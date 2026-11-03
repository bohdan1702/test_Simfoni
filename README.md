# OSS Dependency Health

A tool for evaluating open-source dependencies before adding them to a project.
It helps answer not only “Does this work today?” but also “Could we regret
depending on it two years from now?”

Data comes from the public GitHub API. The service presents observable facts and
explains their limitations; it does not produce an overall score or make
decisions for you.

## Getting started

Docker and Docker Compose are required. A GitHub token is optional.

```bash
cp backend/.env.example backend/.env
```

Optionally add a GitHub token to `backend/.env`. Replace `DJANGO_SECRET_KEY`
with a randomly generated secret, especially before deploying beyond local
development.

```bash
docker compose up --build
```

- Frontend: <http://localhost:5173>
- API base path: <http://localhost:8000/api/> (there is no API index page; see
  the working endpoint examples below)
- The frontend's Nginx server forwards `/api/` requests to the backend container
  at `backend:8000`; the backend reaches Redis at `redis:6379`.
- Redis is not published on a host port. Its data is persisted in the
  `redis_data` Docker volume.

Stop the services with `Ctrl+C`, or from another terminal run:

```bash
docker compose down
```

To also delete the persisted Redis data, run `docker compose down --volumes`.

### Configuration

The backend reads `backend/.env`; `backend/.env.example` lists the supported
variables. Docker Compose overrides `REDIS_URL` with the internal service
address `redis://redis:6379/0`. The example's `localhost` Redis URL is for
running the backend directly on your host, where Redis must be available on
port 6379.

| Variable | Purpose | Default |
|---|---|---|
| `GITHUB_TOKEN` | Optional GitHub API token; used only by the backend | empty |
| `GITHUB_REQUEST_TIMEOUT` | Timeout in seconds for GitHub API requests | `10` |
| `REDIS_URL` | Django cache connection | `redis://localhost:6379/0` in `.env.example`; overridden by Compose |
| `CACHE_TTL_SECONDS` | Django cache default timeout | `7200` |
| `DJANGO_SECRET_KEY` | Required Django secret key | Set in `.env.example`; replace for deployments |
| `DJANGO_DEBUG` | Django debug mode | `False` |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated Django allowed hosts | `localhost,127.0.0.1` |

The search endpoint currently sets its own 10-minute cache TTL. Repository
overview and contributor responses are not cached.

### GitHub API and tokens

Without a token, GitHub generally allows up to 60 requests per hour for the
core API and up to 10 search requests per minute. Authenticated requests have
higher limits. GitHub response headers provide the current remaining quota and
reset time.

The token is stored in `backend/.env` and used only by the backend. The frontend
calls our API rather than GitHub directly. Do not commit a real token to the
repository.

## User journey

1. On the home page, enter a repository name such as `django/django`, or a
   search query such as `django`. The GitHub search starts after a short pause
   in typing.
2. Select a result card to open the repository overview.
3. Review the individual signals and their explanations. The service does not
   combine them into an invented “health” score.

The top bar displays separate remaining quotas for GitHub Search and the core
API. Search results are cached in Redis for 10 minutes. The search response's
`X-Cache` header indicates `HIT` or `MISS`.

## Signals and limitations

The service examines five groups of signals:

| Signal | What it helps answer | Where it can be misleading |
|---|---|---|
| Activity: latest push and release | Are changes being made and versions released? | Pushes may be automated or minor; the absence of a GitHub release does not prove a project is unmaintained |
| License | Which license did GitHub identify for the repository? | `NOASSERTION` means GitHub could not identify the license, not necessarily that no license exists; a monorepo may contain separate licenses |
| Archive status | Has the repository been marked as no longer maintained? | Development may continue in a fork under another name |
| Open issues | How many open items does GitHub report? | `open_issues_count` includes pull requests; the service does not currently measure time to first response |
| Bus factor | Are changes concentrated among a small number of contributors? | Does not account for reviews, documentation, moderation, or maintainers using multiple identities |

### How the bus factor is calculated

