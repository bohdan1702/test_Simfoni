from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework.test import APIClient


class RepositoryViewTests(SimpleTestCase):
    @patch("search.views.GitHubClient")
    def test_returns_repository_metrics_at_repository_path(self, client_class):
        client = client_class.return_value
        client.get_repository.return_value = (self.repository(), {"remaining": 49})
        client.get_latest_release.return_value = (
            {
                "tag_name": "v1.0",
                "published_at": "2026-10-30T00:00:00Z",
            },
            {"remaining": 48},
        )

        response = APIClient().get("/api/repos/example/project/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["X-RateLimit-Remaining"], "48")
        self.assertEqual(response.data["full_name"], "example/project")
        self.assertEqual(response.data["stars"], 100)
        self.assertEqual(response.data["license"], "MIT")
        self.assertEqual(response.data["last_release"]["tag"], "v1.0")

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
            "pushed_at": "2026-11-01T00:00:00Z",
        }
