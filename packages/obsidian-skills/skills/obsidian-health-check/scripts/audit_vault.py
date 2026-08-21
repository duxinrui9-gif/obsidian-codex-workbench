#!/usr/bin/env python3
"""Read-only structural and evidence-contract checks for the personal Obsidian Vault."""

from __future__ import annotations

import argparse
import csv
from contextlib import contextmanager
from datetime import date
import hashlib
import json
import logging
import os
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

try:
    from pypdf import PdfReader
except ImportError:  # The audit remains readable for non-PDF Vaults.
    PdfReader = None

EXCLUDED_DIRS = {
    ".obsidian", ".git", "98_Templates", "99_Attachments", ".trash", ".cache", "backups",
    ".venv", "node_modules", "dist", "build", "__pycache__",
}
REQUIRED_BY_TYPE = {
    "knowledge": {"status", "created", "updated", "asset_scope", "sensitivity", "evidence_status", "source_threads", "source_notes", "source_count", "maturity", "confidence", "review_due", "contradicts", "supersedes"},
    "source": {"status", "created", "updated", "source_kind", "captured", "source_url", "source_unavailable_reason", "content_hash", "asset_scope", "sensitivity", "evidence_status"},
    "output": {"status", "created", "updated", "source_notes", "knowledge_used", "playbooks_used", "feedback_status", "review_due"},
    "query": {"status", "created", "updated", "source_notes", "knowledge_used", "confidence", "writeback_reason", "follow_up_due"},
    "playbook": {"status", "created", "updated", "implementation_status", "skill_name"},
    "action": {"status", "action_id", "action_state", "action_area", "created", "updated", "last_activity", "scheduled_for", "review_on", "closed_at", "asset_scope", "sensitivity", "evidence_status", "projects", "workstreams", "next_action", "completion_standard", "carryover_count", "source_notes", "source_threads", "completion_evidence", "closed_reason", "migration_batch"},
    "project_reference": {"status", "created", "updated", "asset_scope", "sensitivity", "evidence_status", "aliases", "codex_project_labels", "workstreams", "daily_report_enabled", "migration_batch"},
    "ingest_batch": {"status", "created", "updated", "processing_contract", "batch_id", "trigger_mode", "ingest_state", "input_index", "input_count", "source_index", "source_count", "source_complete_count", "source_partial_count", "knowledge_index", "knowledge_count", "unresolved_count", "count_basis", "next_action", "asset_scope", "sensitivity", "evidence_status"},
    "source_manifest": {"status", "created", "updated", "manifest_contract", "source_note", "input_count", "content_hash", "asset_scope", "sensitivity", "evidence_status"},
    "method_dry_run": {"status", "created", "updated", "method_note", "method_version", "dry_run_status", "scenario_kind", "source_notes", "source_count", "output_summary", "known_friction", "asset_scope", "sensitivity", "evidence_status"},
    # Most topic notes have their own local contracts. The role-card contract
    # is selected below only when topic_kind identifies a collaborator.
    "topic": set(),
}
SOURCE_V2_REQUIRED = {"source_contract", "source_adapter", "source_role", "coverage_status", "coverage_verified", "source_inputs", "evidence_families"}
SOURCE_V3_REQUIRED = SOURCE_V2_REQUIRED | {"coverage_check", "semantic_check", "content_unit_scheme"}
SOURCE_V4_REQUIRED = SOURCE_V3_REQUIRED | {"content_modalities", "visual_check", "visual_unit_scheme"}
METHOD_V2_REQUIRED = {"evidence_contract", "method_contract", "knowledge_kind", "operational_readiness", "evidence_families", "independent_source_count", "applied_validation_count"}
KNOWLEDGE_V2_REQUIRED = {"evidence_contract", "knowledge_kind", "operational_readiness", "evidence_families", "independent_source_count", "applied_validation_count"}
REVIEW_COMMON_REQUIRED = {"status", "review_period", "date", "created", "updated", "asset_scope", "sensitivity", "evidence_status", "source_notes"}
DAILY_REVIEW_REQUIRED = {"projects", "source_threads", "has_legacy_plan", "has_legacy_report", "migration_batch"}
LIST_PROPERTIES = {"projects", "source_threads", "source_notes", "contradicts", "supersedes", "knowledge_used", "playbooks_used", "topics", "tags", "inputs", "outputs", "participants", "source_inputs", "evidence_families", "aliases", "codex_project_labels", "workstreams", "dry_run_notes", "known_friction", "profile_basis", "completion_evidence", "action_items", "relationship_roles", "collaboration_topics"}
WIKILINK_RE = re.compile(r"(?P<embed>!)?\[\[([^\]]+)\]\]")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
HASH_RE = re.compile(r"^[0-9a-f]{64}$")
VALID_VALUES = {
    "status": {"active", "archived", "complete", "ignored", "inbox", "processed", "review", "draft", "blocked"},
    "asset_scope": {"personal", "organization", "brand", "project"},
    "sensitivity": {"public", "internal", "restricted"},
    "evidence_status": {"observed", "inferred", "assumed"},
    "maturity": {"seed", "candidate", "validated", "evergreen", "stale", "superseded"},
    "confidence": {"low", "medium", "high"},
    "review_period": {"daily", "weekly", "monthly"},
    "source_role": {"index", "content"},
    "coverage_status": {"index_only", "partial", "complete"},
    "source_contract": {"navigation-index-v1", "semantic-content-v2", "semantic-content-v3", "semantic-content-v4"},
    "source_adapter": {"document", "image", "audio_video", "web", "social", "conversation", "structured_data", "mixed"},
    "evidence_contract": {"direct-content-v1", "direct-content-v2", "direct-content-v3", "direct-content-v4"},
    "method_contract": {"evidence-bound-method-v1", "evidence-bound-method-v2", "evidence-bound-method-v3", "evidence-bound-method-v4"},
    "knowledge_kind": {"method", "method_fragment", "principle", "case"},
    "operational_readiness": {"draft", "runnable", "tested", "not_applicable"},
    "coverage_check": {"pending", "passed", "failed"},
    "semantic_check": {"pending", "passed", "failed"},
    "content_unit_scheme": {"stable-block-v1", "stable-block-v2", "timestamp-topic-v1", "page-element-v1"},
    "visual_check": {"pending", "passed", "failed", "not_applicable"},
    "content_fidelity": {"full"},
    "fidelity_check": {"pending", "passed", "failed"},
    "learning_check": {"pending", "passed", "failed"},
    "anti_summary_check": {"pending", "passed", "failed"},
    "acceptance_status": {"pending", "accepted", "rejected"},
    "visual_unit_scheme": {"page-region-v1", "page-region-v2", "image-region-v1"},
    "source_input_mode": {"inline", "manifest"},
    "trigger_mode": {"manual"},
    "ingest_state": {"selected", "preserved", "source_partial", "source_complete", "knowledge_decided", "closed", "blocked"},
    "count_basis": {"derived", "declared"},
    "dry_run_status": {"not_run", "passed", "failed"},
    "scenario_kind": {"source_case", "synthetic", "historical_case"},
    "action_state": {"ready", "in_progress", "waiting", "backlog", "review", "done", "cancelled"},
    "action_area": {"project", "knowledge", "personal", "candidate"},
}
DATE_PROPERTIES = {"created", "updated", "captured", "review_due", "follow_up_due", "published", "last_activity", "start_on", "due_on", "scheduled_for", "review_on", "closed_at", "metrics_as_of"}
NONEMPTY_PROPERTIES = {"status", "created", "updated", "source_kind", "captured", "content_hash", "asset_scope", "sensitivity", "evidence_status", "maturity", "confidence", "review_period", "date", "migration_batch", "action_id", "action_state", "action_area", "last_activity", "completion_standard"}
BOOLEAN_PROPERTIES = {"has_legacy_plan", "has_legacy_report", "daily_report_enabled", "coverage_verified"}
ACTION_ID_RE = re.compile(r"^ACT-\d{8}-\d{3}$")
ACTION_OPEN_STATES = {"ready", "in_progress", "waiting", "backlog", "review"}
ACTION_CLOSED_STATES = {"done", "cancelled"}
COLLABORATOR_REQUIRED = {"status", "created", "updated", "asset_scope", "sensitivity", "evidence_status", "aliases", "relationship_roles", "projects", "collaboration_topics", "source_notes", "source_threads"}
COLLABORATOR_STATUSES = {"active", "review", "archived", "ignored"}
REPORT_METRIC_COUNT_PROPERTIES = {"metric_completed_actions", "metric_carryover_events", "metric_waiting_actions", "metric_overdue_reviews", "metric_overdue_deliveries"}
METHOD_V2_HEADINGS = ["方法目标", "适用问题与禁用边界", "输入", "输出物", "直接证据台账", "编者操作设计", "执行流程", "决策表", "完成、暂停与停止条件", "工作模板", "会议案例演示", "风险、失败与恢复", "未知与下一次验证"]
METHOD_V3_HEADINGS = ["方法目标", "适用问题与禁用边界", "输入", "输出物", "输出物映射", "直接证据台账", "编者操作设计", "执行流程", "决策表", "完成、暂停与停止条件", "工作模板", "会议案例演示", "风险、失败与恢复", "未知与下一次验证"]
INPUT_HEADERS = ["input_id", "原件或快照", "适配器", "处理范围", "SHA-256", "采集时间", "访问状态"]
COVERAGE_HEADERS = ["input_id", "覆盖单位", "应覆盖范围", "正文去向", "明确排除", "未解决内容"]
DIRECT_EVIDENCE_HEADERS = ["证据ID", "内容", "证据性质", "直接来源", "精确定位", "证据家族", "限制或缺口"]
DESIGN_HEADERS = ["设计ID", "设计类型", "操作骨架", "设计目的", "参数或人工决定", "不主张"]
FLOW_HEADERS = ["步骤ID", "动作", "依据ID", "输入", "输出", "判断或分支", "失败处理"]
DECISION_HEADERS = ["检查点", "条件", "处理", "依据ID", "记录"]
STOP_HEADERS = ["类型", "条件", "下一步"]
STOP_V3_HEADERS = ["类型", "条件", "依据ID", "下一步"]
PAGE_COVERAGE_HEADERS = ["input_id", "PDF页码", "页面角色", "视觉单元ID", "正文块", "明确排除", "未解决内容"]
PAGE_COVERAGE_FULL_HEADERS = ["input_id", "PDF页码", "页面角色", "内容单元ID", "视觉单元ID", "正文块", "明确排除", "未解决内容"]
CONTENT_UNIT_HEADERS = ["unit_id", "PDF页码", "内容类型", "原件内容范围", "正文块", "视觉块", "处理状态", "排除理由", "未解决内容"]
VISUAL_MANIFEST_HEADERS = ["visual_id", "页码与区域", "视觉类型", "附件", "SHA-256", "可见事实", "论证作用", "证据性质", "正文块", "识别状态", "限制"]
SLIDE_PHOTO_VISUAL_HEADERS = ["visual_id", "input_id", "代表输入", "视觉类型", "可见内容转录", "正文块", "展示方式", "处理状态", "duplicate_of", "附件", "SHA-256", "限制"]
DIRECT_EVIDENCE_V4_HEADERS = ["证据ID", "动作或判断", "证据性质", "来源模态", "直接来源", "内容/视觉块", "原始页码或时间码", "证据家族", "限制"]
OUTPUT_MAP_HEADERS = ["输出ID", "输出物", "产生步骤", "模板位置", "依据ID"]
DESIGN_TYPES = {"artifact", "sequencing", "recordkeeping", "parameterization", "review_gate"}
EMPTY_MARKERS = {"", "-", "—", "无", "none", "n/a", "na"}
SEVERITY_ORDER = {"warning": 1, "error": 2, "fatal": 3}


class FrontmatterError(ValueError):
    pass


