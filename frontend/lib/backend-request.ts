import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { getBackendApiBaseUrl, getBackendErrorMessage, readBackendEnvelope, type BackendEnvelope } from "@/lib/backend";

export async function proxyBackendGet<T>(path: string, request: Request) {
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const backendUrl = new URL(path, `${getBackendApiBaseUrl()}/`);
  backendUrl.search = url.searchParams.toString();

  const response = await fetch(backendUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: "no-store",
  });

  const payload = await readBackendEnvelope<T>(response);
  return NextResponse.json(payload, { status: response.status });
}

export async function readBackendList<T>(request: Request, path: string) {
  try {
    return await proxyBackendGet<T>(path, request);
  } catch {
    return NextResponse.json(
      {
        status: "failure",
        error: { message: "Backend is unavailable." },
        timestamp: new Date().toISOString(),
      } satisfies BackendEnvelope<T>,
      { status: 503 },
    );
  }
}

export async function proxyBackendRequest<T>(request: Request, path: string, method: "POST" | "PATCH" | "PUT" | "DELETE") {
  const url = new URL(request.url);
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const backendUrl = new URL(path, `${getBackendApiBaseUrl()}/`);
  backendUrl.search = url.searchParams.toString();

  const headers: HeadersInit = {};
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const body = method === "DELETE" ? undefined : await request.text();
  const response = await fetch(backendUrl, {
    method,
    headers,
    body,
    cache: "no-store",
  });

  const payload = await readBackendEnvelope<T>(response);
  return NextResponse.json(payload, { status: response.status });
}

export function unwrapBackendError(error: unknown) {
  return getBackendErrorMessage(error);
}
