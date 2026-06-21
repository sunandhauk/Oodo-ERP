import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { UsersContent } from "@/components/users-content";
import { getServerSession } from "@/lib/session";

export default async function UsersPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  if (!session.permissions.includes("users.manage")) {
    redirect("/dashboard");
  }

  return (
    <DashboardShell user={session}>
      <UsersContent user={session} />
    </DashboardShell>
  );
}
