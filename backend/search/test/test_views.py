from unittest.mock import patch

from django.core.cache import cache
from django.test import SimpleTestCase, override_settings
from rest_framework.test import APIClient

from search.client import GitHubNotFoundError, GitHubRateLimitError


@override_settings(
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
)
class SearchViewTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()
        cache.clear()

    @patch("search.views.GitHubClient")
    def test_get_searches_github_repositories(self, github_client_class):
        github_client_class.return_value.search_repositories.return_value = (
            self.search_response(),
            {"limit": 30, "remaining": 10, "reset": 123},
        )

        response = self.client.get("/api/search/", {"q": "python"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total_count"], 1)
        self.assertEqual(response["X-RateLimit-Limit"], "30")
        self.assertEqual(response["X-RateLimit-Remaining"], "10")
        self.assertEqual(response.data["results"][0]["full_name"], "example/python")
        self.assertEqual(
            github_client_class.return_value.search_repositories.call_args.args,
            ("python", 10),
        )

    @patch("search.views.GitHubClient")
    def test_search_cache_hit_preserves_rate_headers(self, github_client_class):
        github_client_class.return_value.search_repositories.return_value = (
            self.search_response(),
            {"limit": 30, "remaining": 10, "reset": 123},
        )

        first_response = self.client.get("/api/search/", {"q": "python"})
        second_response = self.client.get("/api/search/", {"q": "python"})

        self.assertEqual(first_response["X-RateLimit-Remaining"], "10")
        self.assertEqual(second_response["X-Cache"], "HIT")
        self.assertEqual(second_response["X-RateLimit-Limit"], "30")
        self.assertEqual(second_response["X-RateLimit-Remaining"], "10")
        github_client_class.return_value.search_repositories.assert_called_once()

    @patch("search.views.GitHubClient")
    def test_rate_limit_error_returns_headers_for_user_message(
        self, github_client_class
    ):
        github_client_class.return_value.search_repositories.side_effect = (
            GitHubRateLimitError(
                {"limit": 30, "remaining": 0, "reset": 1793653200}
            )
        )

        response = self.client.get("/api/search/", {"q": "django"})

        self.assertEqual(response.status_code, 429)
        self.assertEqual(response["X-RateLimit-Remaining"], "0")
        self.assertEqual(response["X-RateLimit-Limit"], "30")
        self.assertEqual(response.data["rate_limit"]["reset"], 1793653200)

    @patch("search.views.GitHubClient")
    def test_post_accepts_json_search_body(self, github_client_class):
        github_client_class.return_value.search_repositories.return_value = (
            self.search_response(),
            {},
        )

        response = self.client.post(
            "/api/search/",
            {"q": "python", "per_page": 5},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["query"], "python")
        self.assertEqual(
            github_client_class.return_value.search_repositories.call_args.args,
            ("python", 5),
        )

    @patch("search.views.GitHubClient")
    def test_missing_query_returns_validation_error(self, github_client_class):
        response = self.client.get("/api/search/")

        self.assertEqual(response.status_code, 400)
        self.assertIn("q", response.data)
        github_client_class.assert_not_called()

    @patch("search.views.GitHubClient")
    def test_repository_metrics_uses_services(self, github_client_class):
        github_client = github_client_class.return_value
        github_client.get_repository.return_value = (self.repository(), {})
        github_client.get_latest_release.return_value = (None, {})
        github_client.get_contributor_stats.return_value = ([], {})

        response = self.client.get("/api/repos/example/project/metrics/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["repository"]["full_name"], "example/project")
        self.assertEqual(response.data["contributors"]["bus_factor"], 0)
        self.assertFalse(response.data["contributor_stats_pending"])

    @patch("search.views.GitHubClient")
    def test_repository_metrics_reports_pending_contributor_stats(
        self, github_client_class
    ):
        github_client = github_client_class.return_value
        github_client.get_repository.return_value = (self.repository(), {})
        github_client.get_latest_release.return_value = (None, {})
        github_client.get_contributor_stats.return_value = (None, {})

        response = self.client.get("/api/repos/example/project/metrics/")

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["contributors"])
        self.assertTrue(response.data["contributor_stats_pending"])

    @patch("search.views.GitHubClient")
    def test_missing_repository_returns_not_found(self, github_client_class):
        github_client_class.return_value.get_repository.side_effect = (
            GitHubNotFoundError("Not Found", github_status=404)
        )

        response = self.client.get("/api/repos/example/missing/metrics/")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data["github_status"], 404)

    @staticmethod
    def search_response():
        return {
            "total_count": 1,
            "items": [
                {
                    "id": 42,
                    "name": "python",
                    "full_name": "example/python",
                    "description": "Python repository",
                    "html_url": "https://github.com/example/python",
                    "language": "Python",
                    "stargazers_count": 10,
                }
            ],
        }

    @staticmethod
    def repository():
        return {
            "full_name": "example/project",
            "description": "Example project",
            "html_url": "https://github.com/example/project",
            "stargazers_count": 100,
            "forks_count": 10,
            "open_issues_count": 2,
            "license": {"spdx_id": "MIT"},
            "archived": False,
            "pushed_at": "2026-01-01T00:00:00Z",
        }
