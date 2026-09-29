import { getAppPool } from "@/lib/db/pool";
import { getSessionFromCookies } from "@/lib/auth/session";
import { requireTenantId } from "@/lib/tenant/context";
import { redirect } from "next/navigation";

async function loadMetrics(tenantId: number | null, isSuper: boolean) {
  const pool = getAppPool();
  if (isSuper) {
    const [tRows] = await pool.query("SELECT COUNT(*) AS c FROM tenants");
    const [uRows] = await pool.query("SELECT COUNT(*) AS c FROM users");
    const [eRows] = await pool.query("SELECT COUNT(*) AS c FROM extensions");
    const [cRows] = await pool.query(
      "SELECT COUNT(*) AS c FROM call_records WHERE DATE(start_time) = CURDATE()",
    );
    const count = (rows: unknown) => (rows as { c: number }[])[0]?.c ?? 0;
    return {
      tenants: count(tRows),
      users: count(uRows),
      extensions: count(eRows),
      callsToday: count(cRows),
    };
  }
  if (tenantId == null) return { callsToday: 0, answered: 0, missed: 0, extensions: 0 };
  const [callsTodayRows] = await pool.query(
    `SELECT COUNT(*) AS c FROM call_records WHERE tenant_id = :tenantId AND DATE(start_time) = CURDATE()`,
    { tenantId },
  );
  const [answeredRows] = await pool.query(
    `SELECT COUNT(*) AS c FROM call_records WHERE tenant_id = :tenantId AND status = 'answered' AND DATE(start_time) = CURDATE()`,
    { tenantId },
  );
  const [missedRows] = await pool.query(
    `SELECT COUNT(*) AS c FROM call_records WHERE tenant_id = :tenantId AND status = 'missed' AND DATE(start_time) = CURDATE()`,
    { tenantId },
  );
  const [extRows] = await pool.query(
    `SELECT COUNT(*) AS c FROM extensions WHERE tenant_id = :tenantId`,
    { tenantId },
  );
  const count = (rows: unknown) => (rows as { c: number }[])[0]?.c ?? 0;
  return {
    callsToday: count(callsTodayRows),
    answered: count(answeredRows),
    missed: count(missedRows),
    extensions: count(extRows),
  };
}

export default async function DashboardPage() {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  const isSuper = session.roleSlug === "SUPER_ADMIN";
  const tenantId = isSuper ? null : requireTenantId(session);
  const metrics = await loadMetrics(tenantId, isSuper);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-400">
        Welcome, {session.name} ({session.roleSlug})
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(metrics).map(([key, value]) => (
          <div
            key={key}
            className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {key.replace(/([A-Z])/g, " $1")}
            </p>
            <p className="mt-2 text-3xl font-semibold text-cyan-300">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
