import fs from "fs";
import { apiSuccess } from "@/lib/api/response";
import { pingAppDb, pingAsteriskDb } from "@/lib/db/pool";
import { pingAmi } from "@/server/services/ami-client";
import { getEnv } from "@/lib/env";

async function pingAri(): Promise<boolean> {
  const env = getEnv();
  if (!env.ARI_URL || !env.ARI_USERNAME || !env.ARI_PASSWORD) return false;
  try {
    const url = new URL(`${env.ARI_URL}/asterisk/info`);
    url.username = env.ARI_USERNAME;
    url.password = env.ARI_PASSWORD;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET() {
  const env = getEnv();
  const dbOk = await pingAppDb();
  const asteriskDbOk = await pingAsteriskDb();
  const amiOk = await pingAmi();
  const ariOk = await pingAri();
  let storageOk = false;
  try {
    storageOk = fs.existsSync(env.RECORDING_PATH);
  } catch {
    storageOk = false;
  }

  return apiSuccess({
    application: "ok",
    database: dbOk ? "ok" : "unavailable",
    asterisk: asteriskDbOk ? "ok" : "unavailable",
    ami: amiOk ? "ok" : "unavailable",
    ari: ariOk ? "ok" : "unavailable",
    storage: storageOk ? "ok" : "unavailable",
  });
}
