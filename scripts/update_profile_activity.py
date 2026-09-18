#!/usr/bin/env python3
"""Refresh the profile activity terminal and contribution graph."""

from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
README = ROOT / "README.md"
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


def main() -> None:
    update_readme(recent_pull_requests())


if __name__ == "__main__":
    main()
