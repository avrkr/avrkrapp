import { NextRequest } from "next/server";
import { clearAuthCookies, getSessionFromCookies } from "@/lib/auth/session";
import { apiSuccess } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { clientIp } from "@/lib/api/with-auth";

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  await clearAuthCookies();
  if (session) {
    await writeAuditLog({
      session,
      action: "logout",
      resource: "auth",
      ip: clientIp(req),
      userAgent: req.headers.get("user-agent"),
    });
  }
  return apiSuccess({ ok: true });
}