def parse_value(raw: str) -> Any:
    value = raw.strip()
    if value.startswith("[") or value.endswith("]"):
        if not (value.startswith("[") and value.endswith("]")):
            raise FrontmatterError("invalid inline list")
        inner = value[1:-1].strip()
        if not inner:
            return []
        without_wikilinks = re.sub(r"\[\[[^\]]+\]\]", "", inner)
        if any(token in without_wikilinks for token in ("[", "]", "{", "}")):
            raise FrontmatterError("nested values are not supported")
        try:
            values = next(csv.reader([inner], skipinitialspace=True))
        except csv.Error as error:
            raise FrontmatterError("invalid inline list") from error
        return [item.strip().strip("\"'") for item in values if item.strip()]
    return value.strip("\"'")


def parse_frontmatter(text: str) -> tuple[dict[str, Any], set[str]]:
    if not text.startswith("---\n"):
        return {}, set()
    end = text.find("\n---", 4)
    if end == -1:
        raise FrontmatterError("missing closing delimiter")
    data: dict[str, Any] = {}
    block_fields: set[str] = set()
    current_key = ""
    for line in text[4:end].splitlines():
        if not line or line.lstrip().startswith("#"):
            continue
        if line.startswith((" ", "\t", "- ")):
            if current_key:
                block_fields.add(current_key)
                continue
            raise FrontmatterError("nested or block value has no parent key")
        if ":" not in line:
            raise FrontmatterError(f"invalid frontmatter line: {line}")
        key, raw_value = line.split(":", 1)
        key = key.strip()
        if not key or key in data:
            raise FrontmatterError(f"invalid or duplicate key: {key or '<empty>'}")
        data[key] = parse_value(raw_value)
        current_key = key
    return data, block_fields


def as_text(value: Any) -> str:
    return value if isinstance(value, str) else ""


def value_is_empty(value: Any) -> bool:
    return value is None or value == [] or (isinstance(value, str) and value.strip().lower() in EMPTY_MARKERS)


def normalize_target(target: str) -> str:
    target = target.split("|", 1)[0].split("#", 1)[0].strip()
    return target[:-3] if target.endswith(".md") else target


def target_from_value(value: str) -> str:
    matches = WIKILINK_RE.findall(value)
    return normalize_target(matches[0][1]) if len(matches) == 1 else normalize_target(value)


@contextmanager
def quiet_pypdf_logger():
    """Suppress non-fatal pypdf parser noise only while opening a PDF."""
    logger = logging.getLogger("pypdf")
    previous_level = logger.level
    logger.setLevel(logging.ERROR)
    try:
        yield
    finally:
        logger.setLevel(previous_level)


def iter_note_paths(vault: Path, findings: dict[str, list[dict]]):
    resolved_vault = vault.resolve()
    for root, directories, files in os.walk(vault, topdown=True):
        root_path = Path(root)
        directories[:] = sorted(
            directory
            for directory in directories
            if directory not in EXCLUDED_DIRS and not (root_path / directory).is_symlink()
        )
        for filename in sorted(files):
            path = root_path / filename
            if not filename.endswith(".md"):
                continue
            relative = path.relative_to(vault).as_posix()
            if path.is_symlink():
                issue(findings["external_symlink_notes"], relative, "external_symlink_note")
                continue
            try:
                path.resolve(strict=True).relative_to(resolved_vault)
            except (OSError, ValueError):
                issue(findings["external_symlink_notes"], relative, "external_symlink_note")
                continue
            yield path


def is_valid_date(value: str) -> bool:
    if not value:
        return True
    if not DATE_RE.fullmatch(value):
        return False
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return True


def issue(bucket: list[dict], file: str, reason: str, **extra: Any) -> None:
    bucket.append({"file": file, "reason": reason, **extra})


def flattened_findings(findings: dict[str, list[dict]], severity_groups: dict[str, tuple[str, ...]]) -> list[dict[str, Any]]:
    """Expose a stable flat API while retaining grouped arrays for callers."""
    flat: list[dict[str, Any]] = []
    for severity, groups in severity_groups.items():
        for category in groups:
            for item in findings[category]:
                details = dict(item)
                file = str(details.pop("file", ""))
                reason = str(details.pop("reason", category))
                flat.append({"severity": severity, "category": category, "file": file, "reason": reason, "details": details})
    for item in findings["repeated_titles"]:
        details = dict(item)
        flat.append({"severity": "info", "category": "repeated_titles", "file": "", "reason": "repeated_title_without_ambiguous_short_link", "details": details})
    return flat


def normalize_scope_file(value: str) -> str:
    path = Path(value)
    if path.is_absolute() or path.suffix.lower() != ".md" or any(part in {"", ".", ".."} for part in path.parts):
        raise ValueError(f"--focus-file must be a Vault-relative Markdown path: {value}")
    return path.as_posix()


def normalize_scope_prefix(value: str) -> str:
    path = Path(value)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise ValueError(f"--path-prefix must be a Vault-relative directory: {value}")
    return path.as_posix().rstrip("/")


def format_text_report(report: dict[str, Any]) -> str:
    scope_details = report["scope_details"]
    summary = report["summary"]
    lines = [
        f"{report['report_contract']} | {report['vault']}",
        f"Scope: {report['scope']}",
        f"Notes scanned: {report['notes_scanned']}; checked: {report['notes_checked']}",
        "Severity: " + ", ".join(f"{level}={summary['severity'][level]}" for level in ("fatal", "error", "warning")),
    ]
    if scope_details["scoped"]:
        lines.append("Selected: " + ", ".join(scope_details["selected_files"]))
    for finding in report["findings"]:
        location = finding["file"] or "Vault"
        lines.append(f"[{finding['severity']}] {location} :: {finding['reason']}")
    return "\n".join(lines)


def contract_versions(note: dict) -> set[str]:
    frontmatter = note["frontmatter"]
    return {
        value.rsplit("-", 1)[-1]
        for key in ("source_contract", "evidence_contract", "method_contract")
        if (value := as_text(frontmatter.get(key))) and re.fullmatch(r".+-v\d+", value)
    }


def note_matches_scope(
    note: dict,
    *,
    focus_files: set[str],
    path_prefixes: tuple[str, ...],
    note_types: set[str],
    contract_version_filters: set[str],
) -> bool:
    relative = note["relative"]
    if focus_files and relative not in focus_files:
        return False
    if path_prefixes and not any(relative == prefix or relative.startswith(f"{prefix}/") for prefix in path_prefixes):
        return False
    if note_types and as_text(note["frontmatter"].get("type")) not in note_types:
        return False
    if contract_version_filters and not (contract_versions(note) & contract_version_filters):
        return False
    return True


def finding_matches_scope(item: dict[str, Any], selected_relatives: set[str], scoped: bool) -> bool:
    if not scoped:
        return True
    file = str(item.get("file", ""))
    if file:
        return file in selected_relatives
    files = item.get("files", [])
    return isinstance(files, list) and bool(selected_relatives & {str(path) for path in files})


def classify_finding(finding: dict[str, Any]) -> str:
    if finding["severity"] in {"fatal", "error"}:
        return "current_blockers"
    if finding["category"] == "legacy_metadata":
        return "legacy_debt"
    if finding["severity"] == "warning":
        return "manual_review"
    return "information"


def markdown_table(text: str, heading: str) -> tuple[list[str], list[list[str]]] | None:
    lines = text.splitlines()
    heading_line = f"## {heading}"
    try:
        start = next(index for index, line in enumerate(lines) if line.strip() == heading_line)
    except StopIteration:
        return None
    for index in range(start + 1, len(lines) - 1):
        if lines[index].startswith("## "):
            return None
        if lines[index].lstrip().startswith("|") and lines[index + 1].lstrip().startswith("|"):
            header = [cell.strip() for cell in lines[index].strip().strip("|").split("|")]
            rows: list[list[str]] = []
            for row in lines[index + 2:]:
                if not row.lstrip().startswith("|"):
                    break
                cells = [cell.strip() for cell in row.strip().strip("|").split("|")]
                if len(cells) == len(header):
                    rows.append(cells)
            return header, rows
    return None


def section_body(text: str, heading: str) -> str | None:
    pattern = re.compile(rf"^## {re.escape(heading)}\s*$", re.MULTILINE)
    match = pattern.search(text)
    if not match:
        return None
    following = re.search(r"^## ", text[match.end():], re.MULTILINE)
    body = text[match.end(): match.end() + following.start() if following else len(text)].strip()
    return body


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def composite_hash(records: list[tuple[str, str]]) -> str:
    payload = "".join(f"{input_id}\t{digest}\n" for input_id, digest in sorted(records))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def resolve_input(vault: Path, target: str) -> Path | None:
    candidate = vault / target
    if candidate.is_file():
        return candidate
    if not candidate.suffix and candidate.with_suffix(".md").is_file():
        return candidate.with_suffix(".md")
    return None


def nonempty_cell(value: str) -> bool:
    return value.strip().casefold() not in EMPTY_MARKERS


def block_anchor_exists(text: str, anchor: str) -> bool:
    return bool(re.search(rf"\^{re.escape(anchor)}(?:\s|$)", text, re.MULTILINE))


def coverage_anchor(text: str, destination: str) -> str | None:
    match = re.search(r"\[\[(?:[^\]#]+)?#\^((?:c|t)-[a-z0-9-]+)\]\]", destination)
    if not match:
        return None
    return match.group(1)


def visual_anchor(text: str, destination: str) -> str | None:
    match = re.search(r"\[\[(?:[^\]#]+)?#\^(v-[a-z0-9-]+)\]\]", destination)
    if not match:
        return None
    return match.group(1)


def link_target(value: str) -> str | None:
    """Return a normalized file target from one Obsidian link or embed."""
    match = WIKILINK_RE.search(value)
    if not match:
        return None
    target = match.group(2).split("|", 1)[0].split("#", 1)[0]
    return normalize_target(target)


def embed_positions(text: str, target: str) -> list[int]:
    """Find embeds of one source image without counting ordinary Wiki links."""
    positions: list[int] = []
    for match in WIKILINK_RE.finditer(text):
        if not match.group("embed"):
            continue
        candidate = normalize_target(match.group(2).split("|", 1)[0].split("#", 1)[0])
        if candidate == target:
            positions.append(match.start())
    return positions


def exact_visual_reader_alignment(text: str, anchor: str, attachment: str) -> str | None:
    """Return a structural failure for a ^t reader mapping, if any."""
    target = link_target(attachment)
    anchor_match = re.search(rf"\^{re.escape(anchor)}(?:\s|$)", text, re.MULTILINE)
    if not target or not anchor_match:
        return "missing_target"
    positions = embed_positions(text, target)
    if len(positions) != 1:
        return "embed_count"
    embed_at = positions[0]
    if embed_at >= anchor_match.start():
        return "embed_after_anchor"
    between = text[embed_at:anchor_match.start()]
    if re.search(r"^#{1,6}\s", between, re.MULTILINE):
        return "heading_between"
    if len(re.findall(r"!\[\[", between)) != 1:
        return "visual_wall"
    # A legacy ^c anchor can be a chapter-level compatibility marker placed
    # immediately before the precise ^t lecture block.  It is not a second
    # reader unit.  A second ^t block, however, means the visual no longer
    # precedes the mapped lecture passage.
    if re.search(r"\^t-[a-z0-9-]+(?:\s|$)", between):
        return "reader_block_between"
    return None


