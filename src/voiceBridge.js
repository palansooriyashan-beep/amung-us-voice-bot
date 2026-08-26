import {
  joinVoiceChannel,
  VoiceConnectionStatus,
  EndBehaviorType
} from "@discordjs/voice";

export class VoiceBridge {
  constructor() {
    this.aliveConnection = null;
    this.deadConnection = null;

    // Active audio subscriptions
    this.subscriptions = new Map();

    this.connected = false;
    this.speakingHandler = null;
  }

  // ==========================================
  // CONNECT BOTH VOICE CHANNELS
  // ==========================================

  connect(guild, aliveChannelId, deadChannelId) {

    // Prevent duplicate connections
    if (this.connected) {
      console.log(
        "ℹ️ Voice Bridge is already connected."
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

      // Required for receiving voice
      selfDeaf: false,
      selfMute: false
    });

    // ==========================================
    // DEAD CONNECTION
    // ==========================================

    this.deadConnection = joinVoiceChannel({
      channelId: deadChannelId,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,

      selfDeaf: false,
      selfMute: false
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
    // DISCONNECTED EVENTS
    // ==========================================

    this.aliveConnection.on(
      VoiceConnectionStatus.Disconnected,
      () => {

        console.log(
          "⚠️ Alive Voice Bridge disconnected."
        );
      }
    );

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
  // START ALIVE → DEAD AUDIO FORWARDING
  // ==========================================

  startAudioForwarding() {

    if (
      !this.aliveConnection ||
      !this.deadConnection
    ) {
      console.log(
        "⚠️ Cannot start audio forwarding. Connections missing."
      );

      return;
    }

    // Prevent duplicate listener
    if (this.speakingHandler) {
      return;
    }

    const receiver =
      this.aliveConnection.receiver;

    this.speakingHandler =
      (userId) => {

        // Already receiving this user's audio
        if (
          this.subscriptions.has(userId)
        ) {
          return;
        }

        console.log(
          `🎙️ Alive player speaking: ${userId}`
        );

        // ======================================
        // SUBSCRIBE TO ALIVE PLAYER
        // ======================================

        let stream;

        try {

          stream =
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

        } catch (error) {

          console.error(
            `❌ Could not subscribe to ${userId}:`,
            error.message
          );

          return;
        }

        this.subscriptions.set(
          userId,
          stream
        );

        // ======================================
        // FORWARD OPUS PACKETS
        // ALIVE → DEAD
        // ======================================

        stream.on(
          "data",
          packet => {

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
                `❌ Audio forwarding error (${userId}):`,
                error.message
              );
            }
          }
        );

        // ======================================
        // PLAYER STOPPED SPEAKING
        // ======================================

        stream.once(
          "end",
          () => {

            this.subscriptions.delete(
              userId
            );

            console.log(
              `🔇 Alive player stopped speaking: ${userId}`
            );
          }
        );

        stream.once(
          "error",
          error => {

            this.subscriptions.delete(
              userId
            );

            console.error(
              `❌ Audio stream error (${userId}):`,
              error.message
            );
          }
        );
      };

    // ==========================================
    // LISTEN FOR ALIVE SPEAKERS
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
  // STOP AUDIO FORWARDING
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

    // Destroy active subscriptions
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

    // Stop audio first
    this.stopAudioForwarding();

    // ==========================================
    // ALIVE CONNECTION
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
    // DEAD CONNECTION
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