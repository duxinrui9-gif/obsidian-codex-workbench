# Changelog

本项目遵循语义化版本；正式发布不可重写，具体规则见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## Unreleased

- 升级 Next.js 至 16.3.8 及相关修复依赖，保留生产依赖安全验收门；Starter CI 使用固定示例基准日期，真实 Vault 默认仍按当天检查逾期。

- 同步四个 Skill 的用户指定 Vault 与聚焦审计边界，增加可选父子任务和前置依赖校验、精确路径优先及授权迁移证据保护；保留公开版协作人、指标和完整试跑检查。
- Starter 新任务模板与待办 Base 增加可选关系字段；不迁移旧卡、不推导完成状态、不新增工作台自动调度。
- 新 active v4 方法不再通过旧证据台账跳过验收；旧 v2/v3 记录继续只读兼容。

- 新增面向非技术用户的中文新手使用指南，涵盖 Starter Vault、四个 Skill、只读演练和可选本地工作台。

## v0.3.0 — 2026-08-23

- Fixed report-table diagnostics and daily report calendar layout overflow; project boards now rank active projects by active task load while keeping archived projects ordered by recency.
- Stabilized Playwright workbench fixtures by serving a pre-fetched synthetic snapshot, removing the disposed-response race from route handlers.
- Extended the four packaged Obsidian Skills with static mixed-material coverage, task-method operational readiness, batch clone detection, and separate evidence-maturity/readiness guidance.
- Added the read-only `validate_method_batch.py` CLI and tests; Skill manifests now derive and verify their version from the root workbench package.

## v0.2.1 — 2026-08-21

- Fixed tag-triggered release verification to explicitly fetch and inspect the annotated tag before validating its `main` ancestry.

## v0.2.0 — 2026-08-21

- Upgraded Next.js and YAML to patched releases, added a production dependency audit gate, and self-hosted the Aldrich font with its OFL provenance and checksum.
- Serialized task creation sequence allocation, retried safe external filename collisions, and return `ACTION_CREATE_CONFLICT` without overwriting Vault files when recovery is exhausted.
- Made risk cockpit entries open an explicit task-board filter with counts, clearing, and overdue review dates instead of losing the originating context.
- Hardened report loading against stale responses, removed duplicate leading titles, completed report/calendar semantics, and standardized tab keyboard behavior and Obsidian vault/file URIs.
- Added synthetic Playwright coverage for report races, risk filters, keyboard tabs, focus restoration, offline resources, readable text, and desktop-width overflow; CI now installs Chromium and retains failure artifacts.
- Added frozen report metrics, period metadata, in-report outlines, evidence labels, project filtering, and horizontal reading support for long report tables while retaining legacy reports unchanged.
- Added the lazy-loaded Collaborators section with safe role-card reading, search/filtering, Obsidian links, and opt-in creation/editing of stable fields only.
- Updated the Starter Vault report templates, review Bases, collaborator template, and data contract for future reports and role cards.
- Added optional task delivery-window fields: `start_on` and `due_on`, validated as a real, ordered date range without changing task status automatically.
- Surfaced delivery windows in task creation, task details, task cards, the four-marker task calendar, the daily cockpit, and project delivery-risk counts.
- Expanded task-calendar delivery windows into continuous, de-duplicated daily work and grouped busy-day task queues by project and urgency.
- Updated the Starter Vault, data contract, release checks, and synthetic fixtures for the new fields.
- Added complete synthetic Daily, Weekly, and Monthly Report examples plus a manual periodic-review playbook; report metrics remain frozen at closing and legacy reports remain unmodified.
- Extended the packaged health check and release gate to validate optional report metrics, delivery-window ordering, collaborator role-card contracts, and the corresponding Starter templates.
- Fixed task-calendar day-cell overflow, added safe project archive/restore without changing related tasks, and added composable project and task-board filters.
- Added a SemVer release contract, Changelog freezing command, release-note extraction, and a tag-triggered verified GitHub Release workflow.

## v0.1.0 — 2026-08-14

- First public release of the local Obsidian workbench, four evidence-aware Codex Skills, and the unified Starter Vault.
- Made Vault writes explicit opt-in with `WORKBENCH_WRITE_ENABLED=true`.
- Added public installation, verification, packaging, and GitHub Actions workflows.

[Unreleased]: https://github.com/duxinrui9-gif/obsidian-codex-workbench/compare/v0.3.0...HEAD
[v0.3.0]: https://github.com/duxinrui9-gif/obsidian-codex-workbench/compare/v0.2.1...v0.3.0
[v0.2.1]: https://github.com/duxinrui9-gif/obsidian-codex-workbench/compare/v0.2.0...v0.2.1
[v0.2.0]: https://github.com/duxinrui9-gif/obsidian-codex-workbench/compare/v0.1.0...v0.2.0
[v0.1.0]: https://github.com/duxinrui9-gif/obsidian-codex-workbench/releases/tag/v0.1.0
