from unittest.mock import Mock

from django.test import SimpleTestCase

from search.client import GitHubClient, GitHubError, GitHubRateLimitError


class GitHubClientTests(SimpleTestCase):
    def test_sends_configured_token_as_bearer_authorization(self):
        response = Mock()
        response.status_code = 200
        response.headers = {}
        response.json.return_value = {"total_count": 0, "items": []}
        response.ok = True

        session = Mock()
        session.get.return_value = response
        client = GitHubClient(token="test-token", timeout=1, session=session)

        client.search_repositories("django")

        self.assertEqual(
            session.get.call_args.kwargs["headers"]["Authorization"],
            "Bearer test-token",
        )

    def test_detects_search_rate_limit_even_when_core_remaining_is_positive(self):
        response = Mock()
        response.status_code = 403
        response.headers = {
            "X-RateLimit-Limit": "30",
            "X-RateLimit-Remaining": "28",
            "X-RateLimit-Reset": "1793653200",
        }
        response.json.return_value = {
            "message": "You have exceeded a secondary rate limit."
        }
        response.ok = False

        session = Mock()
        session.get.return_value = response
        client = GitHubClient(token="", timeout=1, session=session)

        with self.assertRaises(GitHubRateLimitError) as raised:
            client.search_repositories("django")

        self.assertEqual(raised.exception.rate_limit["remaining"], 28)
        self.assertEqual(raised.exception.rate_limit["reset"], 1793653200)

    def test_does_not_treat_an_unrelated_forbidden_response_as_rate_limit(self):
        response = Mock()
        response.status_code = 403
        response.headers = {
            "X-RateLimit-Limit": "5000",
            "X-RateLimit-Remaining": "4999",
        }
        response.json.return_value = {"message": "Resource not accessible"}
        response.ok = False

        session = Mock()
        session.get.return_value = response
        client = GitHubClient(token="", timeout=1, session=session)

        with self.assertRaises(GitHubError) as raised:
            client.search_repositories("django")

        self.assertNotIsInstance(raised.exception, GitHubRateLimitError)
