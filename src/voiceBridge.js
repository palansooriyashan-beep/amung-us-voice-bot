import {
  joinVoiceChannel,
  VoiceConnectionStatus
} from "@discordjs/voice";

export class VoiceBridge {
  constructor() {
    this.aliveConnection = null;
    this.deadConnection = null;
    this.connected = false;
  }

  connect(guild, aliveChannelId, deadChannelId) {

    // Prevent duplicate connections
    if (this.connected) {
      console.log(
        "ℹ️ Voice Bridge is already connected."
      );
      return;
    }

    // ==========================================
    // ALIVE VOICE CONNECTION
    // ==========================================

    this.aliveConnection = joinVoiceChannel({
      channelId: aliveChannelId,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,

      selfDeaf: false,
      selfMute: false
    });

    // ==========================================
    // DEAD VOICE CONNECTION
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
  // SAFE DESTROY
  // ==========================================

  destroy() {

    // Already stopped
    if (
      !this.aliveConnection &&
      !this.deadConnection
    ) {

      this.connected = false;

      console.log(
        "ℹ️ Voice Bridge already stopped."
      );

      return;
    }

    // ==========================================
    // DESTROY ALIVE CONNECTION
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
    // DESTROY DEAD CONNECTION
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