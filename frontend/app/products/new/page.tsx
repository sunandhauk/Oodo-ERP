import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { ProductCreateContent } from "@/components/product-create-content";
import { getServerSession } from "@/lib/session";

export default async function ProductCreatePage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  if (!session.permissions.includes("product.create")) {
    redirect("/products");
  }

  return (
    <DashboardShell user={session}>
      <ProductCreateContent />
    </DashboardShell>
  );
}
