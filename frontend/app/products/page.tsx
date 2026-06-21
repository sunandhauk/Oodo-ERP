import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { ProductsContent } from "@/components/products-content";
import type { ProductRecord } from "@/lib/products";
import { fetchServerBackendList } from "@/lib/server-backend";
import { getServerSession } from "@/lib/session";

export default async function ProductsPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  const initialProducts = await fetchServerBackendList<ProductRecord>("/api/master-data/products");

  return (
    <DashboardShell user={session}>
      <ProductsContent initialProducts={initialProducts} canCreate={session.permissions.includes("product.create")} />
    </DashboardShell>
  );
}
