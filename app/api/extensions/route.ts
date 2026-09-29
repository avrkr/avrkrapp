import { NextRequest } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { withAuth, clientIp } from "@/lib/api/with-auth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { requireTenantId } from "@/lib/tenant/context";
import { requirePermission } from "@/lib/permissions/check";
import { getAppPool } from "@/lib/db/pool";
import { encryptSecret } from "@/lib/crypto/secrets";
import { generateSecurePassword } from "@/lib/auth/password";
import { syncExtensionToAsterisk } from "@/server/services/extension-sync";
import { writeAuditLog } from "@/lib/audit/log";

export const GET = withAuth(async (req, { session }) => {
  await requirePermission(session, "extensions.view");
  const tenantId = requireTenantId(session);
  const pool = getAppPool();
  const [rows] = await pool.query(
    `SELECT id, tenant_id, extension, display_name, user_id, endpoint_name, caller_id_name,
            caller_id_number, enabled, webrtc_enabled, recording_enabled, voicemail_enabled,
            call_waiting, max_contacts, transport, created_at, updated_at
     FROM extensions WHERE tenant_id = :tenantId ORDER BY extension`,
    { tenantId },
  );
  return apiSuccess({ extensions: rows });
});

const createSchema = z.object({
  extension: z.string().min(2).max(32),
  displayName: z.string().min(1),
  userId: z.number().optional().nullable(),
  webrtcEnabled: z.boolean().optional(),
  recordingEnabled: z.boolean().optional(),
  voicemailEnabled: z.boolean().optional(),
});

export const POST = withAuth(async (req, { session }) => {
  await requirePermission(session, "extensions.create");
  const tenantId = requireTenantId(session);
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Invalid extension data", "VALIDATION_ERROR", 400);
  }

  const sipSecret = generateSecurePassword(24);
  const endpointName = `t${tenantId}-ext-${parsed.data.extension}`;
  const sipUsername = `${tenantId}_${parsed.data.extension}`;

  const pool = getAppPool();
  try {
    const [result] = await pool.query(
      `INSERT INTO extensions
        (tenant_id, extension, display_name, user_id, sip_username, sip_secret_encrypted, endpoint_name,
         caller_id_name, caller_id_number, webrtc_enabled, recording_enabled, voicemail_enabled)
       VALUES
        (:tenantId, :extension, :displayName, :userId, :sipUsername, :secret, :endpointName,
         :displayName, :extension, :webrtc, :recording, :voicemail)`,
      {
        tenantId,
        extension: parsed.data.extension,
        displayName: parsed.data.displayName,
        userId: parsed.data.userId ?? null,
        sipUsername,
        secret: encryptSecret(sipSecret),
        endpointName,
        webrtc: parsed.data.webrtcEnabled === false ? 0 : 1,
        recording: parsed.data.recordingEnabled ? 1 : 0,
        voicemail: parsed.data.voicemailEnabled === false ? 0 : 1,
      },
    );

    const insertId = (result as unknown as { insertId: number }).insertId;
    await syncExtensionToAsterisk(insertId);

    await writeAuditLog({
      session,
      action: "create",
      resource: "extension",
      resourceId: insertId,
      tenantId,
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
      after: { extension: parsed.data.extension, endpointName },
    });

    return apiSuccess(
      {
        id: insertId,
        endpointName,
        sipUsername,
        sipSecret,
      },
      201,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Create failed";
    if (msg.includes("Duplicate")) {
      return apiError("Extension already exists", "EXTENSION_EXISTS", 409);
    }
    return apiError("Failed to create extension", "EXTENSION_CREATE_FAILED", 500);
  }
});
