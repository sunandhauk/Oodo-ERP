"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SessionUser } from "@/lib/auth-types";
import { createDefaultProfile, loadProfile, saveProfile } from "@/lib/profile";
import type { EditableProfile } from "@/lib/profile";
import { PROFILE_UPDATED_EVENT } from "@/lib/profile";

export function useEditableProfile(user: SessionUser) {
  const defaultProfile = useMemo(() => createDefaultProfile(user), [user]);
  const [profile, setProfile] = useState<EditableProfile>(() => loadProfile(user));

  useEffect(() => {
    setProfile(loadProfile(user));
  }, [user]);

  useEffect(() => {
    const handleUpdate = () => {
      setProfile(loadProfile(user));
    };

    window.addEventListener(PROFILE_UPDATED_EVENT, handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener(PROFILE_UPDATED_EVENT, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [user]);

  const updateProfile = useCallback(
    (patch: Partial<EditableProfile>) => {
      setProfile((current) => {
        const next = { ...current, ...patch };
        saveProfile(user, next);
        return next;
      });
    },
    [user],
  );

  const setAvatarDataUrl = useCallback(
    (avatarDataUrl: string) => {
      updateProfile({ avatarDataUrl });
    },
    [updateProfile],
  );

  const resetProfile = useCallback(() => {
    saveProfile(user, defaultProfile);
    setProfile(defaultProfile);
  }, [defaultProfile, user]);

  return {
    profile,
    setProfile: (next: EditableProfile) => {
      saveProfile(user, next);
      setProfile(next);
    },
    updateProfile,
    setAvatarDataUrl,
    resetProfile,
  };
}
