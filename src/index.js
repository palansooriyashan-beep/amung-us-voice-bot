import {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} from "discord.js";

import { VoiceRouter } from "./voiceRouter.js";

// ================================
// ENVIRONMENT VARIABLES
// ================================

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  throw new Error(
    "Missing DISCORD_TOKEN, CLIENT_ID or GUILD_ID."
  );
}

// ================================
// VOICE CHANNEL IDs
// ================================

const ALIVE_CHANNEL_ID = "1542086495815598080";
const DEAD_CHANNEL_ID = "1327649537468403817";

// ================================
// SLASH COMMANDS
// ================================

const commands = [
  new SlashCommandBuilder()
    .setName("start")
    .setDescription("Start a new Among Us round"),

  new SlashCommandBuilder()
    .setName("alive")
    .setDescription("Mark a player as alive")
    .addUserOption(option =>
      option
        .setName("player")
        .setDescription("Player")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("dead")
    .setDescription("Mark a player as dead")
    .addUserOption(option =>
      option
        .setName("player")
        .setDescription("Player")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Show player status"),

  new SlashCommandBuilder()
    .setName("end")
    .setDescription("End the round")
].map(command => command.toJSON());

// ================================
// REGISTER COMMANDS
// ================================

const rest = new REST({ version: "10" }).setToken(token);

await rest.put(
  Routes.applicationGuildCommands(clientId, guildId),
  {
    body: commands
  }
);

// ================================
// DISCORD CLIENT
// ================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ================================
// VOICE STATE MANAGER
// ================================

const router = new VoiceRouter();

// ================================
// MOVE PLAYER FUNCTION
// ================================

async function movePlayer(guild, userId, channelId) {
  const member = await guild.members.fetch(userId);

  if (!member.voice.channel) {
    throw new Error(
      `${member.user.username} is not connected to a voice channel.`
    );
  }

  await member.voice.setChannel(channelId);
}

// ================================
// BOT READY
// ================================

client.once(Events.ClientReady, readyClient => {
  console.log(
    `✅ Bot online as ${readyClient.user.tag}`
  );
});

// ================================
// COMMAND HANDLER
// ================================

client.on(Events.InteractionCreate, async interaction => {

  if (!interaction.isChatInputCommand()) {
    return;
  }

  try {

    // ============================
    // START ROUND
    // ============================

    if (interaction.commandName === "start") {

      router.startRound(interaction.guild);

      await interaction.reply(
        "🟢 Among Us round started! Everyone is ALIVE."
      );

      return;
    }

    // ============================
    // PLAYER ALIVE
    // ============================

    if (interaction.commandName === "alive") {

      const player =
        interaction.options.getUser("player", true);

      router.setAlive(player.id);

      await movePlayer(
        interaction.guild,
        player.id,
        ALIVE_CHANNEL_ID
      );

      await interaction.reply(
        `🟢 ${player.username} is now ALIVE.`
      );

      return;
    }

    // ============================
    // PLAYER DEAD
    // ============================

    if (interaction.commandName === "dead") {

      const player =
        interaction.options.getUser("player", true);

      router.setDead(player.id);

      await movePlayer(
        interaction.guild,
        player.id,
        DEAD_CHANNEL_ID
      );

      await interaction.reply(
        `💀 ${player.username} is now DEAD.`
      );

      return;
    }

    // ============================
    // STATUS
    // ============================

    if (interaction.commandName === "status") {

      const players = [...router.entries()]
        .map(([id, state]) =>
          `${state === "alive" ? "🟢" : "💀"} <@${id}>`
        )
        .join("\n");

      await interaction.reply(
        players || "No players recorded."
      );

      return;
    }

    // ============================
    // END ROUND
    // ============================

    if (interaction.commandName === "end") {

      router.endRound();

      await interaction.reply(
        "🏁 Among Us round ended."
      );

      return;
    }

  } catch (error) {

    console.error("❌ Error:", error);

    const message =
      "❌ Something went wrong. Check the Railway logs.";

    if (interaction.replied || interaction.deferred) {

      await interaction.followUp({
        content: message,
        ephemeral: true
      });

    } else {

      await interaction.reply({
        content: message,
        ephemeral: true
      });

    }
  }
});

// ================================
// LOGIN
// ================================

client.login(token);