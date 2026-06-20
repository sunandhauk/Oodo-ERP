export type BackendEnvelope<T> = {
  status?: "progress" | "success" | "failure";
  requestId?: string;
  data?: T;
  error?: unknown;
  timestamp?: string;
};

export function getBackendApiBaseUrl() {
  const url = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_BACKEND_API_URL;
  if (!url) {
    throw new Error("BACKEND_API_URL is required to talk to the auth backend.");
  }

  return url.replace(/\/+$/u, "");
}

export async function readBackendEnvelope<T>(response: Response): Promise<BackendEnvelope<T>> {
  const payload = (await response.json().catch(() => null)) as BackendEnvelope<T> | null;
  if (!payload) {
    throw new Error("The backend returned an empty response.");
  }

  return payload;
}

export function getBackendErrorMessage(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (Array.isArray(message)) {
      const joined = message.filter((item) => typeof item === "string").join(" ");
      if (joined.trim()) {
        return joined;
      }
    }
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return "Something went wrong. Please try again.";
}
