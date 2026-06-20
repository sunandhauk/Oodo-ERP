import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { ProfileContent } from "@/components/profile-content";
import { getServerSession } from "@/lib/session";

export default async function ProfilePage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <DashboardShell user={session}>
      <ProfileContent user={session} />
    </DashboardShell>
  );
}

