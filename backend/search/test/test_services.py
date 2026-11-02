from datetime import datetime, timezone

from django.test import SimpleTestCase

from search.services import (
    build_repo_report,
    bus_factor,
    days_since,
    is_bot,
    summarize_contributors,
)


class RepositoryServiceTests(SimpleTestCase):
    def test_is_bot_is_case_insensitive(self):
        self.assertTrue(is_bot("dependabot[bot]"))
        self.assertFalse(is_bot("octocat"))

    def test_bus_factor_counts_authors_to_threshold(self):
        self.assertEqual(bus_factor({"alice": 60, "bob": 30, "carol": 10}), 1)
        self.assertEqual(bus_factor({"alice": 40, "bob": 35, "carol": 25}), 2)
        self.assertEqual(bus_factor({}), 0)

    def test_days_since_handles_iso_utc_timestamp(self):
        now = datetime(2026, 11, 2, tzinfo=timezone.utc)

        self.assertEqual(days_since("2026-10-31T00:00:00Z", now), 2)
        self.assertIsNone(days_since(None, now))

    def test_build_repo_report_includes_release_and_repository_metrics(self):
        now = datetime(2026, 11, 2, tzinfo=timezone.utc)
        repo = {
            "full_name": "example/project",
            "description": "Example",
            "html_url": "https://github.com/example/project",
            "stargazers_count": 10,
            "forks_count": 2,
            "open_issues_count": 1,
            "license": {"spdx_id": "MIT"},
            "archived": False,
            "pushed_at": "2026-11-01T00:00:00Z",
        }
        release = {
            "tag_name": "v1.0.0",
            "published_at": "2026-10-30T00:00:00Z",
        }

        report = build_repo_report(repo, release, now)

        self.assertEqual(report["last_push_days"], 1)
        self.assertEqual(report["last_release"], {"tag": "v1.0.0", "days_ago": 3})

    def test_summarize_contributors_excludes_bots_and_calculates_bus_factor(self):
        now = datetime(2026, 11, 2, tzinfo=timezone.utc)
        week = int(now.timestamp()) - 7 * 24 * 3600
        stats = [
            {
                "author": {"login": "alice"},
                "weeks": [{"w": week, "a": 60, "d": 0, "c": 2}],
            },
            {
                "author": {"login": "bob"},
                "weeks": [{"w": week, "a": 40, "d": 0, "c": 1}],
            },
            {
                "author": {"login": "dependabot[bot]"},
                "weeks": [{"w": week, "a": 100, "d": 0, "c": 1}],
            },
        ]

        summary = summarize_contributors(stats, now)

        self.assertEqual(summary["contributors_in_window"], 2)
        self.assertEqual(summary["bus_factor"], 1)
        self.assertEqual(summary["top_authors"], [{"login": "alice", "share": 0.6}])
