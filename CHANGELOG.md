# Changelog

## Unreleased

- Added frozen report metrics, period metadata, in-report outlines, evidence labels, project filtering, and horizontal reading support for long report tables while retaining legacy reports unchanged.
- Added the lazy-loaded Collaborators section with safe role-card reading, search/filtering, Obsidian links, and opt-in creation/editing of stable fields only.
- Updated the Starter Vault report templates, review Bases, collaborator template, and data contract for future reports and role cards.
- Added optional task delivery-window fields: `start_on` and `due_on`, validated as a real, ordered date range without changing task status automatically.
- Surfaced delivery windows in task creation, task details, task cards, the four-marker task calendar, the daily cockpit, and project delivery-risk counts.
- Expanded task-calendar delivery windows into continuous, de-duplicated daily work and grouped busy-day task queues by project and urgency.
- Updated the Starter Vault, data contract, release checks, and synthetic fixtures for the new fields.
- Added complete synthetic Daily, Weekly, and Monthly Report examples plus a manual periodic-review playbook; report metrics remain frozen at closing and legacy reports remain unmodified.
- Extended the packaged health check and release gate to validate optional report metrics, delivery-window ordering, collaborator role-card contracts, and the corresponding Starter templates.

## v0.1.0 — 2026-08-14

- First public release of the local Obsidian workbench, four evidence-aware Codex Skills, and the unified Starter Vault.
- Made Vault writes explicit opt-in with `WORKBENCH_WRITE_ENABLED=true`.
- Added public installation, verification, packaging, and GitHub Actions workflows.
