import {
  rateLimitFromResponse,
  throwApiError,
  type ApiResponse,
} from "./api";
import type { ContributorSummary, RepositoryReport } from "../types";

export async function fetchRepository(
  owner: string,
  name: string,
  signal: AbortSignal,
): Promise<ApiResponse<RepositoryReport>> {
  const response = await fetch(
    `/api/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/`,
    { signal },
  );
  if (!response.ok) {
    await throwApiError(response);
  }

  return {
    data: (await response.json()) as RepositoryReport,
    rateLimit: rateLimitFromResponse(response),
  };
}

export type ContributorsResponse =
  | {
      status: "pending";
      retryAfterSeconds: number;
      rateLimit: ReturnType<typeof rateLimitFromResponse>;
    }
  | {
      status: "ready";
      data: ContributorSummary;
      rateLimit: ReturnType<typeof rateLimitFromResponse>;
    };

export async function fetchContributors(
  owner: string,
  name: string,
  signal: AbortSignal,
): Promise<ContributorsResponse> {
  const response = await fetch(
    `/api/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/contributors/`,
    { signal },
  );
  const rateLimit = rateLimitFromResponse(response);

  if (response.status === 202) {
    const retryAfter = Number(response.headers.get("Retry-After"));
    return {
      status: "pending",
      retryAfterSeconds:
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 3,
      rateLimit,
    };
  }
  if (!response.ok) {
    await throwApiError(response);
  }

  return {
    status: "ready",
    data: (await response.json()) as ContributorSummary,
    rateLimit,
  };
}

export function waitForRetry(seconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timeout = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, seconds * 1000);

    function onAbort() {
      window.clearTimeout(timeout);
      reject(new DOMException("Aborted", "AbortError"));
    }

    signal.addEventListener("abort", onAbort, { once: true });
  });
}
