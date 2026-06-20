import { NextResponse } from "next/server";
import { createSessionCookie, createSessionToken } from "@/lib/auth";

type LoginBody = {
  loginId?: string;
  password?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as LoginBody | null;

  if (!body?.loginId?.trim() || !body?.password?.trim()) {
    return NextResponse.json({ error: "Login ID and password are required." }, { status: 400 });
  }

  const { token, user } = createSessionToken({
    loginId: body.loginId,
    kind: "login",
  });

  const response = NextResponse.json({ user });
  response.cookies.set(createSessionCookie(token));

  return response;
}

