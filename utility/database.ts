import { Database } from "bun:sqlite";
import path from "path";

interface WhitelistEntry {
  discordId: string;
  minecraftName: string;
  minecraftUuid: string;
  createdAt: number;
  updatedAt: number;
}

export class WhitelistDatabase {
  private db: Database;

  constructor(dbPath?: string) {
    const defaultPath = path.join(process.cwd(), "data", "whitelist.db");
    this.db = new Database(dbPath || defaultPath, { create: true });
    this.initialize();
  }

  private initialize() {
    // Create the whitelist table if it doesn't exist
    this.db.run(`
      CREATE TABLE IF NOT EXISTS whitelist (
        discord_id TEXT PRIMARY KEY,
        minecraft_name TEXT NOT NULL UNIQUE,
        minecraft_uuid TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Create an index on minecraft_name for faster lookups
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_minecraft_name
      ON whitelist(minecraft_name)
    `);
  }

  /**
   * Add or update a whitelist entry for a Discord user
   * Returns the created/updated entry or null if operation failed
   */
  upsertWhitelistEntry(
    discordId: string,
    minecraftName: string,
    minecraftUuid: string
  ): WhitelistEntry | null {
    try {
      const now = Date.now();

      // Check if this Minecraft name is already registered to a different Discord user
      const existingEntry = this.getEntryByMinecraftName(minecraftName);
      if (existingEntry && existingEntry.discordId !== discordId) {
        return null;
      }

      const stmt = this.db.prepare(`
        INSERT INTO whitelist (discord_id, minecraft_name, minecraft_uuid, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(discord_id) DO UPDATE SET
          minecraft_name = excluded.minecraft_name,
          minecraft_uuid = excluded.minecraft_uuid,
          updated_at = excluded.updated_at
      `);

      // Execute the upsert with bound parameters
      stmt.run(discordId, minecraftName, minecraftUuid, now, now);

      return this.getEntryByDiscordId(discordId);
    } catch (error) {
      console.error("Database upsert error:", error);
      return null;
    }
  }

  /**
   * Get whitelist entry by Discord ID
   */
  getEntryByDiscordId(discordId: string): WhitelistEntry | null {
    const stmt = this.db.prepare(`
      SELECT discord_id as discordId, minecraft_name as minecraftName, 
             minecraft_uuid as minecraftUuid, created_at as createdAt, 
             updated_at as updatedAt
      FROM whitelist
      WHERE discord_id = ?
    `);

    return stmt.get(discordId) as WhitelistEntry | null;
  }

  /**
   * Get whitelist entry by Minecraft name (case-insensitive)
   */
  getEntryByMinecraftName(minecraftName: string): WhitelistEntry | null {
    const stmt = this.db.prepare(`
      SELECT discord_id as discordId, minecraft_name as minecraftName, 
             minecraft_uuid as minecraftUuid, created_at as createdAt, 
             updated_at as updatedAt
      FROM whitelist
      WHERE LOWER(minecraft_name) = LOWER(?)
    `);

    return stmt.get(minecraftName) as WhitelistEntry | null;
  }

  /**
   * Get all whitelist entries
   */
  getAllEntries(): WhitelistEntry[] {
    const stmt = this.db.prepare(`
      SELECT discord_id as discordId, minecraft_name as minecraftName, 
             minecraft_uuid as minecraftUuid, created_at as createdAt, 
             updated_at as updatedAt
      FROM whitelist
      ORDER BY created_at DESC
    `);

    return stmt.all() as WhitelistEntry[];
  }

  /**
   * Close the database connection
   */
  close() {
    this.db.close();
  }
}

// Export a singleton instance
export const whitelistDb = new WhitelistDatabase();
