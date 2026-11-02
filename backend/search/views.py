import hashlib
import json
import os

import requests
from django.core.cache import cache
from rest_framework import status
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import APIView
from .serializers import SearchSerializer


class GitHubAPIError(APIException):
    status_code = status.HTTP_502_BAD_GATEWAY
    default_detail = "GitHub API request failed."
    default_code = "github_api_error"


class SearchView(APIView):
    def get(self, request):
        return self.search(request.query_params)

    def post(self, request):
        return self.search(request.data)

    def search(self, data):
        serializer = SearchSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        query = serializer.validated_data["q"]
        per_page = serializer.validated_data["per_page"]

        cache_key = "github_repository_search_" + hashlib.sha256(
            json.dumps([query, per_page], ensure_ascii=True).encode()
        ).hexdigest()
        cached_result = cache.get(cache_key)
        if cached_result is not None:
            return Response(cached_result)

        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        token = os.environ.get("GITHUB_TOKEN", "").strip()
        if token:
            headers["Authorization"] = f"Bearer {token}"

        try:
            response = requests.get(
                "https://api.github.com/search/repositories",
                params={"q": query, "per_page": per_page},
                headers=headers,
                timeout=float(os.environ.get("GITHUB_REQUEST_TIMEOUT", "10")),
            )
        except requests.Timeout as exc:
            raise GitHubAPIError(
                detail="GitHub API request timed out.",
                code="github_api_timeout",
            ) from exc
        except requests.RequestException as exc:
            raise GitHubAPIError() from exc

        try:
            payload = response.json()
        except requests.exceptions.JSONDecodeError as exc:
            raise GitHubAPIError(
                detail="GitHub API returned an invalid response.",
                code="invalid_github_response",
            ) from exc

        if not response.ok:
            raise GitHubAPIError(
                detail={
                    "message": "GitHub API request failed.",
                    "github_status": response.status_code,
                    "github_message": payload.get("message", "Unknown error")
                    if isinstance(payload, dict)
                    else "Unknown error",
                }
            )

        result = {
            "query": query,
            "total_count": payload.get("total_count", 0),
            "results": [
                {
                    "id": item["id"],
                    "name": item["name"],
                    "full_name": item["full_name"],
                    "description": item["description"],
                    "url": item["html_url"],
                    "language": item["language"],
                    "stars": item["stargazers_count"],
                }
                for item in payload.get("items", [])
            ],
        }
        cache.set(cache_key, result)
        return Response(result)