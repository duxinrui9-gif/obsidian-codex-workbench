#!/usr/bin/env python3
"""Validate that a bounded set of task methods is not a copied template batch."""

from __future__ import annotations

import argparse
import json
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path


WIKILINK_RE = re.compile(r"\[\[([^\]]+)\]\]")
GENERIC_EVIDENCE = {
    "先收集并核对任务的必要事实",
    "按课程给出的检查项或字段核对条件",
    "将确认结果形成可回读记录",
    "视觉材料呈现的字段/风险提示",
}
GENERIC_TEMPLATE_FIELDS = {"订单/任务标识", "核心字段", "证据与限制", "结论与下一动作"}
REQUIRED_DRY_RUN_SECTIONS = ("已填输出物", "正常路径", "暂停或异常路径", "发现的摩擦与回写")


def frontmatter(text: str) -> dict[str, str]:
    if not text.startswith("---\n"):
        return {}
    closing = text.find("\n---", 4)
    if closing < 0:
        return {}
    result: dict[str, str] = {}
    for line in text[4:closing].splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        result[key.strip()] = value.strip().strip('"')
    return result


def section(text: str, heading: str) -> str:
    match = re.search(rf"^## {re.escape(heading)}\s*$", text, re.MULTILINE)
    if not match:
        return ""
    following = re.search(r"^## ", text[match.end():], re.MULTILINE)
    return text[match.end():match.end() + following.start() if following else len(text)].strip()


def table_rows(text: str, heading: str) -> list[list[str]]:
    body = section(text, heading)
    lines = body.splitlines()
    for index in range(len(lines) - 1):
        if lines[index].lstrip().startswith("|") and lines[index + 1].lstrip().startswith("|"):
            rows: list[list[str]] = []
            for line in lines[index + 2:]:
                if not line.lstrip().startswith("|"):
                    break
                rows.append([cell.strip() for cell in line.strip().strip("|").split("|")])
            return rows
    return []


def normalize(text: str) -> str:
    value = WIKILINK_RE.sub("LINK", text)
    value = re.sub(r"\[[ED]\d+\]", "ID", value)
    value = re.sub(r"\b[OSD]\d+\b", "ID", value)
    value = re.sub(r"\d+", "N", value)
    return re.sub(r"\s+", " ", value).strip()


def output_name(text: str) -> str:
    rows = table_rows(text, "输出物映射")
    return rows[0][1] if rows and len(rows[0]) > 1 else ""


def resolve_note(vault: Path, target: str) -> Path | None:
    target = target.split("#", 1)[0]
    candidate = vault / target
    if candidate.is_file():
        return candidate
    if not candidate.suffix and candidate.with_suffix(".md").is_file():
        return candidate.with_suffix(".md")
    matches = [path for path in vault.rglob("*.md") if path.stem == Path(target).name]
    return matches[0] if len(matches) == 1 else None


def issue(findings: list[dict[str, str]], file: Path, reason: str, **details: str) -> None:
    findings.append({"severity": "warning", "file": file.as_posix(), "reason": reason, **details})


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vault", required=True, type=Path)
    parser.add_argument("--path-prefix", required=True)
    parser.add_argument("--format", choices=("text", "json"), default="text")
    parser.add_argument("--fail-on", choices=("none", "warning"), default="none")
    args = parser.parse_args()
    vault = args.vault.resolve()
    root = (vault / args.path_prefix).resolve()
    if not root.is_dir() or (vault not in root.parents and root != vault):
        print("path prefix must be a directory inside the vault", file=sys.stderr)
        return 2

    methods: list[tuple[Path, str, dict[str, str]]] = []
    for path in sorted(root.rglob("*.md")):
        text = path.read_text(encoding="utf-8")
        meta = frontmatter(text)
        if meta.get("type") == "knowledge" and meta.get("knowledge_kind") == "method":
            methods.append((path, text, meta))
    if not methods:
        print("scope selected no method notes", file=sys.stderr)
        return 2

    findings: list[dict[str, str]] = []
    for path, text, meta in methods:
        relative = path.relative_to(vault)
        labels = [row[1] for row in table_rows(text, "直接证据台账") if len(row) > 1]
        for label in labels:
            if label in GENERIC_EVIDENCE:
                issue(findings, relative, "method_evidence_uses_generic_label", label=label)
        fields = {row[0] for row in table_rows(text, "工作模板") if row and row[0]}
        if fields and fields <= GENERIC_TEMPLATE_FIELDS:
            issue(findings, relative, "method_template_is_generic_shell")
        flow = section(text, "执行流程")
        if any(phrase in flow for phrase in ("相应责任人", "相关字段", "必要时升级")):
            issue(findings, relative, "method_flow_uses_ambiguous_operator_or_check")

        if meta.get("dry_run_status") == "passed":
            dry_runs = WIKILINK_RE.findall(meta.get("dry_run_notes", ""))
            dry_run = resolve_note(vault, dry_runs[0]) if len(dry_runs) == 1 else None
            if not dry_run:
                issue(findings, relative, "passed_dry_run_missing_or_ambiguous")
                continue
            dry_text = dry_run.read_text(encoding="utf-8")
            missing = [heading for heading in REQUIRED_DRY_RUN_SECTIONS if not section(dry_text, heading)]
            if missing:
                issue(findings, relative, "dry_run_missing_operational_sections", headings=",".join(missing))
            output = output_name(text)
            if output and output not in section(dry_text, "已填输出物"):
                issue(findings, relative, "dry_run_does_not_fill_named_output", output=output)

    for index, (left_path, left_text, _) in enumerate(methods):
        left_output = output_name(left_text)
        for right_path, right_text, _ in methods[index + 1:]:
            right_output = output_name(right_text)
            if not left_output or not right_output or left_output == right_output:
                continue
            compared = ("执行流程", "决策表", "工作模板")
            similar = [heading for heading in compared if SequenceMatcher(None, normalize(section(left_text, heading)), normalize(section(right_text, heading))).ratio() >= 0.82]
            if len(similar) >= 3:
                issue(findings, left_path.relative_to(vault), "method_template_clone", other_file=right_path.relative_to(vault).as_posix(), sections=",".join(similar))

    report = {"methods_checked": len(methods), "findings": findings, "summary": {"warning": len(findings)}}
    if args.format == "json":
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(f"Methods checked: {len(methods)}; warnings: {len(findings)}")
        for finding in findings:
            print(f"warning {finding['reason']} {finding['file']}")
    return 1 if findings and args.fail_on == "warning" else 0


if __name__ == "__main__":
    raise SystemExit(main())