The calculation covers changes from the past 52 weeks. Added and deleted lines
are summed for each contributor. Authors whose logins contain `[bot]`,
`dependabot`, or `renovate` are excluded. The bus factor is the minimum number
of authors whose combined changes account for at least 50% of the total. The
corresponding authors and their shares are shown alongside the result.

GitHub may still be calculating contributor statistics. In that case, the API
returns `202 Accepted` and a `Retry-After` header; the frontend makes up to four
requests, honoring that header between attempts. A bus factor of zero means
there is not enough data to estimate it, not that there is no risk.

## API

All routes use the `/api/` prefix.

### Search repositories

```http
GET /api/search/?q=django%2Fdjango&per_page=10
```

`q` is required and must contain between 2 and 256 characters. `per_page` is
optional, ranges from 1 to 30, and defaults to 10. The endpoint also accepts a
`POST` request with a JSON body:

```json
{
  "q": "django",
  "per_page": 10
}
```

A successful response contains `query`, `total_count`, and `results` with
repository summaries such as the name, description, programming language, URL,
and star count.

### Repository overview

```http
GET /api/repos/{owner}/{name}/
```

Returns the full name, description, URL, star and fork counts, license, archive
status, number of open issues, days since the last push, and latest GitHub
release details when available.

### Contributors

```http
GET /api/repos/{owner}/{name}/contributors/
```

- `200 OK`: a summary containing `bus_factor`, `top_authors`,
  `contributors_in_window`, `top_share`, and the calculation period.
- `202 Accepted`: GitHub is still preparing the statistics. The response
  contains `{"status": "pending"}` and a `Retry-After` value in seconds.

### Combined metrics

```http
GET /api/repos/{owner}/{name}/metrics/
```

Returns the repository overview and contributor statistics in one request. The
frontend loads these from separate endpoints so it can retry the bus-factor
request while GitHub calculates the statistics.

### Rate-limit headers

GitHub responses may include:

- `X-RateLimit-Limit` — the quota for this endpoint;
- `X-RateLimit-Remaining` — the number of requests remaining;
- `X-RateLimit-Reset` — the Unix timestamp when the quota resets;
- `Retry-After` — how many seconds to wait before retrying, when provided by
  GitHub or while contributor statistics are being calculated.

Search and the rest of the GitHub API have separate rate limits. When the
search quota is exhausted, the interface displays the retry time if GitHub
provided a reset timestamp.

## Development and checks

Run backend tests and Django's configuration check:

```bash
docker compose exec backend python manage.py test search.test
docker compose exec backend python manage.py check
```

Install frontend dependencies and build/type-check the TypeScript application:

```bash
npm --prefix frontend ci
npm --prefix frontend run build
```

For frontend development outside Docker, run the backend on `localhost:8000`
and start Vite with `npm --prefix frontend run dev`. The Vite development proxy
forwards `/api/` requests to that backend; the Docker frontend uses Nginx
instead.


## How AI was used

I used Claude as a collaborator at every stage, from framing the problem to writing code.

1. **Planning.** I started by describing the task to Claude and asking for help breaking it into steps. Claude suggested an order where each step produces a working piece: the GitHub client, the metrics, the repository report, caching, search and contributors, then the frontend, then Docker. I reviewed that order and changed parts of it, for example postponing the repository comparison and the median time-to-first-response on issues.

2. **Code.** Claude drafted the modules, and I checked them: I read each file, ran it, and changed what I didn't like or what didn't fit my decisions. I rejected some suggestions along the way. For instance, I first used a hash for cache keys and later removed it, because it made debugging harder without a real benefit.

3. **Verification and tests.** After each step of the plan I reviewed the code and ran the tests. Client and metrics tests run without network access, so they could be run often. When a test failed or behavior looked odd, I investigated the cause instead of adjusting the test to fit the code.

4. **Documentation.** I drafted the README and the problem statement together with Claude, but rewrote the wording in my own words and checked any ambiguous claims against the actual code.

The decisions were mine: which signals to include, why there is no overall score, which limitations to state openly, and what to leave out. AI helped me reach a working version faster, but those choices are my own.