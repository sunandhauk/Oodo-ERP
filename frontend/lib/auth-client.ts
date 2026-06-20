import type { LoginFormValues, SessionUser, SignupFormValues } from "@/lib/auth-types";

type AuthResponse = {
  user: SessionUser;
};

async function parseAuthResponse(response: Response): Promise<AuthResponse> {
  const payload = (await response.json().catch(() => null)) as AuthResponse & { error?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Something went wrong. Please try again.");
  }

  if (!payload || !("user" in payload)) {
    throw new Error("The auth service returned an unexpected response.");
  }

  return payload;
}

async function postJson<T extends Record<string, unknown>>(endpoint: string, body: T) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return parseAuthResponse(response);
}

export const authClient = {
  login(values: LoginFormValues) {
    return postJson("/api/auth/login", values);
  },
  signup(values: SignupFormValues) {
    return postJson("/api/auth/signup", values);
  },
  async logout() {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Unable to sign out right now.");
    }
  },
};

