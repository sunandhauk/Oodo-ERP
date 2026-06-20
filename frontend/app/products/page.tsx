import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { ProductsContent } from "@/components/products-content";
import { getServerSession } from "@/lib/session";

export default async function ProductsPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <DashboardShell user={session}>
      <ProductsContent />
    </DashboardShell>
  );
}
