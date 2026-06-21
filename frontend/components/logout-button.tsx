"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SessionUser } from "@/lib/auth-types";
import { authClient } from "@/lib/auth-client";
import { useAuditLog } from "@/components/audit-log-provider";
import { UserIcon } from "@/components/icons";

export function LogoutButton({ user, compact = false }: { user: SessionUser; compact?: boolean }) {
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
      const isAdmin = user.roles.includes("admin");
      router.replace(isAdmin ? "/login" : "/user-login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      aria-label={loading ? "Signing out..." : "Sign out"}
      title={loading ? "Signing out..." : "Sign out"}
      className={[
        "inline-flex w-full items-center rounded-[0.25rem] border border-brand-200 bg-brand-50 py-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-60",
        compact ? "justify-center px-3" : "gap-3 px-5",
      ].join(" ")}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-[0.25rem] bg-white/80 text-brand-700">
        <UserIcon className="h-5 w-5" />
      </span>
      {compact ? null : loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
