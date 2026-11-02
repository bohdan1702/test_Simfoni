import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  ExternalLink,
  GitFork,
  LoaderCircle,
  MessageSquare,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import type {
  AppOutletContext,
  RateLimitState,
} from "../components/AppLayout";
import { ApiError } from "../services/api";
import {
  fetchContributors,
  fetchRepository,
  waitForRetry,
} from "../services/repositoryDetails";
import type { ContributorSummary, RepositoryReport } from "../types";

type ContributorsState =
  | { status: "loading" }
  | { status: "pending"; attempt: number; maxAttempts: number }
  | { status: "exhausted" }
  | { status: "ready"; data: ContributorSummary }
  | { status: "error"; message: string };

const MAX_CONTRIBUTOR_ATTEMPTS = 4;

export default function RepositoryPage() {
  const { owner = "", name = "" } = useParams();
  const { setCoreRateLimit } = useOutletContext<AppOutletContext>();
  const [repository, setRepository] = useState<RepositoryReport | null>(null);
  const [contributors, setContributors] = useState<ContributorsState>({
    status: "loading",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setRepository(null);
    setError("");
    setContributors({ status: "loading" });

    async function loadRepository() {
      try {
        const result = await fetchRepository(owner, name, controller.signal);
        if (controller.signal.aborted) return;
        setRepository(result.data);
        updateRateLimit(setCoreRateLimit, result.rateLimit);
      } catch (caughtError) {
        if (!controller.signal.aborted) {
          if (caughtError instanceof ApiError) {
            updateRateLimit(setCoreRateLimit, caughtError.rateLimit);
          }
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Failed to load the repository.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    async function loadContributors() {
      try {
        for (
          let attempt = 1;
          attempt <= MAX_CONTRIBUTOR_ATTEMPTS && !controller.signal.aborted;
          attempt += 1
        ) {
          const result = await fetchContributors(
            owner,
            name,
            controller.signal,
          );
          if (controller.signal.aborted) return;
          updateRateLimit(setCoreRateLimit, result.rateLimit);
          if (result.status === "ready") {
            setContributors({ status: "ready", data: result.data });
            return;
          }

          if (attempt === MAX_CONTRIBUTOR_ATTEMPTS) {
            setContributors({ status: "exhausted" });
            return;
          }

          setContributors({
            status: "pending",
            attempt,
            maxAttempts: MAX_CONTRIBUTOR_ATTEMPTS,
          });
          await waitForRetry(result.retryAfterSeconds, controller.signal);
        }
      } catch (caughtError) {
        if (!controller.signal.aborted) {
          if (caughtError instanceof ApiError) {
            updateRateLimit(setCoreRateLimit, caughtError.rateLimit);
          }
          setContributors({
            status: "error",
            message:
              caughtError instanceof Error
                ? caughtError.message
                : "Failed to load contributor metrics.",
          });
        }
      }
    }

    void loadRepository();
    void loadContributors();

    return () => controller.abort();
  }, [owner, name, setCoreRateLimit]);

  return (
    <section className="content-wrap repository-page">
      <Link to="/" className="back-link">
        <ArrowLeft size={16} />
        Back to search
      </Link>

      {isLoading && (
        <div className="loading-state" role="status">
          <LoaderCircle size={24} className="spin" />
          <span>Loading repository data...</span>
        </div>
      )}

      {error && (
        <div className="error-banner" role="alert">
          <span className="error-icon">!</span>
          <span>{error}</span>
        </div>
      )}

      {repository && (
        <>
          {repository.archived && (
            <div className="archived-warning" role="alert">
              <ShieldCheck size={18} />
              <span>
                <strong>This repository is archived.</strong> It is still
                available to browse, but active maintainer support is unlikely.
              </span>
            </div>
          )}
          <div className="repo-heading">
            <div className="eyebrow">
              <span /> REPOSITORY OVERVIEW
            </div>
            <div className="repo-title-row">
              <div>
                <p className="repository-owner">{owner}</p>
                <h1>{name}</h1>
              </div>
              <a
                className="github-repo-button"
                href={repository.url}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={16} />
                GitHub
              </a>
            </div>
            <p className="repo-description">
              {repository.description || "No description provided."}
            </p>
          </div>

          <div className="metrics-grid">
            <MetricCard
              icon={<Star size={18} />}
              label="Stars"
              value={repository.stars.toLocaleString("en-US")}
              meaning="The number of users who have starred this repository."
              caveat="Popularity does not guarantee quality, security, or active maintenance."
              tone="gold"
            />
            <MetricCard
              icon={<ShieldCheck size={18} />}
              label="License"
              value={
                repository.license
                  ? repository.license
                  : "Not specified · potential risk"
              }
              meaning="The license GitHub detected for this repository."
              caveat={
                repository.license
                  ? "Review the license file and dependency terms before use."
                  : "Without an explicit license, your rights to use and distribute the code may be limited."
              }
              tone="violet"
            />
            <MetricCard
              icon={<GitFork size={18} />}
              label="Archive status"
              value={repository.archived ? "Archived" : "Not archived"}
              meaning="Whether GitHub marks this repository as archived."
              caveat="A repository that is not archived may still lack regular maintainer responses or contributions."
              tone={repository.archived ? "rose" : "blue"}
            />
            <MetricCard
              icon={<MessageSquare size={18} />}
              label="Open issues"
              value={repository.open_issues.toLocaleString("en-US")}
              meaning="The number of open issues reported by GitHub."
              caveat="This count includes pull requests and does not indicate issue complexity or resolution speed."
              tone="rose"
            />
            <MetricCard
              icon={<Activity size={18} />}
              label="Activity"
              value={formatAge(repository.last_push_days)}
              meaning="When changes were last pushed; a release indicates a published version."
              detail={
                repository.last_release
                  ? `Release ${repository.last_release.tag || ""} · ${formatAge(repository.last_release.days_ago)}`
                  : "No releases found"
              }
              caveat="Pushes may be automated by bots, so check releases as well. Releases may also be published through other channels."
              tone="green"
            />
          </div>

          <section className="bus-factor-card">
            <div className="bus-factor-heading">
              <div className="metric-icon metric-icon--blue">
                <Users size={19} />
              </div>
              <div>
                <span className="section-kicker">TEAM RESILIENCE</span>
                <h2>Bus factor</h2>
              </div>
              {contributors.status === "pending" && (
                <span className="pending-badge">
                  <LoaderCircle size={13} className="spin" />
                  Calculating · attempt {contributors.attempt}/{contributors.maxAttempts}
                </span>
              )}
            </div>
            <p className="metric-explanation">
              The minimum number of authors responsible for at least 50% of
              changes over the past 52 weeks. A lower number may indicate
              greater reliance on a few individuals.
            </p>
            {contributors.status === "loading" ||
            contributors.status === "pending" ? (
              <div className="contributors-pending" role="status">
                <LoaderCircle size={17} className="spin" />
                Calculating contributor activity. We will retry after the
                interval specified by GitHub.
              </div>
            ) : contributors.status === "exhausted" ? (
              <div className="contributors-pending" role="status">
                GitHub has not finished calculating the statistics. Please
                refresh the page later.
              </div>
            ) : contributors.status === "error" ? (
              <div className="metric-warning" role="alert">
                Failed to load the bus factor: {contributors.message}
              </div>
            ) : (
              <>
                {contributors.data.bus_factor === 0 ? (
                  <div className="contributors-pending">
                    Not enough data to estimate the bus factor.
                  </div>
                ) : (
                  <>
                    <div className="bus-factor-summary">
                      <div className="bus-factor-value">
                        <strong>{contributors.data.bus_factor}</strong>
                        <span>author(s) for 50% of changes</span>
                      </div>
                      <div className="contributors-count">
                        {contributors.data.contributors_in_window} contributors in{" "}
                        {contributors.data.window_weeks} weeks
                      </div>
                    </div>
                    <p className="bus-factor-conclusion">
                      {contributors.data.bus_factor}{" "}
                      {pluralizeAuthors(contributors.data.bus_factor)} account for{" "}
                      {Math.round((contributors.data.top_share ?? 0) * 100)}%
                      of changes over the past year.
                    </p>
                    {contributors.data.top_authors.length > 0 && (
                      <div className="author-list">
                        {contributors.data.top_authors.map((author) => (
                          <div className="author-row" key={author.login}>
                            <a
                              href={`https://github.com/${encodeURIComponent(author.login)}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              @{author.login}
                            </a>
                            <div
                              className="author-share-track"
                              role="img"
                              aria-label={`${Math.round(author.share * 100)}% of changes`}
                            >
                              <span
                                style={{ width: `${author.share * 100}%` }}
                              />
                            </div>
                            <strong>{Math.round(author.share * 100)}%</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            <p className="metric-caveat">
              What it means: the number of authors who together account for at
              least half of changed lines over the past year. Bots are excluded.
              Limitations: GitHub statistics may be delayed, and line counts do
              not capture complexity, reviews, or less visible contributions.
            </p>
          </section>
        </>
      )}
    </section>
  );
}

interface MetricCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
  meaning: string;
  caveat: string;
  tone: "gold" | "violet" | "blue" | "rose" | "green";
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  meaning,
  caveat,
  tone,
}: MetricCardProps) {
  return (
    <article className="metric-card">
      <div className="metric-card-heading">
        <span className={`metric-icon metric-icon--${tone}`}>{icon}</span>
        <span>{label}</span>
      </div>
      <strong className="metric-value">{value}</strong>
      {detail && <span className="metric-detail">{detail}</span>}
      <p className="metric-explanation">{meaning}</p>
      <p className="metric-caveat">{caveat}</p>
    </article>
  );
}

function formatAge(days: number | null): string {
  if (days === null) return "Unknown";
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function pluralizeAuthors(count: number): string {
  return count === 1 ? "author" : "authors";
}

function updateRateLimit(
  setRateLimit: (rate: RateLimitState) => void,
  rate: RateLimitState,
) {
  if (rate.remaining !== null || rate.limit !== null) {
    setRateLimit(rate);
  }
}
