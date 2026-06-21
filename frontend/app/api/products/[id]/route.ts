import { proxyBackendRequest } from "@/lib/backend-request";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyBackendRequest(request, `/api/master-data/products/${id}`, "DELETE");
}
