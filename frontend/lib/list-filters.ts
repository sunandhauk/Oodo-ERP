type ListFilterUpdates = {
  q?: string;
  status?: string;
};

export function buildListPath(
  pathname: string,
  searchParams: { toString(): string },
  updates: ListFilterUpdates,
) {
  const params = new URLSearchParams(searchParams.toString());

  if (updates.q !== undefined) {
    const query = updates.q.trim();
    if (query) {
      params.set("q", query);
    } else {
      params.delete("q");
    }
  }

  if (updates.status !== undefined) {
    const status = updates.status.trim();
    if (status && status !== "All Status") {
      params.set("status", status);
    } else {
      params.delete("status");
    }
  }

  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}
