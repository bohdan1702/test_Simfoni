import {
  ArrowUpRight,
  Code2,
  Github,
  Search,
  Sparkles,
} from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";

export interface AppOutletContext {
  setSearchRateLimit: (rate: RateLimitState) => void;
  setCoreRateLimit: (rate: RateLimitState) => void;
}

export interface RateLimitState {
  remaining: number | null;
  limit: number | null;
}

interface AppLayoutProps extends AppOutletContext {
  searchRateLimit: RateLimitState;
  coreRateLimit: RateLimitState;
}

export default function AppLayout({
  searchRateLimit,
  coreRateLimit,
  setSearchRateLimit,
  setCoreRateLimit,
}: AppLayoutProps) {
  const location = useLocation();
  const isRepositoryPage = location.pathname.startsWith("/repos/");

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/" aria-label="RepoScope — home">
          <span className="brand-mark">
            <Code2 size={21} strokeWidth={2.5} />
          </span>
          <span>
            repo<span className="brand-accent">scope</span>
          </span>
        </Link>

        <div className="sidebar-section-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          <Link className="nav-item nav-item--active" to="/">
            <Search size={18} />
            <span>Repository Search</span>
          </Link>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-note-icon">
            <Sparkles size={17} />
          </div>
          <p>GitHub repository insights</p>
          <span>Data and metrics to help you evaluate a project.</span>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="github-link"
          >
            <Github size={15} />
            GitHub
            <ArrowUpRight size={13} />
          </a>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span>{" "}
            <strong>{isRepositoryPage ? "Repository" : "Explore"}</strong>
          </div>
          <div className="rate-limit-group" aria-label="GitHub API rate limits remaining">
            <RateLimit label="Search" testId="search-rate-limit" value={searchRateLimit} />
            <RateLimit label="GitHub API" testId="core-rate-limit" value={coreRateLimit} />
          </div>
        </header>

        <Outlet context={{ setSearchRateLimit, setCoreRateLimit }} />

        <footer className="page-footer">
          <span>
            RepoScope <span className="footer-dot">·</span> GitHub Repository
            Explorer
          </span>
          <span>Data provided by the GitHub API</span>
        </footer>
      </main>
    </div>
  );
}

function RateLimit({
  label,
  testId,
  value,
}: {
  label: string;
  testId: string;
  value: RateLimitState;
}) {
  return (
    <span
      className="rate-limit-status"
      title={`${label} rate limit remaining`}
    >
      <span className="status-dot" />
      <span>{label}:</span>
      <strong data-testid={testId}>
        {value.remaining === null ? "—" : value.remaining.toLocaleString("en-US")}
        {" of "}
        {value.limit === null ? "—" : value.limit.toLocaleString("en-US")}
      </strong>
    </span>
  );
}
