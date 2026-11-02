from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework.test import APIClient


class ContributorsViewTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()

    @patch("search.views.GitHubClient")
    def test_returns_contributor_summary_and_rate_limit(self, client_class):
        client_class.return_value.get_contributor_stats.return_value = (
            self.contributor_stats(),
            {"limit": 60, "remaining": 48},
        )

        response = self.client.get(
            "/api/repos/example/project/contributors/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["X-RateLimit-Limit"], "60")
        self.assertEqual(response["X-RateLimit-Remaining"], "48")
        self.assertEqual(response.data["bus_factor"], 1)
        self.assertEqual(
            response.data["top_authors"],
            [{"login": "alice", "share": 0.6}],
        )

    @patch("search.views.GitHubClient")
    def test_pending_stats_return_202_and_retry_after(self, client_class):
        client_class.return_value.get_contributor_stats.return_value = (
            None,
            {"limit": 60, "remaining": 47, "retry_after": 5},
        )

        response = self.client.get(
            "/api/repos/example/project/contributors/"
        )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response["Retry-After"], "5")
        self.assertEqual(response["X-RateLimit-Limit"], "60")
        self.assertEqual(response["X-RateLimit-Remaining"], "47")
        self.assertEqual(response.data, {"status": "pending"})

    @patch("search.views.GitHubClient")
    def test_pending_stats_use_default_retry_after(self, client_class):
        client_class.return_value.get_contributor_stats.return_value = (
            None,
            {"remaining": 46},
        )

        response = self.client.get(
            "/api/repos/example/project/contributors/"
        )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response["Retry-After"], "3")

    @staticmethod
    def contributor_stats():
        return [
            {
                "author": {"login": "alice"},
                "weeks": [{"w": 1793577600, "a": 60, "d": 0, "c": 2}],
            },
            {
                "author": {"login": "bob"},
                "weeks": [{"w": 1793577600, "a": 40, "d": 0, "c": 1}],
            },
        ]
