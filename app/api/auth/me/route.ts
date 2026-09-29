import { getAppPool } from "@/lib/db/pool";
import { withAuth } from "@/lib/api/with-auth";
import { apiSuccess } from "@/lib/api/response";
import { getUserPermissions } from "@/lib/permissions/check";

export const GET = withAuth(async (_req, { session }) => {
  const pool = getAppPool();
  const [rows] = await pool.query(
    `SELECT id, uuid, name, email, username, tenant_id FROM users WHERE id = :id`,
    { id: session.userId },
  );
  const user = (rows as { id: number; uuid: string; name: string; email: string; username: string; tenant_id: number | null }[])[0];
  const permissions = [...(await getUserPermissions(session.userId, session.roleSlug))];
  return apiSuccess({
    user,
    role: session.roleSlug,
    tenantId: session.tenantId,
    permissions,
  });
});
