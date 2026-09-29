"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard,
  Phone,
  Users,
  Settings,
  Headphones,
  Building2,
  Radio,
} from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/softphone", label: "Softphone", icon: Phone },
  { href: "/extensions", label: "Extensions", icon: Radio },
  { href: "/calls", label: "Call Logs", icon: Headphones },
  { href: "/admin/tenants", label: "Tenants", icon: Building2, admin: true },
  { href: "/tenant/users", label: "Users", icon: Users, tenantAdmin: true },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: string;
}) {
  const pathname = usePathname();
  const items = nav.filter((item) => {
    if (item.admin) return role === "SUPER_ADMIN";
    if (item.tenantAdmin)
      return role === "TENANT_ADMIN" || role === "SUPER_ADMIN";
    return true;
  });

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <aside className="hidden w-64 flex-col border-r border-slate-800 bg-slate-900/80 p-4 md:flex">
        <div className="mb-8 px-2">
          <p className="text-xs uppercase tracking-widest text-cyan-400">
            Avrkr Cloud
          </p>
          <h1 className="text-lg font-semibold">Telephony Platform</h1>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                pathname.startsWith(href)
                  ? "bg-cyan-500/15 text-cyan-300"
                  : "text-slate-300 hover:bg-slate-800",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3 md:px-8">
          <p className="text-sm text-slate-400">Multi-tenant cloud telephony</p>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="rounded-md border border-slate-700 px-3 py-1.5 text-xs hover:bg-slate-800"
              onClick={async (e) => {
                e.preventDefault();
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
              }}
            >
              Logout
            </button>
          </form>
        </header>
        <div className="flex-1 p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
