import { useEffect, useState } from "react";
import { Code2, LoaderCircle, Search } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import RepositoryCard from "../components/RepositoryCard";
import type { AppOutletContext, RateLimitState } from "../components/AppLayout";
import { ApiError } from "../services/api";
import { searchRepositories } from "../services/repositories";
import type { SearchResponse } from "../types";

const SEARCH_DEBOUNCE_MS = 350;

export default function SearchPage() {
  const { setSearchRateLimit } = useOutletContext<AppOutletContext>();
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setData(null);
      setError("");
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setData(null);
    setError("");
    setIsLoading(true);

    const timeout = window.setTimeout(async () => {
      try {
        const result = await searchRepositories(
          trimmedQuery,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setData(result.data);
        updateRateLimit(setSearchRateLimit, result.rateLimit);
      } catch (caughtError) {
        if (controller.signal.aborted) return;
        if (caughtError instanceof ApiError) {
          updateRateLimit(setSearchRateLimit, caughtError.rateLimit);
          if (caughtError.status === 429) {
            const resetAt = caughtError.rateLimit.reset;
            const resetTime = resetAt
              ? new Date(resetAt * 1000).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : null;
            setError(
              resetTime
                ? `Search rate limit exceeded. Try again at ${resetTime}.`
                : "Search rate limit exceeded. Please try again later.",
            );
          } else {
            setError(caughtError.message);
          }
        } else {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "An unexpected error occurred. Please try again.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, setSearchRateLimit]);

  return (
    <section className="content-wrap">
      <div className="page-heading">
        <div className="eyebrow">
          <span /> REPOSITORY EXPLORER
        </div>
        <h1>
          Find your next
          <br className="desktop-break" /> interesting repository.
        </h1>
        <p className="page-subtitle">
          Search GitHub repositories by name or technology, then explore their
          details.
        </p>
      </div>

      <div className="search-panel">
        <div className="search-field">
          <Search size={21} className="search-field-icon" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Enter a repository name, such as django/django, or a query like django"
            aria-label="Repository name or search query"
            maxLength={256}
          />
          <span className="search-hint">GitHub</span>
        </div>
      </div>
      <p className="search-help">Search starts automatically after a short pause.</p>

      {error && (
        <div className="error-banner" role="alert">
          <span className="error-icon">!</span>
          <span>{error}</span>
        </div>
      )}

      {isLoading && (
        <div className="loading-state" role="status">
          <LoaderCircle size={24} className="spin" />
          <span>Searching GitHub repositories...</span>
        </div>
      )}

      {!isLoading && data && (
        <section className="results-section" aria-live="polite">
          <div className="results-heading">
            <div>
              <div className="section-kicker">SEARCH RESULTS</div>
              <h2>Repositories matching “{data.query}”</h2>
            </div>
            <span className="result-count">
              {data.total_count.toLocaleString("en-US")} found
            </span>
          </div>
          {data.results.length > 0 ? (
            <div className="repository-grid">
              {data.results.map((repository) => (
                <RepositoryCard repository={repository} key={repository.id} />
              ))}
            </div>
          ) : (
            <div className="empty-results">
              <Search size={22} />
              <h3>No repositories found</h3>
              <p>Try different keywords or change your search query.</p>
            </div>
          )}
        </section>
      )}

      {!isLoading && !data && !error && query.trim().length < 2 && (
        <section className="welcome-panel">
          <div className="welcome-art" aria-hidden="true">
            <div className="art-orbit art-orbit--one" />
            <div className="art-orbit art-orbit--two" />
            <div className="art-core">
              <Code2 size={32} />
            </div>
          </div>
          <div className="welcome-copy">
            <span className="section-kicker">START EXPLORING</span>
            <h2>Enter a repository name.</h2>
            <p>
              Enter a full name such as django/django or a short query such as
              django.
            </p>
          </div>
        </section>
      )}
    </section>
  );
}

function updateRateLimit(
  setRateLimit: (rate: RateLimitState) => void,
  rate: RateLimitState,
) {
  if (rate.remaining !== null || rate.limit !== null) {
    setRateLimit(rate);
  }
}
