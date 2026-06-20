import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { BomCreateContent } from "@/components/bom-content";
import { getServerSession } from "@/lib/session";

export default async function BomsCreatePage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <DashboardShell user={session}>
      <BomCreateContent />
    </DashboardShell>
  );
}
