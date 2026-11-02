import { rateLimitFromResponse, throwApiError, type ApiResponse } from "./api";
import type { SearchResponse } from "../types";

export async function searchRepositories(
  query: string,
  signal?: AbortSignal,
): Promise<ApiResponse<SearchResponse>> {
  const params = new URLSearchParams({ q: query, per_page: "12" });
  const response = await fetch(`/api/search/?${params}`, { signal });

  if (!response.ok) {
    await throwApiError(response);
  }

  return {
    data: (await response.json()) as SearchResponse,
    rateLimit: rateLimitFromResponse(response),
  };
}
