"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SessionUser } from "@/lib/auth-types";
import { authClient } from "@/lib/auth-client";
import { useAuditLog } from "@/components/audit-log-provider";
import { UserIcon } from "@/components/icons";

export function LogoutButton({ user }: { user: SessionUser }) {
  const router = useRouter();
  const { appendAuditLog } = useAuditLog();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);

    try {
      await authClient.logout();
      appendAuditLog({
        user: user.displayName,
        module: "Auth",
        recordType: "Session",
        recordId: user.sub,
        action: "Signed Out",
        fieldChanged: "Session status",
        oldValue: "Active",
        newValue: "Closed",
        details: `Logged out from ${user.loginId}`,
      });
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="inline-flex items-center gap-3 rounded-full border border-brand-200 bg-brand-50 px-5 py-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-brand-700">
        <UserIcon className="h-5 w-5" />
      </span>
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
