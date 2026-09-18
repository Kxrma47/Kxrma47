#!/usr/bin/env python3
"""Refresh the profile activity terminal and contribution graph."""

from __future__ import annotations

import datetime as dt
import html
import json
import os
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
README = ROOT / "README.md"
GRAPH = ROOT / "assets" / "activity-graph.svg"
USER = os.environ.get("PROFILE_USER", "Kxrma47")
TOKEN = os.environ["GITHUB_TOKEN"]
START = "<!-- RECENT-ACTIVITY:START -->"
END = "<!-- RECENT-ACTIVITY:END -->"


def request_json(url: str, payload: dict | None = None) -> dict:
    body = json.dumps(payload).encode() if payload is not None else None
    request = Request(
        url,
        data=body,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
            "User-Agent": f"{USER}-profile-activity",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def recent_pull_requests() -> list[str]:
    query = urlencode(
        {
            "q": f"author:{USER} type:pr",
            "sort": "updated",
            "order": "desc",
            "per_page": 15,
        }
    )
    items = request_json(f"https://api.github.com/search/issues?{query}")["items"]
    lines: list[str] = []
    for item in items:
        repo = item["repository_url"].removeprefix("https://api.github.com/repos/")
        if repo.casefold() == f"{USER}/{USER}".casefold():
            continue
        pull = request_json(item["pull_request"]["url"])
        state = "MERGED" if pull.get("merged_at") else item["state"].upper()
        title = " ".join(item["title"].split())
        if len(title) > 58:
            title = title[:55].rstrip() + "..."
        lines.append(f"[{state:<6}] {repo} #{item['number']}  {title}")
        if len(lines) == 5:
            break
    if not lines:
        raise RuntimeError("GitHub returned no pull-request activity")
    return lines


def update_readme(lines: list[str]) -> None:
    text = README.read_text(encoding="utf-8")
    if START not in text or END not in text:
        raise RuntimeError("README activity markers are missing")
    block = START + "\n\n```text\n" + "\n".join(lines) + "\n```\n\n" + END
    before, remainder = text.split(START, 1)
    _, after = remainder.split(END, 1)
    README.write_text(before + block + after, encoding="utf-8")


def contribution_days() -> list[dict]:
    today = dt.datetime.now(dt.timezone.utc).date()
    start = today - dt.timedelta(days=364)
    graphql = """
    query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            weeks { contributionDays { date contributionCount } }
          }
        }
      }
    }
    """
    data = request_json(
        "https://api.github.com/graphql",
        {
            "query": graphql,
            "variables": {
                "login": USER,
                "from": f"{start.isoformat()}T00:00:00Z",
                "to": f"{today.isoformat()}T23:59:59Z",
            },
        },
    )
    if data.get("errors"):
        raise RuntimeError(f"GraphQL error: {data['errors']}")
    weeks = data["data"]["user"]["contributionsCollection"]["contributionCalendar"]["weeks"]
    return [day for week in weeks for day in week["contributionDays"]]


def longest_streak(days: list[dict]) -> int:
    best = current = 0
    for day in days:
        if day["contributionCount"] > 0:
            current += 1
            best = max(best, current)
        else:
            current = 0
    return best


def render_graph(days: list[dict]) -> None:
    weekly: list[tuple[str, int]] = []
    for offset in range(0, len(days), 7):
        chunk = days[offset : offset + 7]
        weekly.append((chunk[0]["date"], sum(day["contributionCount"] for day in chunk)))

    width, height = 1000, 300
    left, right, top, bottom = 60, 960, 105, 245
    maximum = max((count for _, count in weekly), default=1) or 1
    points: list[tuple[float, float]] = []
    for index, (_, count) in enumerate(weekly):
        x = left + (right - left) * index / max(1, len(weekly) - 1)
        y = bottom - (bottom - top) * count / maximum
        points.append((x, y))

    line = " ".join(f"{x:.1f},{y:.1f}" for x, y in points)
    area = f"{left},{bottom} " + line + f" {right},{bottom}"
    total = sum(day["contributionCount"] for day in days)
    active = sum(day["contributionCount"] > 0 for day in days)
    streak = longest_streak(days)

    labels = []
    for index in sorted({0, len(weekly) // 4, len(weekly) // 2, 3 * len(weekly) // 4, len(weekly) - 1}):
        date = dt.date.fromisoformat(weekly[index][0])
        x = left + (right - left) * index / max(1, len(weekly) - 1)
        labels.append(
            f'<text x="{x:.1f}" y="270" text-anchor="middle">{html.escape(date.strftime("%b %Y"))}</text>'
        )

    grid = []
    for fraction in (0, 0.5, 1):
        y = bottom - (bottom - top) * fraction
        value = round(maximum * fraction)
        grid.append(f'<line x1="{left}" y1="{y:.1f}" x2="{right}" y2="{y:.1f}"/>')
        grid.append(f'<text x="48" y="{y + 5:.1f}" text-anchor="end">{value}</text>')

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="300" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">
  <title id="title">Kxrma47 contribution activity over the last 52 weeks</title>
  <desc id="desc">Weekly contribution counts generated from the GitHub contribution calendar.</desc>
  <rect width="1000" height="300" rx="12" fill="#0d1117"/>
  <rect x="1" y="1" width="998" height="298" rx="11" fill="none" stroke="#30363d" stroke-width="2"/>
  <g font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">
    <text x="30" y="34" fill="#3fb950" font-size="17">$ git activity --since 52w</text>
    <text x="30" y="68" fill="#8b949e" font-size="14">{total} contributions · {active} active days · {streak}-day longest streak</text>
    <g stroke="#21262d" fill="#8b949e" font-size="12">{''.join(grid)}</g>
    <polygon points="{area}" fill="#238636" opacity="0.22"/>
    <polyline points="{line}" fill="none" stroke="#3fb950" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    <g fill="#8b949e" font-size="12">{''.join(labels)}</g>
  </g>
</svg>
'''
    GRAPH.write_text(svg, encoding="utf-8")


def main() -> None:
    update_readme(recent_pull_requests())
    render_graph(contribution_days())


if __name__ == "__main__":
    main()
