import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('server')
  .setDescription('Provides information about the server.');

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inGuild()) {
    await interaction.reply({ content: 'This command can only be run in a server.', ephemeral: true });
    return;
  }

  const guild = interaction.guild!;
  await interaction.reply(`This server is ${guild.name} and has ${guild.memberCount} members.`);
}