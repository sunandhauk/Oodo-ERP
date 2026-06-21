"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentType, SVGProps } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { useAuditLog } from "@/components/audit-log-provider";
import { NotificationCenter } from "@/components/notification-center";
import { LogoutButton } from "@/components/logout-button";
import { useEditableProfile } from "@/components/profile-store";
import {
  BagIcon,
  CartIcon,
  ChevronDownIcon,
  ClockIcon,
  DashboardIcon,
  FactoryIcon,
  MenuDotsIcon,
  ReceiptIcon,
  SearchIcon,
  ShieldIcon,
  UserIcon,
  TruckIcon,
  BoxIcon,
} from "@/components/icons";
import { buildSearchPath } from "@/lib/search-params";
import { buildListPath } from "@/lib/list-filters";
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

type ListRouteConfig = {
  path: string;
  label: string;
  searchPlaceholder: string;
  createPath: string;
  createPermission: string;
};

type DashboardMetricKey =
  | "salesOrders"
  | "purchaseOrders"
  | "manufacturingOrders"
  | "pendingDeliveries"
  | "delayedOrders"
  | "partialReceipts";

type DashboardMetricSummary = {
  key: DashboardMetricKey;
  value: number;
  deltaPercent: number;
  spark: number[];
};

type DashboardSummary = {
  metrics: DashboardMetricSummary[];
  completion: {
    percent: number;
    completed: number;
    inProgress: number;
    pending: number;
    delayed: number;
  };
  salesOverview: {
    total: number;
    statuses: Array<{ label: string; value: number }>;
  };
  purchaseOverview: {
    total: number;
    receivedSeries: number[];
    pendingSeries: number[];
    statuses: Array<{ label: string; value: number }>;
  };
  manufacturingOverview: {
    total: number;
    statuses: Array<{ label: string; value: number }>;
  };
  generatedAt: string;
};

const DEFAULT_SERIES = [0, 0, 0, 0, 0, 0, 0];

const LIST_ROUTE_CONFIG: ListRouteConfig[] = [
  {
    path: "/sales-orders",
    label: "Sales Orders",
    searchPlaceholder: "Search sales orders...",
    createPath: "/sales-orders/new",
    createPermission: "sales.create",
  },
  {
    path: "/purchase-orders",
    label: "Purchase Orders",
    searchPlaceholder: "Search purchase orders...",
    createPath: "/purchase-orders/new",
    createPermission: "purchase.create",
  },
  {
    path: "/manufacturing-orders",
    label: "Manufacturing Orders",
    searchPlaceholder: "Search manufacturing orders...",
    createPath: "/manufacturing-orders/new",
    createPermission: "manufacturing.create",
  },
  {
    path: "/bills-of-materials",
    label: "Bills of Materials",
    searchPlaceholder: "Search bills of materials...",
    createPath: "/bills-of-materials/new",
    createPermission: "manufacturing.create",
  },
  {
    path: "/products",
    label: "Products",
    searchPlaceholder: "Search products...",
    createPath: "/products/new",
    createPermission: "product.create",
  },
];

const METRIC_CONFIG: Record<
  DashboardMetricKey,
  Omit<MetricCard, "value" | "delta" | "spark">
