#!/usr/bin/env python3
"""Integration test for source validation through the health-report API."""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("validate_source_coverage.py")


class ValidateSourceCoverageTests(unittest.TestCase):
    def run_validator(self, vault: Path, source: str) -> tuple[subprocess.CompletedProcess[str], dict]:
        completed = subprocess.run(
            [sys.executable, str(SCRIPT), "--vault", str(vault), "--source", source],
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        result = json.loads(completed.stdout) if completed.stdout else {}
        return completed, result

    def test_fatal_source_finding_is_not_filtered_out(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            source = vault / "01_Sources/Broken.md"
            source.parent.mkdir(parents=True)
            source.write_text("---\ntype: source\nnot-a-frontmatter-field\n---\n", encoding="utf-8")
            completed, result = self.run_validator(vault, "01_Sources/Broken.md")
            self.assertEqual(completed.returncode, 1)
            self.assertFalse(result["valid"])
            self.assertTrue(any(item["severity"] == "fatal" for item in result["findings"]))

    def test_missing_or_escaping_source_returns_operational_error(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            missing, _ = self.run_validator(vault, "01_Sources/Missing.md")
            escaping, _ = self.run_validator(vault, "../outside.md")
            self.assertEqual(missing.returncode, 2)
            self.assertIn("Source not found", missing.stderr)
            self.assertEqual(escaping.returncode, 2)
            self.assertIn("Vault-relative", escaping.stderr)

    def test_existing_legacy_source_enters_scoped_audit_and_passes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            source = vault / "01_Sources/Valid.md"
            source.parent.mkdir(parents=True)
            source.write_text(
                f"---\n"
                f"type: source\nstatus: processed\ncreated: 2026-08-05\nupdated: 2026-08-05\n"
                f"source_kind: note\ncaptured: 2026-08-05\nsource_url: \"\"\n"
                f"source_unavailable_reason: local material\ncontent_hash: {'a' * 64}\n"
                f"asset_scope: personal\nsensitivity: internal\nevidence_status: observed\n---\n# Valid\n",
                encoding="utf-8",
            )
            completed, result = self.run_validator(vault, "01_Sources/Valid")
            self.assertEqual(completed.returncode, 0)
            self.assertTrue(result["valid"])
            self.assertEqual(result["source"], "01_Sources/Valid.md")

    def test_source_semantic_findings_block_acceptance(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            source = vault / "01_Sources/SemanticGap.md"
            source.parent.mkdir(parents=True)
            source.write_text(
                f"---\n"
                f"type: source\nstatus: processed\ncreated: 2026-08-06\nupdated: 2026-08-05\n"
                f"source_kind: note\ncaptured: 2026-08-06\nsource_url: \"\"\n"
                f"source_unavailable_reason: local material\ncontent_hash: {'b' * 64}\n"
                f"asset_scope: personal\nsensitivity: internal\nevidence_status: observed\n---\n# Semantic gap\n",
                encoding="utf-8",
            )
            completed, result = self.run_validator(vault, "01_Sources/SemanticGap.md")
            self.assertEqual(completed.returncode, 1)
            self.assertFalse(result["valid"])
            self.assertIn("semantic_issues", {item["category"] for item in result["findings"]})


if __name__ == "__main__":
    unittest.main()
