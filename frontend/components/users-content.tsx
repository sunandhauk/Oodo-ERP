"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { useAuditLog } from "@/components/audit-log-provider";
import { ChevronDownIcon, SearchIcon, ShieldIcon, UserIcon } from "@/components/icons";
import type { SessionUser } from "@/lib/auth-types";

type UserRecord = {
  id: string;
  login_id: string;
  email: string;
  full_name: string;
  status: string;
  created_at: string;
  roles: string[];
};

type UsersContentProps = {
  user: SessionUser;
};

type FilterState = "all" | "active" | "inactive" | "withRoles" | "roleless";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin", description: "Full access to manage the ERP" },
  { value: "user", label: "User", description: "Operational access for day-to-day work" },
  { value: "viewer", label: "Viewer", description: "Read-only access" },
];

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (error && typeof error === "object") {
    if ("message" in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) {
        return message;
      }
      if (Array.isArray(message)) {
        const joined = message.filter((item) => typeof item === "string").join(" ");
        if (joined.trim()) {
          return joined;
        }
      }
    }

    if ("error" in error) {
      const nested: string = getApiErrorMessage((error as { error?: unknown }).error, "");
      if (nested) {
        return nested;
      }
    }
  }

  return fallback;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function formatDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function SectionCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[0.25rem] border border-slate-200 bg-white shadow-[0_16px_38px_rgba(15,23,42,0.05)] ${className}`}>{children}</section>;
}

function RoleBadge({ role }: { role: string }) {
  const normalized = normalize(role);
  const className =
    normalized === "admin"
      ? "bg-rose-50 text-rose-700 ring-rose-100"
      : normalized === "user"
        ? "bg-brand-50 text-brand-700 ring-brand-100"
        : "bg-slate-100 text-slate-700 ring-slate-200";

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ring-1 ${className}`}>{role}</span>;
}

