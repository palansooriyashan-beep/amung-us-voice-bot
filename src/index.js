import {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} from "discord.js";

import { VoiceRouter } from "./voiceRouter.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const router = new VoiceRouter();

const ALIVE_CHANNEL_ID = "1542086495815598080";
const DEAD_CHANNEL_ID = "1327649537468403817";

async function movePlayer(guild, userId, channelId) {
  const member = await guild.members.fetch(userId);
  await member.voice.setChannel(channelId);
}

if (interaction.commandName === "alive") {
  const player = interaction.options.getUser("player");

  router.setAlive(player.id);

  await movePlayer(
    interaction.guild,
    player.id,
    ALIVE_CHANNEL_ID
  );

  await interaction.reply(
    `🟢 ${player.username} is now ALIVE.`
  );
}

if (interaction.commandName === "dead") {
  const player = interaction.options.getUser("player");

  router.setDead(player.id);

  await movePlayer(
    interaction.guild,
    player.id,
    DEAD_CHANNEL_ID
  );

  await interaction.reply(
    `💀 ${player.username} is now DEAD.`
  );
}
if (!token || !clientId || !guildId) {
  throw new Error(
    "Missing DISCORD_TOKEN, CLIENT_ID or GUILD_ID."
  );
}

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

const rest = new REST({ version: "10" }).setToken(token);

await rest.put(
  Routes.applicationGuildCommands(clientId, guildId),
  { body: commands }
);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const router = new VoiceRouter();

client.once(Events.ClientReady, client => {
  console.log(`Bot online as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "start") {
    router.startRound(interaction.guild);

    await interaction.reply(
      "🟢 Among Us round started! Everyone is ALIVE."
    );
  }

  if (interaction.commandName === "alive") {
    const player = interaction.options.getUser("player");

    router.setAlive(player.id);

    await interaction.reply(
      `🟢 ${player.username} is now ALIVE.`
    );
  }

  if (interaction.commandName === "dead") {
    const player = interaction.options.getUser("player");

    router.setDead(player.id);

    await interaction.reply(
      `💀 ${player.username} is now DEAD.`
    );
  }

  if (interaction.commandName === "status") {
    const players = [...router.entries()]
      .map(([id, state]) =>
        `${state === "alive" ? "🟢" : "💀"} <@${id}>`
      )
      .join("\n");

    await interaction.reply(
      players || "No players recorded."
    );
  }

  if (interaction.commandName === "end") {
    router.endRound();

    await interaction.reply(
      "🏁 Round ended."
    );
  }
});

client.login(token);