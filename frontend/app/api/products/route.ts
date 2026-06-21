import { proxyBackendRequest, readBackendList } from "@/lib/backend-request";

export async function GET(request: Request) {
  return readBackendList(request, "/api/master-data/products");
}

export async function POST(request: Request) {
  return proxyBackendRequest(request, "/api/master-data/products", "POST");
}
