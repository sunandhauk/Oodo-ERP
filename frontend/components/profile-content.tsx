"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useAuditLog } from "@/components/audit-log-provider";
import { CalendarIcon, ChevronDownIcon, DashboardIcon, LockIcon, MailIcon, ShieldIcon, UserIcon } from "@/components/icons";
import { useEditableProfile } from "@/components/profile-store";
import type { SessionUser } from "@/lib/auth-types";
import type { EditableProfile } from "@/lib/profile";

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function SectionRow({
  label,
  value,
  editable = false,
  type = "text",
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  editable?: boolean;
  type?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 border-b border-slate-100 py-4 last:border-b-0 sm:grid-cols-[190px_1fr] sm:items-center">
      <span className="text-[0.92rem] text-slate-500">{label}</span>
      {editable ? (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          placeholder={placeholder}
          className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-[0.92rem] font-semibold text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white"
        />
      ) : (
        <span className="text-[0.92rem] font-semibold text-slate-900">{value}</span>
      )}
    </label>
  );
}

function ProfileBadge({ profile }: { profile: EditableProfile }) {
  const initials = getInitials(profile.displayName) || "U";

  return profile.avatarDataUrl ? (
    <div className="relative h-full w-full">
      <Image src={profile.avatarDataUrl} alt={profile.displayName} fill unoptimized className="object-cover" />
    </div>
  ) : (
    <div className="flex h-full w-full items-center justify-center rounded-full bg-[#dbe7ff] text-[#183b8c]">
      <span className="text-3xl font-extrabold tracking-[-0.05em]">{initials}</span>
    </div>
  );
}

