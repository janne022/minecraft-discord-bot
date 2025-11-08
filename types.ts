import {
  Client,
  Collection,
  CommandInteraction,
  SlashCommandBuilder,
  type ClientEvents,
} from 'discord.js';

export interface Command {
  data:
    | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>
    | SlashCommandBuilder;
  execute: (interaction: CommandInteraction) => Promise<void> | void;
}

export interface Event {
  name: keyof ClientEvents;
  once?: boolean;
  execute: (...args: any[]) => Promise<void> | void;
}

export class CustomClient extends Client {
  public commands: Collection<string, Command> = new Collection();
}