def source_audit_layer(vault: Path, note: dict, findings: dict[str, list[dict]]) -> tuple[dict[str, Any], str, str] | None:
    """Return the audit frontmatter/text for an inline source or its sidecar."""
    frontmatter = note["frontmatter"]
    relative = note["relative"]
    mode = as_text(frontmatter.get("source_input_mode") or "inline")
    if mode == "inline":
        return frontmatter, note["text"], relative
    if mode != "manifest":
        issue(findings["invalid_property_values"], relative, "invalid_source_input_mode", value=mode)
        return None
    manifest_ref = as_text(frontmatter.get("source_manifest"))
    manifest_target = target_from_value(manifest_ref)
    manifest_path = resolve_input(vault, manifest_target)
    if not manifest_ref or not manifest_path:
        issue(findings["traceability_issues"], relative, "manifest_source_requires_existing_sidecar")
        return None
    try:
        manifest_text = manifest_path.read_text(encoding="utf-8")
        manifest_frontmatter, _ = parse_frontmatter(manifest_text)
    except (OSError, FrontmatterError) as error:
        issue(findings["traceability_issues"], relative, "manifest_source_unreadable", detail=type(error).__name__)
        return None
    manifest_relative = str(manifest_path.relative_to(vault))
    if as_text(manifest_frontmatter.get("type")) != "source_manifest" or as_text(manifest_frontmatter.get("manifest_contract")) != "source-input-manifest-v1":
        issue(findings["traceability_issues"], relative, "manifest_source_contract_invalid")
    expected_source = normalize_target(relative)
    actual_source = normalize_target(target_from_value(as_text(manifest_frontmatter.get("source_note"))))
    if actual_source != expected_source:
        issue(findings["traceability_issues"], relative, "manifest_source_note_mismatch", expected=expected_source, actual=actual_source)
    if as_text(manifest_frontmatter.get("content_hash")) != as_text(frontmatter.get("content_hash")):
        issue(findings["traceability_issues"], relative, "manifest_content_hash_mismatch")
    try:
        if int(as_text(frontmatter.get("source_input_count"))) != int(as_text(manifest_frontmatter.get("input_count"))):
            issue(findings["traceability_issues"], relative, "manifest_input_count_mismatch")
    except ValueError:
        issue(findings["traceability_issues"], relative, "manifest_input_count_invalid")
    return manifest_frontmatter, manifest_text, manifest_relative


