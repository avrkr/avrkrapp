import { getAsteriskPool, getAppPool } from "@/lib/db/pool";
import { decryptSecret } from "@/lib/crypto/secrets";

type ExtensionRow = {
  id: number;
  tenant_id: number;
  extension: string;
  display_name: string;
  sip_username: string;
  sip_secret_encrypted: string;
  endpoint_name: string;
  caller_id_name: string | null;
  caller_id_number: string | null;
  enabled: number;
  webrtc_enabled: number;
  max_contacts: number;
  transport: string;
  account_code: string;
};

export async function syncExtensionToAsterisk(extensionId: number): Promise<void> {
  const app = getAppPool();
  const asterisk = getAsteriskPool();

  const [rows] = await app.query(
    `SELECT e.*, t.account_code
     FROM extensions e
     INNER JOIN tenants t ON t.id = e.tenant_id
     WHERE e.id = :id`,
    { id: extensionId },
  );
  const ext = (rows as ExtensionRow[])[0];
  if (!ext) throw new Error("Extension not found");

  const sipSecret = decryptSecret(ext.sip_secret_encrypted);
  const authId = `${ext.endpoint_name}-auth`;
  const aorId = `${ext.endpoint_name}-aor`;
  const context = `tenant-${ext.tenant_id}-internal`;

  await asterisk.query(
    `INSERT INTO ps_auths (id, auth_type, password, username)
     VALUES (:id, 'userpass', :password, :username)
     ON DUPLICATE KEY UPDATE password = VALUES(password), username = VALUES(username)`,
    { id: authId, password: sipSecret, username: ext.sip_username },
  );

  await asterisk.query(
    `INSERT INTO ps_aors (id, max_contacts, remove_existing)
     VALUES (:id, :maxContacts, 'yes')
     ON DUPLICATE KEY UPDATE max_contacts = VALUES(max_contacts)`,
    { id: aorId, maxContacts: ext.max_contacts },
  );

  const webrtc = ext.webrtc_enabled ? "yes" : "no";
  await asterisk.query(
    `INSERT INTO ps_endpoints
      (id, transport, aors, auth, context, disallow, allow, webrtc, dtls_auto_generate_cert,
       media_encryption, direct_media, force_rport, rewrite_contact, rtp_symmetric,
       callerid, accountcode, tenant_id)
     VALUES
      (:id, :transport, :aors, :auth, :context, 'all', 'opus,ulaw,alaw', :webrtc, 'yes',
       'dtls', 'no', 'yes', 'yes', 'yes',
       :callerid, :accountcode, :tenantId)
     ON DUPLICATE KEY UPDATE
       transport = VALUES(transport),
       aors = VALUES(aors),
       auth = VALUES(auth),
       context = VALUES(context),
       webrtc = VALUES(webrtc),
       callerid = VALUES(callerid),
       accountcode = VALUES(accountcode),
       tenant_id = VALUES(tenant_id)`,
    {
      id: ext.endpoint_name,
      transport: ext.transport,
      aors: aorId,
      auth: authId,
      context,
      webrtc,
      callerid: ext.caller_id_name
        ? `"${ext.caller_id_name}" <${ext.caller_id_number ?? ext.extension}>`
        : `"${ext.display_name}" <${ext.extension}>`,
      accountcode: ext.account_code,
      tenantId: ext.tenant_id,
    },
  );

  if (!ext.enabled) {
    await asterisk.query(`DELETE FROM ps_endpoints WHERE id = :id`, {
      id: ext.endpoint_name,
    });
  }
}

export async function removeExtensionFromAsterisk(endpointName: string): Promise<void> {
  const asterisk = getAsteriskPool();
  await asterisk.query(`DELETE FROM ps_endpoints WHERE id = :id`, { id: endpointName });
  await asterisk.query(`DELETE FROM ps_auths WHERE id = :id`, {
    id: `${endpointName}-auth`,
  });
  await asterisk.query(`DELETE FROM ps_aors WHERE id = :id`, {
    id: `${endpointName}-aor`,
  });
}
