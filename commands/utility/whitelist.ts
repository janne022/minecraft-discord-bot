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
import { PterodactylClient } from "../../utility/pterodactyl";
import axios from "axios";

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

  // Check if minecraftName is a valid Minecraft username
  try {
    const mojangResponse = await axios.get(
      `https://api.mojang.com/users/profiles/minecraft/${minecraftName}`
    );
    
    if (!mojangResponse.data || !mojangResponse.data.id) {
      await submittedData.reply({
        content: `Sorry, "${minecraftName}" is not a valid Minecraft username.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const uuid = mojangResponse.data.id;
    const formattedUuid = `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;

    // Use Pterodactyl api to add user to whitelist and run a whitelist reload command
    const pterodactyl = new PterodactylClient({
      apiUrl: process.env.PTERODACTYL_URL || "",
      apiKey: process.env.PTERODACTYL_API_KEY || "",
      serverId: process.env.PTERODACTYL_SERVER_ID || "",
    });

    await pterodactyl.addToWhitelist({
      uuid: formattedUuid,
      name: mojangResponse.data.name,
    });

    // Send whitelist reload command to the server
    await pterodactyl.sendCommand("whitelist reload");

    await submittedData.reply({
      content: `Thank you, ${mojangResponse.data.name}! You have been added to the whitelist.`,
      flags: MessageFlags.Ephemeral,
    });
  } catch (error: any) {
    console.error("Whitelist error:", error);
    
    let errorMessage = "An error occurred while processing your request.";
    if (error.response?.status === 404) {
      errorMessage = `Sorry, "${minecraftName}" is not a valid Minecraft username.`;
    } else if (error.message?.includes("already whitelisted")) {
      errorMessage = `${minecraftName} is already on the whitelist!`;
    }

    await submittedData.reply({
      content: errorMessage,
      flags: MessageFlags.Ephemeral,
    });
  }
}
