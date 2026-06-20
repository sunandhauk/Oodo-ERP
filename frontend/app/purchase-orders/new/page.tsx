import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { PurchaseOrderCreateContent } from "@/components/purchase-orders-content";
import { getServerSession } from "@/lib/session";

export default async function PurchaseOrderCreatePage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <DashboardShell user={session}>
      <PurchaseOrderCreateContent />
    </DashboardShell>
  );
}
