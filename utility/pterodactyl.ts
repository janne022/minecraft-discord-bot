import axios, { type AxiosInstance } from "axios";
import { whitelistDb } from "./database";

interface PterodactylConfig {
  apiUrl: string;
  apiKey: string;
  serverId: string;
}

interface WhitelistPlayer {
  uuid: string;
  name: string;
}

export class PterodactylClient {
  private client: AxiosInstance;
  private serverId: string;

  constructor(config: PterodactylConfig) {
    this.serverId = config.serverId;
    this.client = axios.create({
      baseURL: config.apiUrl,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
  }

  /**
   * Send a command to the Minecraft server
   */
  async sendCommand(command: string): Promise<void> {
    try {
      await this.client.post(
        `/api/client/servers/${this.serverId}/command`,
        { command }
      );
    } catch (error) {
      console.error("Error sending command:", error);
      throw error;
    }
  }

  /**
   * Read the current whitelist.json file from the server
   */
  async getWhitelistFile(): Promise<WhitelistPlayer[]> {
    try {
      const response = await this.client.get(
        `/api/client/servers/${this.serverId}/files/contents`,
        {
          params: {
            file: "/whitelist.json",
          },
        }
      );
      return JSON.parse(response.data);
    } catch (error) {
      console.error("Error reading whitelist file:", error);
      return [];
    }
  }

  /**
   * Write the whitelist.json file to the server
   */
  async writeWhitelistFile(players: WhitelistPlayer[]): Promise<void> {
    try {
      await this.client.post(
        `/api/client/servers/${this.serverId}/files/write`,
        JSON.stringify(players, null, 2),
        {
          params: {
            file: "/whitelist.json",
          },
          headers: {
            "Content-Type": "text/plain",
          },
        }
      );
    } catch (error) {
      console.error("Error writing whitelist file:", error);
      throw error;
    }
  }

  /**
   * Sync the whitelist file from the database
   * This is the source of truth - database overwrites server file
   */
  async syncWhitelistFromDatabase(): Promise<void> {
    try {
      // Get all entries from database
      const dbEntries = whitelistDb.getAllEntries();

      // Convert to Minecraft whitelist format
      const whitelistPlayers: WhitelistPlayer[] = dbEntries.map((entry) => ({
        uuid: entry.minecraftUuid,
        name: entry.minecraftName,
      }));

      // Write to server
      await this.writeWhitelistFile(whitelistPlayers);

      console.log(`Synced ${whitelistPlayers.length} players to whitelist.json`);
    } catch (error) {
      console.error("Error syncing whitelist from database:", error);
      throw error;
    }
  }
}
