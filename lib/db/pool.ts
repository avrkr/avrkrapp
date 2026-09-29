import mysql, { Pool, RowDataPacket } from "mysql2/promise";
import { getEnv, parseMysqlUrl } from "@/lib/env";

let appPool: Pool | null = null;
let asteriskPool: Pool | null = null;

export function getAppPool(): Pool {
  if (!appPool) {
    const cfg = parseMysqlUrl(getEnv().DATABASE_URL);
    appPool = mysql.createPool({
      ...cfg,
      waitForConnections: true,
      connectionLimit: 20,
      namedPlaceholders: true,
    });
  }
  return appPool;
}

export function getAsteriskPool(): Pool {
  if (!asteriskPool) {
    const cfg = parseMysqlUrl(getEnv().ASTERISK_DATABASE_URL);
    asteriskPool = mysql.createPool({
      ...cfg,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true,
    });
  }
  return asteriskPool;
}

export async function pingAppDb(): Promise<boolean> {
  try {
    const pool = getAppPool();
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export async function pingAsteriskDb(): Promise<boolean> {
  try {
    const pool = getAsteriskPool();
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export type DbRow = RowDataPacket;
