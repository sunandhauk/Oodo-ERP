import { createHmac, timingSafeEqual } from "node:crypto";
import type { SessionKind, SessionPayload, SessionUser } from "@/lib/auth-types";

export const SESSION_COOKIE_NAME = "oodo_session";
const DEFAULT_SECRET = "oodo-erp-dev-secret";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

function getSecret() {
  return process.env.MOCK_JWT_SECRET ?? DEFAULT_SECRET;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}

function createSignature(signingInput: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(signingInput).digest();
}

function buildDisplayName(loginId: string) {
  const cleaned = loginId.trim().replace(/[_.-]+/g, " ");
  if (!cleaned) {
    return "User";
  }

  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildSub(loginId: string, email?: string) {
  const seed = (email ?? loginId).trim().toLowerCase();
  return seed || "user";
}

export function createSessionToken(input: {
  loginId: string;
  email?: string;
  kind: SessionKind;
}): { token: string; user: SessionUser } {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: buildSub(input.loginId, input.email),
    loginId: input.loginId.trim(),
    email: input.email?.trim() || undefined,
    kind: input.kind,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };

  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = base64UrlEncode(createSignature(signingInput, getSecret()));

  return {
    token: `${signingInput}.${signature}`,
    user: {
      ...payload,
      displayName: buildDisplayName(payload.loginId),
    },
  };
}

export function verifySessionToken(token: string): SessionUser | null {
  const parts = token.split(".");

  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = createSignature(signingInput, getSecret());
  const providedSignature = base64UrlDecode(encodedSignature);

  if (providedSignature.length !== expectedSignature.length) {
    return null;
  }

  if (!timingSafeEqual(providedSignature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8")) as SessionPayload;

    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      ...payload,
      displayName: buildDisplayName(payload.loginId),
    };
  } catch {
    return null;
  }
}

export function createSessionCookie(token: string) {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: TOKEN_TTL_SECONDS,
  };
}

export function clearSessionCookie() {
  return {
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  };
}

