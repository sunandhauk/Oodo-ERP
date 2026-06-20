"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { ComponentType, SVGProps } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { useAuditLog } from "@/components/audit-log-provider";
import { LogoutButton } from "@/components/logout-button";
import { useEditableProfile } from "@/components/profile-store";
import {
  BagIcon,
  BellIcon,
  CalendarIcon,
  CartIcon,
  ChevronDownIcon,
  ClockIcon,
  DashboardIcon,
  FactoryIcon,
  MenuDotsIcon,
  ReceiptIcon,
  SearchIcon,
  ShieldIcon,
  TruckIcon,
  BoxIcon,
} from "@/components/icons";
import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/auth-types";

type DashboardShellProps = {
  user: SessionUser;
  children?: ReactNode;
};

type SidebarItem = {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  path?: string;
  scrollTargetId?: string;
};

type MetricCard = {
  label: string;
  value: string;
  delta: string;
  color: string;
  bg: string;
  stroke: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  spark: number[];
};

type PipelineStage = {
  label: string;
  value: string;
  accent: string;
};

function BadgeIcon({
  icon: Icon,
  bg,
  color,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  bg: string;
  color: string;
}) {
  return (
    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${bg} ${color}`}>
      <Icon className="h-5 w-5" />
    </div>
  );
}

function Sparkline({ points, stroke }: { points: number[]; stroke: string }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = Math.max(max - min, 1);
  const coords = points
    .map((value, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * 100;
      const y = 100 - ((value - min) / range) * 70 - 15;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      <polyline fill="none" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" points={coords} />
    </svg>
  );
}

function Donut({
  percent,
  stroke,
  label,
}: {
  percent: number;
  stroke: string;
  label: string;
}) {
  return (
    <div className="relative flex h-28 w-28 items-center justify-center rounded-full">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(${stroke} ${percent}%, #e8edf4 ${percent}% 100%)`,
        }}
      />
      <div className="absolute inset-[10px] rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]" />
      <div className="relative text-center">
        <div className="text-xl font-extrabold tracking-[-0.04em] text-slate-900">{percent}%</div>
        <div className="mt-0.5 text-[0.72rem] font-semibold text-slate-500">{label}</div>
      </div>
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function DashboardShell({ user, children }: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { appendAuditLog } = useAuditLog();
  const { profile } = useEditableProfile(user);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  const navItems: SidebarItem[] = useMemo(
    () => [
      { label: "Dashboard", icon: DashboardIcon, path: "/dashboard", scrollTargetId: "dashboard-top" },
      { label: "Sales Orders", icon: CartIcon, path: "/sales-orders" },
      { label: "Purchase Orders", icon: BagIcon, scrollTargetId: "purchase-orders-overview" },
      { label: "Manufacturing Orders", icon: FactoryIcon, scrollTargetId: "manufacturing-orders-pipeline" },
      { label: "Bills of Materials", icon: ReceiptIcon, scrollTargetId: "manufacturing-orders-pipeline" },
      { label: "Products", icon: BoxIcon, scrollTargetId: "dashboard-top" },
      { label: "Audit Logs", icon: ShieldIcon, path: "/audit-logs" },
    ],
    [],
  );

  const isDashboardRoute = pathname.startsWith("/dashboard");

  useEffect(() => {
    appendAuditLog({
      user: user.displayName,
      module: "Navigation",
      recordType: "Page",
      recordId: pathname,
      action: "Viewed",
      fieldChanged: "Route",
      oldValue: "-",
      newValue: pathname,
      details: pathname === "/dashboard" ? "Dashboard opened" : pathname === "/audit-logs" ? "Audit logs opened" : "Navigation updated",
    });
  }, [appendAuditLog, pathname, user.displayName]);

  useEffect(() => {
    if (!isDashboardRoute) {
      return;
    }

    const hashTarget = window.location.hash.replace("#", "");
    if (!hashTarget) {
      return;
    }

    const element = document.getElementById(hashTarget);
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [isDashboardRoute, pathname]);

  function setSidebarVisible(nextOpen: boolean) {
    if (sidebarOpen === nextOpen) {
      return;
    }

    setSidebarOpen(nextOpen);
    appendAuditLog({
      user: user.displayName,
      module: "Navigation",
      recordType: "Sidebar",
      recordId: "main-sidebar",
      action: nextOpen ? "Opened" : "Closed",
      fieldChanged: "Visibility",
      oldValue: nextOpen ? "Closed" : "Opened",
      newValue: nextOpen ? "Opened" : "Closed",
      details: "Sidebar visibility changed from the top menu button",
    });
  }

  function toggleSidebar() {
    setSidebarVisible(!sidebarOpen);
  }

  function closeSidebar() {
    setSidebarVisible(false);
  }

  function scrollToTarget(targetId: string) {
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openProfile() {
    appendAuditLog({
      user: profile.displayName,
      module: "Navigation",
      recordType: "Page",
      recordId: "/profile",
      action: "Viewed",
      fieldChanged: "Account chip",
      oldValue: pathname,
      newValue: "/profile",
      details: "Opened profile from the top-right account menu",
    });

    router.push("/profile");
  }

  function handleSidebarItemClick(item: SidebarItem) {
    appendAuditLog({
      user: user.displayName,
      module: "Navigation",
      recordType: item.path ? "Page" : "Menu Item",
      recordId: item.path ?? item.label,
      action: "Viewed",
      fieldChanged: "Sidebar selection",
      oldValue: pathname,
      newValue: item.path ?? item.scrollTargetId ?? item.label,
      details: item.label,
    });

    if (item.path) {
      if (item.path === "/dashboard" && item.scrollTargetId && isDashboardRoute) {
        scrollToTarget(item.scrollTargetId);
      } else if (item.path === "/dashboard" && item.scrollTargetId) {
        router.push(`/dashboard#${item.scrollTargetId}`);
      } else {
        router.push(item.path);
      }

      closeSidebar();
      return;
    }

    if (item.scrollTargetId) {
      if (isDashboardRoute) {
        scrollToTarget(item.scrollTargetId);
      } else {
        router.push(`/dashboard#${item.scrollTargetId}`);
      }
    }

    closeSidebar();
  }

  const metrics: MetricCard[] = [
    { label: "Total Sales Orders", value: "32", delta: "12% from last month", color: "text-blue-600", bg: "bg-blue-50", stroke: "#3b82f6", icon: CartIcon, spark: [18, 22, 21, 27, 24, 30] },
    { label: "Total Purchase Orders", value: "32", delta: "8% from last month", color: "text-emerald-600", bg: "bg-emerald-50", stroke: "#10b981", icon: BagIcon, spark: [16, 20, 19, 24, 23, 28] },
    { label: "Manufacturing Orders", value: "36", delta: "15% from last month", color: "text-violet-600", bg: "bg-violet-50", stroke: "#8b5cf6", icon: FactoryIcon, spark: [15, 19, 18, 25, 26, 31] },
    { label: "Pending Deliveries", value: "18", delta: "9% from last month", color: "text-amber-600", bg: "bg-amber-50", stroke: "#f59e0b", icon: TruckIcon, spark: [12, 13, 15, 17, 16, 19] },
    { label: "Delayed Orders", value: "22", delta: "5% from last month", color: "text-rose-600", bg: "bg-rose-50", stroke: "#ef4444", icon: ClockIcon, spark: [14, 15, 14, 18, 17, 20] },
    { label: "Partial Receipts", value: "7", delta: "4% from last month", color: "text-cyan-600", bg: "bg-cyan-50", stroke: "#06b6d4", icon: ReceiptIcon, spark: [8, 9, 10, 11, 12, 13] },
  ];

  const pipeline: PipelineStage[] = [
    { label: "Draft", value: "2", accent: "#3b82f6" },
    { label: "Confirmed", value: "7", accent: "#10b981" },
    { label: "In-Progress", value: "12", accent: "#8b5cf6" },
    { label: "To Close", value: "6", accent: "#f59e0b" },
    { label: "Done", value: "5", accent: "#22c55e" },
  ];

  return (
    <main className="h-[100dvh] overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#f3f7fb_100%)] text-slate-900">
      <div className="flex h-full min-w-0">
        {sidebarOpen ? <button type="button" aria-label="Close sidebar" className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden" onClick={closeSidebar} /> : null}

        <aside
          className={[
            "fixed inset-y-0 left-0 z-50 w-[286px] overflow-hidden transform border-r border-slate-200/80 bg-white/95 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-transform duration-300 lg:sticky lg:top-0 lg:z-auto lg:translate-x-0 lg:shadow-none",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex h-[96px] items-center justify-between border-b border-slate-200/70 px-6">
              <BrandMark className="h-14 w-14 animate-float-soft" />
              <button
                type="button"
                onClick={closeSidebar}
                className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 lg:hidden"
                aria-label="Close sidebar"
              >
                <MenuDotsIcon className="h-6 w-6 rotate-90" />
              </button>
            </div>

            <nav className="flex-1 min-h-0 space-y-2 overflow-y-auto px-4 py-5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.path ? pathname.startsWith(item.path) : false;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleSidebarItemClick(item)}
                    className={[
                      "flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-left text-[0.96rem] font-semibold transition duration-200 hover:-translate-y-0.5 active:scale-[0.99]",
                      isActive ? "bg-[#eef4ff] text-blue-700 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.08)]" : "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
                    ].join(" ")}
                  >
                    <span className={isActive ? "text-blue-600" : "text-slate-500"}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="px-4 pb-5">
              <div className="rounded-[22px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] p-3.5 shadow-[0_18px_40px_rgba(15,23,42,0.05)] animate-fade-up" style={{ animationDelay: "60ms" }}>
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eff6ff] text-blue-600">
                    <span className="text-xl">📊</span>
                  </div>
                  <div>
                    <p className="text-[0.95rem] font-bold text-slate-900">Your business, on track</p>
                    <p className="mt-1 text-[0.8rem] leading-5 text-slate-500">Monitor, manage and grow with real-time insights.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200/70 p-4">
              <LogoutButton user={user} />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-[76px] items-center justify-between border-b border-slate-200/70 bg-white/70 px-4 backdrop-blur-xl sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleSidebar}
                aria-expanded={sidebarOpen}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition duration-200 hover:bg-slate-50 active:scale-[0.98]"
                aria-label="Open sidebar menu"
              >
                <MenuDotsIcon className="h-6 w-6" />
              </button>

              <div className="hidden md:block">
                <div className="relative w-[390px] max-w-[42vw]">
                  <SearchIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <div className="h-12 rounded-full border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-400 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                    <div className="flex h-full items-center">Search anything...</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition duration-200 hover:bg-slate-50 active:scale-[0.98]"
                aria-label="Notifications"
              >
                <BellIcon className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={openProfile}
                aria-label={`Account menu for ${profile.displayName}`}
                title={profile.displayName}
                className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-2 py-1.5 pr-4 shadow-sm transition duration-200 hover:bg-slate-50 active:scale-[0.99]"
              >
                <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                  {profile.avatarDataUrl ? <Image src={profile.avatarDataUrl} alt={profile.displayName} fill unoptimized className="object-cover" /> : getInitials(profile.displayName) || "U"}
                </div>
                <span className="hidden text-left sm:block">
                  <span className="block text-[0.95rem] font-semibold text-slate-700">{profile.displayName}</span>
                  <span className="block text-[0.72rem] font-medium uppercase tracking-[0.16em] text-slate-400">{profile.role}</span>
                </span>
                <ChevronDownIcon className="h-4 w-4 text-slate-400" />
              </button>
            </div>
          </header>

          <main className="flex-1 min-h-0 overflow-y-auto px-4 py-3 sm:px-6">
            {children ? (
              children
            ) : (
              <div className="flex flex-col gap-3">
              <section className="flex items-end justify-between gap-4 animate-fade-up">
                <div>
                  <h1 className="text-[1.65rem] font-extrabold tracking-[-0.04em] text-slate-900 sm:text-[1.9rem]">
                    Welcome back, Admin 👋
                  </h1>
                  <p className="mt-1 text-[0.88rem] text-slate-500 sm:text-[0.95rem]">Here&apos;s what&apos;s happening with your business right now.</p>
                </div>

                <div className="hidden shrink-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.04)] sm:flex sm:items-center sm:gap-3">
                  <CalendarIcon className="h-5 w-5 text-slate-500" />
                  <span>{todayLabel}</span>
                  <ChevronDownIcon className="h-4 w-4 text-slate-400" />
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                {metrics.map((metric, index) => {
                  const Icon = metric.icon;
                  return (
                    <article
                      key={metric.label}
                      className="rounded-[22px] border border-slate-200 bg-white p-3.5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] animate-fade-up transition duration-200 hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(15,23,42,0.08)]"
                      style={{ animationDelay: `${index * 70}ms` }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <BadgeIcon icon={Icon} bg={metric.bg} color={metric.color} />
                        <div className="h-10 w-14 opacity-90">
                          <Sparkline points={metric.spark} stroke={metric.stroke} />
                        </div>
                      </div>
                      <p className="mt-2.5 text-[0.88rem] font-medium leading-tight text-slate-600">{metric.label}</p>
                      <div className="mt-1.5 text-[1.8rem] font-extrabold tracking-[-0.05em] text-slate-900">{metric.value}</div>
                      <p className="mt-1 text-[0.78rem] font-medium text-slate-500">
                        <span className={`font-bold ${metric.color}`}>↑</span> {metric.delta}
                      </p>
                    </article>
                  );
                })}
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white p-3.5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] animate-fade-up" style={{ animationDelay: "120ms" }}>
                <div className="grid gap-4 lg:grid-cols-[240px_1fr] lg:items-center">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-[0.92rem] font-semibold text-slate-900">Overall Order Completion</p>
                      <div className="mt-3 flex items-center justify-center">
                        <Donut percent={68} stroke="#3b82f6" label="Completed" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="h-3 rounded-full bg-slate-100 p-1">
                      <div className="flex h-full overflow-hidden rounded-full">
                        <div className="w-[68%] bg-blue-500" />
                        <div className="w-[17%] bg-emerald-500" />
                        <div className="w-[11%] bg-amber-400" />
                        <div className="w-[4%] bg-rose-500" />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-[0.82rem] font-semibold text-slate-600 sm:text-[0.9rem]">
                      <div>
                        <p className="text-blue-600">Completed</p>
                        <p className="mt-1 text-slate-900">68%</p>
                      </div>
                      <div>
                        <p className="text-emerald-600">In Progress</p>
                        <p className="mt-1 text-slate-900">17%</p>
                      </div>
                      <div>
                        <p className="text-amber-500">Pending</p>
                        <p className="mt-1 text-slate-900">11%</p>
                      </div>
                      <div>
                        <p className="text-rose-500">Delayed</p>
                        <p className="mt-1 text-slate-900">4%</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid gap-3 xl:grid-cols-2">
                <article className="rounded-[24px] border border-slate-200 bg-white p-3.5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] animate-fade-up transition duration-200 hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(15,23,42,0.08)]" style={{ animationDelay: "160ms" }}>
                  <div className="flex items-center justify-between">
                    <h2 className="text-[0.98rem] font-extrabold tracking-[-0.03em] text-slate-900">Sales Orders Overview</h2>
                    <button type="button" className="rounded-full border border-slate-200 px-3 py-1 text-[0.8rem] font-medium text-slate-600">This Month</button>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-[200px_1fr] md:items-center">
                    <div className="flex justify-center">
                      <div className="relative h-40 w-40">
                        <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
                          <circle cx="100" cy="100" r="68" fill="none" stroke="#e8edf4" strokeWidth="30" />
                          <circle cx="100" cy="100" r="68" fill="none" stroke="#ef476f" strokeWidth="30" strokeDasharray="96 430" />
                          <circle cx="100" cy="100" r="68" fill="none" stroke="#60a5fa" strokeWidth="30" strokeDasharray="153 430" strokeDashoffset="-96" />
                          <circle cx="100" cy="100" r="68" fill="none" stroke="#22c55e" strokeWidth="30" strokeDasharray="94 430" strokeDashoffset="-249" />
                          <circle cx="100" cy="100" r="68" fill="none" stroke="#f59e0b" strokeWidth="30" strokeDasharray="38 430" strokeDashoffset="-343" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <div className="text-2xl font-extrabold tracking-[-0.04em] text-slate-900">32</div>
                          <div className="text-sm font-medium text-slate-500">Total</div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2.5 text-[0.88rem]">
                      {[
                        ["Draft", "2 (6.3%)", "#94a3b8"],
                        ["Confirmed", "7 (21.9%)", "#22c55e"],
                        ["Partially Delivered", "1 (3.1%)", "#f59e0b"],
                        ["Delivered", "11 (34.4%)", "#3b82f6"],
                        ["Late", "11 (34.4%)", "#ef476f"],
                      ].map(([label, value, color]) => (
                        <div key={label} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                            <span className="font-medium text-slate-700">{label}</span>
                          </div>
                          <span className="font-semibold text-slate-900">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>

                <article className="rounded-[24px] border border-slate-200 bg-white p-3.5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] animate-fade-up transition duration-200 hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(15,23,42,0.08)]" style={{ animationDelay: "220ms" }}>
                  <div className="flex items-center justify-between">
                    <h2 className="text-[0.98rem] font-extrabold tracking-[-0.03em] text-slate-900">Purchase Orders Overview</h2>
                    <button type="button" className="rounded-full border border-slate-200 px-3 py-1 text-[0.8rem] font-medium text-slate-600">This Month</button>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-[200px_1fr] md:items-center">
                    <div className="flex justify-center">
                      <div className="relative h-40 w-40">
                        <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
                          <circle cx="100" cy="100" r="68" fill="none" stroke="#e8edf4" strokeWidth="30" />
                          <circle cx="100" cy="100" r="68" fill="none" stroke="#22c55e" strokeWidth="30" strokeDasharray="210 430" />
                          <circle cx="100" cy="100" r="68" fill="none" stroke="#3b82f6" strokeWidth="30" strokeDasharray="108 430" strokeDashoffset="-210" />
                          <circle cx="100" cy="100" r="68" fill="none" stroke="#f59e0b" strokeWidth="30" strokeDasharray="40 430" strokeDashoffset="-318" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <div className="text-2xl font-extrabold tracking-[-0.04em] text-slate-900">32</div>
                          <div className="text-sm font-medium text-slate-500">Total</div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-[0.92rem] text-slate-600">
                        <span className="font-semibold text-slate-900">Received vs Pending Trend</span>
                        <div className="flex items-center gap-4 text-[0.8rem] font-semibold">
                          <span className="flex items-center gap-2 text-emerald-600"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Received</span>
                          <span className="flex items-center gap-2 text-blue-600"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />Pending</span>
                        </div>
                      </div>
                      <div className="h-36 rounded-[18px] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-2.5">
                        <svg viewBox="0 0 420 170" className="h-full w-full" aria-hidden="true">
                          <path d="M30 138H395" stroke="#e5e7eb" strokeWidth="2" />
                          <path d="M30 112H395" stroke="#eef2f7" strokeWidth="1" />
                          <path d="M30 86H395" stroke="#eef2f7" strokeWidth="1" />
                          <path d="M30 60H395" stroke="#eef2f7" strokeWidth="1" />
                          <polyline fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points="30,120 85,112 140,104 195,96 250,84 305,76 360,66" />
                          <polyline fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points="30,138 85,134 140,130 195,126 250,122 305,118 360,114" />
                          {[
                            [30, 120],
                            [85, 112],
                            [140, 104],
                            [195, 96],
                            [250, 84],
                            [305, 76],
                            [360, 66],
                          ].map(([x, y]) => (
                            <circle key={`${x}-${y}`} cx={x} cy={y} r="3.5" fill="#22c55e" />
                          ))}
                          {[
                            [30, 138],
                            [85, 134],
                            [140, 130],
                            [195, 126],
                            [250, 122],
                            [305, 118],
                            [360, 114],
                          ].map(([x, y]) => (
                            <circle key={`${x}-${y}`} cx={x} cy={y} r="3.5" fill="#3b82f6" />
                          ))}
                          {["May 10", "May 11", "May 12", "May 13", "May 14", "May 15", "May 16"].map((label, index) => (
                            <text key={label} x={30 + index * 55} y="162" textAnchor="middle" fontSize="12" fill="#64748b">
                              {label}
                            </text>
                          ))}
                        </svg>
                      </div>
                    </div>
                  </div>
                </article>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_16px_38px_rgba(15,23,42,0.05)] animate-fade-up" style={{ animationDelay: "280ms" }}>
                <div className="flex items-center justify-between">
                  <h2 className="text-[0.98rem] font-extrabold tracking-[-0.03em] text-slate-900">Manufacturing Orders Pipeline</h2>
                  <span className="text-[0.78rem] font-semibold text-slate-500">Total Manufacturing Orders: 32</span>
                </div>

                <div className="mt-3 grid gap-2.5 xl:grid-cols-[repeat(5,minmax(0,1fr))]">
                  {pipeline.map((stage, index) => (
                    <div key={stage.label} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1 rounded-[18px] border border-slate-200 bg-slate-50 px-3 py-3 text-center">
                        <div className="mx-auto mb-2 h-10 w-10 rounded-2xl" style={{ backgroundColor: `${stage.accent}26` }} />
                        <p className="text-[0.84rem] font-semibold text-slate-600">{stage.label}</p>
                        <div className="mt-1 text-[1.55rem] font-extrabold tracking-[-0.04em] text-slate-900">{stage.value}</div>
                        <p className="text-[0.76rem] font-medium text-slate-500">Orders</p>
                      </div>
                      {index < pipeline.length - 1 ? <div className="hidden text-xl font-bold text-slate-400 xl:block">→</div> : null}
                    </div>
                  ))}
                </div>

                <div className="mt-4 h-2 rounded-full bg-slate-100">
                  <div className="flex h-full overflow-hidden rounded-full">
                    <div className="w-[6.3%] bg-blue-500" />
                    <div className="w-[21.9%] bg-emerald-500" />
                    <div className="w-[37.5%] bg-violet-500" />
                    <div className="w-[18.6%] bg-amber-500" />
                    <div className="w-[15.6%] bg-green-500" />
                  </div>
                </div>
              </section>
              </div>
            )}
          </main>
        </div>
      </div>
    </main>
  );
}
