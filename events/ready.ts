import { Events, ActivityType } from 'discord.js';
import { type Event, CustomClient } from '../types.js';

const clientReadyEvent: Event = {
  name: Events.ClientReady,
  once: true,
  async execute(client: CustomClient) {
    console.log('Bot is starting...');

    if (!client.user) {
      console.log('Ready! Logged in but client.user is null.');
      return;
    }

    console.log(`Ready! Logged in as ${client.user.tag}`);

    // Set the bot's presence
    await client.user.setPresence({
      activities: [
        {
          name: 'Minecraft Bot',
          type: ActivityType.Watching,
        },
      ],
      status: 'online',
    });
  },
};

export = clientReadyEvent;