# Architecture

The repository has three cooperating layers:

1. **Mission Control** at the repository root reads one local Obsidian Vault. It is a dashboard and a narrow task/project writer, not a source-of-truth database.
2. **Starter Vault** supplies the source of truth: raw inputs in `00_Inbox`, complete semantic sources in `01_Sources`, reusable knowledge in `02_Knowledge`, project pages, action cards, and report templates.
3. **Codex Skills** operate manually on a user-named scope. They preserve raw inputs, require complete direct evidence for new knowledge, answer with evidence boundaries, and audit deterministic structure separately from maturity.

The workbench defaults to these Vault paths: `05_Review/Actions`, `03_Topics/项目`, `05_Review/Daily`, `05_Review/Weekly`, `05_Review/Monthly`, and `98_Templates/项目主页.md`. The environment profile can map a compatible Vault without moving user notes.

No layer starts a timer, watcher, scheduler, cloud sync, or automatic catch-up pass. The Vault stays the persistent record; the workbench and Skills are deliberate tools around it.