def add_source_contract_findings(vault: Path, note: dict, findings: dict[str, list[dict]]) -> None:
    frontmatter = note["frontmatter"]
    relative = note["relative"]
    contract = as_text(frontmatter.get("source_contract"))
    role = as_text(frontmatter.get("source_role"))
    coverage = as_text(frontmatter.get("coverage_status"))
    if contract == "navigation-index-v1":
        if role != "index" or coverage != "index_only" or as_text(frontmatter.get("coverage_verified")) != "false":
            issue(findings["semantic_issues"], relative, "navigation_index_contract_mismatch")
        return
    if contract not in {"semantic-content-v2", "semantic-content-v3", "semantic-content-v4"}:
        return
    v3 = contract == "semantic-content-v3"
    v4 = contract == "semantic-content-v4"
    required = SOURCE_V4_REQUIRED if v4 else (SOURCE_V3_REQUIRED if v3 else SOURCE_V2_REQUIRED)
    if as_text(frontmatter.get("source_input_mode") or "inline") == "manifest":
        required = required - {"source_inputs"} | {"source_input_mode", "source_manifest", "source_input_count"}
    missing = sorted(key for key in required if key not in frontmatter)
    if missing:
        issue(findings["traceability_issues"], relative, "semantic_content_v2_missing_properties", missing=missing)
        return
    if role != "content":
        issue(findings["semantic_issues"], relative, "semantic_content_v2_requires_content_role")
    if coverage not in {"partial", "complete"}:
        issue(findings["semantic_issues"], relative, "semantic_content_v2_requires_partial_or_complete")
    if v3:
        if as_text(frontmatter.get("content_unit_scheme")) != "stable-block-v1":
            issue(findings["semantic_issues"], relative, "semantic_content_v3_requires_stable_block_scheme")
        if coverage == "complete" and (as_text(frontmatter.get("coverage_check")) != "passed" or as_text(frontmatter.get("semantic_check")) != "passed"):
            issue(findings["semantic_issues"], relative, "complete_v3_source_requires_double_gate")
    if v4:
        modalities = frontmatter.get("content_modalities")
        if not isinstance(modalities, list) or not modalities:
            issue(findings["traceability_issues"], relative, "semantic_content_v4_requires_modalities")
        if (as_text(frontmatter.get("content_unit_scheme")), as_text(frontmatter.get("visual_unit_scheme"))) not in {
            ("stable-block-v2", "page-region-v1"),
            ("page-element-v1", "page-region-v2"),
            ("timestamp-topic-v1", "page-region-v1"),
            ("timestamp-topic-v1", "image-region-v1"),
        }:
            issue(findings["semantic_issues"], relative, "semantic_content_v4_requires_stable_units")
        visual_check = as_text(frontmatter.get("visual_check"))
        if coverage == "complete" and (as_text(frontmatter.get("coverage_check")) != "passed" or as_text(frontmatter.get("semantic_check")) != "passed" or visual_check not in {"passed", "not_applicable"}):
            issue(findings["semantic_issues"], relative, "complete_v4_source_requires_triple_gate")
        learning_mode = as_text(frontmatter.get("compilation_mode")) in {"pdf-primary-learning-v1", "slide-photo-primary-learning-v1"}
        if learning_mode:
            required_learning = {"narrative_unit_scheme", "primary_speaker", "learning_check", "anti_summary_check", "acceptance_status"}
            missing_learning = sorted(key for key in required_learning if key not in frontmatter or not as_text(frontmatter.get(key)))
            if missing_learning:
                issue(findings["traceability_issues"], relative, "learning_source_missing_properties", missing=missing_learning)
            if as_text(frontmatter.get("narrative_unit_scheme")) != "topic-argument-v1":
                issue(findings["semantic_issues"], relative, "learning_source_requires_topic_argument_scheme")
            if coverage == "complete" and (as_text(frontmatter.get("learning_check")) != "passed" or as_text(frontmatter.get("anti_summary_check")) != "passed" or as_text(frontmatter.get("acceptance_status")) != "accepted"):
                issue(findings["semantic_issues"], relative, "complete_learning_source_requires_accepted_reading_gates")
    audit_layer = source_audit_layer(vault, note, findings)
    if audit_layer is None:
        return
    _, audit_text, _ = audit_layer
    manifest_mode = as_text(frontmatter.get("source_input_mode") or "inline") == "manifest"
    if not manifest_mode and (not isinstance(frontmatter.get("source_inputs"), list) or not frontmatter["source_inputs"]):
        issue(findings["traceability_issues"], relative, "semantic_content_v2_requires_source_inputs")
    if not isinstance(frontmatter.get("evidence_families"), list) or not frontmatter["evidence_families"]:
        issue(findings["traceability_issues"], relative, "semantic_content_v2_requires_evidence_families")
    input_table = markdown_table(audit_text, "原始输入清单")
    coverage_table = markdown_table(audit_text, "覆盖附录")
    if not input_table or input_table[0] != INPUT_HEADERS or not input_table[1] or any(len(row) != len(INPUT_HEADERS) for row in input_table[1]):
        issue(findings["traceability_issues"], relative, "semantic_content_v2_requires_input_manifest")
        return
    if not coverage_table or coverage_table[0] != COVERAGE_HEADERS or not coverage_table[1] or any(len(row) != len(COVERAGE_HEADERS) for row in coverage_table[1]):
        issue(findings["traceability_issues"], relative, "semantic_content_v2_requires_coverage_manifest")
        return
    input_rows = input_table[1]
    coverage_rows = coverage_table[1]
    ids: set[str] = set()
    records: list[tuple[str, str]] = []
    manifest_targets: set[str] = set()
    input_paths: dict[str, Path] = {}
    for row in input_rows:
        input_id, input_ref, _, _, digest, _, _ = row
        target = target_from_value(input_ref)
        if not input_id or input_id in ids:
            issue(findings["traceability_issues"], relative, "invalid_or_duplicate_input_id", input_id=input_id)
            continue
        ids.add(input_id)
        manifest_targets.add(target)
        if not HASH_RE.fullmatch(digest):
            issue(findings["traceability_issues"], relative, "input_manifest_requires_sha256", input_id=input_id)
            continue
        path = resolve_input(vault, target)
        if not path:
            issue(findings["broken_links"], relative, "missing_source_input", target=target)
            continue
        actual = sha256_file(path)
        input_paths[input_id] = path
        if actual != digest and (v3 or v4):
            issue(findings["traceability_issues"], relative, "source_input_hash_mismatch", input_id=input_id, target=target)
        records.append((input_id, digest))
    source_targets = {target_from_value(str(value)) for value in frontmatter.get("source_inputs", [])}
    if not manifest_mode and source_targets != manifest_targets:
        issue(findings["traceability_issues"], relative, "source_inputs_manifest_mismatch", source_inputs=sorted(source_targets), manifest=sorted(manifest_targets))
    if manifest_mode:
        try:
            if int(as_text(frontmatter.get("source_input_count"))) != len(input_rows):
                issue(findings["traceability_issues"], relative, "manifest_input_count_does_not_match_rows", expected=as_text(frontmatter.get("source_input_count")), actual=len(input_rows))
        except ValueError:
            pass
    coverage_by_input: dict[str, list[list[str]]] = defaultdict(list)
    for row in coverage_rows:
        coverage_by_input[row[0]].append(row)
        if row[0] not in ids:
            issue(findings["traceability_issues"], relative, "coverage_references_unknown_input", input_id=row[0])
        if not nonempty_cell(row[1]) or not nonempty_cell(row[2]):
            issue(findings["traceability_issues"], relative, "coverage_requires_unit_and_expected_range", input_id=row[0])
        if not nonempty_cell(row[3]) and not nonempty_cell(row[4]):
            issue(findings["traceability_issues"], relative, "coverage_requires_destination_or_exclusion", input_id=row[0])
        if v3 and nonempty_cell(row[3]):
            anchor = coverage_anchor(note["text"], row[3])
            if not anchor:
                issue(findings["traceability_issues"], relative, "v3_coverage_requires_stable_block_destination", input_id=row[0])
            elif not block_anchor_exists(note["text"], anchor):
                issue(findings["traceability_issues"], relative, "v3_coverage_references_missing_block", input_id=row[0], anchor=anchor)
        if v4 and as_text(frontmatter.get("content_unit_scheme")) == "timestamp-topic-v1" and input_paths.get(row[0], Path()).suffix.lower() in {".txt", ".md", ".srt", ".vtt"}:
            expected_range = row[2].strip().lower()
            if not re.search(r"\b\d{1,2}:\d{2}\b\s*(?:–|-|至|到)\s*\b\d{1,2}:\d{2}\b", expected_range):
                issue(findings["semantic_issues"], relative, "timestamp_topic_coverage_requires_precise_range", input_id=row[0], value=row[2])
            if any(marker in expected_range for marker in {"剩余", "整场", "片段", "其余"}):
                issue(findings["semantic_issues"], relative, "timestamp_topic_coverage_rejects_ambiguous_range", input_id=row[0], value=row[2])
            if nonempty_cell(row[3]):
                anchor = coverage_anchor(note["text"], row[3])
                if not anchor:
                    issue(findings["traceability_issues"], relative, "timestamp_topic_coverage_requires_reader_block", input_id=row[0])
                elif not block_anchor_exists(note["text"], anchor):
                    issue(findings["traceability_issues"], relative, "timestamp_topic_coverage_references_missing_block", input_id=row[0], anchor=anchor)
    for input_id in ids:
        if input_id not in coverage_by_input:
            issue(findings["traceability_issues"], relative, "input_requires_coverage_row", input_id=input_id)
    if coverage == "complete":
        if as_text(frontmatter.get("coverage_verified")) != "true":
            issue(findings["semantic_issues"], relative, "complete_source_requires_coverage_verified")
        for row in coverage_rows:
            if nonempty_cell(row[5]):
                issue(findings["semantic_issues"], relative, "complete_source_has_unresolved_coverage", input_id=row[0])
        if (v3 or v4) and len(records) == len(ids) and as_text(frontmatter.get("content_hash")) != composite_hash(records):
            issue(findings["traceability_issues"], relative, "content_hash_does_not_match_input_manifest")
    if not v4:
        return
    if as_text(frontmatter.get("source_adapter")) == "mixed" and as_text(frontmatter.get("visual_check")) == "not_applicable":
        issue(findings["semantic_issues"], relative, "mixed_source_cannot_mark_visual_not_applicable")
    slide_photo_learning = as_text(frontmatter.get("compilation_mode")) == "slide-photo-primary-learning-v1"
    if slide_photo_learning:
        visual_table = markdown_table(audit_text, "视觉单元清单")
        if not visual_table or visual_table[0] != SLIDE_PHOTO_VISUAL_HEADERS or not visual_table[1] or any(len(row) != len(SLIDE_PHOTO_VISUAL_HEADERS) for row in visual_table[1]):
            issue(findings["traceability_issues"], relative, "slide_photo_source_requires_visual_unit_manifest")
            return
        image_ids = {input_id for input_id, path in input_paths.items() if path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".heic"}}
        visual_ids: set[str] = set()
        by_input: dict[str, list[list[str]]] = defaultdict(list)
        for row in visual_table[1]:
            visual_id, input_id, representative, visual_type, visible, body_ref, display, state, duplicate_of, attachment, digest, limitation = row
            if not re.fullmatch(r"V\d+", visual_id) or visual_id in visual_ids:
                issue(findings["traceability_issues"], relative, "invalid_or_duplicate_slide_photo_visual_id", visual_id=visual_id)
            visual_ids.add(visual_id)
            by_input[input_id].append(row)
            if input_id not in image_ids:
                issue(findings["traceability_issues"], relative, "slide_photo_visual_references_unknown_image", input_id=input_id)
            if state not in {"transcribed", "duplicate", "excluded", "unreadable"}:
                issue(findings["invalid_property_values"], relative, "invalid_slide_photo_visual_state", visual_id=visual_id, value=state)
            if not visible.strip() or visible.strip() in {"现场课件照片", "课件照片", "图片内容"}:
                issue(findings["semantic_issues"], relative, "slide_photo_visual_requires_specific_transcription", visual_id=visual_id)
            if state in {"transcribed", "duplicate"}:
                anchor = coverage_anchor(note["text"], body_ref)
                if not anchor or not block_anchor_exists(note["text"], anchor):
                    issue(findings["traceability_issues"], relative, "slide_photo_visual_requires_reader_block", visual_id=visual_id)
            if state == "duplicate":
                if duplicate_of not in visual_ids and not any(existing[0] == duplicate_of for existing in visual_table[1]):
                    issue(findings["traceability_issues"], relative, "slide_photo_duplicate_requires_valid_target", visual_id=visual_id, duplicate_of=duplicate_of)
                if representative not in image_ids:
                    issue(findings["traceability_issues"], relative, "slide_photo_duplicate_requires_representative", visual_id=visual_id)
                duplicate_target = link_target(attachment)
                if duplicate_target and embed_positions(note["text"], duplicate_target):
                    issue(findings["traceability_issues"], relative, "slide_photo_duplicate_must_not_be_displayed", visual_id=visual_id)
            elif state == "transcribed" and representative != input_id:
                issue(findings["traceability_issues"], relative, "slide_photo_transcribed_requires_self_representative", visual_id=visual_id)
            if display not in {"inline", "folded", "duplicate", "excluded", "unreadable"}:
                issue(findings["invalid_property_values"], relative, "invalid_slide_photo_display_mode", visual_id=visual_id, value=display)
            if state == "transcribed" and display in {"inline", "folded"}:
                if "![[" not in note["text"]:
                    issue(findings["traceability_issues"], relative, "slide_photo_reader_requires_obsidian_embed", visual_id=visual_id)
                elif anchor and anchor.startswith("t-"):
                    alignment = exact_visual_reader_alignment(note["text"], anchor, attachment)
                    if alignment == "embed_count":
                        issue(findings["traceability_issues"], relative, "slide_photo_visual_requires_one_reader_embed", visual_id=visual_id)
                    elif alignment == "embed_after_anchor":
                        issue(findings["traceability_issues"], relative, "slide_photo_visual_embed_must_precede_reader_block", visual_id=visual_id)
                    elif alignment in {"heading_between", "reader_block_between"}:
                        issue(findings["semantic_issues"], relative, "slide_photo_visual_is_not_adjacent_to_reader_block", visual_id=visual_id, alignment=alignment)
                    elif alignment == "visual_wall":
                        issue(findings["semantic_issues"], relative, "visual_wall_without_explanation", visual_id=visual_id)
                    elif alignment == "missing_target":
                        issue(findings["traceability_issues"], relative, "slide_photo_visual_requires_existing_embed_target", visual_id=visual_id)
            matches = WIKILINK_RE.findall(attachment)
            if matches:
                attachment_path = resolve_input(vault, normalize_target(matches[0][1]))
                if not attachment_path:
                    issue(findings["broken_links"], relative, "slide_photo_attachment_missing", visual_id=visual_id)
                elif not HASH_RE.fullmatch(digest) or sha256_file(attachment_path) != digest:
                    issue(findings["traceability_issues"], relative, "slide_photo_attachment_hash_mismatch", visual_id=visual_id)
            elif state == "transcribed" and display == "inline":
                issue(findings["traceability_issues"], relative, "slide_photo_inline_requires_attachment", visual_id=visual_id)
        for input_id in image_ids:
            if len(by_input[input_id]) != 1:
                issue(findings["traceability_issues"], relative, "slide_photo_image_requires_exactly_one_visual_unit", input_id=input_id, count=len(by_input[input_id]))
        if as_text(frontmatter.get("acceptance_status")) == "accepted" and any(row[7] == "unreadable" for row in visual_table[1]):
            issue(findings["semantic_issues"], relative, "accepted_slide_photo_source_has_unreadable_visual")
        return
    has_pdf_input = any(path.suffix.lower() == ".pdf" for path in input_paths.values())
    full_pdf = has_pdf_input and as_text(frontmatter.get("content_fidelity")) == "full"
    requires_page_visual_manifest = full_pdf or (as_text(frontmatter.get("source_adapter")) == "document" and as_text(frontmatter.get("visual_check")) == "passed")
    if full_pdf and coverage == "complete" and (as_text(frontmatter.get("fidelity_check")) != "passed" or as_text(frontmatter.get("content_unit_scheme")) != "page-element-v1" or as_text(frontmatter.get("visual_unit_scheme")) != "page-region-v2"):
        issue(findings["semantic_issues"], relative, "full_pdf_requires_fidelity_gate")
    page_table = markdown_table(note["text"], "页面覆盖表")
    visual_table = markdown_table(note["text"], "视觉证据清单")
    expected_page_headers = PAGE_COVERAGE_FULL_HEADERS if full_pdf else PAGE_COVERAGE_HEADERS
    if requires_page_visual_manifest and (not page_table or page_table[0] != expected_page_headers or not page_table[1] or any(len(row) != len(expected_page_headers) for row in page_table[1])):
        issue(findings["traceability_issues"], relative, "semantic_content_v4_requires_page_coverage")
        return
    if requires_page_visual_manifest and (not visual_table or visual_table[0] != VISUAL_MANIFEST_HEADERS or not visual_table[1] or any(len(row) != len(VISUAL_MANIFEST_HEADERS) for row in visual_table[1])):
        issue(findings["traceability_issues"], relative, "visual_complete_source_requires_manifest")
        return
    visual_rows = visual_table[1] if visual_table else []
    visual_descriptions: Counter[tuple[str, str]] = Counter()
    visual_ids: set[str] = set()
    for row in visual_rows:
        visual_id, _, _, attachment, digest, visible_fact, argument_role, nature, body_ref, state, _ = row
        if not re.fullmatch(r"V\d+", visual_id) or visual_id in visual_ids:
            issue(findings["traceability_issues"], relative, "invalid_or_duplicate_visual_id", visual_id=visual_id)
        visual_ids.add(visual_id)
        if nature not in {"explicit-action", "speaker-claim", "case-result", "visual-observation", "missing"}:
            issue(findings["invalid_property_values"], relative, "invalid_visual_evidence_nature", visual_id=visual_id, value=nature)
        anchor = visual_anchor(note["text"], body_ref)
        if full_pdf and not anchor:
            anchor = coverage_anchor(note["text"], body_ref)
        if not anchor or not block_anchor_exists(note["text"], anchor):
            issue(findings["traceability_issues"], relative, "visual_manifest_requires_real_visual_block", visual_id=visual_id)
        if state not in {"recognized", "excluded", "unreadable"}:
            issue(findings["invalid_property_values"], relative, "invalid_visual_state", visual_id=visual_id, value=state)
        matches = WIKILINK_RE.findall(attachment)
        if matches:
            target = normalize_target(matches[0][1])
            attachment_path = resolve_input(vault, target)
            if not attachment_path:
                issue(findings["broken_links"], relative, "visual_attachment_missing", visual_id=visual_id, target=target)
            elif not HASH_RE.fullmatch(digest) or sha256_file(attachment_path) != digest:
                issue(findings["traceability_issues"], relative, "visual_attachment_hash_mismatch", visual_id=visual_id)
        elif state == "recognized" and as_text(frontmatter.get("visual_check")) == "passed" and attachment not in {"—", "-", "原件", "原件（无派生裁图）"}:
            issue(findings["traceability_issues"], relative, "visual_manifest_requires_attachment_or_explicit_exclusion", visual_id=visual_id)
        if state == "recognized":
            if visible_fact.strip() in {"", "本页可见的表格、SERP、流程或案例画面", "本页可见的图、画布、旅程、渠道或案例画面", "本页可见的截图、图表或案例画面"}:
                issue(findings["semantic_issues"], relative, "visual_manifest_requires_page_specific_description", visual_id=visual_id)
            visual_descriptions[(visible_fact.strip(), argument_role.strip())] += 1
    for (visible_fact, argument_role), count in visual_descriptions.items():
        if visible_fact and argument_role and count > 1:
            issue(findings["semantic_issues"], relative, "visual_manifest_repeats_description", visible_fact=visible_fact, argument_role=argument_role, count=count)
    if not page_table:
        return
    content_units: dict[str, tuple[str, str]] = {}
    if full_pdf:
        content_table = markdown_table(note["text"], "内容单元清单")
        if not content_table or content_table[0] != CONTENT_UNIT_HEADERS or not content_table[1] or any(len(row) != len(CONTENT_UNIT_HEADERS) for row in content_table[1]):
            issue(findings["traceability_issues"], relative, "full_pdf_requires_content_unit_manifest")
        else:
            for unit_id, page, content_type, scope, body_ref, _, state, _, unresolved in content_table[1]:
                if not re.fullmatch(r"C\d+", unit_id) or unit_id in content_units:
                    issue(findings["traceability_issues"], relative, "invalid_or_duplicate_content_unit", unit_id=unit_id)
                anchor = coverage_anchor(note["text"], body_ref)
                if not anchor or not block_anchor_exists(note["text"], anchor):
                    issue(findings["traceability_issues"], relative, "content_unit_requires_real_block", unit_id=unit_id)
                if state not in {"transcribed", "excluded", "unreadable"}:
                    issue(findings["invalid_property_values"], relative, "invalid_content_unit_state", unit_id=unit_id, value=state)
                if coverage == "complete" and (state == "unreadable" or nonempty_cell(unresolved)):
                    issue(findings["semantic_issues"], relative, "complete_full_pdf_has_unresolved_unit", unit_id=unit_id)
                if content_type in {"页面完整语义转录", "页面摘要", "导读"} or scope in {"页面完整语义转录", "导读"}:
                    issue(findings["semantic_issues"], relative, "full_pdf_rejects_generic_content_unit", unit_id=unit_id)
                content_units[unit_id] = (page, state)
    page_ids: set[str] = set()
    for row in page_table[1]:
        if full_pdf:
            input_id, page, role_name, content_unit_id, visual_id, body_ref, exclusion, unresolved = row
        else:
            input_id, page, role_name, visual_id, body_ref, exclusion, unresolved = row
        key = f"{input_id}:{page}"
        if key in page_ids:
            issue(findings["traceability_issues"], relative, "duplicate_page_coverage", page=key)
        page_ids.add(key)
        if not all((input_id, page, role_name)):
            issue(findings["traceability_issues"], relative, "page_coverage_requires_identity", page=key)
        if full_pdf and (content_unit_id not in content_units or content_units[content_unit_id][0] != page):
            issue(findings["traceability_issues"], relative, "page_coverage_requires_matching_content_unit", page=key, content_unit_id=content_unit_id)
        if not full_pdf and visual_id not in visual_ids and not nonempty_cell(exclusion):
            issue(findings["traceability_issues"], relative, "page_coverage_requires_visual_or_exclusion", page=key)
        anchor = coverage_anchor(note["text"], body_ref)
        if not anchor or not block_anchor_exists(note["text"], anchor):
            issue(findings["traceability_issues"], relative, "v4_page_coverage_requires_content_block", page=key)
        if coverage == "complete" and nonempty_cell(unresolved):
            issue(findings["semantic_issues"], relative, "complete_v4_source_has_unresolved_page", page=key)
    if full_pdf:
        for input_id, path in input_paths.items():
            if path.suffix.lower() != ".pdf" or PdfReader is None:
                continue
            try:
                with quiet_pypdf_logger():
                    expected_pages = set(range(1, len(PdfReader(str(path)).pages) + 1))
            except Exception:
                issue(findings["traceability_issues"], relative, "pdf_page_count_unreadable", input_id=input_id)
                continue
            covered_pages = {int(row[1]) for row in page_table[1] if row[0] == input_id and row[1].isdigit()}
            if covered_pages != expected_pages:
                issue(findings["traceability_issues"], relative, "full_pdf_page_coverage_mismatch", input_id=input_id, expected=sorted(expected_pages), actual=sorted(covered_pages))


