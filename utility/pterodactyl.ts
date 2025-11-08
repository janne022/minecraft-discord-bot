import axios, { type AxiosInstance } from "axios";

interface PterodactylConfig {
  apiUrl: string;
  apiKey: string;
  serverId: string;
}

interface WhitelistEntry {
  uuid: string;
  name: string;
}

class PterodactylClient {
  private client: AxiosInstance;
  private serverId: string;

  constructor(config: PterodactylConfig) {
    this.serverId = config.serverId;
    this.client = axios.create({
      baseURL: config.apiUrl,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "Application/vnd.pterodactyl.v1+json",
      },
    });
  }

  /**
   * Read the whitelist.json file from the server
   */
  async getWhitelist(): Promise<WhitelistEntry[]> {
    try {
      const response = await this.client.get(
        `/api/client/servers/${this.serverId}/files/contents`,
        {
          params: {
            file: "/whitelist.json",
          },
        }
      );

      // Handle empty or whitespace-only files
      const content =
        typeof response.data === "string"
          ? response.data.trim()
          : JSON.stringify(response.data);

      if (!content || content === "") {
        return [];
      }

      return JSON.parse(content);
    } catch (error: any) {
      if (error.response) {
        throw new Error(
          `Failed to read whitelist: ${error.response.status} - ${error.response.statusText}. Check API key and server ID.`
        );
      }
      // Handle JSON parse errors
      if (error instanceof SyntaxError) {
        console.warn("Invalid whitelist.json, returning empty array");
        return [];
      }
      throw new Error(`Failed to read whitelist: ${error.message}`);
    }
  }

  /**
   * Write the whitelist.json file to the server
   */
  async updateWhitelist(whitelist: WhitelistEntry[]): Promise<void> {
    try {
      await this.client.post(
        `/api/client/servers/${this.serverId}/files/write`,
        JSON.stringify(whitelist, null, 2),
        {
          params: {
            file: "/whitelist.json",
          },
        }
      );
    } catch (error: any) {
      if (error.response) {
        throw new Error(
          `Failed to update whitelist: ${error.response.status} - ${error.response.statusText}`
        );
      }
      throw new Error(`Failed to update whitelist: ${error.message}`);
    }
  }

  /**
   * Add a player to the whitelist
   */
  async addToWhitelist(player: WhitelistEntry): Promise<void> {
    const whitelist = await this.getWhitelist();
    // Check if player already exists
    if (whitelist.some((p) => p.uuid === player.uuid)) {
      throw new Error(`Player ${player.name} is already whitelisted`);
    }

    whitelist.push(player);
    await this.updateWhitelist(whitelist);
  }

  /**
   * Check if a player is whitelisted
   */
  async isWhitelisted(playerName: string): Promise<boolean> {
    const whitelist = await this.getWhitelist();
    return whitelist.some((p) => p.name === playerName);
  }

  /**
   * Send a command to the server (restricted to safe commands)
   */
  async sendCommand(command: string): Promise<void> {
    // Whitelist of allowed commands
    const allowedCommands = [
      "whitelist reload",
      "whitelist list",
      "save-all",
    ];

    const isAllowed = allowedCommands.some((allowed) =>
      command.toLowerCase().startsWith(allowed.toLowerCase())
    );

    if (!isAllowed) {
      throw new Error(`Command "${command}" is not allowed`);
    }

    try {
      await this.client.post(`/api/client/servers/${this.serverId}/command`, {
        command: command,
      });
    } catch (error: any) {
      if (error.response) {
        throw new Error(
          `Failed to send command: ${error.response.status} - ${error.response.statusText}`
        );
      }
      throw new Error(`Failed to send command: ${error.message}`);
    }
  }
}

export { PterodactylClient };
export type { PterodactylConfig, WhitelistEntry };
