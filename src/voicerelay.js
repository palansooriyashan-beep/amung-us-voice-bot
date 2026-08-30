import {
  EndBehaviorType,
  createAudioPlayer,
  createAudioResource,
  StreamType
} from "@discordjs/voice";

import prism from "prism-media";

export class VoiceRelay {

  constructor({
    playerState,
    voiceManager
  }) {

    this.playerState =
      playerState;

    this.voiceManager =
      voiceManager;

    this.running =
      false;

    this.subscriptions =
      new Map();

    this.player =
      null;
  }

  // ==========================================
  // START
  // ==========================================

  start() {

    if (this.running) {

      console.log(
        "ℹ️ Voice Relay already running."
      );

      return;
    }

    this.running =
      true;

    console.log(
      "🔊 Voice Relay started."
    );

    this.attachAliveReceiver();
  }

  // ==========================================
  // ALIVE RECEIVER
  // ==========================================

  attachAliveReceiver() {

    const connection =
      this.voiceManager.aliveConnection;

    if (!connection) {

      console.error(
        "❌ Alive voice connection unavailable."
      );

      return;
    }

    const receiver =
      connection.receiver;

    receiver.speaking.on(
      "start",
      userId => {

        this.handleSpeaking(
          receiver,
          userId
        );
      }
    );

    console.log(
      "🎧 Alive voice receiver attached."
    );
  }

  // ==========================================
  // HANDLE SPEAKER
  // ==========================================

  handleSpeaking(
    receiver,
    userId
  ) {

    // ----------------------------------------
    // ONLY ALIVE PLAYERS
    // ----------------------------------------

    if (
      !this.playerState.isAlive(
        userId
      )
    ) {

      console.log(
        `🚫 Ignoring non-alive speaker: ${userId}`
      );

      return;
    }

    // ----------------------------------------
    // ALREADY SUBSCRIBED
    // ----------------------------------------

    if (
      this.subscriptions.has(
        userId
      )
    ) {

      return;
    }

    console.log(
      `🎤 Relaying Alive player: ${userId}`
    );

    try {

      const opusStream =
        receiver.subscribe(
          userId,
          {
            end: {
              behavior:
                EndBehaviorType.AfterSilence,
              duration: 100
            }
          }
        );

      const decoder =
        new prism.opus.Decoder({
          rate: 48000,
          channels: 2,
          frameSize: 960
        });

      opusStream.pipe(
        decoder
      );

      this.subscriptions.set(
        userId,
        {
          opusStream,
          decoder
        }
      );

      decoder.on(
        "data",
        pcm => {

          /*
           * Alive audio reaches here.
           *
           * This PCM data will be sent
           * to the Dead voice output.
           */

          this.sendToDead(
            pcm
          );
        }
      );

      opusStream.on(
        "end",
        () => {

          this.removeSubscription(
            userId
          );
        }
      );

      opusStream.on(
        "error",
        error => {

          console.error(
            `❌ Receive error ${userId}:`,
            error.message
          );

          this.removeSubscription(
            userId
          );
        }
      );

    } catch (error) {

      console.error(
        "❌ Relay error:",
        error
      );
    }
  }

  // ==========================================
  // SEND TO DEAD
  // ==========================================

  sendToDead(pcm) {

    /*
     * Audio output implementation will
     * be connected to the Dead voice
     * connection here.
     */

    if (!this.running) {
      return;
    }

    // Temporary diagnostic
    console.log(
      `🔊 Alive PCM received: ${pcm.length} bytes`
    );
  }

  // ==========================================
  // REMOVE
  // ==========================================

  removeSubscription(
    userId
  ) {

    const subscription =
      this.subscriptions.get(
        userId
      );

    if (!subscription) {
      return;
    }

    try {
      subscription.decoder.destroy();
    } catch {}

    this.subscriptions.delete(
      userId
    );
  }

  // ==========================================
  // STOP
  // ==========================================

  stop() {

    console.log(
      "🛑 Stopping Voice Relay..."
    );

    for (
      const userId
      of this.subscriptions.keys()
    ) {

      this.removeSubscription(
        userId
      );
    }

    this.subscriptions.clear();

    this.running =
      false;

    console.log(
      "🛑 Voice Relay stopped."
    );
  }
}