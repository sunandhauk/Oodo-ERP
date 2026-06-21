import { proxyBackendRequest, readBackendList } from "@/lib/backend-request";

export async function GET(request: Request) {
  return readBackendList(request, "/api/bills-of-materials");
}

export async function POST(request: Request) {
  return proxyBackendRequest(request, "/api/bills-of-materials", "POST");
}
