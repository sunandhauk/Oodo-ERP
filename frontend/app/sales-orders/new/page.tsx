import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { SalesOrderCreateContent } from "@/components/sales-orders-content";
import { getServerSession } from "@/lib/session";

export default async function SalesOrderCreatePage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  if (!session.permissions.includes("sales.create")) {
    redirect("/sales-orders");
  }

  return (
    <DashboardShell user={session}>
      <SalesOrderCreateContent user={session} />
    </DashboardShell>
  );
}

