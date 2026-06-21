export function buildSearchPath(
  pathname: string,
  searchParams: { toString(): string },
  nextQuery: string,
  key = "q",
) {
  const params = new URLSearchParams(searchParams.toString());
  const normalizedQuery = nextQuery.trim();

  if (normalizedQuery) {
    params.set(key, normalizedQuery);
  } else {
    params.delete(key);
  }

  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}
