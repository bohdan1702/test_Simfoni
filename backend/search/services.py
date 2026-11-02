from datetime import datetime, timezone

BOT_MARKERS = ("[bot]", "dependabot", "renovate")


def is_bot(login):
    login = login.lower()
    return any(marker in login for marker in BOT_MARKERS)


def bus_factor(author_changes, threshold=0.5):
    """
    author_changes: {login: changed line count}; bots have already been filtered.
    Returns the minimum number of authors whose changes meet the threshold.
    """
    total = sum(author_changes.values())
    if total == 0:
        return 0

    running = 0
    ranked = sorted(author_changes.items(), key=lambda kv: kv[1], reverse=True)
    for count, (_, changes) in enumerate(ranked, start=1):
        running += changes
        if running / total >= threshold:
            return count
    return len(ranked)


def _parse_ts(value):
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def days_since(value, now=None):
    ts = _parse_ts(value)
    if ts is None:
        return None
    now = now or datetime.now(timezone.utc)
    return (now - ts).days


def build_repo_report(repo, latest_release, now=None):
    now = now or datetime.now(timezone.utc)
    release_days = None
    last_release = None
    if latest_release:
        release_days = days_since(latest_release.get("published_at"), now)
        last_release = {
            "tag": latest_release.get("tag_name"),
            "days_ago": release_days,
        }

    return {
        "full_name": repo["full_name"],
        "description": repo.get("description"),
        "url": repo["html_url"],
        "stars": repo["stargazers_count"],
        "forks": repo["forks_count"],
        "open_issues": repo["open_issues_count"],
        "license": (repo.get("license") or {}).get("spdx_id"),
        "archived": repo["archived"],
        "last_push_days": days_since(repo.get("pushed_at"), now),
        "last_release": last_release,
    }



CONTRIBUTOR_WINDOW_WEEKS = 52


def summarize_contributors(stats, now=None, window_weeks=CONTRIBUTOR_WINDOW_WEEKS):
 
    now = now or datetime.now(timezone.utc)
    cutoff = int(now.timestamp()) - window_weeks * 7 * 24 * 3600

    changes = {}
    last_commit_ts = 0
    for entry in stats or []:
        login = (entry.get("author") or {}).get("login") or "unknown"
        if is_bot(login):
            continue
        for week in entry.get("weeks", []):
            if week["w"] < cutoff:
                continue
            changes[login] = changes.get(login, 0) + week["a"] + week["d"]
            if week["c"] > 0:
                last_commit_ts = max(last_commit_ts, week["w"])

    total = sum(changes.values())
    factor = bus_factor(changes)
    ranked = sorted(changes.items(), key=lambda kv: kv[1], reverse=True)

    top_authors = [
        {"login": login, "share": round(changes_count / total, 3)}
        for login, changes_count in ranked[:factor]
    ] if total else []

    last_commit_days = None
    if last_commit_ts:
        last_commit_days = (now - datetime.fromtimestamp(last_commit_ts, timezone.utc)).days

    return {
        "bus_factor": factor,
        "contributors_in_window": len(changes),
        "top_authors": top_authors,
        "top_share": round(sum(a["share"] for a in top_authors), 3) if total else None,
        "last_commit_days": last_commit_days,
        "window_weeks": window_weeks,
    }