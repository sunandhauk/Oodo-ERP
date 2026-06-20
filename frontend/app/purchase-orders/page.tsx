import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { PurchaseOrdersContent } from "@/components/purchase-orders-content";
import { getServerSession } from "@/lib/session";

export default async function PurchaseOrdersPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <DashboardShell user={session}>
      <PurchaseOrdersContent />
    </DashboardShell>
  );
}
