from urllib.parse import quote

import requests
from django.conf import settings

GITHUB_API = "https://api.github.com"


class GitHubError(Exception):
    status_code = 502

    def __init__(self, message, github_status=None, rate_limit=None):
        super().__init__(message)
        self.message = message
        self.github_status = github_status
        self.rate_limit = rate_limit or {}


class GitHubRateLimitError(GitHubError):
    status_code = 429

    def __init__(self, rate_limit):
        super().__init__(
            "GitHub rate limit exceeded.",
            github_status=403,
            rate_limit=rate_limit,
        )


class GitHubNotFoundError(GitHubError):
    status_code = 404


class GitHubTimeoutError(GitHubError):
    status_code = 504


def parse_rate_limit(headers):
    def to_int(value):
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    return {
        "limit": to_int(headers.get("X-RateLimit-Limit")),
        "remaining": to_int(headers.get("X-RateLimit-Remaining")),
        "reset": to_int(headers.get("X-RateLimit-Reset")),
        "retry_after": to_int(headers.get("Retry-After")),
    }


class GitHubClient:
    def __init__(self, token=None, timeout=None, session=None):
        self.token = settings.GITHUB_TOKEN if token is None else token
        self.timeout = (
            settings.GITHUB_REQUEST_TIMEOUT if timeout is None else timeout
        )
        self.session = session or requests.Session()

    def _headers(self):
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers


    def _get(self, path, params=None, accept_status=()):
        try:
            response = self.session.get(
                f"{GITHUB_API}{path}",
                params=params,
                headers=self._headers(),
                timeout=self.timeout,
            )
        except requests.Timeout as exc:
            raise GitHubTimeoutError("GitHub API request timed out.") from exc
        except requests.RequestException as exc:
            raise GitHubError("GitHub API is unreachable.") from exc

        rate = parse_rate_limit(response.headers)

        payload = None
        if response.status_code in (403, 429):
            try:
                payload = response.json()
            except ValueError:
                payload = {}
            message = (
                payload.get("message", "")
                if isinstance(payload, dict)
                else ""
            )
        is_rate_limited = response.status_code == 429 or (
            response.status_code == 403
            and (
                rate["remaining"] == 0
                or "rate limit" in message.lower()
                or "secondary rate" in message.lower()
            )
        )
        if is_rate_limited:
            raise GitHubRateLimitError(rate)

        if response.status_code in accept_status:
            return None, rate

        if payload is None:
            try:
                payload = response.json()
            except ValueError as exc:
                raise GitHubError("GitHub API returned an invalid response.") from exc

        if not response.ok:
            message = "Unknown error"
            if isinstance(payload, dict):
                message = payload.get("message", message)
            error_cls = GitHubNotFoundError if response.status_code == 404 else GitHubError
            raise error_cls(
                message,
                github_status=response.status_code,
                rate_limit=rate,
            )

        return payload, rate

    def search_repositories(self, query, per_page=10):
        return self._get(
            "/search/repositories",
            params={"q": query, "per_page": per_page},
        )

    def get_repository(self, owner, name):
        owner = quote(owner, safe="")
        name = quote(name, safe="")
        return self._get(f"/repos/{owner}/{name}")

    def get_latest_release(self, owner, name):
        owner = quote(owner, safe="")
        name = quote(name, safe="")
        return self._get(
            f"/repos/{owner}/{name}/releases/latest",
            accept_status=(404,),
        )

    def get_contributor_stats(self, owner, name):
        owner = quote(owner, safe="")
        name = quote(name, safe="")
        return self._get(
            f"/repos/{owner}/{name}/stats/contributors",
            accept_status=(202,),
        )