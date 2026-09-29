import { getAppPool } from "@/lib/db/pool";
import { SessionUser } from "@/lib/auth/session";

export async function writeAuditLog(params: {
  session: SessionUser | null;
  action: string;
  resource: string;
  resourceId?: string | number | null;
  ip?: string | null;
  userAgent?: string | null;
  before?: unknown;
  after?: unknown;
  tenantId?: number | null;
}) {
  const pool = getAppPool();
  await pool.query(
    `INSERT INTO audit_logs
      (user_id, tenant_id, action, resource, resource_id, ip_address, user_agent, before_json, after_json)
     VALUES
      (:userId, :tenantId, :action, :resource, :resourceId, :ip, :userAgent, :beforeJson, :afterJson)`,
    {
      userId: params.session?.userId ?? null,
      tenantId:
        params.tenantId ??
        params.session?.impersonatedTenantId ??
        params.session?.tenantId ??
        null,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId != null ? String(params.resourceId) : null,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
      beforeJson: params.before ? JSON.stringify(params.before) : null,
      afterJson: params.after ? JSON.stringify(params.after) : null,
    },
  );
}
