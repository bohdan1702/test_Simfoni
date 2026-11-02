export interface ApiResponse<T> {
  data: T;
  rateLimit: RateLimit;
}

export interface RateLimit {
  remaining: number | null;
  limit: number | null;
  reset: number | null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly rateLimit: RateLimit,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function rateLimitFromResponse(response: Response): RateLimit {
  return {
    remaining: parseHeader(response, "X-RateLimit-Remaining"),
    limit: parseHeader(response, "X-RateLimit-Limit"),
    reset: parseHeader(response, "X-RateLimit-Reset"),
  };
}

export async function throwApiError(response: Response): Promise<never> {
  const body = (await response.json().catch(() => ({}))) as {
    detail?: unknown;
    github_message?: string;
    q?: string[];
    rate_limit?: {
      remaining?: number | null;
      limit?: number | null;
      reset?: number | null;
    };
  };
  const detail = body.detail;
  const message =
    typeof detail === "string"
      ? detail
      : body.github_message ??
        body.q?.[0] ??
        `Request failed (HTTP ${response.status}).`;

  const headerRateLimit = rateLimitFromResponse(response);
  throw new ApiError(message, response.status, {
    remaining: headerRateLimit.remaining ?? body.rate_limit?.remaining ?? null,
    limit: headerRateLimit.limit ?? body.rate_limit?.limit ?? null,
    reset: headerRateLimit.reset ?? body.rate_limit?.reset ?? null,
  });
}

function parseHeader(response: Response, name: string): number | null {
  const value = response.headers.get(name);
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
