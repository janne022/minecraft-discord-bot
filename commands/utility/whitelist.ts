import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  type ModalActionRowComponentBuilder,
  LabelBuilder,
  MessageFlags,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("whitelist")
  .setDescription("Get added to the minecraft whitelist");

export async function execute(interaction: ChatInputCommandInteraction) {
  const modal = new ModalBuilder()
    .setCustomId("whitelistModal")
    .setTitle("Whitelist Request");

  const minecraftNameInput = new TextInputBuilder()
    .setCustomId("minecraftName")
    .setPlaceholder("e.g. CoolGuy")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
    const labelBuilder = new LabelBuilder().setLabel("Enter your Minecraft username:")
    .setTextInputComponent(minecraftNameInput);

  modal.addLabelComponents(labelBuilder);
  await interaction.showModal(modal);

  const submittedData = await interaction.awaitModalSubmit({
    time: 5 * 60 * 1000,
    filter: (i) => i.customId === "whitelistModal" && i.user.id === interaction.user.id,
  });
  const minecraftName = submittedData.fields.getTextInputValue("minecraftName");

  // TODO: Check if minecraftName is a valid Minecraft username

  // TODO: Use Pterodactyl api to add user to whitelist and run a whitelist reload command
  await submittedData.reply({
    content: `Thank you, ${minecraftName}! You have been added to the whitelist.`,
    flags: MessageFlags.Ephemeral,
  });
}
