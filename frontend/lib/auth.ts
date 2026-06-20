import type { SessionUser } from "@/lib/auth-types";

export const SESSION_COOKIE_NAME = "oodo_session";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

export type SessionTokenClaims = {
  sub: string;
  tenantId: string;
  email: string;
  roles: string[];
  permissions: string[];
  iat: number;
  exp: number;
};

export type BackendUserRecord = {
  id: string;
  tenant_id: string;
  login_id: string;
  email: string;
  full_name: string;
  status: string;
  roles: string[];
  permissions: string[];
};

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}

export function decodeSessionToken(token: string): SessionTokenClaims | null {
  const parts = token.split(".");

  if (parts.length !== 3) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(parts[1]).toString("utf8")) as Partial<SessionTokenClaims>;
    if (
      typeof payload.sub !== "string" ||
      typeof payload.tenantId !== "string" ||
      typeof payload.email !== "string" ||
      !Array.isArray(payload.roles) ||
      !Array.isArray(payload.permissions) ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      sub: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
      roles: payload.roles.map((item) => String(item)),
      permissions: payload.permissions.map((item) => String(item)),
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export function mapBackendUserToSessionUser(user: BackendUserRecord, claims: SessionTokenClaims): SessionUser {
  const fullName = user.full_name.trim() || user.login_id.trim();
  return {
    sub: user.id,
    tenantId: user.tenant_id,
    loginId: user.login_id.trim(),
    fullName,
    displayName: fullName,
    email: user.email,
    status: user.status,
    roles: user.roles,
    permissions: user.permissions,
    iat: claims.iat,
    exp: claims.exp,
  };
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
