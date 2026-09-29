import { z } from "zod";
import { randomUUID } from "crypto";
import { withAuth } from "@/lib/api/with-auth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { requirePermission } from "@/lib/permissions/check";
import { getAppPool } from "@/lib/db/pool";

export const GET = withAuth(async (_req, { session }) => {
  if (session.roleSlug !== "SUPER_ADMIN") {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }
  await requirePermission(session, "tenant.view");
  const pool = getAppPool();
  const [rows] = await pool.query(
    `SELECT id, uuid, name, slug, domain, status, timezone, account_code, email, created_at
     FROM tenants ORDER BY id`,
  );
  return apiSuccess({ tenants: rows });
});

const createSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  accountCode: z.string().min(3),
  email: z.string().email().optional(),
});

export const POST = withAuth(async (req, { session }) => {
  if (session.roleSlug !== "SUPER_ADMIN") {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }
  await requirePermission(session, "tenant.update");
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return apiError("Invalid tenant data", "VALIDATION_ERROR", 400);
  }
  const pool = getAppPool();
  const [result] = await pool.query(
    `INSERT INTO tenants (uuid, name, slug, account_code, email, status)
     VALUES (:uuid, :name, :slug, :accountCode, :email, 'trial')`,
    {
      uuid: randomUUID(),
      name: parsed.data.name,
      slug: parsed.data.slug,
      accountCode: parsed.data.accountCode,
      email: parsed.data.email ?? null,
    },
  );
  return apiSuccess({ id: (result as { insertId: number }).insertId }, 201);
});
