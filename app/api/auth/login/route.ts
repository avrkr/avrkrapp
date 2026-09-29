import { NextRequest } from "next/server";
import { z } from "zod";
import { getAppPool } from "@/lib/db/pool";
import { verifyPassword, hashToken } from "@/lib/auth/password";
import {
  createAccessToken,
  createRefreshToken,
  setAuthCookies,
  SessionUser,
} from "@/lib/auth/session";
import { apiError, apiSuccess } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { clientIp } from "@/lib/api/with-auth";

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid credentials payload", "VALIDATION_ERROR", 400);
  }

  const { username, password } = parsed.data;
  const ip = clientIp(req);
  const pool = getAppPool();

  await pool.query(
    `INSERT INTO login_attempts (username, ip_address, success) VALUES (:username, :ip, 0)`,
    { username, ip },
  );

  const [rows] = await pool.query(
    `SELECT u.*, r.slug AS role_slug
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE u.username = :username
     LIMIT 1`,
    { username },
  );

  const user = (rows as {
    id: number;
    uuid: string;
    tenant_id: number | null;
    name: string;
    email: string;
    username: string;
    password_hash: string;
    status: string;
    failed_login_attempts: number;
    locked_until: Date | null;
    role_slug: string;
  }[])[0];
  if (!user) {
    return apiError("Invalid username or password", "INVALID_CREDENTIALS", 401);
  }

  if (user.status === "locked" || (user.locked_until && user.locked_until > new Date())) {
    return apiError("Account locked", "ACCOUNT_LOCKED", 403);
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    const attempts = user.failed_login_attempts + 1;
    const lock =
      attempts >= MAX_ATTEMPTS
        ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
        : null;
    await pool.query(
      `UPDATE users SET failed_login_attempts = :attempts, locked_until = :locked, status = IF(:lockNow, 'locked', status)
       WHERE id = :id`,
      {
        attempts,
        locked: lock,
        lockNow: attempts >= MAX_ATTEMPTS ? 1 : 0,
        id: user.id,
      },
    );
    return apiError("Invalid username or password", "INVALID_CREDENTIALS", 401);
  }

  await pool.query(
    `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, status = 'active', last_login_at = NOW(6) WHERE id = :id`,
    { id: user.id },
  );

  const sessionUser: SessionUser = {
    sub: user.uuid,
    userId: user.id,
    tenantId: user.tenant_id,
    roleSlug: user.role_slug,
    email: user.email,
    name: user.name,
  };

  const access = await createAccessToken(sessionUser);
  const refresh = await createRefreshToken(user.id);
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES (:userId, :hash, DATE_ADD(NOW(6), INTERVAL 7 DAY))`,
    { userId: user.id, hash: hashToken(refresh) },
  );

  await setAuthCookies(access, refresh);

  await writeAuditLog({
    session: sessionUser,
    action: "login",
    resource: "auth",
    ip,
    userAgent: req.headers.get("user-agent"),
  });

  return apiSuccess({
    user: {
      id: user.id,
      uuid: user.uuid,
      name: user.name,
      email: user.email,
      username: user.username,
      tenantId: user.tenant_id,
      role: user.role_slug,
    },
  });
}
