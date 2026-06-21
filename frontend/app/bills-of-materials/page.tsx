import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { BomContent } from "@/components/bom-content";
import { getServerSession } from "@/lib/session";

export default async function BomsPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <DashboardShell user={session}>
      <BomContent canCreate={session.permissions.includes("manufacturing.create")} />
    </DashboardShell>
  );
}
