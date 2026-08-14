#!/usr/bin/env python3
"""Validate one semantic source through the canonical health audit."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


def resolve_source(vault: Path, raw_source: str) -> tuple[Path, str]:
    source_path = Path(raw_source)
    if not raw_source.strip() or str(source_path) == "." or source_path.is_absolute() or any(part in {"", ".", ".."} for part in source_path.parts):
        raise ValueError("--source must be a Vault-relative Markdown path")
    if source_path.suffix and source_path.suffix.lower() != ".md":
        raise ValueError("--source must name a Markdown file")
    if not source_path.suffix:
        source_path = source_path.with_suffix(".md")
    candidate = (vault / source_path).resolve()
    try:
        candidate.relative_to(vault)
    except ValueError as error:
        raise ValueError("--source resolves outside the Vault") from error
    if not candidate.is_file():
        raise ValueError(f"Source not found: {source_path.as_posix()}")
    return candidate, source_path.as_posix()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vault", required=True, type=Path)
    parser.add_argument("--source", required=True, help="Vault-relative Markdown path")
    args = parser.parse_args()
    vault = args.vault.resolve()
    if not vault.is_dir():
        print(f"Vault not found: {vault}", file=sys.stderr)
        return 2
    try:
        _, source = resolve_source(vault, args.source)
    except ValueError as error:
        print(error, file=sys.stderr)
        return 2
    audit = Path(__file__).resolve().parents[2] / "obsidian-health-check" / "scripts" / "audit_vault.py"
    completed = subprocess.run(
        [sys.executable, str(audit), "--vault", str(vault), "--format", "json", "--fail-on", "error", "--focus-file", source],
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if completed.returncode not in {0, 1}:
        detail = completed.stderr or completed.stdout or f"audit exited with status {completed.returncode}"
        print(detail, file=sys.stderr, end="" if detail.endswith("\n") else "\n")
        return completed.returncode
    try:
        report = json.loads(completed.stdout)
    except json.JSONDecodeError:
        detail = completed.stderr or completed.stdout or "audit emitted no JSON report"
        print(f"Health audit returned invalid JSON: {detail}", file=sys.stderr)
        return 2
    if report.get("report_contract") != "obsidian-health-v1":
        print("Unexpected health report contract", file=sys.stderr)
        return 2
    scope_details = report.get("scope_details")
    if not isinstance(scope_details, dict):
        # Accept the short-lived object-shaped scope emitted by the prior
        # local implementation while canonical v1 returns scope_details.
        scope_details = report.get("scope") if isinstance(report.get("scope"), dict) else {}
    if source not in scope_details.get("selected_files", []):
        print("Health audit did not include the requested source", file=sys.stderr)
        return 2
    findings = [
        finding
        for finding in report.get("findings", [])
        if finding.get("file") == source
        and (
            finding.get("severity") in {"fatal", "error"}
            or finding.get("category") == "semantic_issues"
        )
    ]
    print(json.dumps({"source": source, "findings": findings, "valid": not findings}, ensure_ascii=False, indent=2))
    return 0 if not findings else 1


if __name__ == "__main__":
    raise SystemExit(main())
