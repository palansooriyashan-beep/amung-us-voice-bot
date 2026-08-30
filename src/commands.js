import {
  REST,
  Routes,
  SlashCommandBuilder
} from "discord.js";

export async function registerCommands(
  token,
  clientId,
  guildId
) {

  const commands = [

    new SlashCommandBuilder()
      .setName("start")
      .setDescription(
        "Start a new Among Us round"
      ),

    new SlashCommandBuilder()
      .setName("dead")
      .setDescription(
        "Mark a player as dead"
      )
      .addUserOption(option =>
        option
          .setName("player")
          .setDescription(
            "Discord player"
          )
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("alive")
      .setDescription(
        "Mark a player as alive"
      )
      .addUserOption(option =>
        option
          .setName("player")
          .setDescription(
            "Discord player"
          )
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("status")
      .setDescription(
        "Show player status"
      ),

    new SlashCommandBuilder()
      .setName("end")
      .setDescription(
        "End the current round"
      )

  ].map(
    command =>
      command.toJSON()
  );

  const rest =
    new REST({
      version: "10"
    }).setToken(token);

  await rest.put(
    Routes.applicationGuildCommands(
      clientId,
      guildId
    ),
    {
      body: commands
    }
  );
}