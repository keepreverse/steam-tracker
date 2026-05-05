import { neon } from "@neondatabase/serverless";

// Database connection - lazy initialization
let sql: ReturnType<typeof neon> | null = null;

// Account type from database
interface DbAccount {
  id: number;
  steamId64: string;
  personaName: string;
  avatarUrl: string;
  profileUrl: string;
  archived: boolean;
  banStatus: any;
  lastChecked: string | null;
  addedAt: string;
}

function getSql() {
  if (!sql) {
    const DATABASE_URL = process.env.DATABASE_URL || "";
    if (!DATABASE_URL) {
      console.warn("DATABASE_URL is not set. Database operations will fail.");
      return null;
    }
    sql = neon(DATABASE_URL);
  }
  return sql;
}

// Helper functions
export async function getAllAccounts(): Promise<DbAccount[]> {
  const client = getSql();
  if (!client) return [];
  const result = await client`
    SELECT 
      id,
      steam_id_64 as "steamId64",
      persona_name as "personaName",
      avatar_url as "avatarUrl",
      profile_url as "profileUrl",
      archived,
      ban_status as "banStatus",
      last_checked as "lastChecked",
      added_at as "addedAt"
    FROM accounts
    ORDER BY added_at DESC
  `;
  return result as DbAccount[];
}

export async function createAccount(data: {
  steamId64: string;
  personaName: string;
  avatarUrl: string;
  profileUrl: string;
  banStatus: any;
}): Promise<DbAccount> {
  const client = getSql();
  if (!client) throw new Error("DATABASE_URL not configured");
  
  const result = await client`
    INSERT INTO accounts (steam_id_64, persona_name, avatar_url, profile_url, ban_status, added_at)
    VALUES (${data.steamId64}, ${data.personaName}, ${data.avatarUrl}, ${data.profileUrl}, ${data.banStatus}::jsonb, NOW())
    RETURNING 
      id,
      steam_id_64 as "steamId64",
      persona_name as "personaName",
      avatar_url as "avatarUrl",
      profile_url as "profileUrl",
      archived,
      ban_status as "banStatus",
      last_checked as "lastChecked",
      added_at as "addedAt"
  `;
  return (result as DbAccount[])[0];
}

export async function updateAccount(id: number, data: Partial<{
  archived: boolean;
  banStatus: any;
  lastChecked: Date;
}>): Promise<DbAccount | null> {
  const client = getSql();
  if (!client) throw new Error("DATABASE_URL not configured");
  
  // Handle each update type separately to avoid SQL injection
  if (data.archived !== undefined) {
    const result = await client`
      UPDATE accounts 
      SET archived = ${data.archived}
      WHERE id = ${id}
      RETURNING 
        id,
        steam_id_64 as "steamId64",
        persona_name as "personaName",
        avatar_url as "avatarUrl",
        profile_url as "profileUrl",
        archived,
        ban_status as "banStatus",
        last_checked as "lastChecked",
        added_at as "addedAt"
    `;
    return (result as DbAccount[])[0];
  }
  
  if (data.banStatus !== undefined) {
    const result = await client`
      UPDATE accounts 
      SET ban_status = ${data.banStatus}::jsonb,
          last_checked = ${data.lastChecked?.toISOString() || null}
      WHERE id = ${id}
      RETURNING 
        id,
        steam_id_64 as "steamId64",
        persona_name as "personaName",
        avatar_url as "avatarUrl",
        profile_url as "profileUrl",
        archived,
        ban_status as "banStatus",
        last_checked as "lastChecked",
        added_at as "addedAt"
    `;
    return (result as DbAccount[])[0];
  }
  
  return null;
}

export async function deleteAccount(id: number): Promise<boolean> {
  const client = getSql();
  if (!client) throw new Error("DATABASE_URL not configured");
  
  await client`DELETE FROM accounts WHERE id = ${id}`;
  return true;
}

export async function getAccountBySteamId(steamId64: string): Promise<DbAccount | null> {
  const client = getSql();
  if (!client) return null;
  
  const result = await client`
    SELECT 
      id,
      steam_id_64 as "steamId64",
      persona_name as "personaName",
      avatar_url as "avatarUrl",
      profile_url as "profileUrl",
      archived,
      ban_status as "banStatus",
      last_checked as "lastChecked",
      added_at as "addedAt"
    FROM accounts
    WHERE steam_id_64 = ${steamId64}
    LIMIT 1
  `;
  return (result as DbAccount[])[0] || null;
}

// Initialize database table
export async function initDatabase() {
  const client = getSql();
  if (!client) {
    console.log("DATABASE_URL not set, skipping database initialization");
    return false;
  }
  
  try {
    await client`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        steam_id_64 VARCHAR(17) NOT NULL UNIQUE,
        persona_name VARCHAR(255) NOT NULL,
        avatar_url VARCHAR(512) NOT NULL,
        profile_url VARCHAR(512) NOT NULL,
        archived BOOLEAN NOT NULL DEFAULT FALSE,
        ban_status JSONB,
        last_checked TIMESTAMP,
        added_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    console.log("Database initialized successfully");
    return true;
  } catch (error) {
    console.error("Database initialization error:", error);
    return false;
  }
}
