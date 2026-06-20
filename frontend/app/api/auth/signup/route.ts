import { NextResponse } from "next/server";
import {
  decodeSessionToken,
  createSessionCookie,
  mapBackendUserToSessionUser,
  type BackendUserRecord,
} from "@/lib/auth";
import { getBackendApiBaseUrl, getBackendErrorMessage, readBackendEnvelope } from "@/lib/backend";

type SignupBody = {
  loginId?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SignupBody | null;

  if (!body?.loginId?.trim() || !body?.email?.trim() || !body?.password?.trim()) {
    return NextResponse.json({ error: "All required fields must be filled in." }, { status: 400 });
  }

  try {
    const response = await fetch(`${getBackendApiBaseUrl()}/api/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: body.email.trim(),
        loginId: body.loginId.trim(),
        fullName: body.loginId.trim(),
        password: body.password,
      }),
      cache: "no-store",
    });

    const payload = await readBackendEnvelope<{ accessToken: string; user: BackendUserRecord }>(response);
    if (!response.ok || payload.status !== "success" || !payload.data?.accessToken || !payload.data?.user) {
      return NextResponse.json(
        { error: getBackendErrorMessage(payload.error) },
        { status: response.status >= 400 ? response.status : 400 },
      );
    }

    const claims = decodeSessionToken(payload.data.accessToken);
    if (!claims) {
      return NextResponse.json({ error: "The backend returned an invalid session token." }, { status: 502 });
    }

    const user = mapBackendUserToSessionUser(payload.data.user, claims);
    const nextResponse = NextResponse.json({ user });
    nextResponse.cookies.set(createSessionCookie(payload.data.accessToken));

    return nextResponse;
  } catch {
    return NextResponse.json({ error: "Auth backend is unavailable." }, { status: 503 });
  }
}
