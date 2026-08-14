#!/usr/bin/env python3
"""Fixture tests for the clean reader-export validator."""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("validate_reader_export.py")
VALID = """<!doctype html>
<html><head><style>@page { size: A4 portrait; margin: 16mm; } figure { break-inside: avoid; }</style></head>
<body><figure><img src=\"data:image/png;base64,iVBORw0KGgo=\"><figcaption>图注</figcaption></figure><p>解释段落。</p></body></html>"""


class ReaderExportTests(unittest.TestCase):
    def run_validator(self, html: str, expected: int = 1) -> tuple[dict, int]:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "reader.html"
            path.write_text(html, encoding="utf-8")
            completed = subprocess.run(
                [sys.executable, str(SCRIPT), "--html", str(path), "--expected-images", str(expected)],
                check=False,
                text=True,
                stdout=subprocess.PIPE,
            )
            return json.loads(completed.stdout), completed.returncode

    def test_valid_embedded_a4_reader_export_passes(self) -> None:
        result, status = self.run_validator(VALID)
        self.assertEqual(status, 0)
        self.assertTrue(result["valid"])

    def test_export_rejects_obsidian_data_external_resources_and_wrong_count(self) -> None:
        invalid = VALID.replace("data:image/png;base64,iVBORw0KGgo=", "https://example.com/slide.png").replace("解释段落。", "[[01_Sources/Reader#^t-lesson-001]] SHA-256 00_Inbox")
        result, status = self.run_validator(invalid, expected=2)
        self.assertEqual(status, 1)
        reasons = {item["reason"] for item in result["findings"]}
        self.assertTrue({"obsidian_wikilink", "vault_path_leaked", "hash_label", "block_id_leaked", "non_embedded_image", "image_count_mismatch"}.issubset(reasons))

    def test_export_rejects_current_and_legacy_vault_paths(self) -> None:
        for vault_path in ("05_Review/Actions/ACT-20260814-001.md", "06_Skills/方法.md", "05_Queries/legacy.md", "06_Reviews/legacy.md"):
            result, status = self.run_validator(VALID.replace("解释段落。", vault_path))
            self.assertEqual(status, 1)
            self.assertIn("vault_path_leaked", {item["reason"] for item in result["findings"]})

    def test_export_rejects_properties_active_content_and_external_css(self) -> None:
        invalid = VALID.replace(
            "</head>",
            "<link rel=\"stylesheet\" href=\"https://example.com/theme.css\"><style>@import url(https://example.com/print.css);</style></head>",
        ).replace(
            "<body>",
            "<body onload=\"run()\"><script src=\"https://example.com/app.js\"></script><iframe src=\"https://example.com/embed\"></iframe>---\nsource_contract: semantic-content-v4\n",
        )
        result, status = self.run_validator(invalid)
        self.assertEqual(status, 1)
        reasons = {item["reason"] for item in result["findings"]}
        self.assertTrue({"frontmatter_or_properties_leaked", "disallowed_element_present", "inline_event_handler_present", "external_resource_present", "external_css_resource_present"}.issubset(reasons))

    def test_expected_image_count_is_required_and_nonnegative(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "reader.html"
            path.write_text(VALID, encoding="utf-8")
            missing = subprocess.run([sys.executable, str(SCRIPT), "--html", str(path)], check=False, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            negative = subprocess.run([sys.executable, str(SCRIPT), "--html", str(path), "--expected-images", "-1"], check=False, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            self.assertEqual(missing.returncode, 2)
            self.assertEqual(negative.returncode, 2)

    def test_export_rejects_relative_css_and_invalid_or_mismatched_image_data(self) -> None:
        relative_css = VALID.replace("</style>", " background: url(./paper.png); }</style>")
        result, status = self.run_validator(relative_css)
        self.assertEqual(status, 1)
        self.assertIn("external_css_resource_present", {item["reason"] for item in result["findings"]})

        invalid_base64 = VALID.replace("iVBORw0KGgo=", "A")
        result, status = self.run_validator(invalid_base64)
        self.assertEqual(status, 1)
        self.assertIn("invalid_embedded_image_base64", {item["reason"] for item in result["findings"]})

        mime_mismatch = VALID.replace("iVBORw0KGgo=", "/9j/")
        result, status = self.run_validator(mime_mismatch)
        self.assertEqual(status, 1)
        self.assertIn("embedded_image_mime_mismatch", {item["reason"] for item in result["findings"]})

    def test_code_example_is_not_mistaken_for_properties(self) -> None:
        example = VALID.replace("<p>解释段落。</p>", "<pre>---\ntype: source\nsource_contract: semantic-content-v4\n---</pre><p>解释段落。</p>")
        result, status = self.run_validator(example)
        self.assertEqual(status, 0)
        self.assertTrue(result["valid"])

    def test_invalid_encoding_returns_operational_error(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "reader.html"
            path.write_bytes(b"\xff\xfe\x00")
            completed = subprocess.run(
                [sys.executable, str(SCRIPT), "--html", str(path), "--expected-images", "0"],
                check=False,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            result = json.loads(completed.stdout)
            self.assertEqual(completed.returncode, 2)
            self.assertIn("UnicodeDecodeError", result["error"])


if __name__ == "__main__":
    unittest.main()
