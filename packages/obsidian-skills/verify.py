#!/usr/bin/env python3
"""Verify the public Obsidian Skill distribution without external dependencies."""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
EXPECTED_SKILLS = {
    "obsidian-ingest",
    "obsidian-query",
    "obsidian-health-check",
    "obsidian-maturity-audit",
}
LINK_RE = re.compile(r"\[[^\]]+\]\(([^)]+)\)")


def is_packaged_file(path: Path) -> bool:
    return path.is_file() and path.name != "manifest.json" and "__pycache__" not in path.parts and path.suffix not in {".pyc", ".pyo"}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    manifest_path = ROOT / "manifest.json"
    if not manifest_path.is_file():
        print("manifest.json is missing", file=sys.stderr)
        return 2
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    failures: list[str] = []
    files = manifest.get("files")
    if not isinstance(files, list):
        failures.append("manifest files must be a list")
        files = []
    expected_paths = set()
    for item in files:
        relative = item.get("path") if isinstance(item, dict) else None
        expected_hash = item.get("sha256") if isinstance(item, dict) else None
        if not isinstance(relative, str) or not isinstance(expected_hash, str):
            failures.append("invalid manifest file entry")
            continue
        path = ROOT / relative
        expected_paths.add(relative)
        if not path.is_file():
            failures.append(f"missing: {relative}")
        elif digest(path) != expected_hash:
            failures.append(f"hash mismatch: {relative}")
    actual_paths = {
        path.relative_to(ROOT).as_posix()
        for path in ROOT.rglob("*")
        if is_packaged_file(path)
    }
    if actual_paths != expected_paths:
        failures.append("manifest file set does not match package files")
    found_skills = {path.parent.name for path in (ROOT / "skills").glob("*/SKILL.md")}
    if found_skills != EXPECTED_SKILLS:
        failures.append(f"unexpected skills: {sorted(found_skills)}")
    for skill_name in EXPECTED_SKILLS:
        skill_path = ROOT / "skills" / skill_name / "SKILL.md"
        if not skill_path.is_file():
            continue
        text = skill_path.read_text(encoding="utf-8")
        if not text.startswith("---\n") or "\nname:" not in text or "\ndescription:" not in text:
            failures.append(f"invalid frontmatter: {skill_name}")
        for target in LINK_RE.findall(text):
            target = target.split("#", 1)[0]
            if target and "://" not in target and not (skill_path.parent / target).exists():
                failures.append(f"broken link in {skill_name}: {target}")
    if failures:
        print("Verification failed:")
        print("\n".join(f"- {item}" for item in failures))
        return 1
    print(f"Verified {len(EXPECTED_SKILLS)} skills and {len(expected_paths)} packaged files.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
