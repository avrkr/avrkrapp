import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { apiSuccess } from "@/lib/api/response";
import { requireTenantId, TenantAccessError } from "@/lib/tenant/context";
import { requirePermission } from "@/lib/permissions/check";
import { getAppPool } from "@/lib/db/pool";

export const GET = withAuth(async (req: NextRequest, { session }) => {
  await requirePermission(session, "calls.view");

  const url = new URL(req.url);
  const requestedTenant = url.searchParams.get("tenant_id");
  if (requestedTenant && session.roleSlug !== "SUPER_ADMIN") {
    throw new TenantAccessError("Cross-tenant query denied");
  }

  const tenantId = requireTenantId(
    session,
    requestedTenant ? Number(requestedTenant) : undefined,
  );

  const pool = getAppPool();
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
  const [rows] = await pool.query(
    `SELECT id, tenant_id, call_id, caller_number, dest_number, call_type, status,
            start_time, answer_time, end_time, duration, recording_url, account_code
     FROM call_records
     WHERE tenant_id = :tenantId
     ORDER BY start_time DESC
     LIMIT :limit`,
    { tenantId, limit },
  );
  return apiSuccess({ calls: rows });
});
