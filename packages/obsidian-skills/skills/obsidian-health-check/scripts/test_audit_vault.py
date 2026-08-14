#!/usr/bin/env python3
"""Fixture tests for the read-only Vault audit."""

import json
import hashlib
import importlib.util
import logging
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

try:
    from pypdf import PdfWriter
except ImportError:
    PdfWriter = None


SCRIPT = Path(__file__).with_name("audit_vault.py")


def write_note(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


KNOWLEDGE = """---
type: knowledge
status: active
created: 2026-07-26
updated: 2026-07-26
asset_scope: personal
sensitivity: internal
evidence_status: observed
source_threads: []
source_notes: []
source_count: 0
maturity: candidate
confidence: medium
review_due: 2099-01-01
contradicts: []
supersedes: []
---

# Card
"""

DAILY_REVIEW = """---
type: review
status: complete
review_period: daily
date: 2026-07-26
created: 2026-07-26
updated: 2026-07-26
asset_scope: personal
sensitivity: restricted
evidence_status: observed
projects: []
source_notes: []
source_threads: []
has_legacy_plan: false
has_legacy_report: false
migration_batch: native-daily-v1
---

# Daily
"""

WEEKLY_REVIEW = """---
type: review
status: complete
review_period: weekly
date: 2026-07-26
created: 2026-07-26
updated: 2026-07-26
asset_scope: personal
sensitivity: internal
evidence_status: observed
source_notes: []
---

# Weekly
"""

PROJECT_REFERENCE = """---
type: project_reference
status: active
created: 2026-07-26
updated: 2026-07-26
asset_scope: project
sensitivity: restricted
evidence_status: observed
aliases: ["SampleProject", "sampleproject"]
codex_project_labels: ["SampleProject"]
workstreams: ["Shopify"]
daily_report_enabled: true
migration_batch: project-reference-v1
---

# SampleProject
"""

ACTION = """---
type: action
status: {status}
action_id: {action_id}
action_state: {action_state}
action_area: project
created: 2026-08-08
updated: {updated}
last_activity: 2026-08-08
scheduled_for: {scheduled_for}
review_on: {review_on}
closed_at: {closed_at}
asset_scope: project
sensitivity: restricted
evidence_status: observed
projects: []
workstreams: []
next_action: {next_action}
completion_standard: a clear result
carryover_count: {carryover_count}
source_notes: []
source_threads: []
completion_evidence: {completion_evidence}
closed_reason: {closed_reason}
migration_batch: action-ledger-v1
---

# Action
"""

DAILY_ACTION_PLAN = """---
type: review
status: active
review_period: daily
daily_kind: plan
include_in_rollup: false
date: {date}
created: {date}
updated: {date}
asset_scope: personal
sensitivity: restricted
evidence_status: inferred
source_notes: []
action_items: {action_items}
migration_batch: native-daily-plan-v3
---

# Daily plan
"""

SOURCE = """---
type: source
status: processed
created: 2026-07-26
updated: 2026-07-26
source_kind: meeting_semantic_compilation
captured: 2026-07-26
source_url: ""
source_unavailable_reason: local material
content_hash: source-hash
asset_scope: personal
sensitivity: internal
evidence_status: observed
source_role: {role}
coverage_status: {coverage}
source_inputs: {inputs}
---

# Source

[[02_Knowledge/Card]]
"""


class AuditVaultTests(unittest.TestCase):
    def run_audit(self, vault: Path, fail_on: str = "none", *extra: str) -> tuple[dict, int]:
        completed = subprocess.run([sys.executable, str(SCRIPT), "--vault", str(vault), "--format", "json", "--fail-on", fail_on, *extra], check=False, text=True, stdout=subprocess.PIPE)
        return json.loads(completed.stdout), completed.returncode

    def write_slide_photo_reader(self, vault: Path, *, anchor: str = "t-lesson-0001", image_before: bool = True, image_wall: bool = False, show_duplicate: bool = False) -> None:
        transcript = vault / "00_Inbox/lesson.txt"
        primary = vault / "00_Inbox/slide.jpg"
        duplicate = vault / "00_Inbox/duplicate.jpg"
        transcript.parent.mkdir(parents=True, exist_ok=True)
        transcript.write_text("00:00 课程内容", encoding="utf-8")
        primary.write_bytes(b"primary-slide")
        duplicate.write_bytes(b"duplicate-slide")
        transcript_hash = hashlib.sha256(transcript.read_bytes()).hexdigest()
        primary_hash = hashlib.sha256(primary.read_bytes()).hexdigest()
        duplicate_hash = hashlib.sha256(duplicate.read_bytes()).hexdigest()
        combined = hashlib.sha256(
            f"I01\t{transcript_hash}\nI02\t{primary_hash}\nI03\t{duplicate_hash}\n".encode()
        ).hexdigest()
        first_embed = "![[00_Inbox/slide.jpg|900]]"
        second_embed = "![[00_Inbox/other.jpg|900]]" if image_wall else ""
        duplicate_embed = "![[00_Inbox/duplicate.jpg|900]]" if show_duplicate else ""
        lecture = f"这段讲述解释课件中的组织能力关系。 ^{anchor}"
        reader = "\n\n".join(part for part in ([first_embed, second_embed, lecture, duplicate_embed] if image_before else [lecture, first_embed, duplicate_embed]) if part)
        write_note(vault / "01_Sources/Sidecar.md", f'''---
type: source_manifest
status: active
created: 2026-07-30
updated: 2026-07-30
manifest_contract: source-input-manifest-v1
source_note: "[[01_Sources/Reader]]"
input_count: 3
content_hash: {combined}
asset_scope: personal
sensitivity: internal
evidence_status: observed
---

## 原始输入清单

| input_id | 原件或快照 | 适配器 | 处理范围 | SHA-256 | 采集时间 | 访问状态 |
| --- | --- | --- | --- | --- | --- | --- |
| I01 | [[00_Inbox/lesson.txt]] | document | 完整转写 | {transcript_hash} | 2026-07-30 | local |
| I02 | [[00_Inbox/slide.jpg]] | image | 完整拍摄画面 | {primary_hash} | 2026-07-30 | local |
| I03 | [[00_Inbox/duplicate.jpg]] | image | 重复拍摄画面 | {duplicate_hash} | 2026-07-30 | local |

## 覆盖附录

| input_id | 覆盖单位 | 应覆盖范围 | 正文去向 | 明确排除 | 未解决内容 |
| --- | --- | --- | --- | --- | --- |
| I01 | 转写段 | 00:00–00:20 | [[01_Sources/Reader#^{anchor}]] | — | — |
| I02 | 图片 | 完整画面 | [[01_Sources/Reader#^{anchor}]] | — | — |
| I03 | 图片 | 完整画面 | [[01_Sources/Reader#^{anchor}]] | 重复照片 | — |

## 视觉单元清单

| visual_id | input_id | 代表输入 | 视觉类型 | 可见内容转录 | 正文块 | 展示方式 | 处理状态 | duplicate_of | 附件 | SHA-256 | 限制 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| V001 | I02 | I02 | 流程图 | 组织能力由人员、机制和结果关系组成 | [[01_Sources/Reader#^{anchor}]] | inline | transcribed | — | [[00_Inbox/slide.jpg]] | {primary_hash} | — |
| V002 | I03 | I02 | 重复照片 | 与 V001 是同一主题的重复拍摄 | [[01_Sources/Reader#^{anchor}]] | duplicate | duplicate | V001 | [[00_Inbox/duplicate.jpg]] | {duplicate_hash} | 不展示 |
''')
        write_note(vault / "01_Sources/Reader.md", f'''---
type: source
status: processed
created: 2026-07-30
updated: 2026-07-30
source_kind: slide_photo_primary_learning
captured: 2026-07-30
source_url: ""
source_unavailable_reason: local material
content_hash: {combined}
asset_scope: personal
sensitivity: internal
evidence_status: observed
source_contract: semantic-content-v4
source_adapter: mixed
source_role: content
content_modalities: [text, visual]
source_input_mode: manifest
source_manifest: "[[01_Sources/Sidecar]]"
source_input_count: 3
evidence_families: [fixture:slide]
coverage_status: complete
coverage_verified: true
coverage_check: passed
semantic_check: passed
visual_check: passed
content_unit_scheme: timestamp-topic-v1
visual_unit_scheme: image-region-v1
compilation_mode: slide-photo-primary-learning-v1
narrative_unit_scheme: topic-argument-v1
primary_speaker: 罗旭
learning_check: passed
anti_summary_check: passed
acceptance_status: accepted
---

# Reader

{reader}
''')

    def write_learning_pdf_source(self, vault: Path, *, malformed_page_table: bool = False, complete: bool = False) -> None:
        raw = vault / "00_Inbox/raw.pdf"
        raw.parent.mkdir(parents=True, exist_ok=True)
        if PdfWriter is None:
            raw.write_bytes(b"PDF fixture used when pypdf is unavailable")
        else:
            writer = PdfWriter()
            writer.add_blank_page(width=72, height=72)
            with raw.open("wb") as handle:
                writer.write(handle)
        digest = hashlib.sha256(raw.read_bytes()).hexdigest()
        composite = hashlib.sha256(f"I1\t{digest}\n".encode()).hexdigest()
        coverage = "complete" if complete else "partial"
        verified = "true" if complete else "false"
        gate = "passed" if complete else "pending"
        acceptance = "pending" if complete else "pending"
        page_header = "| input_id | PDF页码 | 页面角色 | 内容单元ID | 视觉单元ID | 正文块 | 明确排除 | 未解决内容 |"
        page_row = "| I1 | 1 | 标题与正文 | C001 | V1 | [[#^c-i1-p001-01]] | — | — |"
        if malformed_page_table:
            page_header = "| input_id | PDF页码 | 页面角色 | 正文块 | 明确排除 | 未解决内容 |"
            page_row = "| I1 | 1 | 标题与正文 | [[#^c-i1-p001-01]] | — | — |"
        source = f'''---
type: source
status: review
created: 2026-07-27
updated: 2026-07-27
source_kind: pdf_primary_learning_trial
captured: 2026-07-27
source_url: ""
source_unavailable_reason: local material
content_hash: {composite}
asset_scope: personal
sensitivity: internal
evidence_status: observed
source_contract: semantic-content-v4
source_adapter: document
source_role: content
content_modalities: [text, visual]
source_inputs: ["[[00_Inbox/raw.pdf]]"]
evidence_families: [fixture:learning]
coverage_status: {coverage}
coverage_verified: {verified}
coverage_check: {gate}
semantic_check: {gate}
visual_check: {gate}
content_fidelity: full
fidelity_check: {gate}
content_unit_scheme: page-element-v1
visual_unit_scheme: page-region-v2
compilation_mode: pdf-primary-learning-v1
narrative_unit_scheme: topic-argument-v1
primary_speaker: John
learning_check: {gate}
anti_summary_check: {gate}
acceptance_status: {acceptance}
---

# Learning

The reader layer keeps the page's meaningful sentence. ^c-i1-p001-01

## 原始输入清单

| input_id | 原件或快照 | 适配器 | 处理范围 | SHA-256 | 采集时间 | 访问状态 |
| --- | --- | --- | --- | --- | --- | --- |
| I1 | [[00_Inbox/raw.pdf]] | document | PDF 物理页 1 | {digest} | 2026-07-27 | local |

## 覆盖附录

| input_id | 覆盖单位 | 应覆盖范围 | 正文去向 | 明确排除 | 未解决内容 |
| --- | --- | --- | --- | --- | --- |
| I1 | 页面 | 1 | [[#^c-i1-p001-01]] | — | — |

## 页面覆盖表

{page_header}
| --- | --- | --- | --- | --- | --- | --- |
{page_row}

## 内容单元清单

| unit_id | PDF页码 | 内容类型 | 原件内容范围 | 正文块 | 视觉块 | 处理状态 | 排除理由 | 未解决内容 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C001 | 1 | 标题与正文 | 页面中的可辨认句子 | [[#^c-i1-p001-01]] | — | transcribed | — | — |

## 视觉证据清单

| visual_id | 页码与区域 | 视觉类型 | 附件 | SHA-256 | 可见事实 | 论证作用 | 证据性质 | 正文块 | 识别状态 | 限制 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| V1 | p.1 全页 | 文字页 | 原件 | — | 标题和一句正文 | 支持主题起点 | visual-observation | [[#^c-i1-p001-01]] | recognized | 无额外视觉关系 |
'''
        write_note(vault / "01_Sources/Learning.md", source)

    def test_partial_learning_pdf_uses_full_page_table_without_crashing(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            self.write_learning_pdf_source(vault)
            report, status = self.run_audit(vault, "warning")
            self.assertEqual(status, 0)
            self.assertEqual(report["traceability_issues"], [])
            self.assertEqual(report["semantic_issues"], [])

    def test_malformed_learning_page_table_is_a_finding_not_a_crash(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            self.write_learning_pdf_source(vault, malformed_page_table=True)
            report, status = self.run_audit(vault, "error")
            self.assertEqual(status, 1)
            self.assertIn("semantic_content_v4_requires_page_coverage", {item["reason"] for item in report["traceability_issues"]})

    def test_complete_learning_pdf_requires_accepted_reading_gates(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            self.write_learning_pdf_source(vault, complete=True)
            report, status = self.run_audit(vault, "warning")
            self.assertEqual(status, 1)
            self.assertIn("complete_learning_source_requires_accepted_reading_gates", {item["reason"] for item in report["semantic_issues"]})

    def test_slide_photo_manifest_routes_large_input_data_out_of_reader(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            raw = vault / "00_Inbox/slide.jpg"
            raw.parent.mkdir(parents=True, exist_ok=True)
            raw.write_bytes(b"slide-photo")
            digest = hashlib.sha256(raw.read_bytes()).hexdigest()
            combined = hashlib.sha256(f"I01\t{digest}\n".encode()).hexdigest()
            write_note(vault / "01_Sources/Sidecar.md", f'''---
type: source_manifest
status: active
created: 2026-07-29
updated: 2026-07-29
manifest_contract: source-input-manifest-v1
source_note: "[[01_Sources/Reader]]"
input_count: 1
content_hash: {combined}
asset_scope: personal
sensitivity: internal
evidence_status: observed
---

## 原始输入清单

| input_id | 原件或快照 | 适配器 | 处理范围 | SHA-256 | 采集时间 | 访问状态 |
| --- | --- | --- | --- | --- | --- | --- |
| I01 | [[00_Inbox/slide.jpg]] | image | 完整图片 | {digest} | 2026-07-29 | local |

## 覆盖附录

| input_id | 覆盖单位 | 应覆盖范围 | 正文去向 | 明确排除 | 未解决内容 |
| --- | --- | --- | --- | --- | --- |
| I01 | 图片 | 完整画面 | [[01_Sources/Reader#^c-photo]] | — | — |

## 视觉单元清单

| visual_id | input_id | 代表输入 | 视觉类型 | 可见内容转录 | 正文块 | 展示方式 | 处理状态 | duplicate_of | 附件 | SHA-256 | 限制 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| V001 | I01 | I01 | 文字页 | 可辨标题和一项业务动作 | [[01_Sources/Reader#^c-photo]] | folded | transcribed | — | [[00_Inbox/slide.jpg]] | {digest} | — |
''')
            write_note(vault / "01_Sources/Reader.md", f'''---
type: source
status: review
created: 2026-07-29
updated: 2026-07-29
source_kind: slide_photo_primary_learning
captured: 2026-07-29
source_url: ""
source_unavailable_reason: local material
content_hash: {combined}
asset_scope: personal
sensitivity: internal
evidence_status: observed
source_contract: semantic-content-v4
source_adapter: mixed
source_role: content
content_modalities: [text, visual]
source_input_mode: manifest
source_manifest: "[[01_Sources/Sidecar]]"
source_input_count: 1
evidence_families: [fixture:slide]
coverage_status: partial
coverage_verified: false
coverage_check: passed
semantic_check: passed
visual_check: passed
content_unit_scheme: timestamp-topic-v1
visual_unit_scheme: image-region-v1
compilation_mode: slide-photo-primary-learning-v1
narrative_unit_scheme: topic-argument-v1
primary_speaker: 罗旭
learning_check: passed
anti_summary_check: passed
acceptance_status: pending
---

# Reader

完整转录图片中的可辨标题和业务动作。 ^c-photo

> [!example]- 查看课件原图
> ![[00_Inbox/slide.jpg|900]]
''')
            report, status = self.run_audit(vault, "warning")
            self.assertEqual(status, 0)
            self.assertEqual(report["traceability_issues"], [])

    def test_project_reference_is_audited(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            write_note(vault / "03_Topics/项目/SampleProject.md", PROJECT_REFERENCE)
            report, status = self.run_audit(vault)
            self.assertEqual(status, 0)
            self.assertEqual(report["notes_checked"], 1)
            self.assertEqual(report["unreadable_notes"], [])
            self.assertIsInstance(report["scope"], str)
            self.assertFalse(report["scope_details"]["scoped"])
            self.assertEqual(report["scope_details"]["focus_files"], [])

    def test_project_reference_requires_inline_lists_and_boolean(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            invalid = PROJECT_REFERENCE.replace("aliases: [\"SampleProject\", \"sampleproject\"]", "aliases:\n  - SampleProject").replace("daily_report_enabled: true", "daily_report_enabled: maybe")
            write_note(vault / "03_Topics/项目/SampleProject.md", invalid)
            report, status = self.run_audit(vault, "error")
            self.assertEqual(status, 1)
            self.assertEqual(len(report["malformed_frontmatter"]), 1)

    def test_project_reference_requires_all_fields(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            invalid = PROJECT_REFERENCE.replace("workstreams: [\"Shopify\"]\n", "")
            write_note(vault / "03_Topics/项目/SampleProject.md", invalid)
            report, status = self.run_audit(vault, "error")
            self.assertEqual(status, 1)
            self.assertEqual(report["missing_properties"][0]["missing"], ["workstreams"])

    def test_project_reference_rejects_invalid_boolean(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            invalid = PROJECT_REFERENCE.replace("daily_report_enabled: true", "daily_report_enabled: maybe")
            write_note(vault / "03_Topics/项目/SampleProject.md", invalid)
            report, status = self.run_audit(vault, "error")
            self.assertEqual(status, 1)
            self.assertTrue(any(item["property"] == "daily_report_enabled" for item in report["invalid_property_values"]))

    def test_scope_filters_limit_reported_notes_and_findings(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            write_note(vault / "03_Topics/项目/Good.md", PROJECT_REFERENCE)
            invalid = PROJECT_REFERENCE.replace("workstreams: [\"Shopify\"]\n", "")
            write_note(vault / "03_Topics/项目/Bad.md", invalid)

            report, status = self.run_audit(vault, "error", "--focus-file", "03_Topics/项目/Good.md")
            self.assertEqual(status, 0)
            self.assertEqual(report["notes_scanned"], 2)
            self.assertEqual(report["notes_checked"], 1)
            self.assertEqual(report["scope_details"]["focus_files"], ["03_Topics/项目/Good.md"])
            self.assertEqual(report["missing_properties"], [])

            report, status = self.run_audit(vault, "error", "--path-prefix", "03_Topics/项目", "--note-type", "project_reference")
            self.assertEqual(status, 1)
            self.assertEqual(report["notes_checked"], 2)
            self.assertIn("current_blockers", report["summary"]["layers"])

    def test_contract_version_filter_and_invalid_scope_return_expected_status(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            source = SOURCE.format(role="content", coverage="partial", inputs="[]").replace("source_inputs: []", "source_contract: semantic-content-v4\nsource_inputs: []")
            write_note(vault / "01_Sources/V4.md", source)
            report, _ = self.run_audit(vault, "none", "--contract-version", "v4")
            self.assertEqual(report["notes_checked"], 1)
            self.assertEqual(report["scope_details"]["contract_versions"], ["v4"])

            completed = subprocess.run(
                [sys.executable, str(SCRIPT), "--vault", str(vault), "--format", "json", "--focus-file", "01_Sources/missing.md"],
                check=False,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            self.assertEqual(completed.returncode, 2)
            self.assertIn("Focus file not found", completed.stderr)

    def test_pypdf_warning_logger_is_suppressed(self) -> None:
        spec = importlib.util.spec_from_file_location("audit_vault_test_module", SCRIPT)
        self.assertIsNotNone(spec)
        module = importlib.util.module_from_spec(spec)
        self.assertIsNotNone(spec.loader)
        spec.loader.exec_module(module)
        logger = logging.getLogger("pypdf")
        original_level = logger.level
        with module.quiet_pypdf_logger():
            self.assertEqual(logger.level, logging.ERROR)
        self.assertEqual(logger.level, original_level)

    def test_embeds_count_as_links_and_ambiguous_targets_are_reported(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            write_note(vault / "02_Knowledge/Card.md", KNOWLEDGE)
            write_note(vault / "01_Sources/Source.md", "![[02_Knowledge/Card]]\n![[90_System/Bases/收件箱.base]]\n[[Duplicate]]\n")
            write_note(vault / "01_Sources/Duplicate.md", "# First\n")
            write_note(vault / "01_Sources/Archive/Duplicate.md", "# Second\n")
            report, status = self.run_audit(vault)
            self.assertEqual(status, 0)
            self.assertEqual(report["orphan_knowledge"], [])
            self.assertEqual(report["broken_links"], [])
            self.assertEqual(len(report["ambiguous_links"]), 1)

    def test_inline_lists_and_semantic_findings(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            card = KNOWLEDGE.replace("source_notes: []\nsource_count: 0\nmaturity: candidate", "source_notes: [\"[[01_Sources/One]]\"]\nsource_count: 0\nmaturity: evergreen").replace("updated: 2026-07-26", "updated: 2026-07-25")
            write_note(vault / "02_Knowledge/Card.md", card)
            report, status = self.run_audit(vault, "warning")
            self.assertEqual(status, 1)
            reasons = {item["reason"] for item in report["semantic_issues"]}
            self.assertIn("source_count_mismatch", reasons)
            self.assertIn("updated_before_created", reasons)

    def test_block_list_is_malformed(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            write_note(vault / "02_Knowledge/Card.md", "---\ntype: knowledge\nsource_notes:\n  - [[Source]]\n---\n# Card\n")
            report, status = self.run_audit(vault, "error")
            self.assertEqual(status, 1)
            self.assertEqual(len(report["malformed_frontmatter"]), 1)

    def test_daily_review_accepts_complete_inline_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            write_note(vault / "05_Review/Daily/2026-07-26.md", DAILY_REVIEW)
            report, status = self.run_audit(vault, "warning")
            self.assertEqual(status, 0)
            self.assertEqual(report["missing_properties"], [])
            self.assertEqual(report["invalid_property_values"], [])

    def test_daily_review_rejects_required_block_lists(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            invalid = DAILY_REVIEW.replace("projects: []", "projects:\n  - [[03_Topics/项目/SampleProject]]")
            write_note(vault / "05_Review/Daily/2026-07-26.md", invalid)
            report, status = self.run_audit(vault, "error")
            self.assertEqual(status, 1)
            self.assertEqual(len(report["malformed_frontmatter"]), 1)

    def test_daily_review_requires_daily_only_fields(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            invalid = DAILY_REVIEW.replace("migration_batch: native-daily-v1\n", "")
            write_note(vault / "05_Review/Daily/2026-07-26.md", invalid)
            report, status = self.run_audit(vault, "error")
            self.assertEqual(status, 1)
            self.assertEqual(report["missing_properties"][0]["missing"], ["migration_batch"])

    def test_split_daily_and_test_artifacts_do_not_create_legacy_debt(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            split_daily = DAILY_REVIEW.replace("migration_batch: native-daily-v1", "migration_batch: daily-plan-report-split-2026-07-26\ndaily_kind: plan")
            test_artifact = "---\ntype: review\nstatus: review\nreview_period: monthly\ndate: 2026-07-31\ntest_artifact: true\n---\n# Fixture\n"
            write_note(vault / "05_Review/Daily/Plan.md", split_daily)
            write_note(vault / "05_Review/Monthly/Fixture.md", test_artifact)
            report, status = self.run_audit(vault, "error")
            self.assertEqual(status, 0)
            self.assertEqual(report["missing_properties"], [])

    def test_split_daily_plan_and_report_are_not_duplicate_titles(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            plan = DAILY_REVIEW.replace("migration_batch: native-daily-v1", "migration_batch: daily-plan-report-split-2026-07-26\ndaily_kind: plan")
            report_note = DAILY_REVIEW.replace("migration_batch: native-daily-v1", "migration_batch: daily-plan-report-split-2026-07-26\ndaily_kind: report")
            write_note(vault / "05_Review/Daily/Plan/2026-07-26.md", plan)
            write_note(vault / "05_Review/Daily/Report/2026-07-26.md", report_note)
            report, status = self.run_audit(vault, "warning")
            self.assertEqual(status, 0)
            self.assertEqual(report["duplicate_title_candidates"], [])

    def test_unique_suffix_link_is_valid_and_repeated_titles_are_informational(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            write_note(vault / "英语SEO训练/01_第1周/训练计划.md", "# Plan\n")
            write_note(vault / "英语SEO训练/02_第2周/训练计划.md", "# Plan\n")
            write_note(vault / "英语SEO训练/00_训练总览.md", "[[01_第1周/训练计划]]\n")
            report, status = self.run_audit(vault, "warning")
            self.assertEqual(status, 0)
            self.assertEqual(report["broken_links"], [])
            self.assertEqual(report["ambiguous_links"], [])
            self.assertEqual(report["duplicate_title_candidates"], [])
            self.assertEqual(report["summary"]["severity"]["warning"], 0)
            self.assertEqual(report["repeated_titles"][0]["title"], "训练计划")

    def test_flat_report_contract_preserves_grouped_findings(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            write_note(vault / "02_Knowledge/Card.md", "---\ntype: knowledge\n---\n# Card\n")
            report, status = self.run_audit(vault, "error")
            self.assertEqual(status, 1)
            self.assertEqual(report["report_contract"], "obsidian-health-v1")
            self.assertTrue(report["missing_properties"])
            finding = next(item for item in report["findings"] if item["category"] == "missing_properties")
            self.assertEqual(finding["severity"], "error")
            self.assertEqual(finding["file"], "02_Knowledge/Card.md")
            self.assertEqual(finding["reason"], "missing_required_properties")

    def test_daily_review_reports_invalid_period(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            invalid_period = DAILY_REVIEW.replace("review_period: daily", "review_period: fortnightly")
            write_note(vault / "05_Review/Daily/2026-07-25.md", invalid_period)
            report, status = self.run_audit(vault, "warning")
            self.assertEqual(status, 1)
            self.assertTrue(any(item["property"] == "review_period" for item in report["invalid_property_values"]))
            self.assertEqual(report["semantic_issues"], [])

    def test_daily_review_reports_filename_date_mismatch(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            write_note(vault / "05_Review/Daily/2026-07-25.md", DAILY_REVIEW)
            report, status = self.run_audit(vault, "warning")
            self.assertEqual(status, 0)
            self.assertEqual(report["semantic_issues"], [])

    def test_weekly_review_requires_only_common_review_fields(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            write_note(vault / "05_Review/Weekly/2026-W30.md", WEEKLY_REVIEW)
            report, status = self.run_audit(vault, "warning")
            self.assertEqual(status, 0)
            self.assertEqual(report["missing_properties"], [])

    def test_direct_content_contract_rejects_index_and_partial_sources(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            card = KNOWLEDGE.replace("source_notes: []\nsource_count: 0", "source_notes: [\"[[01_Sources/Index]]\", \"[[01_Sources/Partial]]\"]\nsource_count: 2").replace("supersedes: []", "supersedes: []\nevidence_contract: direct-content-v1")
            write_note(vault / "02_Knowledge/Card.md", card)
            write_note(vault / "01_Sources/Index.md", SOURCE.format(role="index", coverage="index_only", inputs="[]"))
            write_note(vault / "01_Sources/Partial.md", SOURCE.format(role="content", coverage="partial", inputs='["[[00_Inbox/raw.txt]]"]'))
            report, status = self.run_audit(vault, "warning")
            self.assertEqual(status, 1)
            self.assertEqual(report["semantic_issues"], [])

    def test_complete_content_requires_inputs_and_valid_direct_source_passes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            card = KNOWLEDGE.replace("source_notes: []\nsource_count: 0", "source_notes: [\"[[01_Sources/Complete]]\"]\nsource_count: 1").replace("supersedes: []", "supersedes: []\nevidence_contract: direct-content-v1")
            write_note(vault / "02_Knowledge/Card.md", card)
            write_note(vault / "01_Sources/Complete.md", SOURCE.format(role="content", coverage="complete", inputs='["[[00_Inbox/raw.txt]]"]'))
            report, status = self.run_audit(vault, "warning")
            self.assertEqual(status, 0)
            self.assertEqual(report["traceability_issues"], [])

    def test_complete_content_without_inputs_fails_without_flagging_legacy_notes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            write_note(vault / "02_Knowledge/Legacy.md", KNOWLEDGE)
            write_note(vault / "01_Sources/Incomplete.md", SOURCE.format(role="content", coverage="complete", inputs="[]"))
            report, status = self.run_audit(vault, "error")
            self.assertEqual(status, 1)
            self.assertEqual(report["traceability_issues"], [])
            self.assertEqual(report["semantic_issues"], [])

    def test_knowledge_status_must_match_active_or_archive_tree(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            archived = KNOWLEDGE.replace("status: active", "status: archived")
            write_note(vault / "02_Knowledge/方法/Archived.md", archived)
            write_note(vault / "02_Knowledge/归档/方法/Active.md", KNOWLEDGE)
            write_note(vault / "01_Sources/Links.md", "[[02_Knowledge/方法/Archived]]\n[[02_Knowledge/归档/方法/Active]]\n")
            report, status = self.run_audit(vault, "warning")
            self.assertEqual(status, 1)
            reasons = {item["reason"] for item in report["semantic_issues"]}
            self.assertIn("archived_knowledge_in_active_method_tree", reasons)
            self.assertIn("active_knowledge_in_archive_tree", reasons)

    def test_v2_source_and_action_method_require_direct_units(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            raw = vault / "00_Inbox/raw.txt"
            raw.parent.mkdir(parents=True)
            raw.write_text("direct evidence", encoding="utf-8")
            digest = hashlib.sha256(raw.read_bytes()).hexdigest()
            composite = hashlib.sha256(f"I1\t{digest}\n".encode()).hexdigest()
            source = f'''---
type: source
status: processed
created: 2026-07-26
updated: 2026-07-26
source_kind: document
captured: 2026-07-26
source_url: ""
source_unavailable_reason: local material
content_hash: {composite}
asset_scope: personal
sensitivity: internal
evidence_status: observed
source_contract: semantic-content-v2
source_adapter: document
source_role: content
coverage_status: complete
coverage_verified: true
source_inputs: ["[[00_Inbox/raw.txt]]"]
evidence_families: [fixture:one]
---

# Direct

## 原始输入清单

| input_id | 原件或快照 | 适配器 | 处理范围 | SHA-256 | 采集时间 | 访问状态 |
| --- | --- | --- | --- | --- | --- | --- |
| I1 | [[00_Inbox/raw.txt]] | document | all | {digest} | 2026-07-26 | local |

## 覆盖附录

| input_id | 覆盖单位 | 应覆盖范围 | 正文去向 | 明确排除 | 未解决内容 |
| --- | --- | --- | --- | --- | --- |
| I1 | text | all | 正文 | — | — |
'''
            card = '''---
type: knowledge
status: active
created: 2026-07-26
updated: 2026-07-26
asset_scope: personal
sensitivity: internal
evidence_status: inferred
evidence_contract: direct-content-v2
knowledge_kind: method
operational_readiness: runnable
method_contract: evidence-bound-method-v2
evidence_families: [fixture:one]
independent_source_count: 1
applied_validation_count: 0
source_threads: []
source_notes: ["[[01_Sources/Direct]]"]
source_count: 1
maturity: candidate
confidence: medium
review_due: 2099-01-01
contradicts: []
supersedes: []
---

# Method

## 方法目标

Produce a fixture output.

## 适用问题与禁用边界

Use only for the fixture; do not infer performance.

## 输入

Direct input.

## 输出物

One recorded fixture result.

## 直接证据台账

| 证据ID | 内容 | 证据性质 | 直接来源 | 精确定位 | 证据家族 | 限制或缺口 |
| --- | --- | --- | --- | --- | --- | --- |
| E1 | Do the action | explicit-action | [[01_Sources/Direct]] | unit I1 | fixture:one | no effect claim |

## 编者操作设计

| 设计ID | 设计类型 | 操作骨架 | 设计目的 | 参数或人工决定 | 不主张 |
| --- | --- | --- | --- | --- | --- |
| D1 | artifact | Record one result | Preserve the result | User chooses the record field | Does not prove an effect |

## 执行流程

| 步骤ID | 动作 | 依据ID | 输入 | 输出 | 判断或分支 | 失败处理 |
| --- | --- | --- | --- | --- | --- | --- |
| S1 | Do the action and record it | [E1] [D1] | Direct input | Result record | If input is unavailable, pause | Mark the input missing |

## 决策表

| 检查点 | 条件 | 处理 | 依据ID | 记录 |
| --- | --- | --- | --- | --- |
| Input exists | Direct input is available | Continue | [E1] [D1] | Availability decision |

## 完成、暂停与停止条件

| 类型 | 条件 | 下一步 |
| --- | --- | --- |
| complete | Result record exists | Review the record |
| pause | Input is unavailable | Recover input before retrying |

## 工作模板

| 字段 | 填写内容 |
| --- | --- |
| Result |  |

## 会议案例演示

The fixture demonstrates the shape only; it does not validate an outcome.

## 风险、失败与恢复

Missing input pauses the flow.

## 未知与下一次验证

No performance threshold is supplied.
'''
            write_note(vault / "01_Sources/Direct.md", source)
            write_note(vault / "02_Knowledge/方法/Method.md", card)
            write_note(vault / "90_System/Links.md", "[[02_Knowledge/方法/Method]]")
            report, status = self.run_audit(vault, "error")
            self.assertEqual(status, 0)
            self.assertEqual(report["traceability_issues"], [])
            self.assertEqual(report["semantic_issues"], [])

            # A runnable structure does not promote a seed, but it must remain
            # structurally valid when the direct action is present.
            write_note(vault / "02_Knowledge/方法/Method.md", card.replace("maturity: candidate", "maturity: seed"))
            report, status = self.run_audit(vault, "error")
            self.assertEqual(status, 0)

            # Every execution row must use known evidence/design IDs and an
            # explicit action; claims cannot be substituted for actions.
            write_note(vault / "02_Knowledge/方法/Method.md", card.replace("[E1] [D1]", "[E99] [D1]", 1))
            report, status = self.run_audit(vault, "error")
            self.assertEqual(status, 1)
            reasons = {item["reason"] for item in report["traceability_issues"]}
            self.assertIn("execution_step_references_unknown_id", reasons)

            write_note(vault / "02_Knowledge/方法/Method.md", card.replace("explicit-action | [[01_Sources/Direct]]", "speaker-claim | [[01_Sources/Direct]]"))
            report, status = self.run_audit(vault, "warning")
            self.assertEqual(status, 1)
            self.assertIn("execution_step_requires_explicit_action", {item["reason"] for item in report["semantic_issues"]})

            # A design row needs an explicit boundary; a filled-out format is
            # not permission to assert the speaker's results or causality.
            write_note(vault / "02_Knowledge/方法/Method.md", card.replace("Does not prove an effect |", " |", 1))
            report, status = self.run_audit(vault, "error")
            self.assertEqual(status, 1)
            self.assertIn("compiler_design_requires_complete_boundary", {item["reason"] for item in report["traceability_issues"]})

            write_note(vault / "02_Knowledge/方法/Method.md", card.replace("operational_readiness: runnable", "operational_readiness: tested"))
            report, status = self.run_audit(vault, "warning")
            self.assertEqual(status, 1)
            self.assertIn("tested_method_requires_applied_validation", {item["reason"] for item in report["semantic_issues"]})

            write_note(vault / "02_Knowledge/方法/Method.md", card.replace("evidence_contract: direct-content-v2", "evidence_contract: direct-content-v1"))
            report, status = self.run_audit(vault, "warning")
            self.assertEqual(status, 1)
            self.assertIn("active_method_requires_direct_content_v2", {item["reason"] for item in report["semantic_issues"]})

            # Cases cite complete sources but do not pretend to be runnable SOPs.
            case = card.replace("knowledge_kind: method", "knowledge_kind: case").replace("operational_readiness: runnable", "operational_readiness: not_applicable").replace("method_contract: evidence-bound-method-v2", "method_contract: \"\"")
            write_note(vault / "02_Knowledge/方法/Method.md", case)
            write_note(vault / "02_Knowledge/案例/Case.md", case)
            write_note(vault / "90_System/Links.md", "[[02_Knowledge/案例/Case]]")
            (vault / "02_Knowledge/方法/Method.md").unlink()
            report, status = self.run_audit(vault, "error")
            self.assertEqual(status, 0)

    def test_slide_photo_exact_timestamp_anchor_and_legacy_content_anchor_pass(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            self.write_slide_photo_reader(vault)
            report, status = self.run_audit(vault, "error")
            self.assertEqual(status, 0)
            self.assertEqual(report["traceability_issues"], [])

            reader = vault / "01_Sources/Reader.md"
            sidecar = vault / "01_Sources/Sidecar.md"
            reader.write_text(reader.read_text(encoding="utf-8").replace("^t-lesson-0001", "^c-lesson-0001"), encoding="utf-8")
            sidecar.write_text(sidecar.read_text(encoding="utf-8").replace("^t-lesson-0001", "^c-lesson-0001"), encoding="utf-8")
            report, status = self.run_audit(vault, "error")
            self.assertEqual(status, 0)

    def test_slide_photo_exact_anchor_rejects_missing_or_misaligned_visuals(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            self.write_slide_photo_reader(vault, anchor="t-missing")
            reader = vault / "01_Sources/Reader.md"
            reader.write_text(reader.read_text(encoding="utf-8").replace("^t-missing", "^t-present"), encoding="utf-8")
            report, status = self.run_audit(vault, "error")
            self.assertEqual(status, 1)
            self.assertIn("slide_photo_visual_requires_reader_block", {item["reason"] for item in report["traceability_issues"]})
            self.assertIn("timestamp_topic_coverage_references_missing_block", {item["reason"] for item in report["traceability_issues"]})

        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            self.write_slide_photo_reader(vault, image_before=False)
            report, status = self.run_audit(vault, "error")
            self.assertEqual(status, 1)
            self.assertIn("slide_photo_visual_embed_must_precede_reader_block", {item["reason"] for item in report["traceability_issues"]})

        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            self.write_slide_photo_reader(vault, image_wall=True)
            report, status = self.run_audit(vault, "warning")
            self.assertEqual(status, 1)
            self.assertIn("visual_wall_without_explanation", {item["reason"] for item in report["semantic_issues"]})

        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            self.write_slide_photo_reader(vault, show_duplicate=True)
            report, status = self.run_audit(vault, "error")
            self.assertEqual(status, 1)
            self.assertIn("slide_photo_duplicate_must_not_be_displayed", {item["reason"] for item in report["traceability_issues"]})

    def test_scoped_report_keeps_v1_scope_and_exposes_scope_details(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            write_note(vault / "02_Knowledge/Card.md", KNOWLEDGE)
            report, status = self.run_audit(vault, "none", "--focus-file", "02_Knowledge/Card.md")
            self.assertEqual(status, 0)
            self.assertIsInstance(report["scope"], str)
            self.assertEqual(report["scope_details"]["selected_files"], ["02_Knowledge/Card.md"])
            self.assertTrue(report["scope_details"]["scoped"])

            text = subprocess.run(
                [sys.executable, str(SCRIPT), "--vault", str(vault), "--format", "text", "--focus-file", "02_Knowledge/Card.md"],
                check=False,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            self.assertEqual(text.returncode, 0)
            self.assertTrue(text.stdout.startswith("obsidian-health-v1 | "))
            self.assertIn("Notes scanned:", text.stdout)

    def test_invalid_or_empty_scopes_fail_closed_unless_explicitly_allowed(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            write_note(vault / "02_Knowledge/Card.md", KNOWLEDGE)
            empty = subprocess.run(
                [sys.executable, str(SCRIPT), "--vault", str(vault), "--format", "json", "--contract-version", "v9"],
                check=False,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            self.assertEqual(empty.returncode, 2)
            self.assertIn("Scope selected no auditable", empty.stderr)
            allowed_report, allowed_status = self.run_audit(vault, "none", "--contract-version", "v9", "--allow-empty-scope")
            self.assertEqual(allowed_status, 0)
            self.assertEqual(allowed_report["notes_checked"], 0)
            invalid_type = subprocess.run(
                [sys.executable, str(SCRIPT), "--vault", str(vault), "--note-type", "typo"],
                check=False,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            self.assertEqual(invalid_type.returncode, 2)
            self.assertIn("Unknown note type", invalid_type.stderr)
            missing_prefix = subprocess.run(
                [sys.executable, str(SCRIPT), "--vault", str(vault), "--path-prefix", "missing"],
                check=False,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            self.assertEqual(missing_prefix.returncode, 2)
            self.assertIn("Path prefix not found", missing_prefix.stderr)

    def test_external_markdown_symlink_is_reported_without_reading_target(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            vault = root / "vault"
            vault.mkdir()
            outside = root / "outside.md"
            outside.write_text("# External", encoding="utf-8")
            link = vault / "01_Sources/External.md"
            link.parent.mkdir(parents=True)
            os.symlink(outside, link)
            report, status = self.run_audit(vault, "error")
            self.assertEqual(status, 1)
            self.assertEqual(report["notes_scanned"], 0)
            self.assertEqual(report["external_symlink_notes"][0]["reason"], "external_symlink_note")

    def write_action(self, vault: Path, action_id: str = "ACT-20260808-001", **overrides: str) -> Path:
        values = {
            "status": "active",
            "action_id": action_id,
            "action_state": "ready",
            "updated": "2026-08-08",
            "scheduled_for": "2026-08-10",
            "review_on": "",
            "closed_at": "",
            "next_action": "do the next step",
            "carryover_count": "0",
            "completion_evidence": "[]",
            "closed_reason": "",
        }
        values.update(overrides)
        path = vault / f"05_Review/Actions/{action_id} Action.md"
        write_note(path, ACTION.format(**values))
        return path

    def test_action_contract_accepts_valid_action(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            self.write_action(vault)
            report, status = self.run_audit(vault, "warning", "--note-type", "action")
            self.assertEqual(status, 0)
            self.assertEqual(report["missing_properties"], [])
            self.assertEqual(report["semantic_issues"], [])

    def test_action_contract_rejects_missing_and_invalid_values(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            invalid = ACTION.format(
                status="active", action_id="bad", action_state="unknown", updated="2026-08-08",
                scheduled_for="", review_on="", closed_at="", next_action="", carryover_count="-1",
                completion_evidence="[]", closed_reason="",
            ).replace("completion_standard: a clear result\n", "")
            write_note(vault / "05_Review/Actions/bad Action.md", invalid)
            report, status = self.run_audit(vault, "warning", "--note-type", "action")
            self.assertEqual(status, 1)
            self.assertTrue(report["missing_properties"])
            self.assertTrue(any(item["reason"] == "invalid_action_id" for item in report["invalid_property_values"]))
            self.assertTrue(any(item["property"] == "action_state" for item in report["invalid_property_values"]))
            self.assertTrue(any(item["reason"] == "carryover_count_must_be_nonnegative_integer" for item in report["invalid_property_values"]))

    def test_action_contract_rejects_waiting_and_closed_state_gaps(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            self.write_action(vault, action_id="ACT-20260808-001", action_state="waiting", scheduled_for="", review_on="")
            self.write_action(vault, action_id="ACT-20260808-002", status="archived", action_state="done", scheduled_for="", closed_at="", next_action="", completion_evidence="[]", closed_reason="")
            report, status = self.run_audit(vault, "warning", "--note-type", "action")
            self.assertEqual(status, 1)
            reasons = {item["reason"] for item in report["semantic_issues"]}
            self.assertIn("waiting_action_requires_review_on", reasons)
            self.assertIn("closed_action_requires_closed_at", reasons)
            self.assertIn("closed_action_requires_closed_reason", reasons)
            self.assertIn("done_action_requires_completion_evidence", reasons)

    def test_action_contract_rejects_duplicate_ids(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            first = self.write_action(vault)
            second = vault / "05_Review/Actions/ACT-20260808-001 Duplicate.md"
            write_note(second, first.read_text(encoding="utf-8"))
            report, status = self.run_audit(vault, "warning", "--note-type", "action")
            self.assertEqual(status, 1)
            self.assertTrue(any(item["reason"] == "duplicate_action_id" for item in report["semantic_issues"]))

    def test_action_items_must_resolve_to_actions(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            action = self.write_action(vault)
            write_note(vault / "05_Review/Daily/Plan/2026-08-10.md", DAILY_ACTION_PLAN.format(date="2026-08-10", action_items='["[[05_Review/Actions/ACT-20260808-001 Action]]"]'))
            report, status = self.run_audit(vault, "warning")
            self.assertEqual(status, 0)
            write_note(vault / "05_Review/Daily/Plan/2026-08-11.md", DAILY_ACTION_PLAN.format(date="2026-08-11", action_items='["[[05_Review/Daily/Plan/2026-08-10]]"]'))
            report, status = self.run_audit(vault, "warning")
            self.assertEqual(status, 1)
            self.assertTrue(any(item["reason"] == "action_item_must_target_action" for item in report["semantic_issues"]))

    def test_action_disappearance_and_carryover_are_checked(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            self.write_action(vault)
            action_link = '[[05_Review/Actions/ACT-20260808-001 Action]]'
            write_note(vault / "05_Review/Daily/Plan/2026-08-10.md", DAILY_ACTION_PLAN.format(date="2026-08-10", action_items=f'["{action_link}"]'))
            write_note(vault / "05_Review/Daily/Plan/2026-08-11.md", DAILY_ACTION_PLAN.format(date="2026-08-11", action_items="[]"))
            report, status = self.run_audit(vault, "warning")
            self.assertEqual(status, 1)
            self.assertTrue(any(item["reason"] == "action_disappeared_without_transition" for item in report["semantic_issues"]))

            self.write_action(vault, action_state="waiting", scheduled_for="", review_on="2026-08-11", updated="2026-08-10")
            report, status = self.run_audit(vault, "warning")
            self.assertEqual(status, 0)

            self.write_action(vault, action_state="ready", scheduled_for="2026-08-11", updated="2026-08-10", carryover_count="1")
            write_note(vault / "05_Review/Daily/Plan/2026-08-11.md", DAILY_ACTION_PLAN.format(date="2026-08-11", action_items=f'["{action_link}"]'))
            report, status = self.run_audit(vault, "warning")
            self.assertEqual(status, 0)


if __name__ == "__main__":
    unittest.main()
