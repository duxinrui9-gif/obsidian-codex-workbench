#!/usr/bin/env python3
"""Validate one self-contained, A4 reader-derived HTML delivery."""

from __future__ import annotations

import argparse
import base64
import binascii
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path


FORBIDDEN_TEXT = {
    "obsidian_wikilink": "[[",
    "source_manifest": "source_manifest",
    "hash_label": "SHA-256",
}
BLOCK_ID_RE = re.compile(r"\^(?:c|t|v)-[a-z0-9-]+", re.IGNORECASE)
A4_RE = re.compile(r"@page\s*\{[^}]*\bsize\s*:\s*A4(?:\s+portrait)?\s*;", re.IGNORECASE | re.DOTALL)
KEEP_RE = re.compile(r"break-inside\s*:\s*avoid", re.IGNORECASE)
VAULT_PATH_RE = re.compile(
    r"(?<![A-Za-z0-9_-])(?:00_Inbox|01_Sources|02_Knowledge|03_Topics|04_Outputs|05_Review|05_Queries|06_Skills|06_Reviews|90_System|98_Templates|99_Attachments)[/\\]",
    re.IGNORECASE,
)
PROPERTY_KEY_RE = re.compile(r"^\s*(?:type|source_contract|evidence_contract|method_contract|source_inputs|source_manifest|content_hash|coverage_status)\s*:\s*\S+", re.IGNORECASE | re.MULTILINE)
FRONTMATTER_BLOCK_RE = re.compile(r"(?:^|\n)\s*---\s*\n(?:\s*[A-Za-z_][A-Za-z0-9_]*\s*:\s*[^\n]+\n?)+", re.IGNORECASE)
CSS_URL_RE = re.compile(r"url\(\s*([\"']?)(.*?)\1\s*\)", re.IGNORECASE | re.DOTALL)
CSS_IMPORT_RE = re.compile(r"@import\s+([\"'])(.*?)\1", re.IGNORECASE | re.DOTALL)
DATA_IMAGE_RE = re.compile(r"^data:image/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$", re.IGNORECASE)
DISALLOWED_TAGS = {"script", "iframe", "object", "embed"}


class HtmlInventory(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.image_sources: list[str] = []
        self.hrefs: list[str] = []
        self.disallowed_tags: list[str] = []
        self.inline_event_handlers: list[str] = []
        self.external_resources: list[str] = []
        self.visible_text: list[str] = []
        self._tag_stack: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        self._tag_stack.append(tag)
        values = dict(attrs)
        if tag == "img" and values.get("src") is not None:
            self.image_sources.append(values["src"] or "")
        if tag == "a" and values.get("href") is not None:
            self.hrefs.append(values["href"] or "")
        if tag in DISALLOWED_TAGS:
            self.disallowed_tags.append(tag)
        for key, value in attrs:
            normalized_key = key.lower()
            if normalized_key.startswith("on"):
                self.inline_event_handlers.append(normalized_key)
            if tag != "img" and normalized_key in {"src", "href", "data", "poster"} and value:
                self.external_resources.append(value)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if self._tag_stack and self._tag_stack[-1] == tag:
            self._tag_stack.pop()

    def handle_data(self, data: str) -> None:
        if not {"pre", "code", "style", "script"} & set(self._tag_stack):
            self.visible_text.append(data)


def embedded_image_error(source: str) -> str | None:
    match = DATA_IMAGE_RE.fullmatch(source)
    if not match:
        return "non_embedded_image"
    mime, payload = match.groups()
    try:
        data = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError):
        return "invalid_embedded_image_base64"
    if not data:
        return "invalid_embedded_image_base64"
    signatures = {
        "png": b"\x89PNG\r\n\x1a\n",
        "jpeg": b"\xff\xd8\xff",
        "gif": (b"GIF87a", b"GIF89a"),
    }
    normalized_mime = mime.lower()
    if normalized_mime == "webp":
        return None if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP" else "embedded_image_mime_mismatch"
    expected = signatures[normalized_mime]
    valid = data.startswith(expected) if isinstance(expected, bytes) else data.startswith(expected)
    return None if valid else "embedded_image_mime_mismatch"


def css_external_resources(text: str) -> list[str]:
    values = [match.group(2).strip() for match in CSS_URL_RE.finditer(text)]
    values.extend(match.group(2).strip() for match in CSS_IMPORT_RE.finditer(text))
    return [value for value in values if not value.lower().startswith("data:")]


def properties_leaked(inventory: HtmlInventory) -> bool:
    visible_text = "".join(inventory.visible_text)
    return bool(FRONTMATTER_BLOCK_RE.search(visible_text) or PROPERTY_KEY_RE.search(visible_text))


def validate(path: Path, expected_images: int) -> dict:
    text = path.read_text(encoding="utf-8")
    findings: list[dict[str, str | int]] = []
    for reason, marker in FORBIDDEN_TEXT.items():
        if marker in text:
            findings.append({"reason": reason, "marker": marker})
    if VAULT_PATH_RE.search(text):
        findings.append({"reason": "vault_path_leaked"})
    if BLOCK_ID_RE.search(text):
        findings.append({"reason": "block_id_leaked"})
    if not A4_RE.search(text):
        findings.append({"reason": "a4_page_css_missing"})
    if not KEEP_RE.search(text):
        findings.append({"reason": "figure_keep_together_css_missing"})
    inventory = HtmlInventory()
    inventory.feed(text)
    inventory.close()
    if properties_leaked(inventory):
        findings.append({"reason": "frontmatter_or_properties_leaked"})
    if inventory.hrefs:
        findings.append({"reason": "clickable_link_present", "count": len(inventory.hrefs)})
    if inventory.disallowed_tags:
        findings.append({"reason": "disallowed_element_present", "tags": sorted(set(inventory.disallowed_tags))})
    if inventory.inline_event_handlers:
        findings.append({"reason": "inline_event_handler_present", "attributes": sorted(set(inventory.inline_event_handlers))})
    if inventory.external_resources:
        findings.append({"reason": "external_resource_present", "count": len(inventory.external_resources)})
    if css_external_resources(text):
        findings.append({"reason": "external_css_resource_present"})
    if len(inventory.image_sources) != expected_images:
        findings.append({"reason": "image_count_mismatch", "expected": expected_images, "actual": len(inventory.image_sources)})
    for source in inventory.image_sources:
        if reason := embedded_image_error(source):
            findings.append({"reason": reason, "source": source[:120]})
    return {"path": str(path), "image_count": len(inventory.image_sources), "findings": findings, "valid": not findings}


def main() -> int:
    def nonnegative_integer(value: str) -> int:
        try:
            parsed = int(value)
        except ValueError as error:
            raise argparse.ArgumentTypeError("expected a non-negative integer") from error
        if parsed < 0:
            raise argparse.ArgumentTypeError("expected a non-negative integer")
        return parsed

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--html", required=True, type=Path)
    parser.add_argument("--expected-images", required=True, type=nonnegative_integer)
    args = parser.parse_args()
    if not args.html.is_file():
        print(f"HTML file not found: {args.html}")
        return 2
    try:
        result = validate(args.html, args.expected_images)
    except (OSError, UnicodeDecodeError, ValueError, binascii.Error) as error:
        result = {"path": str(args.html), "findings": [], "valid": False, "error": f"{type(error).__name__}: {error}"}
        print(json.dumps(result, ensure_ascii=False, indent=2))
        print(result["error"], file=sys.stderr)
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
