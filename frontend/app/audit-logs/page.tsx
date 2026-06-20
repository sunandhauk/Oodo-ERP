import { redirect } from "next/navigation";
import { AuditLogsContent } from "@/components/audit-logs-content";
import { DashboardShell } from "@/components/dashboard-shell";
import { getServerSession } from "@/lib/session";

export default async function AuditLogsPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <DashboardShell user={session}>
      <AuditLogsContent />
    </DashboardShell>
  );
}
