import { NextRequest } from "next/server";
import { getSessionFromCookies } from "@/lib/auth/session";
import { apiError } from "@/lib/api/response";
import { TenantAccessError } from "@/lib/tenant/context";

export type AuthedHandler = (
  req: NextRequest,
  ctx: { session: NonNullable<Awaited<ReturnType<typeof getSessionFromCookies>>> },
) => Promise<Response>;

export function withAuth(handler: AuthedHandler) {
  return async (req: NextRequest): Promise<Response> => {
    try {
      const session = await getSessionFromCookies();
      if (!session) {
        return apiError("Authentication required", "UNAUTHORIZED", 401);
      }
      return handler(req, { session });
    } catch (err) {
      if (err instanceof TenantAccessError) {
        return apiError(err.message, "TENANT_ACCESS_DENIED", 403);
      }
      console.error(err);
      return apiError("Internal server error", "INTERNAL_ERROR", 500);
    }
  };
}

export function clientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip")
  );
}
