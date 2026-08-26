import {
  joinVoiceChannel,
  VoiceConnectionStatus
} from "@discordjs/voice";

export class VoiceBridge {
  constructor() {
    this.aliveConnection = null;
    this.deadConnection = null;
  }

  connect(guild, aliveChannelId, deadChannelId) {

    // ==============================
    // ALIVE VOICE CONNECTION
    // ==============================

    this.aliveConnection = joinVoiceChannel({
      channelId: aliveChannelId,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,

      // IMPORTANT:
      // Bot must be able to receive audio.
      selfDeaf: false,
      selfMute: false
    });

    // ==============================
    // DEAD VOICE CONNECTION
    // ==============================

    this.deadConnection = joinVoiceChannel({
      channelId: deadChannelId,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,

      selfDeaf: false,
      selfMute: false
    });

    this.aliveConnection.on(
      VoiceConnectionStatus.Ready,
      () => {
        console.log(
          "🎙️ Alive Voice Bridge: READY"
        );
      }
    );

    this.deadConnection.on(
      VoiceConnectionStatus.Ready,
      () => {
        console.log(
          "💀 Dead Voice Bridge: READY"
        );
      }
    );

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
  }

  destroy() {

    if (this.aliveConnection) {
      this.aliveConnection.destroy();
      this.aliveConnection = null;
    }

    if (this.deadConnection) {
      this.deadConnection.destroy();
      this.deadConnection = null;
    }

    console.log(
      "🛑 Voice Bridge stopped."
    );
  }
}