import {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} from "discord.js";

import { VoiceRouter } from "./voiceRouter.js";

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
// VOICE CHANNEL IDs
// ==========================================

const ALIVE_CHANNEL_ID = "1542086495815598080";
const DEAD_CHANNEL_ID = "1327649537468403817";

// ==========================================
// SLASH COMMANDS
// ==========================================

const commands = [
  new SlashCommandBuilder()
    .setName("start")
    .setDescription("Start a new Among Us round"),

  new SlashCommandBuilder()
    .setName("alive")
    .setDescription("Move a player to Alive Voice")
    .addUserOption(option =>
      option
        .setName("player")
        .setDescription("Discord player")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("dead")
    .setDescription("Move a player to Dead Voice")
    .addUserOption(option =>
      option
        .setName("player")
        .setDescription("Discord player")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Show player status"),

  new SlashCommandBuilder()
    .setName("end")
    .setDescription("End the current round")
].map(command => command.toJSON());

// ==========================================
// REGISTER COMMANDS
// ==========================================

const rest = new REST({
  version: "10"
}).setToken(token);

await rest.put(
  Routes.applicationGuildCommands(clientId, guildId),
  {
    body: commands
  }
);

// ==========================================
// DISCORD CLIENT
// ==========================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ==========================================
// VOICE ROUTER
// ==========================================

const router = new VoiceRouter();

// ==========================================
// MOVE PLAYER
// ==========================================

async function movePlayer(
  guild,
  userId,
  channelId
) {
  const member =
    await guild.members.fetch(userId);

  // Player is not in a voice channel
  if (!member.voice.channelId) {
    return {
      success: false,
      reason: "NOT_IN_VOICE",
      member
    };
  }

  // Player is already in target channel
  if (
    member.voice.channelId === channelId
  ) {
    return {
      success: true,
      reason: "ALREADY_THERE",
      member
    };
  }

  await member.voice.setChannel(channelId);

  return {
    success: true,
    reason: "MOVED",
    member
  };
}

// ==========================================
// BOT READY
// ==========================================

client.once(
  Events.ClientReady,
  readyClient => {
    console.log(
      `✅ Bot online as ${readyClient.user.tag}`
    );
  }
);

// ==========================================
// INTERACTION HANDLER
// ==========================================

client.on(
  Events.InteractionCreate,
  async interaction => {

    if (!interaction.isChatInputCommand()) {
      return;
    }

    try {

      // ======================================
      // /START
      // ======================================

      if (
        interaction.commandName === "start"
      ) {

        router.startRound(
          interaction.guild
        );

        await interaction.reply(
          "🟢 Among Us round started! Everyone is ALIVE."
        );

        return;
      }

      // ======================================
      // /ALIVE
      // ======================================

      if (
        interaction.commandName === "alive"
      ) {

        const player =
          interaction.options.getUser(
            "player",
            true
          );

        router.setAlive(
          player.id
        );

        const result =
          await movePlayer(
            interaction.guild,
            player.id,
            ALIVE_CHANNEL_ID
          );

        if (
          result.reason === "NOT_IN_VOICE"
        ) {

          await interaction.reply(
            `🟢 ${player.username} is marked ALIVE.\n` +
            `⚠️ They are not currently in a Voice Channel.`
          );

          return;
        }

        if (
          result.reason === "ALREADY_THERE"
        ) {

          await interaction.reply(
            `🟢 ${player.username} is already in Alive Voice.`
          );

          return;
        }

        await interaction.reply(
          `🟢 ${player.username} moved to Alive Voice.`
        );

        return;
      }

      // ======================================
      // /DEAD
      // ======================================

      if (
        interaction.commandName === "dead"
      ) {

        const player =
          interaction.options.getUser(
            "player",
            true
          );

        router.setDead(
          player.id
        );

        const result =
          await movePlayer(
            interaction.guild,
            player.id,
            DEAD_CHANNEL_ID
          );

        if (
          result.reason === "NOT_IN_VOICE"
        ) {

          await interaction.reply(
            `💀 ${player.username} is marked DEAD.\n` +
            `⚠️ They are not currently in a Voice Channel.`
          );

          return;
        }

        if (
          result.reason === "ALREADY_THERE"
        ) {

          await interaction.reply(
            `💀 ${player.username} is already in Dead Voice.`
          );

          return;
        }

        await interaction.reply(
          `💀 ${player.username} moved to Dead Voice.`
        );

        return;
      }

      // ======================================
      // /STATUS
      // ======================================

      if (
        interaction.commandName === "status"
      ) {

        const entries = [
          ...router.entries()
        ];

        if (entries.length === 0) {

          await interaction.reply(
            "ℹ️ No players recorded."
          );

          return;
        }

        const players = entries
          .map(
            ([id, state]) =>
              `${
                state === "alive"
                  ? "🟢"
                  : "💀"
              } <@${id}>`
          )
          .join("\n");

        await interaction.reply(
          `🎮 **Player Status**\n\n${players}`
        );

        return;
      }

      // ======================================
      // /END
      // ======================================

      if (
        interaction.commandName === "end"
      ) {

        const guild =
          interaction.guild;

        // Clear old round state
        router.endRound();

        // Get ONLY members currently connected
        // to a voice channel
        const members =
          guild.members.cache.filter(
            member =>
              !member.user.bot &&
              member.voice.channelId !== null
          );

        let moved = 0;
        let alreadyAlive = 0;
        let failed = 0;

        for (
          const member
          of members.values()
        ) {

          try {

            // Already in Alive Voice
            if (
              member.voice.channelId ===
              ALIVE_CHANNEL_ID
            ) {

              alreadyAlive++;
              continue;
            }

            // Move to Alive Voice
            await member.voice.setChannel(
              ALIVE_CHANNEL_ID
            );

            moved++;

          } catch (error) {

            failed++;

            console.error(
              `❌ Failed to move ${member.user.username}:`,
              error.message
            );

          }
        }

        const totalAlive =
          moved + alreadyAlive;

        let reply =
          `🏁 **Round ended!**\n\n` +
          `🟢 Alive Voice: ${totalAlive} player(s)`;

        if (failed > 0) {
          reply +=
            `\n⚠️ Could not move: ${failed} player(s)`;
        }

        await interaction.reply(reply);

        return;
      }

    } catch (error) {

      console.error(
        "❌ Command error:",
        error
      );

      const errorMessage =
        "❌ Something went wrong. Check Railway logs.";

      try {

        if (
          interaction.replied ||
          interaction.deferred
        ) {

          await interaction.followUp({
            content: errorMessage,
            ephemeral: true
          });

        } else {

          await interaction.reply({
            content: errorMessage,
            ephemeral: true
          });

        }

      } catch (replyError) {

        console.error(
          "❌ Could not send error reply:",
          replyError
        );

      }
    }
  }
);

// ==========================================
// LOGIN
// ==========================================

client.login(token);