def add_method_contract_findings(notes: dict[Path, dict], aliases: dict[str, list[Path]], note: dict, findings: dict[str, list[dict]]) -> None:
    frontmatter = note["frontmatter"]
    relative = note["relative"]
    active_method = relative.startswith("02_Knowledge/方法/") and as_text(frontmatter.get("status")) == "active"
    active_case = relative.startswith("02_Knowledge/案例/") and as_text(frontmatter.get("status")) == "active"
    contract = as_text(frontmatter.get("evidence_contract"))
    v2 = contract == "direct-content-v2"
    v3 = contract == "direct-content-v3"
    v4 = contract == "direct-content-v4"
    if active_method and not (v2 or v3 or v4):
        issue(findings["semantic_issues"], relative, "active_method_requires_direct_content_v2")
        return
    if not (v2 or v3 or v4):
        return
    kind = as_text(frontmatter.get("knowledge_kind"))
    required = METHOD_V2_REQUIRED if kind == "method" else KNOWLEDGE_V2_REQUIRED
    missing = sorted(key for key in required if key not in frontmatter)
    if missing:
        issue(findings["traceability_issues"], relative, "knowledge_v2_missing_properties", missing=missing)
        return
    readiness = as_text(frontmatter.get("operational_readiness"))
    expected_method_contract = "evidence-bound-method-v4" if v4 else ("evidence-bound-method-v3" if v3 else "evidence-bound-method-v2")
    if active_method and (kind != "method" or as_text(frontmatter.get("method_contract")) != expected_method_contract or readiness not in {"runnable", "tested"}):
        issue(findings["semantic_issues"], relative, "active_method_requires_operational_method_v2")
    if active_case and (kind != "case" or readiness != "not_applicable" or as_text(frontmatter.get("method_contract"))):
        issue(findings["semantic_issues"], relative, "active_case_contract_mismatch")
    if kind == "method" and as_text(frontmatter.get("method_contract")) != expected_method_contract:
        issue(findings["semantic_issues"], relative, "method_v2_contract_mismatch")
    source_notes = frontmatter.get("source_notes")
    cited_sources: list[dict] = []
    if not isinstance(source_notes, list) or not source_notes:
        issue(findings["semantic_issues"], relative, "direct_content_contract_requires_source_notes")
    else:
        for source_note in source_notes:
            matches = WIKILINK_RE.findall(str(source_note))
            if len(matches) != 1:
                issue(findings["semantic_issues"], relative, "direct_content_contract_requires_wikilink_source", source_note=str(source_note))
                continue
            candidates = aliases.get(normalize_target(matches[0][1]), [])
            if len(candidates) != 1:
                continue
            source = notes[candidates[0]]
            source_frontmatter = source["frontmatter"]
            expected_source_contract = "semantic-content-v4" if v4 else ("semantic-content-v3" if v3 else "semantic-content-v2")
            gates_passed = as_text(source_frontmatter.get("coverage_check")) == "passed" and as_text(source_frontmatter.get("semantic_check")) == "passed"
            if v4:
                gates_passed = gates_passed and as_text(source_frontmatter.get("visual_check")) in {"passed", "not_applicable"}
            if not (as_text(source_frontmatter.get("type")) == "source" and as_text(source_frontmatter.get("source_contract")) == expected_source_contract and as_text(source_frontmatter.get("source_role")) == "content" and as_text(source_frontmatter.get("coverage_status")) == "complete" and as_text(source_frontmatter.get("coverage_verified")) == "true" and (not (v3 or v4) or gates_passed)):
                issue(findings["semantic_issues"], relative, "direct_content_v2_requires_verified_complete_source", source_note=str(source_note))
                continue
            cited_sources.append(source)
    if v2 and not active_method:
        # v2 is deliberately read-compatible. Only newly active v3 methods
        # receive v3 family/readiness enforcement; legacy/review notes are not
        # mass-migrated into new audit debt.
        return
    families = sorted({family for source in cited_sources for family in source["frontmatter"].get("evidence_families", [])})
    claimed_families = frontmatter.get("evidence_families")
    if isinstance(claimed_families, list) and sorted(claimed_families) != families:
        issue(findings["semantic_issues"], relative, "knowledge_evidence_families_mismatch", expected=families, actual=sorted(claimed_families))
    independent_count = as_text(frontmatter.get("independent_source_count"))
    applied_count = as_text(frontmatter.get("applied_validation_count"))
    try:
        parsed_independent = int(independent_count)
        parsed_applied = int(applied_count)
        if parsed_independent < 0 or parsed_applied < 0:
            raise ValueError
    except ValueError:
        issue(findings["semantic_issues"], relative, "method_v2_counts_must_be_nonnegative_integers")
        parsed_independent, parsed_applied = -1, -1
    if parsed_independent >= 0 and parsed_independent != len(families):
        issue(findings["semantic_issues"], relative, "independent_source_count_mismatch", expected=len(families), actual=parsed_independent)
    actual_applied = sum(1 for source in cited_sources if as_text(source["frontmatter"].get("source_kind")) == "applied_validation")
    if parsed_applied >= 0 and parsed_applied != actual_applied:
        issue(findings["semantic_issues"], relative, "applied_validation_count_mismatch", expected=actual_applied, actual=parsed_applied)
    maturity = as_text(frontmatter.get("maturity"))
    if maturity == "candidate" and parsed_independent < 1:
        issue(findings["semantic_issues"], relative, "candidate_requires_direct_evidence_family")
    if maturity == "validated" and not (parsed_independent >= 2 or (parsed_independent >= 1 and parsed_applied >= 1)):
        issue(findings["semantic_issues"], relative, "validated_requires_independent_family_or_applied_validation")
    if maturity == "evergreen" and not (parsed_independent >= 2 and parsed_applied >= 2):
        issue(findings["semantic_issues"], relative, "evergreen_requires_multiple_families_and_applications")
    if maturity == "evergreen" and isinstance(frontmatter.get("contradicts"), list) and frontmatter["contradicts"]:
        issue(findings["semantic_issues"], relative, "evergreen_has_unresolved_conflict")
    if kind != "method" or as_text(frontmatter.get("method_contract")) != expected_method_contract:
        return
    # Existing v3-format ledgers promoted to v4 for their verified visual
    # sources stay readable during incremental migration; new v4 cards below
    # must use the richer modality/raw-locator ledger.
    legacy_v4_ledger = v4 and markdown_table(note["text"], "直接证据台账") and markdown_table(note["text"], "直接证据台账")[0] == DIRECT_EVIDENCE_HEADERS
    if legacy_v4_ledger:
        return
    if v4 and markdown_table(note["text"], "直接证据台账") and tuple(markdown_table(note["text"], "直接证据台账")[0]) not in {tuple(DIRECT_EVIDENCE_HEADERS), tuple(DIRECT_EVIDENCE_V4_HEADERS)}:
        return
    headings = METHOD_V3_HEADINGS if (v3 or v4) else METHOD_V2_HEADINGS
    for heading in headings:
        body = section_body(note["text"], heading)
        count = len(re.findall(rf"^## {re.escape(heading)}\s*$", note["text"], re.MULTILINE))
        if count != 1:
            issue(findings["semantic_issues"], relative, "method_v2_requires_one_section", heading=heading, actual=count)
        if body is None or not body:
            issue(findings["semantic_issues"], relative, "method_v2_missing_or_empty_section", heading=heading)
    evidence_table = markdown_table(note["text"], "直接证据台账")
    evidence_by_id: dict[str, list[str]] = {}
    expected_evidence_headers = DIRECT_EVIDENCE_V4_HEADERS if v4 else DIRECT_EVIDENCE_HEADERS
    allowed_evidence_headers = {tuple(expected_evidence_headers)}
    # v4 method cards migrated from a v3 ledger remain structurally readable
    # while their source locators are being recompiled; newly authored v4 cards
    # use the richer modality/raw-locator header.
    if v4:
        allowed_evidence_headers.add(tuple(DIRECT_EVIDENCE_HEADERS))
    if not evidence_table or tuple(evidence_table[0]) not in allowed_evidence_headers or not evidence_table[1]:
        issue(findings["traceability_issues"], relative, "method_v2_requires_direct_evidence_ledger")
    else:
        for row in evidence_table[1]:
            if v4 and evidence_table[0] == DIRECT_EVIDENCE_V4_HEADERS:
                evidence_id, content, nature, modality, source, locator, raw_locator, family, limitation = row
                locator = f"{source} {locator}"
            else:
                evidence_id, content, nature, source, locator, family, limitation = row
            if not re.fullmatch(r"E\d+", evidence_id) or evidence_id in evidence_by_id:
                issue(findings["traceability_issues"], relative, "invalid_or_duplicate_evidence_id", evidence_id=evidence_id)
            evidence_by_id[evidence_id] = row
            if not all((content, nature, source, locator, family, limitation)):
                issue(findings["traceability_issues"], relative, "direct_evidence_requires_complete_row", evidence_id=evidence_id)
            if nature not in {"explicit-action", "speaker-claim", "case-result", "visual-observation", "missing"}:
                issue(findings["invalid_property_values"], relative, "invalid_evidence_nature", evidence_id=evidence_id, value=nature)
            if v3 or v4:
                anchor = coverage_anchor(note["text"], locator) or visual_anchor(note["text"], locator)
                if not anchor:
                    issue(findings["traceability_issues"], relative, "v3_evidence_requires_source_block", evidence_id=evidence_id)
                else:
                    candidates = aliases.get(normalize_target(WIKILINK_RE.findall(locator)[-1][1]), []) if WIKILINK_RE.findall(locator) else []
                    if len(candidates) != 1 or not block_anchor_exists(notes[candidates[0]]["text"], anchor):
                        issue(findings["traceability_issues"], relative, "v3_evidence_references_missing_source_block", evidence_id=evidence_id, anchor=anchor)
    design_table = markdown_table(note["text"], "编者操作设计")
    design_by_id: dict[str, list[str]] = {}
    if not design_table or design_table[0] != DESIGN_HEADERS or not design_table[1]:
        issue(findings["traceability_issues"], relative, "method_v2_requires_compiler_design_ledger")
    else:
        for row in design_table[1]:
            design_id, design_type, skeleton, purpose, parameter, boundary = row
            if not re.fullmatch(r"D\d+", design_id) or design_id in design_by_id:
                issue(findings["traceability_issues"], relative, "invalid_or_duplicate_design_id", design_id=design_id)
            design_by_id[design_id] = row
            if not all((design_type, skeleton, purpose, parameter, boundary)):
                issue(findings["traceability_issues"], relative, "compiler_design_requires_complete_boundary", design_id=design_id)
            if design_type not in DESIGN_TYPES:
                issue(findings["invalid_property_values"], relative, "invalid_compiler_design_type", design_id=design_id, value=design_type)
    flow_table = markdown_table(note["text"], "执行流程")
    if not flow_table or flow_table[0] != FLOW_HEADERS or not flow_table[1]:
        issue(findings["traceability_issues"], relative, "method_v2_requires_execution_flow")
    else:
        for row in flow_table[1]:
            step_id, action, basis, inputs, outputs, branch, failure = row
            if not re.fullmatch(r"S\d+", step_id) or not all((action, basis, inputs, outputs, branch, failure)):
                issue(findings["traceability_issues"], relative, "execution_step_requires_complete_row", step_id=step_id)
            references = re.findall(r"\[([ED]\d+)\]", basis)
            if not references:
                issue(findings["traceability_issues"], relative, "execution_step_requires_evidence_or_design_id", step_id=step_id)
            explicit_action_found = False
            for reference in references:
                if reference.startswith("E"):
                    evidence = evidence_by_id.get(reference)
                    if not evidence:
                        issue(findings["traceability_issues"], relative, "execution_step_references_unknown_id", reference=reference)
                    elif evidence[2] == "explicit-action":
                        explicit_action_found = True
                    else:
                        issue(findings["semantic_issues"], relative, "execution_step_requires_explicit_action", reference=reference)
                elif reference not in design_by_id:
                    issue(findings["traceability_issues"], relative, "execution_step_references_unknown_id", reference=reference)
            if not explicit_action_found:
                issue(findings["semantic_issues"], relative, "execution_step_requires_explicit_action", step_id=step_id)
    decision_table = markdown_table(note["text"], "决策表")
    if not decision_table or decision_table[0] != DECISION_HEADERS or not decision_table[1]:
        issue(findings["traceability_issues"], relative, "method_v2_requires_decision_table")
    else:
        for row in decision_table[1]:
            if not all(row):
                issue(findings["traceability_issues"], relative, "decision_table_requires_complete_row")
            for reference in re.findall(r"\[([ED]\d+)\]", row[3]):
                if reference.startswith("E") and reference not in evidence_by_id:
                    issue(findings["traceability_issues"], relative, "decision_references_unknown_id", reference=reference)
                if reference.startswith("D") and reference not in design_by_id:
                    issue(findings["traceability_issues"], relative, "decision_references_unknown_id", reference=reference)
    if v3 or v4:
        output_map = markdown_table(note["text"], "输出物映射")
        step_ids = {row[0] for row in (flow_table[1] if flow_table else [])}
        if not output_map or output_map[0] != OUTPUT_MAP_HEADERS or not output_map[1]:
            issue(findings["traceability_issues"], relative, "method_v3_requires_output_mapping")
        else:
            for row in output_map[1]:
                output_id, output_name, steps, template_location, basis = row
                if not re.fullmatch(r"O\d+", output_id) or not all(row):
                    issue(findings["traceability_issues"], relative, "output_mapping_requires_complete_row", output_id=output_id)
                for step in re.findall(r"S\d+", steps):
                    if step not in step_ids:
                        issue(findings["traceability_issues"], relative, "output_mapping_references_unknown_step", output_id=output_id, step_id=step)
                for reference in re.findall(r"\[([ED]\d+)\]", basis):
                    if reference.startswith("E") and reference not in evidence_by_id:
                        issue(findings["traceability_issues"], relative, "output_mapping_references_unknown_id", output_id=output_id, reference=reference)
                    if reference.startswith("D") and reference not in design_by_id:
                        issue(findings["traceability_issues"], relative, "output_mapping_references_unknown_id", output_id=output_id, reference=reference)
    stop_table = markdown_table(note["text"], "完成、暂停与停止条件")
    expected_stop_headers = STOP_V3_HEADERS if (v3 or v4) else STOP_HEADERS
    if not stop_table or stop_table[0] != expected_stop_headers or not stop_table[1]:
        issue(findings["traceability_issues"], relative, "method_v2_requires_completion_table")
    else:
        stop_types = {row[0] for row in stop_table[1] if len(row) == len(expected_stop_headers) and all(row)}
        if "complete" not in stop_types or not ({"pause", "stop"} & stop_types):
            issue(findings["semantic_issues"], relative, "completion_table_requires_complete_and_pause_or_stop")
        if v3 or v4:
            for row in stop_table[1]:
                for reference in re.findall(r"\[([ED]\d+)\]", row[2]):
                    if reference.startswith("E") and reference not in evidence_by_id:
                        issue(findings["traceability_issues"], relative, "completion_references_unknown_id", reference=reference)
                    if reference.startswith("D") and reference not in design_by_id:
                        issue(findings["traceability_issues"], relative, "completion_references_unknown_id", reference=reference)
    template_table = markdown_table(note["text"], "工作模板")
    if not template_table or not template_table[0] or not template_table[1]:
        issue(findings["traceability_issues"], relative, "method_v2_requires_copyable_template")
    if v3:
        try:
            version = int(as_text(frontmatter.get("method_version")))
            if version < 1:
                raise ValueError
        except ValueError:
            issue(findings["semantic_issues"], relative, "method_v3_requires_positive_version")
            version = -1
        dry_run_status = as_text(frontmatter.get("dry_run_status"))
        dry_run_notes = frontmatter.get("dry_run_notes")
        if readiness == "runnable" and dry_run_status != "passed":
            issue(findings["semantic_issues"], relative, "runnable_method_requires_passed_dry_run")
        if dry_run_status == "passed":
            matched = False
            if isinstance(dry_run_notes, list):
                for dry_run_note in dry_run_notes:
                    matches = WIKILINK_RE.findall(str(dry_run_note))
                    candidates = aliases.get(normalize_target(matches[0][1]), []) if len(matches) == 1 else []
                    if len(candidates) != 1:
                        continue
                    dry_run = notes[candidates[0]]["frontmatter"]
                    if as_text(dry_run.get("type")) == "method_dry_run" and as_text(dry_run.get("status")) == "complete" and as_text(dry_run.get("dry_run_status")) == "passed" and as_text(dry_run.get("method_version")) == str(version) and normalize_target(target_from_value(as_text(dry_run.get("method_note")))) == normalize_target(relative):
                        matched = True
            if not matched:
                issue(findings["traceability_issues"], relative, "passed_dry_run_requires_matching_record")
    if readiness == "tested" and parsed_applied < 1:
        issue(findings["semantic_issues"], relative, "tested_method_requires_applied_validation")


