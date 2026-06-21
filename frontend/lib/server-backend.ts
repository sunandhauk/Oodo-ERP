import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { getBackendApiBaseUrl, readBackendEnvelope } from "@/lib/backend";

export async function fetchServerBackendList<T>(path: string): Promise<T[]> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return [];
  }

  try {
    const response = await fetch(`${getBackendApiBaseUrl()}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    const payload = await readBackendEnvelope<T[]>(response);
    return payload.status === "success" && Array.isArray(payload.data) ? payload.data : [];
  } catch {
    return [];
  }
}
