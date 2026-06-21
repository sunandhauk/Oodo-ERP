import { proxyBackendGet } from "@/lib/backend-request";

export async function GET(request: Request) {
  return proxyBackendGet("/api/users/lookup", request);
}