> = {
  salesOrders: {
    label: "Total Sales Orders",
    color: "text-brand-600",
    bg: "bg-brand-50",
    stroke: "#2b9e7a",
    icon: CartIcon,
  },
  purchaseOrders: {
    label: "Total Purchase Orders",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    stroke: "#10b981",
    icon: BagIcon,
  },
  manufacturingOrders: {
    label: "Manufacturing Orders",
    color: "text-violet-600",
    bg: "bg-violet-50",
    stroke: "#8b5cf6",
    icon: FactoryIcon,
  },
  pendingDeliveries: {
    label: "Pending Deliveries",
    color: "text-amber-600",
    bg: "bg-amber-50",
    stroke: "#f59e0b",
    icon: TruckIcon,
  },
  delayedOrders: {
    label: "Delayed Orders",
    color: "text-rose-600",
    bg: "bg-rose-50",
    stroke: "#ef4444",
    icon: ClockIcon,
  },
  partialReceipts: {
    label: "Partial Receipts",
    color: "text-cyan-600",
    bg: "bg-cyan-50",
    stroke: "#06b6d4",
    icon: ReceiptIcon,
  },
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

function DashboardKpiCard({
  label,
  value,
  hint,
  accentClassName,
  active,
  onClick,
}: {
  label: string;
  value: number;
  hint: string;
  accentClassName: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const classes = [
    "rounded-[0.25rem] border bg-white p-4 text-left shadow-[0_16px_38px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_48px_rgba(15,23,42,0.08)]",
    active ? "border-brand-300 ring-2 ring-brand-100" : "border-slate-200",
    onClick ? "cursor-pointer" : "cursor-default",
  ].join(" ");

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        <div className={`text-xs font-semibold uppercase tracking-[0.14em] ${accentClassName}`}>{label}</div>
        <div className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-slate-900">{value}</div>
        <div className="mt-1 text-sm text-slate-500">{hint}</div>
      </button>
    );
  }

  return (
    <div className={classes}>
      <div className={`text-xs font-semibold uppercase tracking-[0.14em] ${accentClassName}`}>{label}</div>
      <div className="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{hint}</div>
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
  const searchParams = useSearchParams();
  const { appendAuditLog } = useAuditLog();
  const { profile } = useEditableProfile(user);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [dashboardError, setDashboardError] = useState("");

  const navItems: SidebarItem[] = useMemo(
    () => [
      { label: "Dashboard", icon: DashboardIcon, path: "/dashboard", scrollTargetId: "dashboard-top" },
      { label: "Sales Orders", icon: CartIcon, path: "/sales-orders" },
      { label: "Purchase Orders", icon: BagIcon, path: "/purchase-orders" },
      { label: "Manufacturing Orders", icon: FactoryIcon, path: "/manufacturing-orders" },
      { label: "Bills of Materials", icon: ReceiptIcon, path: "/bills-of-materials" },
      { label: "Products", icon: BoxIcon, path: "/products" },
      ...(user.permissions.includes("users.manage") ? [{ label: "Users", icon: UserIcon, path: "/users" }] : []),
      { label: "Audit Logs", icon: ShieldIcon, path: "/audit-logs" },
    ],
    [user.permissions],
  );

  const isDashboardRoute = pathname.startsWith("/dashboard");
  const activeListRoute = useMemo(() => LIST_ROUTE_CONFIG.find((route) => pathname === route.path), [pathname]);
  const canQuickCreate = activeListRoute ? user.permissions.includes(activeListRoute.createPermission) : false;
  const isSidebarCompact = sidebarCollapsed;
  const shellSearchQuery = searchParams.get("q") ?? "";

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

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadSummary() {
      try {
        setDashboardError("");
        const response = await fetch("/api/dashboard/summary", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        const payload = (await response.json().catch(() => null)) as
          | { status?: string; data?: DashboardSummary; error?: unknown }
          | null;

        if (!response.ok || payload?.status !== "success" || !payload.data) {
          throw new Error(
            typeof payload?.error === "string"
              ? payload.error
              : "Unable to load dashboard data.",
          );
        }

        if (active) {
          setDashboardSummary(payload.data);
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setDashboardSummary(null);
        setDashboardError(error instanceof Error ? error.message : "Unable to load dashboard data.");
      }
    }

    void loadSummary();
    const refreshHandle = window.setInterval(() => {
      void loadSummary();
    }, 60000);

    return () => {
      active = false;
      controller.abort();
      window.clearInterval(refreshHandle);
    };
  }, []);

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

  function openQuickCreate() {
    if (!activeListRoute || !canQuickCreate) {
      return;
    }

    appendAuditLog({
      user: profile.displayName,
      module: activeListRoute.label,
      recordType: "Page",
      recordId: activeListRoute.createPath,
      action: "Viewed",
      fieldChanged: "Quick action",
      oldValue: pathname,
      newValue: activeListRoute.createPath,
      details: `Opened ${activeListRoute.label} create page from the shortcut button`,
    });

    router.push(activeListRoute.createPath);
  }

  function updateShellSearch(nextQuery: string) {
    if (!activeListRoute) {
      return;
    }

    router.replace(buildSearchPath(pathname, searchParams, nextQuery), { scroll: false });
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

  const numberFormatter = useMemo(() => new Intl.NumberFormat("en-US"), []);
  const isSummaryLoading = dashboardSummary === null && !dashboardError;
  const summaryStatusLabel = dashboardError ? dashboardError : isSummaryLoading ? "Loading live dashboard data..." : `Updated ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(dashboardSummary?.generatedAt || Date.now()))}`;
  const metrics: MetricCard[] = useMemo(() => {
    const metricMap = new Map(dashboardSummary?.metrics.map((metric) => [metric.key, metric]) ?? []);
    return (Object.entries(METRIC_CONFIG) as Array<[DashboardMetricKey, (typeof METRIC_CONFIG)[DashboardMetricKey]]>).map(([key, config]) => {
      const metric = metricMap.get(key);
      return {
        ...config,
        value: metric ? numberFormatter.format(metric.value) : "—",
        delta: metric ? `${metric.deltaPercent >= 0 ? "+" : ""}${metric.deltaPercent}% vs previous 7 days` : summaryStatusLabel,
        spark: metric?.spark ?? DEFAULT_SERIES,
      };
    });
  }, [dashboardSummary, numberFormatter, summaryStatusLabel]);

  const salesOverview =
    dashboardSummary?.salesOverview ?? {
      total: 0,
      statuses: [
        { label: "Draft", value: 0 },
        { label: "Confirmed", value: 0 },
        { label: "Partially Delivered", value: 0 },
        { label: "Delivered", value: 0 },
        { label: "Late", value: 0 },
      ],
    };

  const purchaseOverview =
    dashboardSummary?.purchaseOverview ?? {
      total: 0,
      receivedSeries: DEFAULT_SERIES,
      pendingSeries: DEFAULT_SERIES,
      statuses: [
        { label: "Draft", value: 0 },
        { label: "Confirmed", value: 0 },
        { label: "Pending", value: 0 },
        { label: "Received", value: 0 },
        { label: "Cancelled", value: 0 },
      ],
    };
  const manufacturingOverview =
    dashboardSummary?.manufacturingOverview ?? {
      total: 0,
      statuses: [
        { label: "Draft", value: 0 },
        { label: "Confirmed", value: 0 },
        { label: "In Progress", value: 0 },
        { label: "Done", value: 0 },
        { label: "Cancelled", value: 0 },
      ],
    };

  const isAdmin = user.roles.includes("admin");

  const moduleStatusValue = useCallback(
    (statuses: Array<{ label: string; value: number }>, label: string) => statuses.find((status) => status.label === label)?.value ?? 0,
    [],
  );

  const salesKpis = useMemo(
    () => [
      {
        label: "Total Orders",
        value: salesOverview.total,
        hint: "All sales order records",
        accentClassName: "text-slate-500",
        onClick: () => router.push("/sales-orders"),
      },
      {
        label: "Confirmed",
        value: moduleStatusValue(salesOverview.statuses, "Confirmed"),
        hint: "Confirmed orders",
        accentClassName: "text-emerald-600",
        onClick: () => router.push(buildListPath("/sales-orders", new URLSearchParams(), { status: "Confirmed" })),
      },
      {
        label: "Pending",
        value: moduleStatusValue(salesOverview.statuses, "Pending"),
        hint: "Awaiting fulfillment",
        accentClassName: "text-amber-600",
        onClick: () => router.push(buildListPath("/sales-orders", new URLSearchParams(), { status: "Pending" })),
      },
      {
        label: "Delivered",
        value: moduleStatusValue(salesOverview.statuses, "Delivered"),
        hint: "Completed deliveries",
        accentClassName: "text-blue-600",
        onClick: () => router.push(buildListPath("/sales-orders", new URLSearchParams(), { status: "Delivered" })),
      },
    ],
    [moduleStatusValue, router, salesOverview.statuses, salesOverview.total],
  );

  const salesAdminKpis = useMemo(
    () => [
      {
        label: "Partially Delivered",
        value: moduleStatusValue(salesOverview.statuses, "Partially Delivered"),
        hint: "Admin KPI",
        accentClassName: "text-blue-600",
        onClick: () => router.push(buildListPath("/sales-orders", new URLSearchParams(), { status: "Partially Delivered" })),
      },
      {
        label: "Cancelled",
        value: moduleStatusValue(salesOverview.statuses, "Cancelled"),
        hint: "Admin KPI",
        accentClassName: "text-rose-600",
        onClick: () => router.push(buildListPath("/sales-orders", new URLSearchParams(), { status: "Cancelled" })),
      },
      {
        label: "Draft",
        value: moduleStatusValue(salesOverview.statuses, "Draft"),
        hint: "Admin KPI",
        accentClassName: "text-slate-500",
        onClick: () => router.push(buildListPath("/sales-orders", new URLSearchParams(), { status: "Draft" })),
      },
    ],
    [moduleStatusValue, router, salesOverview.statuses],
  );

  const purchaseKpis = useMemo(
    () => [
      {
        label: "Total Orders",
        value: purchaseOverview.total,
        hint: "All purchase order records",
        accentClassName: "text-slate-500",
        onClick: () => router.push("/purchase-orders"),
      },
      {
        label: "Confirmed",
        value: moduleStatusValue(purchaseOverview.statuses, "Confirmed"),
        hint: "Confirmed orders",
        accentClassName: "text-emerald-600",
        onClick: () => router.push(buildListPath("/purchase-orders", new URLSearchParams(), { status: "Confirmed" })),
      },
      {
        label: "Pending",
        value: moduleStatusValue(purchaseOverview.statuses, "Pending"),
        hint: "Awaiting receipt",
        accentClassName: "text-amber-600",
        onClick: () => router.push(buildListPath("/purchase-orders", new URLSearchParams(), { status: "Pending" })),
      },
      {
        label: "Received",
        value: moduleStatusValue(purchaseOverview.statuses, "Received"),
        hint: "Received orders",
        accentClassName: "text-blue-600",
        onClick: () => router.push(buildListPath("/purchase-orders", new URLSearchParams(), { status: "Received" })),
      },
    ],
    [moduleStatusValue, purchaseOverview.statuses, purchaseOverview.total, router],
  );

  const purchaseAdminKpis = useMemo(
    () => [
      {
        label: "Draft",
        value: moduleStatusValue(purchaseOverview.statuses, "Draft"),
        hint: "Admin KPI",
        accentClassName: "text-slate-500",
        onClick: () => router.push(buildListPath("/purchase-orders", new URLSearchParams(), { status: "Draft" })),
      },
      {
        label: "Cancelled",
        value: moduleStatusValue(purchaseOverview.statuses, "Cancelled"),
        hint: "Admin KPI",
        accentClassName: "text-rose-600",
        onClick: () => router.push(buildListPath("/purchase-orders", new URLSearchParams(), { status: "Cancelled" })),
      },
    ],
    [moduleStatusValue, purchaseOverview.statuses, router],
  );

  const manufacturingKpis = useMemo(
    () => [
      {
        label: "Total Orders",
        value: manufacturingOverview.total,
        hint: "All manufacturing order records",
        accentClassName: "text-slate-500",
        onClick: () => router.push("/manufacturing-orders"),
      },
      {
        label: "Confirmed",
        value: moduleStatusValue(manufacturingOverview.statuses, "Confirmed"),
        hint: "Confirmed orders",
        accentClassName: "text-emerald-600",
        onClick: () => router.push(buildListPath("/manufacturing-orders", new URLSearchParams(), { status: "Confirmed" })),
      },
      {
        label: "In Progress",
        value: moduleStatusValue(manufacturingOverview.statuses, "In Progress"),
        hint: "Work currently in process",
        accentClassName: "text-violet-600",
        onClick: () => router.push(buildListPath("/manufacturing-orders", new URLSearchParams(), { status: "In Progress" })),
      },
      {
        label: "Done",
        value: moduleStatusValue(manufacturingOverview.statuses, "Done"),
        hint: "Finished manufacturing orders",
        accentClassName: "text-blue-600",
        onClick: () => router.push(buildListPath("/manufacturing-orders", new URLSearchParams(), { status: "Done" })),
      },
    ],
    [manufacturingOverview.statuses, manufacturingOverview.total, moduleStatusValue, router],
  );

  const manufacturingAdminKpis = useMemo(
    () => [
      {
        label: "Draft",
        value: moduleStatusValue(manufacturingOverview.statuses, "Draft"),
        hint: "Admin KPI",
        accentClassName: "text-slate-500",
        onClick: () => router.push(buildListPath("/manufacturing-orders", new URLSearchParams(), { status: "Draft" })),
      },
      {
        label: "Cancelled",
        value: moduleStatusValue(manufacturingOverview.statuses, "Cancelled"),
        hint: "Admin KPI",
        accentClassName: "text-rose-600",
        onClick: () => router.push(buildListPath("/manufacturing-orders", new URLSearchParams(), { status: "Cancelled" })),
      },
    ],
    [manufacturingOverview.statuses, moduleStatusValue, router],
  );

  return (
    <main className="h-[100dvh] overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#f3f7fb_100%)] text-slate-900">
      <div className="flex h-full min-w-0">
        {sidebarOpen ? <button type="button" aria-label="Close sidebar" className="fixed inset-0 z-40 bg-slate-900/30 lg:hidden" onClick={closeSidebar} /> : null}

        <aside
          className={[
            "fixed inset-y-0 left-0 z-50 w-[286px] overflow-hidden transform border-r border-brand-100/80 bg-[linear-gradient(180deg,rgba(239,250,247,0.98)_0%,rgba(247,252,250,0.96)_42%,rgba(233,247,242,0.96)_100%)] shadow-[0_18px_50px_rgba(31,158,122,0.08)] backdrop-blur-xl transition-[transform,width] duration-300 lg:sticky lg:top-0 lg:z-auto lg:translate-x-0 lg:shadow-none",
            sidebarCollapsed ? "lg:w-[88px]" : "lg:w-[286px]",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className={[
              "flex h-[96px] min-w-0 items-center justify-between border-b border-slate-200/70",
              sidebarCollapsed ? "px-3 lg:px-3" : "px-6",
            ].join(" ")}>
              <BrandMark className={sidebarCollapsed ? "h-11 w-11" : "h-14 w-14 animate-float-soft"} />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSidebarCollapsed((current) => !current)}
                  className="hidden h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 lg:flex"
                  aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  aria-expanded={!sidebarCollapsed}
                >
                  <ChevronDownIcon className={sidebarCollapsed ? "h-5 w-5 -rotate-90" : "h-5 w-5 rotate-90"} />
                </button>
                <button
                  type="button"
                  onClick={closeSidebar}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 lg:hidden"
                  aria-label="Close sidebar"
                >
                  <MenuDotsIcon className="h-6 w-6 rotate-90" />
                </button>
              </div>
            </div>

            <nav className={["flex-1 min-h-0 space-y-2 overflow-y-auto py-5", sidebarCollapsed ? "px-2 lg:px-2" : "px-4"].join(" ")}>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.path ? pathname.startsWith(item.path) : false;
                return (
                  <button
                    key={item.label}
                    type="button"
                    aria-label={item.label}
                    title={sidebarCollapsed ? item.label : undefined}
                    onClick={() => handleSidebarItemClick(item)}
                    className={[
                      "flex w-full items-center gap-4 rounded-[0.25rem] py-3.5 text-left text-[0.96rem] font-semibold transition duration-200 hover:-translate-y-0.5 active:scale-[0.99]",
                      sidebarCollapsed ? "justify-center px-0 lg:px-0" : "px-4",
                      isActive ? "bg-[#edf9f4] text-brand-700 shadow-[inset_0_0_0_1px_rgba(31,158,122,0.08)]" : "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
                    ].join(" ")}
                  >
                    <span className={isActive ? "text-brand-600" : "text-slate-500"}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className={sidebarCollapsed ? "sr-only lg:hidden" : ""}>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className={["border-t border-brand-100/80 p-4", sidebarCollapsed ? "lg:px-2" : ""].join(" ")}>
              <LogoutButton user={user} compact={sidebarCollapsed} />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-[76px] items-center justify-between border-b border-slate-200/70 bg-white/70 px-4 backdrop-blur-xl sm:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {activeListRoute ? (
                <>
                  <div className="hidden min-w-0 flex-1 md:block">
                    <div className="relative w-full max-w-[42vw]">
                      <SearchIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                      <input
                        type="search"
                        value={shellSearchQuery}
                        onChange={(event) => updateShellSearch(event.target.value)}
                        placeholder={activeListRoute.searchPlaceholder}
                        aria-label={activeListRoute.searchPlaceholder}
                        className="h-12 w-full rounded-full border border-slate-200 bg-white pl-12 pr-4 text-sm font-medium text-slate-900 shadow-[0_10px_24px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-slate-400 focus:border-brand-300 focus:ring-4 focus:ring-brand-100"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1" />
              )}
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              <NotificationCenter actorName={profile.displayName} />

              <button
                type="button"
                onClick={openProfile}
                aria-label={`Account menu for ${profile.displayName}`}
                title={profile.displayName}
                className="flex items-center gap-3 rounded-[0.25rem] border border-slate-200 bg-white px-2 py-1.5 pr-4 shadow-sm transition duration-200 hover:bg-slate-50 active:scale-[0.99]"
              >
                <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-[0.25rem] bg-slate-100 text-sm font-bold text-slate-700">
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

              </section>

              <section className="hidden gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                {metrics.map((metric, index) => {
                  const Icon = metric.icon;
                  const metricRoute =
                    metric.label === "Total Sales Orders"
                      ? "/sales-orders"
                      : metric.label === "Total Purchase Orders"
                        ? "/purchase-orders"
                        : metric.label === "Manufacturing Orders"
                          ? "/manufacturing-orders"
                          : "";
                  return (
                    <button
                      key={metric.label}
                      type="button"
                      onClick={metricRoute ? () => router.push(metricRoute) : undefined}
                      className={[
                        "rounded-[0.25rem] border border-slate-200 bg-white p-3.5 text-left shadow-[0_16px_38px_rgba(15,23,42,0.05)] animate-fade-up transition duration-200 hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(15,23,42,0.08)]",
                        metricRoute ? "cursor-pointer" : "cursor-default",
                      ].join(" ")}
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
                    </button>
                  );
                })}
              </section>

              <section className="space-y-4">
                <article className="rounded-[0.25rem] border border-slate-200 bg-white p-3.5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] animate-fade-up" style={{ animationDelay: "90ms" }}>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-[0.98rem] font-extrabold tracking-[-0.03em] text-slate-900">Sales Orders</h2>
                    <button type="button" onClick={() => router.push("/sales-orders")} className="rounded-full border border-slate-200 px-3 py-1 text-[0.8rem] font-medium text-slate-600">
                      View List
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {salesKpis.map((card) => (
                      <DashboardKpiCard key={card.label} {...card} />
                    ))}
                  </div>
                  {isAdmin ? <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{salesAdminKpis.map((card) => <DashboardKpiCard key={card.label} {...card} />)}</div> : null}
                </article>

                <article className="rounded-[0.25rem] border border-slate-200 bg-white p-3.5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] animate-fade-up" style={{ animationDelay: "120ms" }}>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-[0.98rem] font-extrabold tracking-[-0.03em] text-slate-900">Purchase Orders</h2>
                    <button type="button" onClick={() => router.push("/purchase-orders")} className="rounded-full border border-slate-200 px-3 py-1 text-[0.8rem] font-medium text-slate-600">
                      View List
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {purchaseKpis.map((card) => (
                      <DashboardKpiCard key={card.label} {...card} />
                    ))}
                  </div>
                  {isAdmin ? <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-2">{purchaseAdminKpis.map((card) => <DashboardKpiCard key={card.label} {...card} />)}</div> : null}
                </article>

                <article className="rounded-[0.25rem] border border-slate-200 bg-white p-3.5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] animate-fade-up" style={{ animationDelay: "150ms" }}>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-[0.98rem] font-extrabold tracking-[-0.03em] text-slate-900">Manufacturing Orders</h2>
                    <button type="button" onClick={() => router.push("/manufacturing-orders")} className="rounded-full border border-slate-200 px-3 py-1 text-[0.8rem] font-medium text-slate-600">
                      View List
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {manufacturingKpis.map((card) => (
                      <DashboardKpiCard key={card.label} {...card} />
                    ))}
                  </div>
                  {isAdmin ? <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-2">{manufacturingAdminKpis.map((card) => <DashboardKpiCard key={card.label} {...card} />)}</div> : null}
                </article>
              </section>

              <section className="rounded-[0.25rem] border border-slate-200 bg-white p-3.5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] animate-fade-up" style={{ animationDelay: "120ms" }}>
                <div className="grid gap-4 lg:grid-cols-[240px_1fr] lg:items-center">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-[0.92rem] font-semibold text-slate-900">Overall Order Completion</p>
                      <div className="mt-3 flex items-center justify-center">
                        <Donut percent={68} stroke="#2b9e7a" label="Completed" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="h-3 rounded-full bg-slate-100 p-1">
                      <div className="flex h-full overflow-hidden rounded-full">
                        <div className="w-[68%] bg-brand-500" />
                        <div className="w-[17%] bg-brand-400" />
                        <div className="w-[11%] bg-brand-300" />
                        <div className="w-[4%] bg-brand-700" />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-[0.82rem] font-semibold text-slate-600 sm:text-[0.9rem]">
                      <div>
                        <p className="text-brand-600">Completed</p>
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
                <article className="rounded-[0.25rem] border border-slate-200 bg-white p-3.5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] animate-fade-up transition duration-200 hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(15,23,42,0.08)]" style={{ animationDelay: "160ms" }}>
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
                          <circle cx="100" cy="100" r="68" fill="none" stroke="#57b997" strokeWidth="30" strokeDasharray="153 430" strokeDashoffset="-96" />
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
                        ["Delivered", "11 (34.4%)", "#2b9e7a"],
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

                <article className="rounded-[0.25rem] border border-slate-200 bg-white p-3.5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] animate-fade-up transition duration-200 hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(15,23,42,0.08)]" style={{ animationDelay: "220ms" }}>
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
                          <circle cx="100" cy="100" r="68" fill="none" stroke="#2b9e7a" strokeWidth="30" strokeDasharray="108 430" strokeDashoffset="-210" />
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
                          <span className="flex items-center gap-2 text-brand-600"><span className="h-2.5 w-2.5 rounded-full bg-brand-500" />Pending</span>
                        </div>
                      </div>
                      <div className="h-36 rounded-[0.25rem] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-2.5">
                        <svg viewBox="0 0 420 170" className="h-full w-full" aria-hidden="true">
                          <path d="M30 138H395" stroke="#e5e7eb" strokeWidth="2" />
                          <path d="M30 112H395" stroke="#eef2f7" strokeWidth="1" />
                          <path d="M30 86H395" stroke="#eef2f7" strokeWidth="1" />
                          <path d="M30 60H395" stroke="#eef2f7" strokeWidth="1" />
                          <polyline fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points="30,120 85,112 140,104 195,96 250,84 305,76 360,66" />
                          <polyline fill="none" stroke="#2b9e7a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points="30,138 85,134 140,130 195,126 250,122 305,118 360,114" />
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
                            <circle key={`${x}-${y}`} cx={x} cy={y} r="3.5" fill="#2b9e7a" />
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

              </div>
            )}
          </main>
        </div>
      </div>
    </main>
  );
}

