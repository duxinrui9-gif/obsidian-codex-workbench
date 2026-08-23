#!/usr/bin/env python3
"""Refresh the integrity manifest for this public Skill package."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def package_version() -> str:
    manifest = json.loads((ROOT.parent.parent / "package.json").read_text(encoding="utf-8"))
    version = manifest.get("version")
    if not isinstance(version, str):
        raise ValueError("root package.json must provide a string version")
    return version


def is_packaged_file(path: Path) -> bool:
    """Exclude Python execution caches from the reproducible distribution."""
    return path.is_file() and path.name != "manifest.json" and "__pycache__" not in path.parts and path.suffix not in {".pyc", ".pyo"}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    files = []
    for path in sorted(ROOT.rglob("*")):
        if not is_packaged_file(path):
            continue
        files.append({"path": path.relative_to(ROOT).as_posix(), "sha256": digest(path)})
    manifest = {
        "package": "obsidian-knowledge-skills",
        "version": package_version(),
        "distribution": "public",
        "license": "MIT",
        "python": ">=3.9",
        "optional_dependencies": [
            {"package": "pypdf", "purpose": "PDF page-count and structural validation"}
        ],
        "skills": [
            "obsidian-ingest",
            "obsidian-query",
            "obsidian-health-check",
            "obsidian-maturity-audit",
        ],
        "files": files,
    }
    (ROOT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
