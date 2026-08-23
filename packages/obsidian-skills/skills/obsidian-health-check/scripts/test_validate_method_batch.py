#!/usr/bin/env python3
"""Tests for task-method batch validation."""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("validate_method_batch.py")


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def method(title: str, output: str, fields: list[str], flow: str, *, dry_run: str, generic: bool = False) -> str:
    evidence = "先收集并核对任务的必要事实" if generic else f"核对 {output} 所需的具体字段"
    template_rows = "\n".join(f"| {field} | 已填 |" for field in fields)
    return f'''---
type: knowledge
status: active
knowledge_kind: method
dry_run_status: passed
dry_run_notes: ["[[05_Review/方法试跑/{dry_run}]]"]
---

# {title}

## 输出物映射

| 输出ID | 输出物 | 产生步骤 | 模板位置 | 依据ID |
| --- | --- | --- | --- | --- |
| O1 | {output} | S1 | 工作模板 | [E1] [D1] |

## 直接证据台账

| 证据ID | 动作或判断 |
| --- | --- |
| E1 | {evidence} |

## 执行流程

{flow}

## 决策表

| 检查点 | 条件 | 处理 |
| --- | --- | --- |
| 字段状态 | 缺失 | 暂停 |

## 工作模板

| 字段 | 填写内容 |
| --- | --- |
{template_rows}
'''


def dry_run(output: str, *, complete: bool) -> str:
    sections = f'''## 已填输出物

已填 **{output}**。

## 正常路径

完成核对并交接。

## 暂停或异常路径

发现关键差异，暂停并回传。

## 发现的摩擦与回写

需要补充授权人。''' if complete else "## 正常路径\n\n只描述过程。"
    return f"---\ntype: method_dry_run\nstatus: complete\n---\n\n# Trial\n\n{sections}\n"


class MethodBatchValidatorTests(unittest.TestCase):
    def run_validator(self, vault: Path) -> tuple[dict, int]:
        completed = subprocess.run([sys.executable, str(SCRIPT), "--vault", str(vault), "--path-prefix", "02_Knowledge/方法", "--format", "json", "--fail-on", "warning"], text=True, stdout=subprocess.PIPE, check=False)
        return json.loads(completed.stdout), completed.returncode

    def test_generic_shell_and_incomplete_trial_fail(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            flow = "| S1 | 建立任务记录，逐项收集已有事实和版本 |"
            write(vault / "02_Knowledge/方法/A.md", method("A", "输出A", ["订单/任务标识", "核心字段", "证据与限制", "结论与下一动作"], flow, dry_run="A试跑", generic=True))
            write(vault / "02_Knowledge/方法/B.md", method("B", "输出B", ["订单/任务标识", "核心字段", "证据与限制", "结论与下一动作"], flow, dry_run="B试跑", generic=True))
            write(vault / "05_Review/方法试跑/A试跑.md", dry_run("输出A", complete=False))
            write(vault / "05_Review/方法试跑/B试跑.md", dry_run("输出B", complete=False))
            report, status = self.run_validator(vault)
            self.assertEqual(status, 1)
            self.assertIn("method_template_is_generic_shell", {item["reason"] for item in report["findings"]})

    def test_task_specific_methods_and_filled_trials_pass(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            vault = Path(temporary)
            write(vault / "02_Knowledge/方法/A.md", method("A", "询盘澄清记录", ["目的地", "用途", "规格"], "| S1 | 收集目的地、用途和规格 |", dry_run="A试跑"))
            write(vault / "02_Knowledge/方法/B.md", method("B", "三单一致性核对表", ["毛重", "体积", "船名航次"], "| S1 | 比对毛重、体积和船名航次 |", dry_run="B试跑"))
            write(vault / "05_Review/方法试跑/A试跑.md", dry_run("询盘澄清记录", complete=True))
            write(vault / "05_Review/方法试跑/B试跑.md", dry_run("三单一致性核对表", complete=True))
            report, status = self.run_validator(vault)
            self.assertEqual(status, 0)
            self.assertEqual(report["findings"], [])


if __name__ == "__main__":
    unittest.main()
