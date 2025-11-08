import 'dotenv/config';
import { REST, Routes, type RESTPostAPIChatInputApplicationCommandsJSONBody, ApplicationCommand } from 'discord.js';
import fs from 'fs';
import path from 'path';

interface MinimalCommand {
  data: {
    name: string;
    toJSON: () => RESTPostAPIChatInputApplicationCommandsJSONBody;
  };
  execute: (...args: any[]) => any;
}

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token) {
  throw new Error('[FATAL] DISCORD_TOKEN is not defined in your .env file.');
}
if (!clientId) {
  throw new Error('[FATAL] CLIENT_ID is not defined in your .env file.');
}

const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith('.ts'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath) as MinimalCommand;

    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      );
    }
  }
}

const rest = new REST().setToken(token);

(async () => {
  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`
    );

    const data = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands },
    ) as ApplicationCommand[];

    console.log(
      `Successfully reloaded ${data.length} application (/) commands.`
    );
  } catch (error) {
    console.error(error);
  }
})();