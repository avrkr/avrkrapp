import { withAuth } from "@/lib/api/with-auth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getAppPool } from "@/lib/db/pool";
import { getEnv } from "@/lib/env";
import { decryptSecret } from "@/lib/crypto/secrets";
import { requireTenantId } from "@/lib/tenant/context";

export const GET = withAuth(async (_req, { session }) => {
  const tenantId = requireTenantId(session);
  const pool = getAppPool();
  const [rows] = await pool.query(
    `SELECT e.extension, e.sip_username, e.sip_secret_encrypted, e.display_name
     FROM extensions e
     WHERE e.tenant_id = :tenantId AND e.user_id = :userId AND e.enabled = 1
     LIMIT 1`,
    { tenantId, userId: session.userId },
  );

  const extRows = rows as {
    extension: string;
    sip_username: string;
    sip_secret_encrypted: string;
    display_name: string;
  }[];
  if (!extRows[0]) {
    return apiError("No extension assigned to user", "NO_EXTENSION", 404);
  }

  const env = getEnv();
  const ext = extRows[0];
  return apiSuccess({
    displayName: ext.display_name,
    extension: ext.extension,
    sipUri: `sip:${ext.sip_username}@${env.SIP_DOMAIN}`,
    authorizationUsername: ext.sip_username,
    authorizationPassword: decryptSecret(ext.sip_secret_encrypted),
    wsServer: env.SIP_WSS_URL,
    iceServers: [
      ...(env.STUN_SERVER ? [{ urls: env.STUN_SERVER }] : []),
      ...(env.TURN_SERVER
        ? [
            {
              urls: env.TURN_SERVER,
              username: env.TURN_USERNAME,
              credential: env.TURN_PASSWORD,
            },
          ]
        : []),
    ],
  });
});
