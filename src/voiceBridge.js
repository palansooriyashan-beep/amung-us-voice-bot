import {
  joinVoiceChannel,
  VoiceConnectionStatus
} from "@discordjs/voice";

export class VoiceBridge {
  constructor() {
    this.aliveConnection = null;
    this.deadConnection = null;

    this.speakingHandler = null;
    this.connected = false;
  }

  connect(guild, aliveChannelId, deadChannelId) {

    if (this.connected) {
      console.log("ℹ️ Voice Bridge already connected.");
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

        this.setupReceiverDiagnostic();
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
    // DISCONNECT
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
  // RECEIVER DIAGNOSTIC
  // ==========================================

  setupReceiverDiagnostic() {

    if (!this.aliveConnection) {
      console.log(
        "❌ Alive connection missing."
      );
      return;
    }

    const receiver =
      this.aliveConnection.receiver;

    console.log(
      "🎧 Voice Receiver initialized."
    );

    console.log(
      "🎧 Receiver exists:",
      !!receiver
    );

    console.log(
      "🎧 Speaking exists:",
      !!receiver.speaking
    );

    console.log(
      "🎧 Speaking listener count BEFORE:",
      receiver.speaking.listenerCount("start")
    );

    // Prevent duplicate listener
    if (this.speakingHandler) {
      return;
    }

    this.speakingHandler =
      userId => {

        console.log(
          "======================================"
        );

        console.log(
          `🔥 SPEAKING EVENT RECEIVED`
        );

        console.log(
          `👤 User ID: ${userId}`
        );

        console.log(
          "======================================"
        );
      };

    receiver.speaking.on(
      "start",
      this.speakingHandler
    );

    console.log(
      "🎧 Speaking listener attached."
    );

    console.log(
      "🎧 Speaking listener count AFTER:",
      receiver.speaking.listenerCount("start")
    );
  }

  // ==========================================
  // DESTROY
  // ==========================================

  destroy() {

    console.log(
      "🛑 Stopping Voice Bridge..."
    );

    // Remove receiver listener
    if (
      this.aliveConnection &&
      this.speakingHandler
    ) {

      try {

        this.aliveConnection.receiver.speaking.off(
          "start",
          this.speakingHandler
        );

      } catch (error) {

        console.log(
          "ℹ️ Speaking listener cleanup:",
          error.message
        );
      }
    }

    this.speakingHandler = null;

    // ==========================================
    // ALIVE DESTROY
    // ==========================================

    if (this.aliveConnection) {

      try {

        if (
          this.aliveConnection.state.status !==
          VoiceConnectionStatus.Destroyed
        ) {

          this.aliveConnection.destroy();
        }

      } catch (error) {

        console.log(
          "ℹ️ Alive connection already destroyed."
        );
      }

      this.aliveConnection = null;
    }

    // ==========================================
    // DEAD DESTROY
    // ==========================================

    if (this.deadConnection) {

      try {

        if (
          this.deadConnection.state.status !==
          VoiceConnectionStatus.Destroyed
        ) {

          this.deadConnection.destroy();
        }

      } catch (error) {

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