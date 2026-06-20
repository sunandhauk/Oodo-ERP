"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useAuditLog } from "@/components/audit-log-provider";
import { CalendarIcon, ChevronDownIcon, DashboardIcon, EyeToggleIcon, LockIcon, MailIcon, UserIcon } from "@/components/icons";
import { useEditableProfile } from "@/components/profile-store";
import type { SessionUser } from "@/lib/auth-types";
import type { EditableProfile } from "@/lib/profile";
import { createDefaultProfile, normalizeEditableProfile, saveProfilePassword, validateEditableProfile } from "@/lib/profile";
import { validatePassword } from "@/lib/validators";

type EditableField = keyof EditableProfile | "avatarDataUrl";
type FieldTouched = Partial<Record<EditableField, boolean>>;

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function summaryInputClass(hasError: boolean, editable: boolean) {
  return [
    "min-w-0 rounded-xl border border-transparent bg-transparent outline-none transition",
    editable ? "focus:px-3 focus:py-1" : "cursor-default",
    hasError ? "border-rose-300 bg-rose-50/60 px-3 py-1 text-rose-700 focus:border-rose-400" : editable ? "focus:border-slate-200 focus:bg-slate-50" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function ProfileBadge({ profile }: { profile: EditableProfile }) {
  const initials = getInitials(profile.displayName) || "U";

  return profile.avatarDataUrl ? (
    <div className="relative h-full w-full">
      <Image src={profile.avatarDataUrl} alt={profile.displayName} fill unoptimized className="object-cover" />
    </div>
  ) : (
    <div className="flex h-full w-full items-center justify-center rounded-full bg-[#dcefe8] text-brand-800">
      <span className="text-3xl font-extrabold tracking-[-0.05em]">{initials}</span>
    </div>
  );
}

function collectChangedFields(before: EditableProfile, after: EditableProfile) {
  const entries: Array<{ field: keyof EditableProfile; before: string; after: string }> = [];

  (Object.keys(after) as Array<keyof EditableProfile>).forEach((field) => {
    if (field === "avatarDataUrl") {
      return;
    }

    if (before[field] !== after[field]) {
      entries.push({
        field,
        before: String(before[field]),
        after: String(after[field]),
      });
    }
  });

  return entries;
}

export function ProfileContent({ user }: { user: SessionUser }) {
  const { appendAuditLog } = useAuditLog();
  const { profile, setProfile, resetProfile } = useEditableProfile(user);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<EditableProfile>(profile);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [passwordExpanded, setPasswordExpanded] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState<FieldTouched>({});
  const [avatarError, setAvatarError] = useState("");

  useEffect(() => {
    setDraft(profile);
    setSubmitAttempted(false);
    setTouched({});
    setAvatarError("");
    setPasswordExpanded(false);
    setPasswordValue("");
    setPasswordVisible(false);
    setPasswordTouched(false);
    setPasswordSaving(false);
    setPasswordStatus("");
  }, [profile]);

  const joinedOn = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(user.iat * 1000)),
    [user.iat],
  );

  const validationErrors = useMemo(() => validateEditableProfile(draft), [draft]);
  const formIsValid = Object.keys(validationErrors).length === 0 && !avatarError;
  const passwordError = useMemo(() => validatePassword(passwordValue), [passwordValue]);

  function updateField<K extends keyof EditableProfile>(key: K, value: EditableProfile[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setTouched((current) => ({ ...current, [key]: true }));
  }

  function markTouched(key: EditableField) {
    setTouched((current) => ({ ...current, [key]: true }));
  }

  function handleAvatarUpload(file: File | null) {
    if (!file) {
      return;
    }

    const isValidType = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
    const isValidSize = file.size <= 2 * 1024 * 1024;

    if (!isValidType || !isValidSize) {
      setAvatarError("Upload a JPG, PNG, or WebP image up to 2MB.");
      appendAuditLog({
        user: draft.displayName,
        module: "Profile",
        recordType: "Avatar",
        recordId: user.sub,
        action: "Updated",
        fieldChanged: "Avatar upload",
        oldValue: profile.avatarDataUrl ? "Custom image" : "Default avatar",
        newValue: file.name,
        details: "Invalid avatar upload attempt blocked by validation.",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const nextAvatar = String(reader.result ?? "");
      setAvatarError("");
      setDraft((current) => ({ ...current, avatarDataUrl: nextAvatar }));
      setTouched((current) => ({ ...current, avatarDataUrl: true }));
      appendAuditLog({
        user: draft.displayName,
        module: "Profile",
        recordType: "Avatar",
        recordId: user.sub,
        action: "Updated",
        fieldChanged: "Avatar",
        oldValue: profile.avatarDataUrl ? "Custom image" : "Default avatar",
        newValue: file.name,
        details: `Uploaded profile picture ${file.name}.`,
      });
    };
    reader.readAsDataURL(file);
  }

  function handleQuickAction() {
    setIsEditing(true);
    setPasswordExpanded((current) => !current);
    setPasswordStatus("");
    setPasswordTouched(false);
    setPasswordVisible(false);
    setPasswordValue("");
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordTouched(true);
    setPasswordStatus("");

    if (passwordError) {
      return;
    }

    setPasswordSaving(true);
    try {
      const normalized = passwordValue.trim();
      saveProfilePassword(user, normalized);
      appendAuditLog({
        user: draft.displayName,
        module: "Profile",
        recordType: "Password",
        recordId: user.sub,
        action: "Updated",
        fieldChanged: "Password",
        oldValue: "Hidden",
        newValue: "Updated",
        details: "Password updated from the profile quick action panel.",
      });
      setPasswordStatus("Password updated successfully.");
      setPasswordValue("");
      setPasswordVisible(false);
      setPasswordExpanded(false);
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitAttempted(true);

    const nextErrors = validateEditableProfile(draft);
    if (Object.keys(nextErrors).length > 0 || avatarError) {
      setTouched({
        displayName: true,
        loginId: true,
        email: true,
        phone: true,
        role: true,
        department: true,
        location: true,
        employeeId: true,
        bio: true,
        status: true,
        avatarDataUrl: true,
      });
      return;
    }

    setSaving(true);
    try {
      const normalized = normalizeEditableProfile(draft);
      const previous = profile;
      const changes = collectChangedFields(previous, normalized);

      setProfile(normalized);
      appendAuditLog({
        user: normalized.displayName,
        module: "Profile",
        recordType: "Profile",
        recordId: user.sub,
        action: "Updated",
        fieldChanged: changes[0]?.field ?? "Profile details",
        oldValue: changes[0]?.before ?? "-",
        newValue: changes[0]?.after ?? normalized.displayName,
        details:
          changes.length > 0
            ? `Updated profile fields: ${changes.map((change) => change.field).join(", ")}.`
            : "Saved profile with no field changes.",
      });

      setDraft(normalized);
      setAvatarError("");
      setTouched({});
      setSubmitAttempted(false);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setIsEditing(true);
    resetProfile();
    const defaults = createDefaultProfile(user);
    setDraft(defaults);
    setAvatarError("");
    setTouched({});
    setSubmitAttempted(false);
    appendAuditLog({
      user: defaults.displayName,
      module: "Profile",
      recordType: "Profile",
      recordId: user.sub,
      action: "Updated",
      fieldChanged: "Profile reset",
      oldValue: "Edited profile",
      newValue: "Default profile",
      details: "Reset profile values back to the default state for this browser.",
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <section className="flex flex-wrap items-end justify-between gap-4 animate-fade-up">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <span>Home</span>
            <span className="text-slate-300">/</span>
            <span className="text-brand-600">My Profile</span>
          </div>
          <h1 className="mt-2 text-[1.65rem] font-extrabold tracking-[-0.04em] text-slate-900 sm:text-[1.9rem]">My Profile</h1>
          <p className="mt-1 text-[0.9rem] text-slate-500 sm:text-[0.95rem]">Edit your account details, profile picture, and access information.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEditing((current) => !current)}
            className={[
              "inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition",
              isEditing ? "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
            ].join(" ")}
          >
            {isEditing ? "Editing" : "Edit"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition hover:bg-slate-50"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={saving || !isEditing || !formIsValid}
            className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(31,158,122,0.2)] transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.45fr_0.95fr]">
        <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] animate-fade-up" style={{ animationDelay: "60ms" }}>
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <div className="relative flex w-fit items-center justify-center">
              <div className="h-44 w-44 overflow-hidden rounded-full shadow-[0_14px_35px_rgba(31,158,122,0.12)] ring-1 ring-brand-100">
                <ProfileBadge profile={draft} />
              </div>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md transition hover:bg-slate-50"
                aria-label="Upload profile picture"
              >
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    setUploading(true);
                    handleAvatarUpload(event.target.files?.[0] ?? null);
                    event.target.value = "";
                    setTimeout(() => setUploading(false), 300);
                  }}
                />
                {uploading ? (
                  <span className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-slate-500">...</span>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="3" />
                    <circle cx="9" cy="10" r="1.5" />
                    <path d="m21 16-4.5-4.5-4 4L9 11.5 3 18" />
                  </svg>
                )}
              </button>
            </div>

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  value={draft.displayName}
                  onChange={(event) => updateField("displayName", event.target.value)}
                  onBlur={() => markTouched("displayName")}
                  readOnly={!isEditing}
                  aria-invalid={Boolean((touched.displayName || submitAttempted) && validationErrors.displayName)}
                  className={`min-w-0 rounded-xl border border-transparent bg-transparent text-[1.8rem] font-extrabold tracking-[-0.05em] text-slate-900 outline-none transition ${
                    (touched.displayName || submitAttempted) && validationErrors.displayName
                      ? "border-rose-300 bg-rose-50/60 px-3 py-1 text-rose-700 focus:border-rose-400"
                      : isEditing
                        ? "focus:border-slate-200 focus:bg-slate-50 focus:px-3 focus:py-1"
                        : "cursor-default"
                  }`}
                />
                <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">{draft.status}</span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-3 text-[0.96rem] text-slate-600">
                <input
                  value={draft.role}
                  onChange={(event) => updateField("role", event.target.value)}
                  onBlur={() => markTouched("role")}
                  readOnly={!isEditing}
                  aria-invalid={Boolean((touched.role || submitAttempted) && validationErrors.role)}
                  className={summaryInputClass(Boolean((touched.role || submitAttempted) && validationErrors.role), isEditing)}
                />
                <span>•</span>
                <input
                  value={draft.department}
                  onChange={(event) => updateField("department", event.target.value)}
                  onBlur={() => markTouched("department")}
                  readOnly={!isEditing}
                  aria-invalid={Boolean((touched.department || submitAttempted) && validationErrors.department)}
                  className={summaryInputClass(Boolean((touched.department || submitAttempted) && validationErrors.department), isEditing)}
                />
              </div>
              <p className="mt-2 text-[0.96rem] text-slate-600">Login session: {user.kind}</p>

              <div className="mt-5 grid gap-3 text-[0.95rem] text-slate-700 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <CalendarIcon className="h-5 w-5 text-slate-400" />
                  <span>{joinedOn}</span>
                </div>
                <div className="flex items-center gap-3">
                  <MailIcon className="h-5 w-5 text-slate-400" />
                  <input
                    value={draft.email}
                    onChange={(event) => updateField("email", event.target.value)}
                    onBlur={() => markTouched("email")}
                    readOnly={!isEditing}
                    aria-invalid={Boolean((touched.email || submitAttempted) && validationErrors.email)}
                    className={`min-w-0 flex-1 rounded-lg border border-transparent bg-transparent outline-none transition ${
                      (touched.email || submitAttempted) && validationErrors.email
                        ? "border-rose-300 bg-rose-50/60 px-2 py-1 text-rose-700 focus:border-rose-400"
                        : isEditing
                          ? "focus:border-slate-200 focus:bg-slate-50 focus:px-2 focus:py-1"
                          : "cursor-default"
                    }`}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <UserIcon className="h-5 w-5 text-slate-400" />
                  <input
                    value={draft.employeeId}
                    onChange={(event) => updateField("employeeId", event.target.value)}
                    onBlur={() => markTouched("employeeId")}
                    readOnly={!isEditing}
                    aria-invalid={Boolean((touched.employeeId || submitAttempted) && validationErrors.employeeId)}
                    className={`min-w-0 flex-1 rounded-lg border border-transparent bg-transparent outline-none transition ${
                      (touched.employeeId || submitAttempted) && validationErrors.employeeId
                        ? "border-rose-300 bg-rose-50/60 px-2 py-1 text-rose-700 focus:border-rose-400"
                        : isEditing
                          ? "focus:border-slate-200 focus:bg-slate-50 focus:px-2 focus:py-1"
                          : "cursor-default"
                    }`}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <DashboardIcon className="h-5 w-5 text-slate-400" />
                  <input
                    value={draft.location}
                    onChange={(event) => updateField("location", event.target.value)}
                    onBlur={() => markTouched("location")}
                    readOnly={!isEditing}
                    aria-invalid={Boolean((touched.location || submitAttempted) && validationErrors.location)}
                    className={`min-w-0 flex-1 rounded-lg border border-transparent bg-transparent outline-none transition ${
                      (touched.location || submitAttempted) && validationErrors.location
                        ? "border-rose-300 bg-rose-50/60 px-2 py-1 text-rose-700 focus:border-rose-400"
                        : isEditing
                          ? "focus:border-slate-200 focus:bg-slate-50 focus:px-2 focus:py-1"
                          : "cursor-default"
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>
          {avatarError ? <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{avatarError}</p> : null}
        </article>

        <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] animate-fade-up" style={{ animationDelay: "100ms" }}>
          <h2 className="text-[1.05rem] font-extrabold tracking-[-0.03em] text-slate-900">Quick Actions</h2>
          <div className="mt-4 divide-y divide-slate-100">
            <button
              type="button"
              onClick={handleQuickAction}
              className="flex w-full items-center justify-between gap-4 py-4 text-left transition hover:text-slate-900"
            >
              <span className="flex items-center gap-3 text-[0.95rem] font-semibold text-slate-700">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <LockIcon className="h-5 w-5" />
                </span>
                Change Password
              </span>
              <ChevronDownIcon className={`h-4 w-4 text-slate-400 transition ${passwordExpanded ? "rotate-0" : "rotate-[-90deg]"}`} />
            </button>

            {passwordExpanded ? (
              <form onSubmit={handlePasswordSubmit} className="space-y-3 py-4">
                <div className="space-y-2">
                  <label className="block text-[0.9rem] font-semibold text-slate-600">New Password</label>
                  <div
                    className={[
                      "flex h-12 items-center rounded-2xl border bg-white px-3 shadow-[0_1px_0_rgba(15,23,42,0.03)] transition",
                      passwordTouched && passwordError ? "border-rose-300 ring-2 ring-rose-100" : "border-slate-200 focus-within:border-brand-300 focus-within:ring-4 focus-within:ring-brand-100",
                    ].join(" ")}
                  >
                    <LockIcon className="h-5 w-5 text-brand-600" />
                    <input
                      value={passwordValue}
                      onChange={(event) => setPasswordValue(event.target.value)}
                      onBlur={() => setPasswordTouched(true)}
                      placeholder="Enter new password"
                      type={passwordVisible ? "text" : "password"}
                      autoComplete="new-password"
                      className="min-w-0 flex-1 bg-transparent px-3 text-[0.95rem] text-ink-800 outline-none placeholder:text-ink-400/70"
                    />
                    <button
                      type="button"
                      onClick={() => setPasswordVisible((current) => !current)}
                      className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label={passwordVisible ? "Hide password" : "Show password"}
                    >
                      <EyeToggleIcon open={passwordVisible} />
                    </button>
                  </div>
                  {passwordTouched && passwordError ? <p className="text-xs font-medium text-rose-600">{passwordError}</p> : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordExpanded(false);
                      setPasswordValue("");
                      setPasswordVisible(false);
                      setPasswordTouched(false);
                      setPasswordStatus("");
                    }}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={passwordSaving || Boolean(passwordError)}
                    className="rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(31,158,122,0.18)] transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {passwordSaving ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </form>
            ) : null}

            {passwordStatus ? <p className="py-3 text-sm font-medium text-brand-700">{passwordStatus}</p> : null}
          </div>
        </article>
      </section>

    </form>
  );
}
