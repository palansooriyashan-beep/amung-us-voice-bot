import {
joinVoiceChannel,
VoiceConnectionStatus,
createAudioPlayer,
createAudioResource,
StreamType,
NoSubscriberBehavior
} from "@discordjs/voice";

import prism from "prism-media";
import { PassThrough } from "node:stream";

export class VoiceBridge {

constructor() {
this.aliveConnection = null;
this.deadConnection = null;

this.alivePlayer = null;
this.outputStream = null;

this.speakingHandler = null;
this.speakingStopHandler = null;

this.subscriptions = new Map();
this.audioFrames = new Map();

this.mixTimer = null;

this.connected = false;

}

// ==========================================
// CONNECT
// ==========================================

connect(guild, aliveChannelId, deadChannelId) {

if (this.connected) {
  console.log("ℹ️ Voice Bridge already connected.");
  return;
}

console.log("🚀 Starting Voice Bridge...");

// ========================================
// ALIVE CONNECTION
// ========================================

this.aliveConnection = joinVoiceChannel({
  channelId: aliveChannelId,
  guildId: guild.id,
  adapterCreator: guild.voiceAdapterCreator,

  selfDeaf: false,
  selfMute: true,

  debug: true
});

// ========================================
// DEAD CONNECTION
// ========================================

this.deadConnection = joinVoiceChannel({
  channelId: deadChannelId,
  guildId: guild.id,
  adapterCreator: guild.voiceAdapterCreator,

  selfDeaf: false,
  selfMute: false,

  debug: true
});

this.connected = true;

this.attachConnectionLogs(
  this.aliveConnection,
  "ALIVE"
);

this.attachConnectionLogs(
  this.deadConnection,
  "DEAD"
);

// ========================================
// ALIVE READY
// ========================================

this.aliveConnection.on(
  VoiceConnectionStatus.Ready,
  () => {

    console.log("======================================");
    console.log("🎙️ ALIVE CONNECTION READY");
    console.log(
      "🎧 ALIVE RECEIVER:",
      !!this.aliveConnection.receiver
    );
    console.log("======================================");

    this.setupAliveReceiver();
  }
);

// ========================================
// DEAD READY
// ========================================

this.deadConnection.on(
  VoiceConnectionStatus.Ready,
  () => {

    console.log("======================================");
    console.log("💀 DEAD CONNECTION READY");
    console.log(
      "🔊 DEAD AUDIO OUTPUT READY"
    );
    console.log("======================================");

    this.setupDeadOutput();
  }
);

console.log(
  "🎙️ Voice Bridge connections created."
);

}

// ==========================================
// ALIVE RECEIVER
// ==========================================

setupAliveReceiver() {

if (!this.aliveConnection) {
  return;
}

const receiver =
  this.aliveConnection.receiver;

if (!receiver) {
  console.log(
    "❌ Alive receiver unavailable."
  );
  return;
}

// Remove old handlers
if (this.speakingHandler) {
  receiver.speaking.off(
    "start",
    this.speakingHandler
  );
}

if (this.speakingStopHandler) {
  receiver.speaking.off(
    "end",
    this.speakingStopHandler
  );
}

// ========================================
// SPEAKING START
// ========================================

this.speakingHandler =
  userId => {

    console.log(
      `🎤 ALIVE SPEAKING: ${userId}`
    );

    // Already subscribed
    if (this.subscriptions.has(userId)) {
      return;
    }

    try {

      const opusStream =
        receiver.subscribe(
          userId,
          {
            end: {
              behavior: "silence",
              duration: 100
            }
          }
        );

      // ==================================
      // OPUS → PCM DECODER
      // ==================================

      const decoder =
        new prism.opus.Decoder({
          frameSize: 960,
          channels: 2,
          rate: 48000
        });

      const subscription = {
        opusStream,
        decoder
      };

      this.subscriptions.set(
        userId,
        subscription
      );

      // ==================================
      // DECODE AUDIO
      // ==================================

      opusStream
        .pipe(decoder)
        .on(
          "data",
          pcm => {

            /*
             * Discord sends approximately
             * 20ms PCM frames.
             *
             * Keep the latest frame from
             * each Alive speaker.
             */

            this.audioFrames.set(
              userId,
              Buffer.from(pcm)
            );
          }
        );

      opusStream.on(
        "end",
        () => {

          console.log(
            `🛑 ALIVE AUDIO END: ${userId}`
          );

          this.removeSpeaker(userId);
        }
      );

      opusStream.on(
        "error",
        error => {

          console.error(
            `❌ Audio stream error ${userId}:`,
            error.message
          );

          this.removeSpeaker(userId);
        }
      );

      decoder.on(
        "error",
        error => {

          console.error(
            `❌ Decoder error ${userId}:`,
            error.message
          );

          this.removeSpeaker(userId);
        }
      );

    } catch (error) {

      console.error(
        "❌ Could not subscribe to Alive user:",
        error
      );
    }
  };

// ========================================
// SPEAKING END
// ========================================

this.speakingStopHandler =
  userId => {

    console.log(
      `🛑 ALIVE STOP: ${userId}`
    );

    /*
     * Do not immediately destroy the
     * subscription. Discord's receiver
     * stream handles the silence/end.
     */
  };

receiver.speaking.on(
  "start",
  this.speakingHandler
);

receiver.speaking.on(
  "end",
  this.speakingStopHandler
);

console.log(
  "🎧 Alive receiver ready."
);

}

// ==========================================
// DEAD OUTPUT
// ==========================================

setupDeadOutput() {

if (!this.deadConnection) {
  return;
}

// ========================================
// AUDIO PLAYER
// ========================================

this.alivePlayer =
  createAudioPlayer({
    behaviors: {
      noSubscriber:
        NoSubscriberBehavior.Play
    }
  });

this.alivePlayer.on(
  "error",
  error => {

    console.error(
      "❌ DEAD OUTPUT PLAYER ERROR:",
      error
    );
  }
);

this.alivePlayer.on(
  "stateChange",
  (oldState, newState) => {

    console.log(
      `🔊 DEAD OUTPUT PLAYER: ` +
      `${oldState.status} → ${newState.status}`
    );
  }
);

// ========================================
// OUTPUT STREAM
// ========================================

this.outputStream =
  new PassThrough();

const resource =
  createAudioResource(
    this.outputStream,
    {
      inputType: StreamType.Opus
    }
  );

this.alivePlayer.play(resource);

// ========================================
// BOT TRANSMITS INTO DEAD CHANNEL
// ========================================

this.deadConnection.subscribe(
  this.alivePlayer
);

console.log(
  "🔊 Dead output player subscribed."
);

// ========================================
// START MIXER
// ========================================

this.startMixer();

}

// ==========================================
// AUDIO MIXER
// ==========================================

startMixer() {

if (this.mixTimer) {
  return;
}

/*
 * 48kHz stereo
 * 16-bit PCM
 * 20ms = 3840 bytes
 */

const FRAME_SIZE = 3840;

this.mixTimer =
  setInterval(
    () => {

      if (!this.outputStream) {
        return;
      }

      const frames =
        [...this.audioFrames.values()];

      if (frames.length === 0) {

        /*
         * Send silence when nobody speaks.
         */

        const silence =
          Buffer.alloc(FRAME_SIZE);

        this.writeEncodedFrame(
          silence
        );

        return;
      }

      const mixed =
        Buffer.alloc(FRAME_SIZE);

      // ==================================
      // MIX ALL ALIVE SPEAKERS
      // ==================================

      for (const frame of frames) {

        const length =
          Math.min(
            frame.length,
            FRAME_SIZE
          );

        for (
          let i = 0;
          i < length - 1;
          i += 2
        ) {

          const current =
            mixed.readInt16LE(i);

          const incoming =
            frame.readInt16LE(i);

          let value =
            current + incoming;

          /*
           * Prevent integer overflow.
           */

          if (value > 32767) {
            value = 32767;
          }

          if (value < -32768) {
            value = -32768;
          }

          mixed.writeInt16LE(
            value,
            i
          );
        }
      }

      this.writeEncodedFrame(
        mixed
      );

      /*
       * Frames are consumed every
       * 20ms.
       */
      this.audioFrames.clear();

    },
    20
  );

console.log(
  "🎚️ Audio mixer started."
);

}

// ==========================================
// PCM → OPUS
// ==========================================

writeEncodedFrame(pcm) {

if (!this.outputStream) {
  return;
}

try {

  const encoder =
    new prism.opus.Encoder({
      frameSize: 960,
      channels: 2,
      rate: 48000
    });

  const opus =
    encoder._transform
    ? null
    : null;

  /*
   * Use a temporary encoder for
   * the PCM frame.
   */

  const chunks = [];

  encoder.on(
    "data",
    chunk => {
      chunks.push(
        Buffer.from(chunk)
      );
    }
  );

  encoder.on(
    "end",
    () => {

      if (chunks.length > 0) {

        const packet =
          Buffer.concat(chunks);

        this.outputStream.write(
          packet
        );
      }
    }
  );

  encoder.end(pcm);

} catch (error) {

  console.error(
    "❌ Opus encoder error:",
    error.message
  );
}

}

// ==========================================
// REMOVE SPEAKER
// ==========================================

removeSpeaker(userId) {

this.audioFrames.delete(
  userId
);

const subscription =
  this.subscriptions.get(
    userId
  );

if (subscription) {

  try {
    subscription.opusStream.destroy();
  } catch {}

  try {
    subscription.decoder.destroy();
  } catch {}
}

this.subscriptions.delete(
  userId
);

}

// ==========================================
// CONNECTION LOGS
// ==========================================

attachConnectionLogs(
connection,
name
) {

connection.on(
  "debug",
  message => {

    console.log(
      `🔍 [${name}] ${message}`
    );
  }
);

connection.on(
  "error",
  error => {

    console.error(
      `❌ [${name}]`,
      error.message
    );
  }
);

connection.on(
  "stateChange",
  (
    oldState,
    newState
  ) => {

    console.log(
      `🔄 [${name}]`,
      oldState.status,
      "→",
      newState.status
    );
  }
);

connection.on(
  VoiceConnectionStatus.Disconnected,
  () => {

    console.log(
      `⚠️ [${name}] DISCONNECTED`
    );
  }
);

}

// ==========================================
// DESTROY
// ==========================================

destroy() {

console.log(
  "🛑 Stopping Voice Bridge..."
);

// ========================================
// STOP MIXER
// ========================================

if (this.mixTimer) {

  clearInterval(
    this.mixTimer
  );

  this.mixTimer = null;
}

// ========================================
// REMOVE SPEAKERS
// ========================================

for (
  const userId
  of this.subscriptions.keys()
) {

  this.removeSpeaker(
    userId
  );
}

this.subscriptions.clear();
this.audioFrames.clear();

// ========================================
// RECEIVER LISTENERS
// ========================================

if (
  this.aliveConnection &&
  this.aliveConnection.receiver
) {

  if (this.speakingHandler) {

    this.aliveConnection
      .receiver
      .speaking
      .off(
        "start",
        this.speakingHandler
      );
  }

  if (this.speakingStopHandler) {

    this.aliveConnection
      .receiver
      .speaking
      .off(
        "end",
        this.speakingStopHandler
      );
  }
}

this.speakingHandler = null;
this.speakingStopHandler = null;

// ========================================
// OUTPUT STREAM
// ========================================

if (this.outputStream) {

  try {
    this.outputStream.end();
  } catch {}

  this.outputStream = null;
}

// ========================================
// AUDIO PLAYER
// ========================================

if (this.alivePlayer) {

  try {
    this.alivePlayer.stop();
  } catch {}

  this.alivePlayer = null;
}

// ========================================
// ALIVE CONNECTION
// ========================================

if (this.aliveConnection) {

  try {

    if (
      this.aliveConnection.state.status !==
      VoiceConnectionStatus.Destroyed
    ) {

      this.aliveConnection.destroy();
    }

  } catch {}

  this.aliveConnection = null;
}

// ========================================
// DEAD CONNECTION
// ========================================

if (this.deadConnection) {

  try {

    if (
      this.deadConnection.state.status !==
      VoiceConnectionStatus.Destroyed
    ) {

      this.deadConnection.destroy();
    }

  } catch {}

  this.deadConnection = null;
}

this.connected = false;

console.log(
  "🛑 Voice Bridge stopped."
);

}
}