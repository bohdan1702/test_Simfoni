export interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  url: string;
  language: string | null;
  stars: number;
}

export interface SearchResponse {
  query: string;
  total_count: number;
  results: Repository[];
}

export interface LatestRelease {
  tag: string | null;
  days_ago: number | null;
}

export interface RepositoryReport {
  full_name: string;
  description: string | null;
  url: string;
  stars: number;
  forks: number;
  open_issues: number;
  license: string | null;
  archived: boolean;
  last_push_days: number | null;
  last_release: LatestRelease | null;
}

export interface ContributorSummary {
  bus_factor: number;
  contributors_in_window: number;
  top_authors: Array<{ login: string; share: number }>;
  top_share: number | null;
  last_commit_days: number | null;
  window_weeks: number;
}
