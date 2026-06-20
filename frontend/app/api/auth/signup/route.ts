import { NextResponse } from "next/server";
import { createSessionCookie, createSessionToken } from "@/lib/auth";

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

  const { token, user } = createSessionToken({
    loginId: body.loginId,
    email: body.email,
    kind: "signup",
  });

  const response = NextResponse.json({ user });
  response.cookies.set(createSessionCookie(token));

  return response;
}

