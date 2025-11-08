import 'dotenv/config';
import {
  REST,
  Routes,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  ApplicationCommand,
  Client,
  GatewayIntentBits,
  MessageFlags,
} from 'discord.js';
import fs from 'fs';
import path from 'path';

interface MinimalCommand {
  data: {
    name: string;
    toJSON: () => RESTPostAPIChatInputApplicationCommandsJSONBody;
  };
  execute: (...args: any[]) => Promise<any>;
  cooldown?: number;
}

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token) throw new Error('[FATAL] DISCORD_TOKEN is not defined in your .env file.');
if (!clientId) throw new Error('[FATAL] CLIENT_ID is not defined in your .env file.');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commandsJson: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
const commandMap = new Map<string, MinimalCommand>();
const cooldowns = new Map<string, Map<string, number>>();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.existsSync(foldersPath) ? fs.readdirSync(foldersPath) : [];

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith('.ts') || file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const mod = require(filePath);
    const command: MinimalCommand = mod.default ?? mod;

    if (command && 'data' in command && 'execute' in command) {
      commandsJson.push(command.data.toJSON());
      commandMap.set(command.data.name, command);
    } else {
      console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
  }
}

const rest = new REST().setToken(token);

async function registerCommands() {
  try {
    console.log(`Started refreshing ${commandsJson.length} application (/) commands.`);
    const data = (await rest.put(Routes.applicationCommands(clientId!), {
      body: commandsJson,
    })) as ApplicationCommand[];
    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error('[command registration error]', error);
  }
}

// Basic runtime
client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user?.tag}`);
  registerCommands();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = commandMap.get(interaction.commandName);
  if (!command) {
    if (!interaction.replied)
      await interaction.reply({ content: 'Command not found.', flags: MessageFlags.Ephemeral });
    return;
  }

  // Rate limiting check
  if (!cooldowns.has(interaction.commandName)) {
    cooldowns.set(interaction.commandName, new Map());
  }

  const now = Date.now();
  const timestamps = cooldowns.get(interaction.commandName)!;
  const cooldownAmount = (command.cooldown ?? 3) * 1000;

  if (timestamps.has(interaction.user.id)) {
    const expirationTime = timestamps.get(interaction.user.id)! + cooldownAmount;

    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000;
      await interaction.reply({
        content: `Please wait ${timeLeft.toFixed(1)} more second(s) before using \`${interaction.commandName}\` again.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  timestamps.set(interaction.user.id, now);
  setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`[command error] ${interaction.commandName}`, err);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: 'There was an error while executing this command.',
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        content: 'There was an error while executing this command.',
        flags: MessageFlags.Ephemeral,
      });
    }
  }
});

process.on('unhandledRejection', (r) => console.error('[unhandledRejection]', r));
process.on('uncaughtException', (e) => console.error('[uncaughtException]', e));

client.login(token);