import {
  Client,
  Events,
  GatewayIntentBits
} from "discord.js";

import { PlayerState } from "./playerState.js";
import { VoiceManager } from "./voiceManager.js";
import { VoiceRelay } from "./voiceRelay.js";
import { registerCommands } from "./commands.js";

// ==========================================
// ENVIRONMENT VARIABLES
// ==========================================

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  throw new Error(
    "Missing DISCORD_TOKEN, CLIENT_ID or GUILD_ID."
  );
}

// ==========================================
// VOICE CHANNEL IDS
// ==========================================

const ALIVE_CHANNEL_ID = "1542086495815598080";
const DEAD_CHANNEL_ID = "1327649537468403817";

// ==========================================
// SYSTEM
// ==========================================

const playerState = new PlayerState();

const voiceManager = new VoiceManager({
  aliveChannelId: ALIVE_CHANNEL_ID,
  deadChannelId: DEAD_CHANNEL_ID
});

const voiceRelay = new VoiceRelay({
  playerState,
  voiceManager
});

// ==========================================
// DISCORD CLIENT
// ==========================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// ==========================================
// READY
// ==========================================

client.once(
  Events.ClientReady,
  async readyClient => {

    console.log(
      `✅ Bot online as ${readyClient.user.tag}`
    );

    console.log(
      "🎮 Among Us Voice System ready."
    );

    try {

      await registerCommands(
        token,
        clientId,
        guildId
      );

      console.log(
        "✅ Slash commands registered."
      );

    } catch (error) {

      console.error(
        "❌ Command registration failed:",
        error
      );
    }
  }
);

// ==========================================
// VOICE STATE UPDATE
// ==========================================

client.on(
  Events.VoiceStateUpdate,
  async (oldState, newState) => {

    const member = newState.member;

    if (!member || member.user.bot) {
      return;
    }

    console.log(
      `🎙️ Voice update: ${member.user.username} | ` +
      `${oldState.channelId ?? "NONE"} → ` +
      `${newState.channelId ?? "NONE"}`
    );
  }
);

// ==========================================
// COMMAND HANDLER
// ==========================================

client.on(
  Events.InteractionCreate,
  async interaction => {

    if (!interaction.isChatInputCommand()) {
      return;
    }

    try {

      // ======================================
      // START
      // ======================================

      if (
        interaction.commandName === "start"
      ) {

        const guild =
          interaction.guild;

        const memberIds =
          guild.members.cache
            .filter(
              member =>
                !member.user.bot
            )
            .map(
              member =>
                member.id
            );

        playerState.startRound(
          memberIds
        );

        await voiceManager.start(
          guild
        );

        voiceRelay.start();

        await interaction.reply(
          "🟢 **Among Us round started!**\n\n" +
          "Everyone is ALIVE."
        );

        return;
      }

      // ======================================
      // DEAD
      // ======================================

      if (
        interaction.commandName === "dead"
      ) {

        const player =
          interaction.options.getUser(
            "player",
            true
          );

        playerState.setDead(
          player.id
        );

        await voiceManager.moveToDead(
          interaction.guild,
          player.id
        );

        await interaction.reply(
          `💀 **${player.username} is DEAD!**`
        );

        return;
      }

      // ======================================
      // ALIVE
      // ======================================

      if (
        interaction.commandName === "alive"
      ) {

        const player =
          interaction.options.getUser(
            "player",
            true
          );

        playerState.setAlive(
          player.id
        );

        await voiceManager.moveToAlive(
          interaction.guild,
          player.id
        );

        await interaction.reply(
          `🟢 **${player.username} is ALIVE!**`
        );

        return;
      }

      // ======================================
      // STATUS
      // ======================================

      if (
        interaction.commandName === "status"
      ) {

        const entries =
          [...playerState