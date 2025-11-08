import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

// Provides bot and API latency
export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Shows bot latency.');

export async function execute(interaction: ChatInputCommandInteraction) {
  const start = Date.now();
  await interaction.reply({ content: 'Pinging...' });
  const sent = await interaction.fetchReply();
  const apiLatency = sent.createdTimestamp - interaction.createdTimestamp;
  const wsPing = Math.round(interaction.client.ws.ping);
  const roundTrip = Date.now() - start;
  await interaction.editReply(`Pong! API: ${apiLatency}ms | WS: ${wsPing}ms | RTT: ${roundTrip}ms`);
}