export function ProfileContent({ user }: { user: SessionUser }) {
  const { appendAuditLog } = useAuditLog();
  const { profile, setProfile, setAvatarDataUrl, resetProfile } = useEditableProfile(user);
  const [draft, setDraft] = useState<EditableProfile>(profile);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setDraft(profile);
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

  function updateField<K extends keyof EditableProfile>(key: K, value: EditableProfile[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleAvatarUpload(file: File | null) {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAvatarDataUrl(String(reader.result ?? ""));
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      setProfile(draft);
      appendAuditLog({
        user: draft.displayName,
        module: "Profile",
        recordType: "Profile",
        recordId: user.sub,
        action: "Updated",
        fieldChanged: "Profile details",
        oldValue: user.displayName,
        newValue: draft.displayName,
        details: "Profile information updated from the editable profile form.",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    resetProfile();
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <section className="flex flex-wrap items-end justify-between gap-4 animate-fade-up">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <span>Home</span>
            <span className="text-slate-300">/</span>
            <span className="text-blue-600">My Profile</span>
          </div>
          <h1 className="mt-2 text-[1.65rem] font-extrabold tracking-[-0.04em] text-slate-900 sm:text-[1.9rem]">
            My Profile
          </h1>
          <p className="mt-1 text-[0.9rem] text-slate-500 sm:text-[0.95rem]">
            Edit your account details, profile picture, and access information.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition hover:bg-slate-50"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(59,130,246,0.2)] transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.45fr_0.95fr]">
        <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] animate-fade-up" style={{ animationDelay: "60ms" }}>
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <div className="relative flex w-fit items-center justify-center">
              <div className="h-44 w-44 overflow-hidden shadow-[0_14px_35px_rgba(59,130,246,0.12)]">
                <ProfileBadge profile={draft} />
              </div>
              <label
                className="absolute bottom-3 right-3 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md transition hover:bg-slate-50"
                aria-label="Upload profile picture"
              >
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    setUploading(true);
                    handleAvatarUpload(event.target.files?.[0] ?? null);
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
              </label>
            </div>

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  value={draft.displayName}
                  onChange={(event) => updateField("displayName", event.target.value)}
                  className="min-w-0 rounded-xl border border-transparent bg-transparent text-[1.8rem] font-extrabold tracking-[-0.05em] text-slate-900 outline-none transition focus:border-slate-200 focus:bg-slate-50 focus:px-3 focus:py-1"
                />
                <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">{draft.status}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[0.96rem] text-slate-600">
                <input
                  value={draft.role}
                  onChange={(event) => updateField("role", event.target.value)}
                  className="min-w-[150px] rounded-xl border border-transparent bg-transparent outline-none transition focus:border-slate-200 focus:bg-slate-50 focus:px-3 focus:py-1"
                />
                <span>•</span>
                <input
                  value={draft.department}
                  onChange={(event) => updateField("department", event.target.value)}
                  className="min-w-[150px] rounded-xl border border-transparent bg-transparent outline-none transition focus:border-slate-200 focus:bg-slate-50 focus:px-3 focus:py-1"
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
                    className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent outline-none transition focus:border-slate-200 focus:bg-slate-50 focus:px-2 focus:py-1"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <UserIcon className="h-5 w-5 text-slate-400" />
                  <input
                    value={draft.employeeId}
                    onChange={(event) => updateField("employeeId", event.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent outline-none transition focus:border-slate-200 focus:bg-slate-50 focus:px-2 focus:py-1"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <DashboardIcon className="h-5 w-5 text-slate-400" />
                  <input
                    value={draft.location}
                    onChange={(event) => updateField("location", event.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent outline-none transition focus:border-slate-200 focus:bg-slate-50 focus:px-2 focus:py-1"
                  />
                </div>
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] animate-fade-up" style={{ animationDelay: "100ms" }}>
          <h2 className="text-[1.05rem] font-extrabold tracking-[-0.03em] text-slate-900">Quick Actions</h2>
          <div className="mt-4 divide-y divide-slate-100">
            {["Change Password", "Update Profile Picture", "Account Settings"].map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => appendAuditLog({
                  user: draft.displayName,
                  module: "Profile",
                  recordType: "Quick Action",
                  recordId: label,
                  action: "Viewed",
                  fieldChanged: "Action",
                  oldValue: "-",
                  newValue: label,
                  details: `${label} opened from the profile page`,
                })}
                className="flex w-full items-center justify-between gap-4 py-4 text-left transition hover:text-slate-900"
              >
                <span className="flex items-center gap-3 text-[0.95rem] font-semibold text-slate-700">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-slate-500">
                    {label === "Change Password" ? (
                      <LockIcon className="h-5 w-5" />
                    ) : label === "Update Profile Picture" ? (
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="5" width="18" height="14" rx="3" />
                        <circle cx="9" cy="10" r="1.5" />
                        <path d="m21 16-4.5-4.5-4 4L9 11.5 3 18" />
                      </svg>
                    ) : (
                      <ShieldIcon className="h-5 w-5" />
                    )}
                  </span>
                  {label}
                </span>
                <ChevronDownIcon className="h-4 w-4 rotate-[-90deg] text-slate-400" />
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] animate-fade-up" style={{ animationDelay: "140ms" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eff6ff] text-blue-600">
              <UserIcon className="h-5 w-5" />
            </div>
            <h2 className="text-[1.05rem] font-extrabold tracking-[-0.03em] text-slate-900">Editable Profile Information</h2>
          </div>
          <div className="mt-2">
            <SectionRow label="Full Name" value={draft.displayName} editable onChange={(value) => updateField("displayName", value)} placeholder="Enter full name" />
            <SectionRow label="Login ID" value={draft.loginId} editable onChange={(value) => updateField("loginId", value)} placeholder="Enter login ID" />
            <SectionRow label="Email" value={draft.email} editable type="email" onChange={(value) => updateField("email", value)} placeholder="Enter email" />
            <SectionRow label="Phone" value={draft.phone} editable onChange={(value) => updateField("phone", value)} placeholder="Enter phone number" />
            <SectionRow label="Department" value={draft.department} editable onChange={(value) => updateField("department", value)} placeholder="Enter department" />
            <SectionRow label="Location" value={draft.location} editable onChange={(value) => updateField("location", value)} placeholder="Enter location" />
            <SectionRow label="Employee ID" value={draft.employeeId} editable onChange={(value) => updateField("employeeId", value)} placeholder="Employee ID" />
            <SectionRow label="Status" value={draft.status} editable onChange={(value) => updateField("status", value as EditableProfile["status"])} placeholder="Active" />
          </div>
          <div className="mt-4">
            <label className="mb-2 block text-[0.92rem] text-slate-500">Bio</label>
            <textarea
              value={draft.bio}
              onChange={(event) => updateField("bio", event.target.value)}
              rows={4}
              className="w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-[0.92rem] font-medium text-slate-900 outline-none transition focus:border-slate-300 focus:bg-white"
            />
          </div>
        </article>

        <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_16px_38px_rgba(15,23,42,0.05)] animate-fade-up" style={{ animationDelay: "180ms" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <ShieldIcon className="h-5 w-5" />
            </div>
            <h2 className="text-[1.05rem] font-extrabold tracking-[-0.03em] text-slate-900">Security Information</h2>
          </div>
          <div className="mt-2">
            <SectionRow label="Password" value="••••••••••••" />
            <SectionRow label="Session Kind" value={user.kind} />
            <SectionRow label="Joined On" value={joinedOn} />
            <SectionRow label="Avatar" value={draft.avatarDataUrl ? "Uploaded" : "Default"} />
            <SectionRow label="Changes" value="Editable and saved locally" />
          </div>
          <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            Profile changes are stored locally for this browser and immediately reflected in the dashboard header.
          </div>
        </article>
      </section>
    </form>
  );
}
