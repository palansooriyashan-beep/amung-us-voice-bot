import {
  joinVoiceChannel,
  VoiceConnectionStatus,
  EndBehaviorType
} from "@discordjs/voice";

export class VoiceBridge {
  constructor() {
    this.aliveConnection = null;
    this.deadConnection = null;

    this.subscriptions = new Map();

    this.connected = false;
    this.speakingHandler = null;
  }

  // ==========================================
  // CONNECT ALIVE + DEAD
  // ==========================================

  connect(guild, aliveChannelId, deadChannelId) {

    if (this.connected) {
      console.log(
        "ℹ️ Voice Bridge already connected."
      );
      return;
    }

    // ==========================================
    // ALIVE CONNECTION
    // ==========================================

    this.aliveConnection = joinVoiceChannel({
      channelId: aliveChannelId,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: true
    });

    // ==========================================
    // DEAD CONNECTION
    // ==========================================

    this.deadConnection = joinVoiceChannel({
      channelId: deadChannelId,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: true
    });

    this.connected = true;

    // ==========================================
    // ALIVE READY
    // ==========================================

    this.aliveConnection.on(
      VoiceConnectionStatus.Ready,
      () => {

        console.log(
          "🎙️ Alive Voice Bridge: READY"
        );

        const receiver =
          this.aliveConnection.receiver;

        console.log(
          "🎧 Receiver exists:",
          !!receiver
        );

        console.log(
          "🎧 Speaking emitter exists:",
          !!receiver.speaking
        );

        this.startAudioForwarding();
      }
    );

    // ==========================================
    // DEAD READY
    // ==========================================

    this.deadConnection.on(
      VoiceConnectionStatus.Ready,
      () => {

        console.log(
          "💀 Dead Voice Bridge: READY"
        );
      }
    );

    // ==========================================
    // ALIVE DISCONNECTED
    // ==========================================

    this.aliveConnection.on(
      VoiceConnectionStatus.Disconnected,
      () => {

        console.log(
          "⚠️ Alive Voice Bridge disconnected."
        );
      }
    );

    // ==========================================
    // DEAD DISCONNECTED
    // ==========================================

    this.deadConnection.on(
      VoiceConnectionStatus.Disconnected,
      () => {

        console.log(
          "⚠️ Dead Voice Bridge disconnected."
        );
      }
    );

    console.log(
      "🎙️ Voice Bridge connections started."
    );
  }

  // ==========================================
  // AUDIO FORWARDING
  // ALIVE → DEAD
  // ==========================================

  startAudioForwarding() {

    if (
      !this.aliveConnection ||
      !this.deadConnection
    ) {

      console.log(
        "❌ Audio forwarding: connections missing."
      );

      return;
    }

    if (this.speakingHandler) {
      return;
    }

    const receiver =
      this.aliveConnection.receiver;

    // ==========================================
    // SPEAKING EVENT
    // ==========================================

    this.speakingHandler =
      userId => {

        console.log(
          `🔥 SPEAKING START EVENT: ${userId}`
        );

        // Prevent duplicate stream
        if (
          this.subscriptions.has(userId)
        ) {

          console.log(
            `ℹ️ Already receiving ${userId}`
          );

          return;
        }

        let stream;

        try {

          stream =
            receiver.subscribe(
              userId,
              {
                end: {
                  behavior:
                    EndBehaviorType.AfterSilence,

                  duration: 250
                }
              }
            );

        } catch (error) {

          console.error(
            `❌ Subscribe error (${userId}):`,
            error.message
          );

          return;
        }

        this.subscriptions.set(
          userId,
          stream
        );

        console.log(
          `🎧 AUDIO STREAM STARTED: ${userId}`
        );

        let packetCount = 0;

        // ========================================
        // RECEIVE OPUS
        // ========================================

        stream.on(
          "data",
          packet => {

            packetCount++;

            if (packetCount === 1) {

              console.log(
                `📡 FIRST OPUS PACKET: ${userId}`
              );
            }

            if (
              packetCount % 50 === 0
            ) {

              console.log(
                `📡 ${userId}: ${packetCount} packets`
              );
            }

            if (
              !this.deadConnection
            ) {
              return;
            }

            try {

              this.deadConnection.playOpusPacket(
                packet
              );

            } catch (error) {

              console.error(
                `❌ PLAY OPUS ERROR (${userId}):`,
                error.message
              );
            }
          }
        );

        // ========================================
        // STREAM END
        // ========================================

        stream.once(
          "end",
          () => {

            console.log(
              `🔇 AUDIO STREAM ENDED: ${userId} | ` +
              `${packetCount} packets`
            );

            this.subscriptions.delete(
              userId
            );
          }
        );

        // ========================================
        // STREAM ERROR
        // ========================================

        stream.once(
          "error",
          error => {

            console.error(
              `❌ AUDIO STREAM ERROR (${userId}):`,
              error.message
            );

            this.subscriptions.delete(
              userId
            );
          }
        );
      };

    // ==========================================
    // ATTACH SPEAKING LISTENER
    // ==========================================

    receiver.speaking.on(
      "start",
      this.speakingHandler
    );

    console.log(
      "🎙️ Alive → Dead audio forwarding ENABLED."
    );
  }

  // ==========================================
  // STOP FORWARDING
  // ==========================================

  stopAudioForwarding() {

    if (
      this.aliveConnection &&
      this.speakingHandler
    ) {

      this.aliveConnection.receiver.speaking.off(
        "start",
        this.speakingHandler
      );
    }

    this.speakingHandler = null;

    // Destroy streams
    for (
      const stream
      of this.subscriptions.values()
    ) {

      try {
        stream.destroy();
      } catch {
        // Already destroyed
      }
    }

    this.subscriptions.clear();

    console.log(
      "🛑 Audio forwarding stopped."
    );
  }

  // ==========================================
  // SAFE DESTROY
  // ==========================================

  destroy() {

    this.stopAudioForwarding();

    // ==========================================
    // ALIVE
    // ==========================================

    if (this.aliveConnection) {

      try {

        if (
          this.aliveConnection.state.status !==
          VoiceConnectionStatus.Destroyed
        ) {

          this.aliveConnection.destroy();
        }

      } catch {
        console.log(
          "ℹ️ Alive connection already destroyed."
        );
      }

      this.aliveConnection = null;
    }

    // ==========================================
    // DEAD
    // ==========================================

    if (this.deadConnection) {

      try {

        if (
          this.deadConnection.state.status !==
          VoiceConnectionStatus.Destroyed
        ) {

          this.deadConnection.destroy();
        }

      } catch {
        console.log(
          "ℹ️ Dead connection already destroyed."
        );
      }

      this.deadConnection = null;
    }

    this.connected = false;

    console.log(
      "🛑 Voice Bridge stopped."
    );
  }
}