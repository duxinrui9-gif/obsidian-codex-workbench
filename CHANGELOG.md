# Changelog

本项目遵循语义化版本；正式发布不可重写，具体规则见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## Unreleased

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

[Unreleased]: https://github.com/duxinrui9-gif/obsidian-codex-workbench/compare/v0.2.0...HEAD
[v0.2.0]: https://github.com/duxinrui9-gif/obsidian-codex-workbench/compare/v0.1.0...v0.2.0
[v0.1.0]: https://github.com/duxinrui9-gif/obsidian-codex-workbench/releases/tag/v0.1.0
