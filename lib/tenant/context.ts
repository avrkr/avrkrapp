import { SessionUser } from "@/lib/auth/session";

export class TenantAccessError extends Error {
  constructor(message = "Tenant access denied") {
    super(message);
    this.name = "TenantAccessError";
  }
}

/** Effective tenant for data access — never trust client-supplied tenant_id. */
export function resolveTenantId(
  session: SessionUser,
  requestedTenantId?: number | null,
): number | null {
  if (session.roleSlug === "SUPER_ADMIN") {
    if (requestedTenantId != null) {
      return requestedTenantId;
    }
    return session.impersonatedTenantId ?? session.tenantId;
  }
  if (session.tenantId == null) {
    throw new TenantAccessError("User has no tenant");
  }
  if (requestedTenantId != null && requestedTenantId !== session.tenantId) {
    throw new TenantAccessError("Cross-tenant access denied");
  }
  return session.tenantId;
}

export function requireTenantId(
  session: SessionUser,
  requestedTenantId?: number | null,
): number {
  const id = resolveTenantId(session, requestedTenantId);
  if (id == null) {
    throw new TenantAccessError("Tenant context required");
  }
  return id;
}
