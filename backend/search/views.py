from concurrent.futures import ThreadPoolExecutor

from django.core.cache import cache
from rest_framework.response import Response
from rest_framework.views import APIView

from .client import GitHubClient, GitHubError
from .serializers import RepositoryMetricsSerializer, SearchSerializer
from .services import build_repo_report, summarize_contributors

SEARCH_CACHE_TTL = 600


def _cache_key(query, per_page):
    return f"github:search:{per_page}:{query}"


def _rate_headers(rate):
    headers = {}
    if rate.get("limit") is not None:
        headers["X-RateLimit-Limit"] = str(rate["limit"])
    if rate.get("remaining") is not None:
        headers["X-RateLimit-Remaining"] = str(rate["remaining"])
    if rate.get("reset") is not None:
        headers["X-RateLimit-Reset"] = str(rate["reset"])
    if rate.get("retry_after") is not None:
        headers["Retry-After"] = str(rate["retry_after"])
    return headers


def _summarize(item):
    return {
        "id": item["id"],
        "name": item["name"],
        "full_name": item["full_name"],
        "description": item.get("description"),
        "url": item["html_url"],
        "language": item.get("language"),
        "stars": item["stargazers_count"],
    }


def _github_error_response(exc):
    return Response(
        {
            "detail": exc.message,
            "github_status": exc.github_status,
            "rate_limit": exc.rate_limit,
        },
        status=exc.status_code,
        headers=_rate_headers(exc.rate_limit),
    )


class SearchView(APIView):
    def get(self, request):
        return self.search(request.query_params)

    def post(self, request):
        return self.search(request.data)

    def search(self, data):
        serializer = SearchSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        query = serializer.validated_data["q"].strip().lower()
        per_page = serializer.validated_data["per_page"]

        key = _cache_key(query, per_page)
        cached = cache.get(key)
        if isinstance(cached, dict) and "data" in cached and "rate_limit" in cached:
            return Response(
                cached["data"],
                headers={
                    "X-Cache": "HIT",
                    **_rate_headers(cached["rate_limit"]),
                },
            )
        if cached is not None:
            cache.delete(key)

        client = GitHubClient()
        try:
            payload, rate = client.search_repositories(query, per_page)
        except GitHubError as exc:
            return _github_error_response(exc)

        result = {
            "query": query,
            "total_count": payload.get("total_count", 0),
            "results": [_summarize(item) for item in payload.get("items", [])],
        }
        cache.set(
            key,
            {"data": result, "rate_limit": rate},
            timeout=SEARCH_CACHE_TTL,
        )
        return Response(result, headers={"X-Cache": "MISS", **_rate_headers(rate)})


class RepositoryView(APIView):
    def get(self, request, owner, name):
        serializer = RepositoryMetricsSerializer(data={"owner": owner, "name": name})
        serializer.is_valid(raise_exception=True)
        owner = serializer.validated_data["owner"]
        name = serializer.validated_data["name"]

        with ThreadPoolExecutor(max_workers=2) as executor:
            repository_future = executor.submit(
                GitHubClient().get_repository, owner, name
            )
            release_future = executor.submit(
                GitHubClient().get_latest_release, owner, name
            )

            try:
                repository, repository_rate = repository_future.result()
                release, release_rate = release_future.result()
            except GitHubError as exc:
                return _github_error_response(exc)

        rate = (
            release_rate
            if release_rate.get("remaining") is not None
            else repository_rate
        )
        return Response(
            build_repo_report(repository, release),
            headers=_rate_headers(rate),
        )


class ContributorsView(APIView):
    def get(self, request, owner, name):
        serializer = RepositoryMetricsSerializer(data={"owner": owner, "name": name})
        serializer.is_valid(raise_exception=True)
        owner = serializer.validated_data["owner"]
        name = serializer.validated_data["name"]

        try:
            stats, rate = GitHubClient().get_contributor_stats(owner, name)
        except GitHubError as exc:
            return _github_error_response(exc)

        if stats is None:
            retry_after = rate.get("retry_after") or 3
            headers = {**_rate_headers(rate), "Retry-After": str(retry_after)}
            return Response(
                {"status": "pending"},
                status=202,
                headers=headers,
            )

        return Response(
            summarize_contributors(stats),
            headers=_rate_headers(rate),
        )


class RepositoryMetricsView(APIView):
    def get(self, request, owner, name):
        serializer = RepositoryMetricsSerializer(data={"owner": owner, "name": name})
        serializer.is_valid(raise_exception=True)
        owner = serializer.validated_data["owner"]
        name = serializer.validated_data["name"]

        with ThreadPoolExecutor(max_workers=3) as executor:
            repository_future = executor.submit(
                GitHubClient().get_repository, owner, name
            )
            release_future = executor.submit(
                GitHubClient().get_latest_release, owner, name
            )
            contributors_future = executor.submit(
                GitHubClient().get_contributor_stats, owner, name
            )

            try:
                repository, repository_rate = repository_future.result()
                release, release_rate = release_future.result()
                contributor_stats, contributor_rate = contributors_future.result()
            except GitHubError as exc:
                return _github_error_response(exc)

        rate = contributor_rate or release_rate or repository_rate
        result = {
            "repository": build_repo_report(repository, release),
            "contributors": (
                summarize_contributors(contributor_stats)
                if contributor_stats is not None
                else None
            ),
            "contributor_stats_pending": contributor_stats is None,
        }
        return Response(result, headers=_rate_headers(rate))