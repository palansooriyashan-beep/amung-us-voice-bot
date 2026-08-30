import {
  joinVoiceChannel,
  VoiceConnectionStatus
} from "@discordjs/voice";

export class VoiceManager {

  constructor({
    aliveChannelId,
    deadChannelId
  }) {

    this.aliveChannelId =
      aliveChannelId;

    this.deadChannelId =
      deadChannelId;

    this.aliveConnection =
      null;

    this.deadConnection =
      null;

    this.started =
      false;
  }

  // ==========================================
  // START
  // ==========================================

  async start(guild) {

    if (this.started) {

      console.log(
        "ℹ️ Voice Manager already running."
      );

      return;
    }

    console.log(
      "🚀 Starting Voice Manager..."
    );

    this.aliveConnection =
      joinVoiceChannel({
        channelId:
          this.aliveChannelId,

        guildId:
          guild.id,

        adapterCreator:
          guild.voiceAdapterCreator,

        selfDeaf: false,
        selfMute: true,

        debug: true
      });

    this.deadConnection =
      joinVoiceChannel({
        channelId:
          this.deadChannelId,

        guildId:
          guild.id,

        adapterCreator:
          guild.voiceAdapterCreator,

        selfDeaf: false,
        selfMute: true,

        debug: true
      });

    this.setupLogs(
      this.aliveConnection,
      "ALIVE"
    );

    this.setupLogs(
      this.deadConnection,
      "DEAD"
    );

    this.started =
      true;

    console.log(
      "✅ Voice Manager started."
    );
  }

  // ==========================================
  // MOVE TO ALIVE
  // ==========================================

  async moveToAlive(
    guild,
    userId
  ) {

    const member =
      await guild.members.fetch(
        userId
      );

    if (!member.voice.channelId) {

      throw new Error(
        `${member.user.username} is not in voice.`
      );
    }

    await member.voice.setChannel(
      this.aliveChannelId
    );

    console.log(
      `🟢 ${member.user.username} → ALIVE`
    );
  }

  // ==========================================
  // MOVE TO DEAD
  // ==========================================

  async moveToDead(
    guild,
    userId
  ) {

    const member =
      await guild.members.fetch(
        userId
      );

    if (!member.voice.channelId) {

      throw new Error(
        `${member.user.username} is not in voice.`
      );
    }

    await member.voice.setChannel(
      this.deadChannelId
    );

    console.log(
      `💀 ${member.user.username} → DEAD`
    );
  }

  // ==========================================
  // END
  // ==========================================

  async end(guild) {

    console.log(
      "🏁 Ending Voice Manager..."
    );

    const members =
      guild.members.cache.filter(
        member =>
          !member.user.bot &&
          member.voice.channelId !== null
      );

    for (
      const member
      of members.values()
    ) {

      try {

        await member.voice.setChannel(
          this.aliveChannelId
        );

      } catch (error) {

        console.error(
          `❌ Could not move ${member.user.username}:`,
          error.message
        );
      }
    }

    this.destroy();

    console.log(
      "✅ Voice Manager ended."
    );
  }

  // ==========================================
  // LOGS
  // ==========================================

  setupLogs(
    connection,
    name
  ) {

    connection.on(
      VoiceConnectionStatus.Ready,
      () => {

        console.log(
          `🎙️ ${name} voice connection READY`
        );
      }
    );

    connection.on(
      VoiceConnectionStatus.Disconnected,
      () => {

        console.log(
          `⚠️ ${name} voice disconnected`
        );
      }
    );

    connection.on(
      "error",
      error => {

        console.error(
          `❌ ${name} voice error:`,
          error.message
        );
      }
    );
  }

  // ==========================================
  // DESTROY
  // ==========================================

  destroy() {

    if (this.aliveConnection) {

      try {
        this.aliveConnection.destroy();
      } catch {}
    }

    if (this.deadConnection) {

      try {
        this.deadConnection.destroy();
      } catch {}
    }

    this.aliveConnection =
      null;

    this.deadConnection =
      null;

    this.started =
      false;
  }
}