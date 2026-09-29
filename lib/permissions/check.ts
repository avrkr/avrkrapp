import { getAppPool } from "@/lib/db/pool";
import { SessionUser } from "@/lib/auth/session";

const cache = new Map<string, Set<string>>();

export async function getUserPermissions(
  userId: number,
  roleSlug: string,
): Promise<Set<string>> {
  const key = `${userId}:${roleSlug}`;
  if (cache.has(key)) return cache.get(key)!;

  const pool = getAppPool();
  const [rows] = await pool.query(
    `SELECT p.slug FROM permissions p
     INNER JOIN role_permissions rp ON rp.permission_id = p.id
     INNER JOIN users u ON u.role_id = rp.role_id
     WHERE u.id = :userId`,
    { userId },
  );
  const set = new Set((rows as { slug: string }[]).map((r) => r.slug));
  cache.set(key, set);
  return set;
}

export async function requirePermission(
  session: SessionUser,
  permission: string,
): Promise<void> {
  const perms = await getUserPermissions(session.userId, session.roleSlug);
  if (!perms.has(permission)) {
    throw new Error(`Missing permission: ${permission}`);
  }
}

export function clearPermissionCache() {
  cache.clear();
}
