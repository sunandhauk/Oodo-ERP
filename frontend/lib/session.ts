import { cookies } from "next/headers";
import { decodeSessionToken, mapBackendUserToSessionUser, SESSION_COOKIE_NAME, type BackendUserRecord } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth-types";
import { getBackendApiBaseUrl, readBackendEnvelope } from "@/lib/backend";

export async function getServerSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const claims = decodeSessionToken(token);
  if (!claims) {
    return null;
  }

  try {
    const response = await fetch(`${getBackendApiBaseUrl()}/api/auth/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = await readBackendEnvelope<BackendUserRecord>(response);
    if (payload.status !== "success" || !payload.data) {
      return null;
    }

    return mapBackendUserToSessionUser(payload.data, claims);
  } catch {
    return null;
  }
}
