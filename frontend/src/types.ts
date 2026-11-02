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
