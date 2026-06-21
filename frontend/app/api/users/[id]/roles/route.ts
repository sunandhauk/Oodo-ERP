import { proxyBackendRequest } from "@/lib/backend-request";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return proxyBackendRequest(request, `/api/users/${id}/roles`, "PATCH");
}
