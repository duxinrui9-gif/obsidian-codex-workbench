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

## Validate a method batch

After the structural health check, validate a bounded directory of task methods before marking sibling cards runnable:

```bash
python3 skills/obsidian-health-check/scripts/validate_method_batch.py \
  --vault <vault-root> --path-prefix <02-method-dir> --format text --fail-on warning
```

The validator is read-only. It reports generic evidence labels and templates, vague operator steps, missing or unfilled dry runs, and near-identical method batches. Static mixed sources remain subject to the main health audit, which requires a concrete visual/unit manifest for each supplied image, slide, PDF page, and document region.
