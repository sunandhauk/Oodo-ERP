import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { ManufacturingOrdersContent } from "@/components/manufacturing-orders-content";
import { getServerSession } from "@/lib/session";

export default async function ManufacturingOrdersPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <DashboardShell user={session}>
      <ManufacturingOrdersContent />
    </DashboardShell>
  );
}
