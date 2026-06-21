import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { SalesOrdersContent } from "@/components/sales-orders-content";
import type { SalesOrderRecord } from "@/lib/sales-orders";
import { fetchServerBackendList } from "@/lib/server-backend";
import { getServerSession } from "@/lib/session";

export default async function SalesOrdersPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  const initialOrders = await fetchServerBackendList<SalesOrderRecord>("/api/sales-orders");

  return (
    <DashboardShell user={session}>
      <SalesOrdersContent initialOrders={initialOrders} isAdmin={session.roles.includes("admin")} canCreate={session.permissions.includes("sales.create")} />
    </DashboardShell>
  );
}

