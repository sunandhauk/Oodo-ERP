import type { SessionUser } from "@/lib/auth-types";

export const PROFILE_STORAGE_PREFIX = "oodo-erp.profile.v2";
export const PROFILE_UPDATED_EVENT = "oodo-erp:profile-updated";

export type EditableProfile = {
  displayName: string;
  loginId: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  location: string;
  employeeId: string;
  bio: string;
  status: "Active" | "Away" | "Offline";
  avatarDataUrl?: string;
};

function storageKey(sub: string) {
  return `${PROFILE_STORAGE_PREFIX}:${sub}`;
}

function buildEmployeeId(sub: string) {
  const cleaned = sub.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `EMP-${cleaned.slice(0, 8).padEnd(8, "0") || "00000000"}`;
}

function getPrimaryRole(user: SessionUser) {
  return (user.roles[0] ?? "viewer").toLowerCase();
}

function describeRole(user: SessionUser) {
  switch (getPrimaryRole(user)) {
    case "admin":
      return "System Administrator";
    case "user":
      return "System User";
    case "viewer":
      return "Read-Only Viewer";
    default:
      return "ERP User";
  }
}

function describeDepartment(user: SessionUser) {
  switch (getPrimaryRole(user)) {
    case "admin":
      return "Administration";
    case "user":
      return "Operations";
    case "viewer":
      return "Review";
    default:
      return "General";
  }
}

export function createDefaultProfile(user: SessionUser): EditableProfile {
  return {
    displayName: user.displayName,
    loginId: user.loginId,
    email: user.email,
    phone: "+91 80000 00000",
    role: describeRole(user),
    department: describeDepartment(user),
    location: "Chennai, India",
    employeeId: buildEmployeeId(user.sub),
    bio: "Manage your ERP profile, picture, and access details from this screen.",
    status: "Active",
    avatarDataUrl: "",
  };
}

export function loadProfile(user: SessionUser): EditableProfile {
  if (typeof window === "undefined") {
    return createDefaultProfile(user);
  }

  try {
    const raw = window.localStorage.getItem(storageKey(user.sub));

    if (!raw) {
      return createDefaultProfile(user);
    }

    const parsed = JSON.parse(raw) as Partial<EditableProfile>;
    const defaults = createDefaultProfile(user);

    return {
      ...defaults,
      ...parsed,
      displayName: parsed.displayName?.trim() || defaults.displayName,
      loginId: parsed.loginId?.trim() || defaults.loginId,
      email: parsed.email?.trim() || defaults.email,
      phone: parsed.phone?.trim() || defaults.phone,
      role: parsed.role?.trim() || defaults.role,
      department: parsed.department?.trim() || defaults.department,
      location: parsed.location?.trim() || defaults.location,
      employeeId: parsed.employeeId?.trim() || defaults.employeeId,
      bio: parsed.bio?.trim() || defaults.bio,
      status: parsed.status || defaults.status,
      avatarDataUrl: parsed.avatarDataUrl || "",
    };
  } catch {
    return createDefaultProfile(user);
  }
}

export function saveProfile(user: SessionUser, profile: EditableProfile) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey(user.sub), JSON.stringify(profile));
  window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
}
