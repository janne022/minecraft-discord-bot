import 'dotenv/config';
import {
  REST,
  Routes,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
  ApplicationCommand,
  Client,
  GatewayIntentBits,
} from 'discord.js';
import fs from 'fs';
import path from 'path';

interface MinimalCommand {
  data: {
    name: string;
    toJSON: () => RESTPostAPIChatInputApplicationCommandsJSONBody;
  };
  execute: (...args: any[]) => Promise<any>;
}

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token) throw new Error('[FATAL] DISCORD_TOKEN is not defined in your .env file.');
if (!clientId) throw new Error('[FATAL] CLIENT_ID is not defined in your .env file.');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commandsJson: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
const commandMap = new Map<string, MinimalCommand>();

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
  // Optional: move to Routes.applicationGuildCommands for instant updates during dev
  registerCommands();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = commandMap.get(interaction.commandName);
  if (!command) {
    if (!interaction.replied) await interaction.reply({ content: 'Command not found.', ephemeral: true });
    return;
  }
  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`[command error] ${interaction.commandName}`, err);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: 'There was an error while executing this command.', ephemeral: true });
    } else {
      await interaction.reply({ content: 'There was an error while executing this command.', ephemeral: true });
    }
  }
});

// Crash visibility
process.on('unhandledRejection', (r) => console.error('[unhandledRejection]', r));
process.on('uncaughtException', (e) => console.error('[uncaughtException]', e));

// Login to keep the bot online
client.login(token);

