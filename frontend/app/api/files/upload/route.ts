import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { getBackendApiBaseUrl } from "@/lib/backend";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ error: "Missing session." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required." }, { status: 400 });
  }

  const outbound = new FormData();
  outbound.append("file", file, file.name);

  try {
    const response = await fetch(`${getBackendApiBaseUrl()}/api/files/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: outbound,
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload ?? { error: "Empty response from file service." }, { status: response.status });
  } catch {
    return NextResponse.json({ error: "File service is unavailable." }, { status: 503 });
  }
}
