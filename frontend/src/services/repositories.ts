import type { SearchResponse } from "../types";

interface ApiErrorBody {
  detail?: string | { message?: string; github_message?: string };
  q?: string[];
}

export async function searchRepositories(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query, per_page: "12" });
  const response = await fetch(`/api/search/?${params}`, { signal });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    const detail = body.detail;
    const message =
      typeof detail === "string"
        ? detail
        : detail?.github_message ??
          body.q?.[0] ??
          `Не вдалося виконати пошук (HTTP ${response.status}).`;
    throw new Error(message);
  }

  return (await response.json()) as SearchResponse;
}
