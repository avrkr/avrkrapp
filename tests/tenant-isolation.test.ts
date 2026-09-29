import { describe, expect, it } from "vitest";
import { resolveTenantId } from "@/lib/tenant/context";
import type { SessionUser } from "@/lib/auth/session";

const tenant1User: SessionUser = {
  sub: "u1",
  userId: 10,
  tenantId: 1,
  roleSlug: "TENANT_ADMIN",
  email: "a@local",
  name: "A",
};

describe("tenant isolation", () => {
  it("derives tenant from session for tenant users", () => {
    expect(resolveTenantId(tenant1User)).toBe(1);
  });

  it("rejects cross-tenant tenant_id query param for tenant users", () => {
    expect(() => resolveTenantId(tenant1User, 2)).toThrow(/Cross-tenant/);
  });

  it("allows super admin to select tenant explicitly", () => {
    const superAdmin: SessionUser = {
      ...tenant1User,
      tenantId: null,
      roleSlug: "SUPER_ADMIN",
    };
    expect(resolveTenantId(superAdmin, 2)).toBe(2);
  });
});
