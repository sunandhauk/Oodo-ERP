import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { getBackendApiBaseUrl } from "@/lib/backend";

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ error: "Missing session." }, { status: 401 });
  }

  try {
    const response = await fetch(`${getBackendApiBaseUrl()}/api/dashboard/summary`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload ?? { error: "Empty response from dashboard service." }, { status: response.status });
  } catch {
    return NextResponse.json({ error: "Dashboard service is unavailable." }, { status: 503 });
  }
}
