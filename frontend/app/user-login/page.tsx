import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth-screen";
import { getServerSession } from "@/lib/session";

export default async function UserLoginPage() {
  const session = await getServerSession();

  if (session) {
    redirect("/dashboard");
  }

  return <AuthScreen variant="user-login" />;
}
