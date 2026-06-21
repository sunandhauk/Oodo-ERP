import { proxyBackendRequest, readBackendList } from "@/lib/backend-request";

export async function GET(request: Request) {
  return readBackendList(request, "/api/users");
}

export async function POST(request: Request) {
  return proxyBackendRequest(request, "/api/users", "POST");
}
