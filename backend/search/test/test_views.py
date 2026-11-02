from unittest.mock import Mock, patch

from django.test import SimpleTestCase, override_settings
from rest_framework.test import APIClient


@override_settings(
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
)
class SearchViewTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()

    @patch("search.views.requests.get")
    def test_get_searches_github_repositories(self, github_get):
        github_get.return_value = self.github_response()

        response = self.client.get("/api/search/", {"q": "python"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total_count"], 1)
        self.assertEqual(response.data["results"][0]["full_name"], "example/python")
        self.assertEqual(
            github_get.call_args.kwargs["params"],
            {"q": "python", "per_page": 10},
        )

    @patch("search.views.requests.get")
    def test_post_accepts_json_search_body(self, github_get):
        github_get.return_value = self.github_response()

        response = self.client.post(
            "/api/search/",
            {"q": "python", "per_page": 5},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["query"], "python")
        self.assertEqual(
            github_get.call_args.kwargs["params"],
            {"q": "python", "per_page": 5},
        )

    @patch("search.views.requests.get")
    def test_missing_query_returns_validation_error(self, github_get):
        response = self.client.post("/api/search/", {}, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("q", response.data)
        github_get.assert_not_called()

    @staticmethod
    def github_response():
        response = Mock()
        response.ok = True
        response.json.return_value = {
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
        return response
