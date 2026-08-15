# Changelog

## Unreleased

- Added optional task delivery-window fields: `start_on` and `due_on`, validated as a real, ordered date range without changing task status automatically.
- Surfaced delivery windows in task creation, task details, task cards, the four-marker task calendar, the daily cockpit, and project delivery-risk counts.
- Updated the Starter Vault, data contract, release checks, and synthetic fixtures for the new fields.

## v0.1.0 — 2026-08-14

- First public release of the local Obsidian workbench, four evidence-aware Codex Skills, and the unified Starter Vault.
- Made Vault writes explicit opt-in with `WORKBENCH_WRITE_ENABLED=true`.
- Added public installation, verification, packaging, and GitHub Actions workflows.
