import { AppShell } from "@/components/layout/AppShell";
import { getSessionFromCookies } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");
  return <AppShell role={session.roleSlug}>{children}</AppShell>;
}