export function UsersContent({ user }: UsersContentProps) {
  const { appendAuditLog } = useAuditLog();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [search, setSearch] = useState("");
  const [primaryFilter, setPrimaryFilter] = useState<FilterState>("all");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const canManageRoles = user.permissions.includes("users.manage");

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadUsers() {
      try {
        setLoading(true);
        setError("");
        setActionError("");

        const response = await fetch("/api/users", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        const payload = (await response.json().catch(() => null)) as
          | { status?: string; data?: UserRecord[]; error?: unknown }
          | null;

        if (!response.ok || payload?.status !== "success" || !Array.isArray(payload.data)) {
          throw new Error(
            typeof payload?.error === "string"
              ? payload.error
              : "Unable to load users.",
          );
        }

        if (active) {
          setUsers(payload.data);
        }
      } catch (fetchError) {
        if (!active) {
          return;
        }

        setUsers([]);
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load users.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadUsers();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    appendAuditLog({
      user: user.displayName,
      module: "Users",
      recordType: "Page",
      recordId: "/users",
      action: "Viewed",
      fieldChanged: "Route",
      oldValue: "-",
      newValue: "/users",
      details: "Users management page opened",
    });
  }, [appendAuditLog, user.displayName]);

  useEffect(() => {
    setPage(1);
  }, [search, primaryFilter, roleFilter, rowsPerPage]);

  useEffect(() => {
    if (!selectedUserId && users[0]) {
      setSelectedUserId(users[0].id);
    }
  }, [selectedUserId, users]);

  const selectedUser = useMemo(() => users.find((item) => item.id === selectedUserId) ?? null, [selectedUserId, users]);

  useEffect(() => {
    if (selectedUser) {
      setSelectedRoles(selectedUser.roles);
      setActionError("");
    }
  }, [selectedUser]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();

    return users.filter((item) => {
      const haystack = [item.full_name, item.login_id, item.email, item.status, item.roles.join(" ")].join(" ").toLowerCase();

      if (q && !haystack.includes(q)) {
        return false;
      }

      const normalizedStatus = normalize(item.status);
      if (primaryFilter === "active" && normalizedStatus !== "active") {
        return false;
      }

      if (primaryFilter === "inactive" && normalizedStatus === "active") {
        return false;
      }

      if (primaryFilter === "withRoles" && item.roles.length === 0) {
        return false;
      }

      if (primaryFilter === "roleless" && item.roles.length > 0) {
        return false;
      }

      if (roleFilter !== "All Roles" && !item.roles.includes(roleFilter)) {
        return false;
      }

      return true;
    });
  }, [primaryFilter, roleFilter, search, users]);

  const total = filteredUsers.length;
  const pageCount = Math.max(1, Math.ceil(total / rowsPerPage));
  const currentPage = Math.min(page, pageCount);
  const pageUsers = filteredUsers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
  const firstVisible = total === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const lastVisible = total === 0 ? 0 : Math.min(currentPage * rowsPerPage, total);
  const startPage = Math.max(1, Math.min(currentPage - 2, Math.max(1, pageCount - 4)));
  const visiblePages = Array.from({ length: Math.min(5, pageCount) }, (_, index) => startPage + index);
  const roleOptions = ROLE_OPTIONS.map((option) => option.value);
  const selectedRoleKey = [...selectedRoles].sort().join("|");
  const originalRoleKey = [...(selectedUser?.roles ?? [])].sort().join("|");
  const roleChanged = Boolean(selectedUser) && selectedRoleKey !== originalRoleKey;

  function clearFilters() {
    setSearch("");
    setPrimaryFilter("all");
    setRoleFilter("All Roles");
  }

  function toggleRole(role: string) {
    setSelectedRoles((current) =>
      current.includes(role) ? current.filter((item) => item !== role) : [...current, role],
    );
  }

  async function saveRoles() {
    if (!selectedUser || !canManageRoles) {
      return;
    }

    setSaving(true);
    try {
      setActionError("");
      const response = await fetch(`/api/users/${selectedUser.id}/roles`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ roles: Array.from(new Set(selectedRoles)) }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { status?: string; data?: { userId?: string; roles?: string[] }; error?: unknown }
        | null;

      if (!response.ok || payload?.status !== "success") {
        throw new Error(getApiErrorMessage(payload?.error, "Unable to update user roles."));
      }

      const nextRoles = payload.data?.roles ?? Array.from(new Set(selectedRoles));
      setUsers((current) => current.map((item) => (item.id === selectedUser.id ? { ...item, roles: nextRoles } : item)));
      setSelectedRoles(nextRoles);
      appendAuditLog({
        user: user.displayName,
        module: "Users",
        recordType: "User",
        recordId: selectedUser.login_id,
        action: "Updated",
        fieldChanged: "Roles",
        oldValue: originalRoleKey || "-",
        newValue: nextRoles.join(", ") || "-",
        details: `Updated roles for ${selectedUser.full_name || selectedUser.login_id}`,
      });
    } catch (saveError) {
      setActionError(saveError instanceof Error ? saveError.message : "Unable to update user roles.");
    } finally {
      setSaving(false);
    }
  }

  async function setUserStatus(nextStatus: "active" | "inactive") {
    if (!selectedUser || !canManageRoles || selectedUser.status === nextStatus) {
      return;
    }

    const confirmed = window.confirm(
      nextStatus === "inactive"
        ? `Make ${selectedUser.full_name || selectedUser.login_id} inactive?`
        : `Restore ${selectedUser.full_name || selectedUser.login_id} to active?`,
    );
    if (!confirmed) {
      return;
    }

    setSaving(true);
    try {
      setActionError("");
      const response = await fetch(`/api/users/${selectedUser.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { status?: string; data?: { id?: string; status?: string }; error?: unknown }
        | null;

      if (!response.ok || payload?.status !== "success") {
        throw new Error(getApiErrorMessage(payload?.error, "Unable to update user status."));
      }

      setUsers((current) => current.map((item) => (item.id === selectedUser.id ? { ...item, status: nextStatus } : item)));
      setSelectedUserId(selectedUser.id);
      appendAuditLog({
        user: user.displayName,
        module: "Users",
        recordType: "User",
        recordId: selectedUser.login_id,
        action: "Updated",
        fieldChanged: "Status",
        oldValue: selectedUser.status,
        newValue: nextStatus,
        details: `${nextStatus === "inactive" ? "Deactivated" : "Reactivated"} ${selectedUser.full_name || selectedUser.login_id}`,
      });
    } catch (statusError) {
      setActionError(statusError instanceof Error ? statusError.message : "Unable to update user status.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser() {
    if (!selectedUser || !canManageRoles) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedUser.full_name || selectedUser.login_id}? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    setSaving(true);
    try {
      setActionError("");
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as
        | { status?: string; data?: { userId?: string }; error?: unknown }
        | null;

      if (!response.ok || payload?.status !== "success") {
        throw new Error(getApiErrorMessage(payload?.error, "Unable to delete user."));
      }

      setUsers((current) => {
        const nextUsers = current.filter((item) => item.id !== selectedUser.id);
        setSelectedUserId(nextUsers[0]?.id ?? null);
        return nextUsers;
      });
      setSelectedRoles([]);
      appendAuditLog({
        user: user.displayName,
        module: "Users",
        recordType: "User",
        recordId: selectedUser.login_id,
        action: "Deleted",
        fieldChanged: "Account",
        oldValue: selectedUser.status,
        newValue: "-",
        details: `Deleted ${selectedUser.full_name || selectedUser.login_id}`,
      });
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : "Unable to delete user.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-end justify-between gap-4 animate-fade-up">
        <Breadcrumbs items={[{ label: "Home", href: "/dashboard" }, { label: "Users" }]} />

        <button
          type="button"
          onClick={clearFilters}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Clear filters
        </button>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <SectionCard className="overflow-hidden">
          <div className="border-b border-slate-100 p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div className="flex-1">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Search</label>
                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by name, login, email, or role..."
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative min-w-[190px]">
                  <select
                    value={roleFilter}
                    onChange={(event) => setRoleFilter(event.target.value)}
                    className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-10 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white"
                  >
                    <option>All Roles</option>
                    {roleOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
                <div className="relative min-w-[170px]">
                  <select
                    value={primaryFilter}
                    onChange={(event) => setPrimaryFilter(event.target.value as FilterState)}
                    className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-10 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-300 focus:bg-white"
                  >
                    <option value="all">All Users</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                    <option value="withRoles">Has Roles</option>
                    <option value="roleless">Roleless</option>
                  </select>
                  <ChevronDownIcon className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1120px] w-full border-separate border-spacing-0">
              <thead className="bg-slate-50/80">
                <tr className="text-left text-[0.78rem] font-bold uppercase tracking-[0.14em] text-slate-500">
                  {["Name", "Login ID", "Email", "Roles", "Status", "Joined", canManageRoles ? "Action" : ""].map((column, index) => (
                    <th key={`${column}-${index}`} className="border-b border-slate-200 px-4 py-3.5">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={canManageRoles ? 7 : 6} className="px-4 py-16 text-center text-sm text-slate-500">
                      Loading users...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={canManageRoles ? 7 : 6} className="px-4 py-16 text-center">
                      <div className="mx-auto max-w-md space-y-3">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                          <ShieldIcon className="h-6 w-6" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Unable to load users</h3>
                        <p className="text-sm leading-6 text-slate-500">{error}</p>
                      </div>
                    </td>
                  </tr>
                ) : pageUsers.length > 0 ? (
                  pageUsers.map((item, index) => {
                    const isSelected = item.id === selectedUserId;
                    return (
                      <tr key={item.id} className={[index % 2 === 0 ? "bg-white" : "bg-slate-50/40", isSelected ? "ring-1 ring-inset ring-brand-200 bg-brand-50/40" : ""].join(" ")}>
                        <td className="border-b border-slate-100 px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                              {getInitials(item.full_name || item.login_id) || "U"}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{item.full_name || item.login_id}</div>
                              <div className="text-xs text-slate-500">{item.status}</div>
                            </div>
                          </div>
                        </td>
                        <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-700">{item.login_id}</td>
                        <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-700">{item.email}</td>
                        <td className="border-b border-slate-100 px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            {item.roles.length > 0 ? item.roles.map((role) => <RoleBadge key={role} role={role} />) : <span className="text-sm text-slate-400">No roles</span>}
                          </div>
                        </td>
                        <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-700">{item.status}</td>
                        <td className="border-b border-slate-100 px-4 py-4 text-sm text-slate-700">{formatDate(item.created_at)}</td>
                        {canManageRoles ? (
                          <td className="border-b border-slate-100 px-4 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedUserId(item.id);
                                setSelectedRoles(item.roles);
                              }}
                              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              Manage Roles
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={canManageRoles ? 7 : 6} className="px-4 py-16 text-center">
                      <div className="mx-auto max-w-md space-y-3">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                          <UserIcon className="h-6 w-6" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">No users found</h3>
                        <p className="text-sm leading-6 text-slate-500">
                          Try clearing the filters or search for a different user, login ID, email, or role.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 text-sm text-slate-600 lg:flex-row lg:items-center lg:justify-between">
            <div>
              Showing {firstVisible} to {lastVisible} of {total} entries
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={currentPage === 1}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Prev
              </button>

              <div className="flex items-center gap-1">
                {visiblePages.map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    className={[
                      "min-w-9 rounded-full px-3 py-2 text-sm font-semibold transition",
                      pageNumber === currentPage ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {pageNumber}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                disabled={currentPage === pageCount}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>

              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2">
                <span className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Rows per page</span>
                <select
                  value={rowsPerPage}
                  onChange={(event) => setRowsPerPage(Number(event.target.value))}
                  className="bg-transparent text-sm font-semibold text-slate-700 outline-none"
                >
                  {[10, 20, 50].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[0.98rem] font-extrabold tracking-[-0.03em] text-slate-900">Role Allocation</div>
              <p className="mt-1 text-sm text-slate-500">Select a user and assign one or more roles.</p>
            </div>
            {selectedUser ? <div className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-brand-700">Selected</div> : null}
          </div>

          {selectedUser ? (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-3 rounded-[0.25rem] border border-slate-200 bg-slate-50 p-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-700 shadow-sm">
                  {getInitials(selectedUser.full_name || selectedUser.login_id) || "U"}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">{selectedUser.full_name || selectedUser.login_id}</div>
                  <div className="text-xs text-slate-500">{selectedUser.email}</div>
                </div>
              </div>

              <div className="grid gap-2">
                {ROLE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={[
                      "flex cursor-pointer items-start gap-3 rounded-[0.25rem] border p-3 transition",
                      selectedRoles.includes(option.value) ? "border-brand-300 bg-brand-50/60" : "border-slate-200 bg-white hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(option.value)}
                      onChange={() => toggleRole(option.value)}
                      disabled={!canManageRoles}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:cursor-not-allowed"
                    />
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{option.label}</div>
                      <div className="mt-0.5 text-xs leading-5 text-slate-500">{option.description}</div>
                    </div>
                  </label>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  void saveRoles();
                }}
                disabled={!canManageRoles || saving || !roleChanged}
                className="flex h-11 w-full items-center justify-center rounded-2xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(31,158,122,0.18)] transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Roles"}
              </button>

              {actionError ? (
                <div className="rounded-[0.25rem] border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                  {actionError}
                </div>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    void setUserStatus(selectedUser.status === "active" ? "inactive" : "active");
                  }}
                  disabled={!canManageRoles || saving || selectedUser.id === user.sub}
                  className="flex h-11 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {selectedUser.status === "active" ? "Make Inactive" : "Make Active"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void deleteUser();
                  }}
                  disabled={!canManageRoles || saving || selectedUser.id === user.sub}
                  className="flex h-11 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Delete User
                </button>
              </div>

              {selectedUser.id === user.sub ? (
                <p className="text-xs leading-5 text-slate-500">
                  Your own account is protected from deactivation or deletion.
                </p>
              ) : null}

              <div className="rounded-[0.25rem] border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                <div className="font-semibold text-slate-900">Current roles</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedUser.roles.length > 0 ? selectedUser.roles.map((role) => <RoleBadge key={role} role={role} />) : <span className="text-slate-400">No roles assigned</span>}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-[0.25rem] border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
                <UserIcon className="h-6 w-6" />
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-900">No user selected</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Choose a user from the list to view details and update their roles.
              </p>
            </div>
          )}
        </SectionCard>
      </section>
    </div>
  );
}
