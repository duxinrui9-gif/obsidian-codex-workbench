# Obsidian Knowledge Skills

This package contains four manual Codex Skills for an evidence-aware Obsidian Vault:

- `obsidian-ingest` — organize explicitly selected inputs into direct content and reusable knowledge.
- `obsidian-query` — answer from verified direct evidence with facts, inference, and unknowns separated.
- `obsidian-health-check` — inspect Properties, links, hashes, coverage, and deterministic structure.
- `obsidian-maturity-audit` — audit evidence independence, maturity, readiness, conflicts, and supersession.

## Install safely

Run `./install.sh` to install only when no same-named Skills exist. Run `./install.sh --replace` only when you intend to back up and replace installed copies.

Validate the distribution before and after copying:

```bash
python3 verify.py
```

These Skills are manual and user-triggered. They do not create schedulers, watchers, or automatic writes.
