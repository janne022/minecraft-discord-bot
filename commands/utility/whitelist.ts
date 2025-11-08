import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  LabelBuilder,
  MessageFlags,
} from "discord.js";
import { PterodactylClient } from "../../utility/pterodactyl";
import { whitelistDb } from "../../utility/database";
import axios from "axios";

export const data = new SlashCommandBuilder()
  .setName("whitelist")
  .setDescription("Get added to the minecraft whitelist");

export async function execute(interaction: ChatInputCommandInteraction) {
  // Check if user already has a whitelist entry
  const existingEntry = whitelistDb.getEntryByDiscordId(interaction.user.id);

  const modal = new ModalBuilder()
    .setCustomId("whitelistModal")
    .setTitle("Whitelist Request");

  const minecraftNameInput = new TextInputBuilder()
    .setCustomId("minecraftName")
    .setPlaceholder("e.g. CoolGuy")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(16);

  // Pre-fill with existing Minecraft name if available
  if (existingEntry) {
    minecraftNameInput.setValue(existingEntry.minecraftName);
  }

  const labelBuilder = new LabelBuilder()
    .setLabel(
      existingEntry
        ? "Update your Minecraft username:"
        : "Enter your Minecraft username:"
    )
    .setTextInputComponent(minecraftNameInput);

  // Show modal
  modal.addLabelComponents(labelBuilder);
  await interaction.showModal(modal);

  // Wait for modal submission, times out after 5 min
  let submittedData;
  try {
    submittedData = await interaction.awaitModalSubmit({
      time: 5 * 60 * 1000,
      filter: (i) =>
        i.customId === "whitelistModal" && i.user.id === interaction.user.id,
    });
  } catch (error) {
    console.log(`Whitelist modal timed out for user ${interaction.user.tag}`);
    return;
  }

  // Sanitize and validate input
  const rawMinecraftName = submittedData.fields
    .getTextInputValue("minecraftName")
    .trim();

  // Validate Minecraft username format
  const minecraftUsernameRegex = /^[a-zA-Z0-9_]{3,16}$/;
  if (!minecraftUsernameRegex.test(rawMinecraftName)) {
    await submittedData.reply({
      content: `Invalid username format. Minecraft usernames must be 3-16 characters long and contain only letters, numbers, and underscores.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check if another Discord user already has this Minecraft name
  const existingMinecraftEntry =
    whitelistDb.getEntryByMinecraftName(rawMinecraftName);
  if (
    existingMinecraftEntry &&
    existingMinecraftEntry.discordId !== interaction.user.id
  ) {
    await submittedData.reply({
      content: `This Minecraft username is already registered to another Discord user.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check if minecraftName is a valid Minecraft username via Mojang API
  try {
    const mojangResponse = await axios.get(
      `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(
        rawMinecraftName
      )}`
    );

    if (!mojangResponse.data || !mojangResponse.data.id) {
      await submittedData.reply({
        content: `Sorry, "${rawMinecraftName}" is not a valid Minecraft username.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const uuid = mojangResponse.data.id;
    const formattedUuid = `${uuid.slice(0, 8)}-${uuid.slice(
      8,
      12
    )}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;

    // Update minecraftName to use mojang's response
    const minecraftName = mojangResponse.data.name;

    // Save to database
    const isUpdate = !!existingEntry;
    const dbEntry = whitelistDb.upsertWhitelistEntry(
      interaction.user.id,
      minecraftName,
      formattedUuid
    );

    if (!dbEntry) {
      await submittedData.reply({
        content: `Failed to save your whitelist entry to the database. Please try again later.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // If database entry saved successfully, sync with Pterodactyl
    try {
      const pterodactyl = new PterodactylClient({
        apiUrl: process.env.PTERODACTYL_URL || "",
        apiKey: process.env.PTERODACTYL_API_KEY || "",
        serverId: process.env.PTERODACTYL_SERVER_ID || "",
      });

      // Sync the entire database to the whitelist file
      await pterodactyl.syncWhitelistFromDatabase();

      // Send whitelist reload command to the server
      await pterodactyl.sendCommand("whitelist reload");

      const message = isUpdate
        ? `Your Minecraft username has been updated to ${minecraftName}!`
        : `Thank you, ${minecraftName}! You have been added to the whitelist.`;

      await submittedData.reply({
        content: message,
        flags: MessageFlags.Ephemeral,
      });
    } catch (pterodactylError: any) {
      console.error("Pterodactyl sync error:", pterodactylError);

      // Database entry was saved, but Pterodactyl sync failed
      await submittedData.reply({
        content: `Your entry was saved, but there was an error syncing with the server.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error: any) {
    console.error("Whitelist error:", error);

    let errorMessage = "An error occurred while processing your request.";
    if (error.response?.status === 404) {
      errorMessage = `Sorry, "${rawMinecraftName}" is not a valid Minecraft username.`;
    } else if (axios.isAxiosError(error)) {
      errorMessage = `Unable to verify Minecraft username. Please try again later.`;
    }

    await submittedData.reply({
      content: errorMessage,
      flags: MessageFlags.Ephemeral,
    });
  }
}