def validate_templates(vault: Path, findings: dict[str, list[dict]]) -> None:
    template_root = vault / "98_Templates"
    if not template_root.is_dir():
        return
    template_specs = {
        "98_Templates/来源笔记.md": ("semantic-content-v4", "partial", "false", "page-element-v1", "page-region-v2"),
        "98_Templates/会议纪要.md": ("semantic-content-v4", "partial", "false", "timestamp-topic-v1", "page-region-v1"),
        "98_Templates/PDF学习语义稿.md": ("semantic-content-v4", "partial", "false", "page-element-v1", "page-region-v2"),
    }
    for relative, expected in template_specs.items():
        path = vault / relative
        if not path.is_file():
            continue
        try:
            frontmatter, _ = parse_frontmatter(path.read_text(encoding="utf-8"))
        except (OSError, FrontmatterError) as error:
            issue(findings["template_issues"], relative, type(error).__name__)
            continue
        if (as_text(frontmatter.get("source_contract")), as_text(frontmatter.get("coverage_status")), as_text(frontmatter.get("coverage_verified")), as_text(frontmatter.get("content_unit_scheme")), as_text(frontmatter.get("visual_unit_scheme"))) != expected:
            issue(findings["template_issues"], relative, "source_template_v4_defaults_invalid")
        common_pending = as_text(frontmatter.get("coverage_check")) == "pending" and as_text(frontmatter.get("semantic_check")) == "pending" and as_text(frontmatter.get("visual_check")) == "pending"
        if relative.endswith("来源笔记.md") or relative.endswith("PDF学习语义稿.md"):
            valid_gates = common_pending and as_text(frontmatter.get("fidelity_check")) == "pending" and as_text(frontmatter.get("content_fidelity")) == "full"
        else:
            valid_gates = common_pending and not as_text(frontmatter.get("content_fidelity")) and not as_text(frontmatter.get("fidelity_check"))
        if not valid_gates:
            issue(findings["template_issues"], relative, "source_template_v4_gate_defaults_invalid")
        if relative.endswith("PDF学习语义稿.md"):
            learning_defaults = (
                as_text(frontmatter.get("compilation_mode")) == "pdf-primary-learning-v1"
                and as_text(frontmatter.get("narrative_unit_scheme")) == "topic-argument-v1"
                and as_text(frontmatter.get("learning_check")) == "pending"
                and as_text(frontmatter.get("anti_summary_check")) == "pending"
                and as_text(frontmatter.get("acceptance_status")) == "pending"
                and "primary_speaker" in frontmatter
            )
            if not learning_defaults:
                issue(findings["template_issues"], relative, "learning_source_template_defaults_invalid")
    template_specs = {
        "98_Templates/知识卡片.md": ("principle", "not_applicable", ""),
        "98_Templates/方法卡片.md": ("method", "runnable", "evidence-bound-method-v4"),
        "98_Templates/案例卡片.md": ("case", "not_applicable", ""),
    }
    for relative, expected in template_specs.items():
        path = vault / relative
        if not path.is_file():
            issue(findings["template_issues"], relative, "knowledge_template_missing")
            continue
        try:
            frontmatter, _ = parse_frontmatter(path.read_text(encoding="utf-8"))
        except (OSError, FrontmatterError) as error:
            issue(findings["template_issues"], relative, type(error).__name__)
            continue
        kind, readiness, contract = expected
        if as_text(frontmatter.get("knowledge_kind")) != kind or as_text(frontmatter.get("operational_readiness")) != readiness or as_text(frontmatter.get("method_contract")) != contract:
            issue(findings["template_issues"], relative, "knowledge_template_v4_defaults_invalid")
    method_template = vault / "98_Templates/方法卡片.md"
    if method_template.is_file():
        text = method_template.read_text(encoding="utf-8")
        completion = markdown_table(text, "完成、暂停与停止条件")
        if "## 输出物映射" not in text or not completion or completion[0] != STOP_V3_HEADERS:
            issue(findings["template_issues"], "98_Templates/方法卡片.md", "method_template_v3_structure_invalid")
    workbench_templates = {
        "98_Templates/待办事项.md": {"type": "action", "start_on": None, "due_on": None, "scheduled_for": None, "review_on": None},
        "98_Templates/协作人角色卡.md": {"type": "topic", "topic_kind": "collaborator_reference", "aliases": None, "relationship_roles": None, "projects": None, "collaboration_topics": None, "source_notes": None, "source_threads": None},
        "98_Templates/每日日报.md": {"type": "review", "review_period": "daily", "daily_kind": "report", "metrics_as_of": None, **{field: None for field in REPORT_METRIC_COUNT_PROPERTIES}},
        "98_Templates/周复盘.md": {"type": "review", "review_period": "weekly", "review_kind": "report", "metrics_as_of": None, **{field: None for field in REPORT_METRIC_COUNT_PROPERTIES}},
        "98_Templates/每月报告.md": {"type": "review", "review_period": "monthly", "review_kind": "report", "metrics_as_of": None, **{field: None for field in REPORT_METRIC_COUNT_PROPERTIES}},
    }
    for relative, expected in workbench_templates.items():
        path = vault / relative
        if not path.is_file():
            continue
        try:
            frontmatter, _ = parse_frontmatter(path.read_text(encoding="utf-8"))
        except (OSError, FrontmatterError) as error:
            issue(findings["template_issues"], relative, type(error).__name__)
            continue
        missing = sorted(field for field in expected if field not in frontmatter)
        mismatched = sorted(field for field, value in expected.items() if value is not None and as_text(frontmatter.get(field)) != value)
        if missing:
            issue(findings["template_issues"], relative, "workbench_template_missing_properties", missing=missing)
        if mismatched:
            issue(findings["template_issues"], relative, "workbench_template_defaults_invalid", fields=mismatched)
        for list_field in {"aliases", "relationship_roles", "projects", "collaboration_topics", "source_notes", "source_threads"} & set(expected):
            if list_field in frontmatter and not isinstance(frontmatter[list_field], list):
                issue(findings["template_issues"], relative, "workbench_template_requires_inline_list", property=list_field)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vault", required=True, type=Path)
    parser.add_argument("--format", choices=("json", "text"), default="text")
    parser.add_argument("--fail-on", choices=("none", "warning", "error"), default="none")
    parser.add_argument("--focus-file", action="append", default=[], metavar="PATH", help="Audit one Vault-relative Markdown file; repeatable")
    parser.add_argument("--path-prefix", action="append", default=[], metavar="DIR", help="Audit files below one Vault-relative directory; repeatable")
    parser.add_argument("--note-type", action="append", default=[], metavar="TYPE", help="Audit one note type; repeatable")
    parser.add_argument("--contract-version", action="append", default=[], metavar="VERSION", help="Audit source, evidence, or method contracts ending in this version, such as v4")
    parser.add_argument("--allow-empty-scope", action="store_true", help="Allow a bounded audit that selects no notes")
    args = parser.parse_args()
    vault = args.vault.resolve()
    if not vault.is_dir():
        print(f"Vault not found: {vault}", file=sys.stderr)
        return 2
    try:
        focus_files = {normalize_scope_file(value) for value in args.focus_file}
        path_prefixes = tuple(normalize_scope_prefix(value) for value in args.path_prefix)
    except ValueError as error:
        print(error, file=sys.stderr)
        return 2
    if any(not re.fullmatch(r"v\d+", value) for value in args.contract_version):
        print("--contract-version must use a form such as v4", file=sys.stderr)
        return 2
    for relative in focus_files:
        candidate = vault / relative
        if not candidate.is_file() or candidate.is_symlink():
            print(f"Focus file not found: {relative}", file=sys.stderr)
            return 2
        try:
            candidate.resolve(strict=True).relative_to(vault)
        except (OSError, ValueError):
            print(f"Focus file resolves outside the Vault: {relative}", file=sys.stderr)
            return 2
    for prefix in path_prefixes:
        candidate = vault / prefix
        if not candidate.is_dir() or candidate.is_symlink():
            print(f"Path prefix not found: {prefix}", file=sys.stderr)
            return 2
        try:
            candidate.resolve(strict=True).relative_to(vault)
        except (OSError, ValueError):
            print(f"Path prefix resolves outside the Vault: {prefix}", file=sys.stderr)
            return 2
    note_types = set(args.note_type)
    known_note_types = set(REQUIRED_BY_TYPE) | {"profile", "index", "review"}
    unknown_note_types = sorted(note_types - known_note_types)
    if unknown_note_types:
        print(f"Unknown note type: {', '.join(unknown_note_types)}", file=sys.stderr)
        return 2
    contract_version_filters = set(args.contract_version)
    scoped = bool(focus_files or path_prefixes or note_types or contract_version_filters)
    notes: dict[Path, dict] = {}
    aliases: dict[str, list[Path]] = defaultdict(list)
    findings: dict[str, list[dict]] = defaultdict(list)
    title_to_paths: dict[str, list[str]] = defaultdict(list)
    content_hashes: dict[str, list[str]] = defaultdict(list)
    for path in iter_note_paths(vault, findings):
        relative = path.relative_to(vault).as_posix()
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as error:
            issue(findings["unreadable_notes"], relative, type(error).__name__)
            continue
        try:
            frontmatter, block_fields = parse_frontmatter(text)
        except FrontmatterError as error:
            issue(findings["malformed_frontmatter"], relative, str(error))
            frontmatter, block_fields = {}, set()
        notes[path] = {"text": text, "frontmatter": frontmatter, "relative": relative}
        # Obsidian accepts a unique suffix path, such as
        # [[01_第1周.../训练计划]], when the full note is nested below a
        # folder. Preserve exact paths first and let multiple suffix matches
        # remain ambiguous instead of guessing.
        parts = Path(relative[:-3]).parts
        for index in range(len(parts)):
            suffix = Path(*parts[index:]).as_posix()
            if path not in aliases[suffix]:
                aliases[suffix].append(path)
        title_to_paths[path.stem.casefold()].append(relative)
        note_type = as_text(frontmatter.get("type"))
        if note_type == "review" and as_text(frontmatter.get("test_artifact")) == "true":
            # Fixture notes intentionally model incomplete roll-up inputs; they
            # are not operational review records and must not create vault-wide
            # metadata debt.
            required = set()
        elif note_type == "review":
            is_native_daily = as_text(frontmatter.get("review_period")) == "daily" and not as_text(frontmatter.get("daily_kind"))
            required = REVIEW_COMMON_REQUIRED | (DAILY_REVIEW_REQUIRED if is_native_daily else set())
            migration_batch = as_text(frontmatter.get("migration_batch"))
            if migration_batch in {"native-daily-plan-v3", "native-daily-report-v3", "native-weekly-plan-v2", "native-weekly-report-v2"}:
                required.add("action_items")
        elif note_type == "topic" and as_text(frontmatter.get("topic_kind")) == "collaborator_reference":
            required = COLLABORATOR_REQUIRED
        else:
            required = REQUIRED_BY_TYPE.get(note_type, set())
        if not required:
            continue
        required_blocks = block_fields & required
        if required_blocks:
            issue(findings["malformed_frontmatter"], relative, "nested_or_block_values_not_allowed", fields=sorted(required_blocks))
            continue
        if block_fields - required_blocks:
            issue(findings["legacy_metadata"], relative, "legacy_block_values_not_normalized", fields=sorted(block_fields - required_blocks))
        missing = sorted(key for key in required if key not in frontmatter)
        if missing:
            issue(findings["missing_properties"], relative, "missing_required_properties", type=note_type, missing=missing)
        empty = sorted(key for key in required if key in NONEMPTY_PROPERTIES and value_is_empty(frontmatter.get(key)))
        if empty:
            issue(findings["empty_properties"], relative, "empty_required_properties", type=note_type, empty=empty)
        for key, allowed in VALID_VALUES.items():
            value = as_text(frontmatter.get(key))
            if value and value not in allowed:
                issue(findings["invalid_property_values"], relative, "invalid_value", property=key, value=value)
        for key in DATE_PROPERTIES:
            value = as_text(frontmatter.get(key))
            if value and not is_valid_date(value):
                issue(findings["invalid_property_values"], relative, "invalid_date", property=key, value=value)
        for key in BOOLEAN_PROPERTIES & set(frontmatter):
            if as_text(frontmatter.get(key)) not in {"true", "false"}:
                issue(findings["invalid_property_values"], relative, "expected_boolean", property=key)
        for key in LIST_PROPERTIES & set(frontmatter):
            if key not in block_fields and not isinstance(frontmatter[key], list):
                issue(findings["invalid_property_values"], relative, "expected_inline_list", property=key)
        if as_text(frontmatter.get("created")) and as_text(frontmatter.get("updated")) and as_text(frontmatter.get("updated")) < as_text(frontmatter.get("created")):
            issue(findings["semantic_issues"], relative, "updated_before_created")
        if note_type == "source":
            if value_is_empty(frontmatter.get("source_url")) and value_is_empty(frontmatter.get("source_unavailable_reason")):
                issue(findings["traceability_issues"], relative, "source_url_or_unavailable_reason_required")
            digest = as_text(frontmatter.get("content_hash"))
            if digest:
                content_hashes[digest].append(relative)
            role, coverage = as_text(frontmatter.get("source_role")), as_text(frontmatter.get("coverage_status"))
            if role and not coverage:
                issue(findings["traceability_issues"], relative, "source_role_requires_coverage_status")
            if coverage and not role:
                issue(findings["traceability_issues"], relative, "coverage_status_requires_source_role")
            if role == "index" and coverage != "index_only":
                issue(findings["semantic_issues"], relative, "index_source_must_be_index_only", coverage_status=coverage)
            add_source_contract_findings(vault, notes[path], findings)
        if note_type == "ingest_batch":
            numeric_fields = ("input_count", "source_count", "source_complete_count", "source_partial_count", "knowledge_count", "unresolved_count")
            numbers: dict[str, int] = {}
            for field in numeric_fields:
                try:
                    numbers[field] = int(as_text(frontmatter.get(field)))
                    if numbers[field] < 0:
                        raise ValueError
                except ValueError:
                    issue(findings["invalid_property_values"], relative, "batch_count_must_be_nonnegative_integer", property=field)
                    numbers[field] = -1
            if as_text(frontmatter.get("processing_contract")) != "ingest-batch-v1":
                issue(findings["semantic_issues"], relative, "ingest_batch_contract_mismatch")
            if as_text(frontmatter.get("status")) == "complete" and numbers["unresolved_count"] > 0:
                issue(findings["semantic_issues"], relative, "complete_batch_has_unresolved_items")
            if as_text(frontmatter.get("ingest_state")) == "closed" and numbers["source_partial_count"] > 0:
                issue(findings["semantic_issues"], relative, "closed_batch_has_partial_sources")
        if note_type == "action":
            action_state = as_text(frontmatter.get("action_state"))
            status = as_text(frontmatter.get("status"))
            action_id = as_text(frontmatter.get("action_id"))
            if action_id and not ACTION_ID_RE.fullmatch(action_id):
                issue(findings["invalid_property_values"], relative, "invalid_action_id", action_id=action_id)
            if action_id and not Path(relative).stem.startswith(f"{action_id} "):
                issue(findings["semantic_issues"], relative, "action_id_must_prefix_filename", action_id=action_id)
            if action_state in ACTION_OPEN_STATES and status != "active":
                issue(findings["semantic_issues"], relative, "open_action_requires_active_status", action_state=action_state, status=status)
            if action_state in ACTION_CLOSED_STATES and status != "archived":
                issue(findings["semantic_issues"], relative, "closed_action_requires_archived_status", action_state=action_state, status=status)
            if action_state in {"ready", "in_progress"} and not as_text(frontmatter.get("scheduled_for")):
                issue(findings["semantic_issues"], relative, "scheduled_action_requires_scheduled_for", action_state=action_state)
            if action_state == "waiting" and not as_text(frontmatter.get("review_on")):
                issue(findings["semantic_issues"], relative, "waiting_action_requires_review_on")
            if action_state in ACTION_OPEN_STATES and not as_text(frontmatter.get("next_action")):
                issue(findings["semantic_issues"], relative, "open_action_requires_next_action")
            if action_state in ACTION_CLOSED_STATES:
                if not as_text(frontmatter.get("closed_at")):
                    issue(findings["semantic_issues"], relative, "closed_action_requires_closed_at")
                if not as_text(frontmatter.get("closed_reason")):
                    issue(findings["semantic_issues"], relative, "closed_action_requires_closed_reason")
                if action_state == "done" and not frontmatter.get("completion_evidence"):
                    issue(findings["semantic_issues"], relative, "done_action_requires_completion_evidence")
            try:
                carryover_count = int(as_text(frontmatter.get("carryover_count")))
                if carryover_count < 0:
                    raise ValueError
            except ValueError:
                issue(findings["invalid_property_values"], relative, "carryover_count_must_be_nonnegative_integer")
            start_on = as_text(frontmatter.get("start_on"))
            due_on = as_text(frontmatter.get("due_on"))
            if start_on and due_on and is_valid_date(start_on) and is_valid_date(due_on) and start_on > due_on:
                issue(findings["semantic_issues"], relative, "action_start_on_after_due_on", start_on=start_on, due_on=due_on)
        if note_type == "topic" and as_text(frontmatter.get("topic_kind")) == "collaborator_reference":
            status = as_text(frontmatter.get("status"))
            if status and status not in COLLABORATOR_STATUSES:
                issue(findings["invalid_property_values"], relative, "invalid_collaborator_status", status=status)
            if not frontmatter.get("relationship_roles"):
                issue(findings["semantic_issues"], relative, "collaborator_requires_relationship_role")
            if not frontmatter.get("projects") and not frontmatter.get("collaboration_topics"):
                issue(findings["semantic_issues"], relative, "collaborator_requires_project_or_topic")
        if note_type == "review":
            for field in REPORT_METRIC_COUNT_PROPERTIES & set(frontmatter):
                value = frontmatter.get(field)
                if value_is_empty(value):
                    continue
                if not isinstance(value, str) or not re.fullmatch(r"\d+", value.strip()):
                    issue(findings["invalid_property_values"], relative, "report_metric_must_be_nonnegative_integer", property=field)
        if note_type == "knowledge":
            status = as_text(frontmatter.get("status"))
            if relative.startswith("02_Knowledge/方法/") and status == "archived":
                issue(findings["semantic_issues"], relative, "archived_knowledge_in_active_method_tree")
            if relative.startswith("02_Knowledge/归档/") and status == "active":
                issue(findings["semantic_issues"], relative, "active_knowledge_in_archive_tree")
            try:
                count = int(as_text(frontmatter.get("source_count")))
                if count < 0:
                    raise ValueError
            except ValueError:
                issue(findings["semantic_issues"], relative, "source_count_must_be_nonnegative_integer")
                count = -1
            if isinstance(frontmatter.get("source_notes"), list) and count >= 0 and count != len(frontmatter["source_notes"]):
                issue(findings["semantic_issues"], relative, "source_count_mismatch", source_count=count, linked_sources=len(frontmatter["source_notes"]))
            if as_text(frontmatter.get("maturity")) in {"stale", "superseded"} and status not in {"review", "archived"}:
                issue(findings["semantic_issues"], relative, "stale_or_superseded_requires_review_or_archived_status")
        if note_type == "profile" and as_text(frontmatter.get("profile_contract")) != "configuration-profile-v1":
            issue(findings["semantic_issues"], relative, "profile_contract_mismatch")
        if note_type == "index" and relative.startswith("02_Knowledge/") and as_text(frontmatter.get("index_contract")) == "knowledge-map-v1" and as_text(frontmatter.get("index_role")) != "knowledge_navigation":
            issue(findings["semantic_issues"], relative, "knowledge_map_index_role_mismatch")
    backlinks: Counter[Path] = Counter()
    for path, note in notes.items():
        for _, raw_target in WIKILINK_RE.findall(note["text"]):
            target = normalize_target(raw_target)
            if not target or target.startswith(("http://", "https://", "mailto:")) or (Path(target).suffix and not target.endswith(".md")) or target.startswith("98_Templates/"):
                continue
            candidates = aliases.get(target, [])
            moved_paths = {
                "02_Knowledge/方法/可复用Skill应分离入口、细则与验收": "02_Knowledge/原则/AI组织/可复用Skill应分离入口、细则与验收",
                "02_Knowledge/方法/技术SEO整改需要台账、变更验证与复查指标闭环": "02_Knowledge/原则/SEO/技术SEO整改需要台账、变更验证与复查指标闭环",
                "02_Knowledge/方法/网站发布应将预发布验证、上线与回滚记录视为同一交付链": "02_Knowledge/原则/网站交付/网站发布应将预发布验证、上线与回滚记录视为同一交付链",
                "02_Knowledge/方法/项目对话沉淀应分离项目事实与跨项目方法": "02_Knowledge/原则/知识治理/项目对话沉淀应分离项目事实与跨项目方法",
            }
            if not candidates and target in moved_paths:
                candidates = aliases.get(moved_paths[target], [])
            if not candidates:
                issue(findings["broken_links"], note["relative"], "broken_link", target=raw_target)
            elif len(candidates) == 1:
                backlinks[candidates[0]] += 1
            else:
                issue(findings["ambiguous_links"], note["relative"], "ambiguous_link", target=raw_target, candidates=sorted(candidate.relative_to(vault).as_posix() for candidate in candidates))
    action_paths_by_id: dict[str, Path] = {}
    for path, note in notes.items():
        if as_text(note["frontmatter"].get("type")) != "action":
            continue
        action_id = as_text(note["frontmatter"].get("action_id"))
        if not action_id:
            continue
        if action_id in action_paths_by_id:
            issue(findings["semantic_issues"], note["relative"], "duplicate_action_id", action_id=action_id, other_file=action_paths_by_id[action_id].relative_to(vault).as_posix())
        else:
            action_paths_by_id[action_id] = path

    def action_ids_from_items(note: dict) -> set[str]:
        action_ids: set[str] = set()
        raw_items = note["frontmatter"].get("action_items")
        if not isinstance(raw_items, list):
            return action_ids
        for raw_item in raw_items:
            matches = WIKILINK_RE.findall(str(raw_item))
            candidates = aliases.get(normalize_target(matches[0][1]), []) if len(matches) == 1 else []
            if len(candidates) != 1:
                issue(findings["traceability_issues"], note["relative"], "action_item_requires_resolved_action", item=str(raw_item))
                continue
            target_note = notes.get(candidates[0])
            if target_note is None or as_text(target_note["frontmatter"].get("type")) != "action":
                issue(findings["semantic_issues"], note["relative"], "action_item_must_target_action", item=str(raw_item))
                continue
            action_id = as_text(target_note["frontmatter"].get("action_id"))
            if action_id:
                action_ids.add(action_id)
        return action_ids

    daily_v3_plans: list[tuple[date, dict, set[str]]] = []
    for path, note in notes.items():
        frontmatter = note["frontmatter"]
        if as_text(frontmatter.get("type")) == "review" and as_text(frontmatter.get("review_period")) == "daily" and as_text(frontmatter.get("daily_kind")) == "plan" and as_text(frontmatter.get("migration_batch")) == "native-daily-plan-v3":
            action_ids = action_ids_from_items(note)
            plan_date = as_text(frontmatter.get("date"))
            if is_valid_date(plan_date) and plan_date:
                daily_v3_plans.append((date.fromisoformat(plan_date), note, action_ids))
        elif as_text(frontmatter.get("type")) == "review" and "action_items" in frontmatter:
            action_ids_from_items(note)
    daily_v3_plans.sort(key=lambda item: item[0])
    for (_, previous_note, previous_actions), (current_date, current_note, current_actions) in zip(daily_v3_plans, daily_v3_plans[1:]):
        previous_date = as_text(previous_note["frontmatter"].get("date"))
        for action_id in previous_actions - current_actions:
            action_path = action_paths_by_id.get(action_id)
            if action_path is None:
                continue
            action_frontmatter = notes[action_path]["frontmatter"]
            action_state = as_text(action_frontmatter.get("action_state"))
            updated = as_text(action_frontmatter.get("updated"))
            if action_state not in {"waiting", "backlog", "review", "done", "cancelled"} or updated < previous_date:
                issue(findings["semantic_issues"], current_note["relative"], "action_disappeared_without_transition", action_id=action_id, previous_plan=previous_note["relative"])
        for action_id in previous_actions & current_actions:
            action_path = action_paths_by_id.get(action_id)
            if action_path is None:
                continue
            action_frontmatter = notes[action_path]["frontmatter"]
            action_state = as_text(action_frontmatter.get("action_state"))
            if action_state in {"ready", "in_progress"}:
                try:
                    carryover_count = int(as_text(action_frontmatter.get("carryover_count")))
                except ValueError:
                    continue
                if as_text(action_frontmatter.get("scheduled_for")) != current_date.isoformat() or carryover_count < 1:
                    issue(findings["semantic_issues"], current_note["relative"], "carried_action_requires_reschedule_and_increment", action_id=action_id, previous_plan=previous_note["relative"])
    for path, note in notes.items():
        if as_text(note["frontmatter"].get("type")) == "ingest_batch":
            for field in ("input_index", "source_index", "knowledge_index"):
                value = as_text(note["frontmatter"].get(field))
                if not value:
                    continue
                matches = WIKILINK_RE.findall(value)
                candidates = aliases.get(normalize_target(matches[0][1]), []) if len(matches) == 1 else []
                if len(candidates) != 1:
                    issue(findings["traceability_issues"], note["relative"], "batch_index_requires_resolved_note", property=field)
        if as_text(note["frontmatter"].get("type")) == "knowledge":
            add_method_contract_findings(notes, aliases, note, findings)
            if backlinks[path] == 0:
                issue(findings["orphan_knowledge"], note["relative"], "no_incoming_link")
            review_due = as_text(note["frontmatter"].get("review_due"))
            if review_due and is_valid_date(review_due) and date.fromisoformat(review_due) <= date.today():
                issue(findings["overdue_review"], note["relative"], "review_due")
    validate_templates(vault, findings)
    unqualified_targets = {
        normalize_target(raw_target).casefold()
        for note in notes.values()
        for _, raw_target in WIKILINK_RE.findall(note["text"])
        if "/" not in normalize_target(raw_target)
    }
    duplicate_titles = []
    repeated_titles = []
    for title, files in sorted(title_to_paths.items()):
        if len(files) <= 1:
            continue
        paired_daily = [notes[vault / relative]["frontmatter"] for relative in files]
        intentional_split_pair = (
            all(
                as_text(item.get("type")) == "review"
                and as_text(item.get("review_period")) == "daily"
                and as_text(item.get("daily_kind")) in {"plan", "report"}
                for item in paired_daily
            )
            and {as_text(item.get("daily_kind")) for item in paired_daily} == {"plan", "report"}
        )
        if intentional_split_pair:
            continue
        if title in unqualified_targets:
            duplicate_titles.append({"title": title, "files": files})
        else:
            repeated_titles.append({"title": title, "files": files})
    findings["duplicate_title_candidates"] = duplicate_titles
    findings["repeated_titles"] = repeated_titles
    findings["duplicate_content_hashes"] = [{"content_hash": digest, "files": sorted(files)} for digest, files in sorted(content_hashes.items()) if len(files) > 1]
    selected_notes = {
        path: note
        for path, note in notes.items()
        if note_matches_scope(
            note,
            focus_files=focus_files,
            path_prefixes=path_prefixes,
            note_types=note_types,
            contract_version_filters=contract_version_filters,
        )
    }
    selected_relatives = {note["relative"] for note in selected_notes.values()}
    missing_focus = sorted(focus_files - selected_relatives)
    if missing_focus:
        print(f"Focus file is not an auditable Vault note: {', '.join(missing_focus)}", file=sys.stderr)
        return 2
    if scoped and not selected_notes and not args.allow_empty_scope:
        print("Scope selected no auditable Vault notes; use --allow-empty-scope to accept this result", file=sys.stderr)
        return 2
    severity_groups = {
        "fatal": ("malformed_frontmatter", "unreadable_notes", "external_symlink_notes"),
        "error": ("missing_properties", "empty_properties", "invalid_property_values", "traceability_issues", "broken_links", "template_issues"),
        "warning": ("semantic_issues", "ambiguous_links", "orphan_knowledge", "duplicate_title_candidates", "duplicate_content_hashes", "overdue_review", "legacy_metadata"),
    }
    report_findings: dict[str, list[dict]] = defaultdict(list)
    for category, items in findings.items():
        report_findings[category] = [item for item in items if finding_matches_scope(item, selected_relatives, scoped)]
    severity_counts = {level: sum(len(report_findings[name]) for name in names) for level, names in severity_groups.items()}
    flat_findings = flattened_findings(report_findings, severity_groups)
    layers = {"current_blockers": 0, "legacy_debt": 0, "manual_review": 0, "information": 0}
    for finding in flat_findings:
        layers[classify_finding(finding)] += 1
    report = {
        "report_contract": "obsidian-health-v1",
        "vault": str(vault),
        "scope": "Markdown content plus referenced raw inputs; templates validated separately; attachments checked only when referenced",
        "scope_details": {
            "focus_files": sorted(focus_files),
            "path_prefixes": list(path_prefixes),
            "note_types": sorted(note_types),
            "contract_versions": sorted(contract_version_filters),
            "selected_files": sorted(selected_relatives) if scoped else [],
            "scoped": scoped,
        },
        "notes_scanned": len(notes),
        "notes_checked": len(selected_notes),
        "knowledge_cards": sum(1 for note in selected_notes.values() if as_text(note["frontmatter"].get("type")) == "knowledge"),
        **{name: report_findings[name] for names in severity_groups.values() for name in names},
        "repeated_titles": report_findings["repeated_titles"],
        "findings": flat_findings,
        "summary": {
            "severity": severity_counts,
            "layers": layers,
            **{name: len(report_findings[name]) for names in severity_groups.values() for name in names},
            "repeated_titles": len(report_findings["repeated_titles"]),
        },
    }
    if args.format == "json":
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(format_text_report(report))
    threshold = {"none": 4, "warning": 1, "error": 2}[args.fail_on]
    highest = max((SEVERITY_ORDER[level] for level, count in severity_counts.items() if count), default=0)
    return 1 if highest >= threshold else 0


if __name__ == "__main__":
    raise SystemExit(main())
