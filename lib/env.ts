import { z } from "zod";

const envSchema = z.object({
  APP_NAME: z.string().default("Avrkr Cloud"),
  APP_ENV: z.enum(["development", "production", "test"]).default("production"),
  APP_URL: z.string().url().optional(),
  DATABASE_URL: z.string().min(1),
  ASTERISK_DATABASE_URL: z.string().min(1),
  AMI_HOST: z.string().default("127.0.0.1"),
  AMI_PORT: z.coerce.number().default(5038),
  AMI_USERNAME: z.string().optional(),
  AMI_PASSWORD: z.string().optional(),
  ARI_URL: z.string().optional(),
  ARI_USERNAME: z.string().optional(),
  ARI_PASSWORD: z.string().optional(),
  SIP_DOMAIN: z.string().default("sip.avrkr.tech"),
  SIP_WSS_URL: z.string().default("wss://sip.avrkr.tech/ws"),
  STUN_SERVER: z.string().optional(),
  TURN_SERVER: z.string().optional(),
  TURN_USERNAME: z.string().optional(),
  TURN_PASSWORD: z.string().optional(),
  RECORDING_PATH: z.string().default("/var/spool/asterisk/recordings"),
  SESSION_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(32),
  WS_PORT: z.coerce.number().default(3001),
  LOG_DIR: z.string().default("/asterislogs/application"),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  cached = parsed.data;
  return parsed.data;
}

export function parseMysqlUrl(url: string) {
  const u = new URL(url.replace(/^mysql:\/\//, "http://"));
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
  };
}
