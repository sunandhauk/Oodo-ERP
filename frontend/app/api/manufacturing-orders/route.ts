import { proxyBackendRequest, readBackendList } from "@/lib/backend-request";

export async function GET(request: Request) {
  return readBackendList(request, "/api/manufacturing-orders");
}

export async function POST(request: Request) {
  return proxyBackendRequest(request, "/api/manufacturing-orders", "POST");
}
