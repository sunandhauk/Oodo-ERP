import type { SessionUser } from "@/lib/auth-types";

export const PROFILE_STORAGE_PREFIX = "oodo-erp.profile.v2";
export const PROFILE_UPDATED_EVENT = "oodo-erp:profile-updated";
export const PASSWORD_STORAGE_PREFIX = "oodo-erp.password.v1";

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

export type EditableProfileErrors = Partial<Record<keyof EditableProfile | "avatarDataUrl", string>>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9][0-9\s()-]{7,}$/;
const EMPLOYEE_ID_REGEX = /^EMP-[A-Z0-9-]{4,16}$/i;
const PROFILE_STATUSES: EditableProfile["status"][] = ["Active", "Away", "Offline"];

function storageKey(sub: string) {
  return `${PROFILE_STORAGE_PREFIX}:${sub}`;
}

function passwordStorageKey(sub: string) {
  return `${PASSWORD_STORAGE_PREFIX}:${sub}`;
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

export function normalizeEditableProfile(profile: EditableProfile): EditableProfile {
  const status = PROFILE_STATUSES.includes(profile.status) ? profile.status : "Active";

  return {
    ...profile,
    displayName: profile.displayName.trim(),
    loginId: profile.loginId.trim(),
    email: profile.email.trim().toLowerCase(),
    phone: profile.phone.trim(),
    role: profile.role.trim(),
    department: profile.department.trim(),
    location: profile.location.trim(),
    employeeId: profile.employeeId.trim().toUpperCase(),
    bio: profile.bio.trim(),
    status,
    avatarDataUrl: profile.avatarDataUrl?.trim() || "",
  };
}

export function validateEditableProfile(profile: EditableProfile): EditableProfileErrors {
  const errors: EditableProfileErrors = {};
  const normalized = normalizeEditableProfile(profile);

  if (normalized.displayName.length < 2) {
    errors.displayName = "Enter a display name with at least 2 characters.";
  }

  if (!normalized.loginId) {
    errors.loginId = "Login ID is required.";
  } else if (normalized.loginId.length < 3) {
    errors.loginId = "Login ID must be at least 3 characters.";
  }

  if (!normalized.email) {
    errors.email = "Email is required.";
  } else if (!EMAIL_REGEX.test(normalized.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!normalized.phone) {
    errors.phone = "Phone number is required.";
  } else if (!PHONE_REGEX.test(normalized.phone)) {
    errors.phone = "Enter a valid phone number.";
  }

  if (!normalized.role) {
    errors.role = "Role is required.";
  } else if (normalized.role.length < 2) {
    errors.role = "Role must be at least 2 characters.";
  }

  if (!normalized.department) {
    errors.department = "Department is required.";
  }

  if (!normalized.location) {
    errors.location = "Location is required.";
  }

  if (!normalized.employeeId) {
    errors.employeeId = "Employee ID is required.";
  } else if (!EMPLOYEE_ID_REGEX.test(normalized.employeeId)) {
    errors.employeeId = "Employee ID should look like EMP-0001.";
  }

  if (!normalized.bio) {
    errors.bio = "Bio is required.";
  } else if (normalized.bio.length < 20) {
    errors.bio = "Bio should be at least 20 characters.";
  } else if (normalized.bio.length > 240) {
    errors.bio = "Bio should be 240 characters or less.";
  }

  if (normalized.avatarDataUrl && !normalized.avatarDataUrl.startsWith("data:image/")) {
    errors.avatarDataUrl = "Please upload a valid image file.";
  }

  return errors;
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

    return normalizeEditableProfile({
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
    });
  } catch {
    return createDefaultProfile(user);
  }
}

export function saveProfile(user: SessionUser, profile: EditableProfile) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey(user.sub), JSON.stringify(normalizeEditableProfile(profile)));
  window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
}

export function loadProfilePassword(user: SessionUser) {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return window.localStorage.getItem(passwordStorageKey(user.sub)) ?? "";
  } catch {
    return "";
  }
}

export function saveProfilePassword(user: SessionUser, password: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(passwordStorageKey(user.sub), password);
}
