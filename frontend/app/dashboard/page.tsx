import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { getServerSession } from "@/lib/session";

export default async function DashboardPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  return <DashboardShell user={session} />;
}
