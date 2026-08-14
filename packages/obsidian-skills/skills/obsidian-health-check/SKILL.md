---
name: obsidian-health-check
description: Check the personal Obsidian Vault for malformed Properties, broken or ambiguous links, raw-input hashes, coverage manifests, evidence-contract integrity, orphan cards, duplicate candidates, and deterministic structural repairs. Use when the user asks for 知识库体检, Obsidian lint, evidence-chain checks, link checks, metadata checks, or Vault health.
---

# Obsidian Health Check

Inspect Vault structure in report mode. Apply deterministic repairs only when the user explicitly asks to repair or apply them.

## Start

1. Read the Vault's `AGENTS.md`, `00_知识库配置.md`, `00_首页.md`, and `90_System/知识库自增长说明.md`.
2. Read [references/health-contract.md](references/health-contract.md).
3. Run `scripts/audit_vault.py --vault <vault-root> --format json --fail-on error`. Exit `1` means the report found in-scope governance errors; exit `2` means the command itself failed. Use `--focus-file`, `--path-prefix`, `--note-type`, or `--contract-version v4` for a bounded pass; an empty bounded result is an error unless `--allow-empty-scope` is explicit. This Skill owns the canonical `obsidian-health-v1` audit.

## Workflow

1. Review malformed frontmatter, batch states, broken links, v4 hashes/gates/stable content and visual blocks, page coverage, attachment hashes, evidence-family counts, maturity gates, output mapping and dry-run/version consistency. A full-fidelity PDF marked complete needs a real PDF page count, one physical-page record per page, concrete element units (not generic page summaries), page-specific visual descriptions, real body anchors, visual evidence where relevant and no unresolved information-bearing unit. A large-source manifest must recursively match its reader note, input count, combined hash, original inputs and reader anchors. A `slide-photo-primary-learning-v1` source must classify every supplied image as `transcribed`, `duplicate`, `excluded` or `unreadable`; its relationship visuals use Obsidian embeds and its text slides are fully transcribed before a folded original image. For an exact `^t-*` visual mapping, verify the one retained embed appears before its target explanation without an intervening heading, reader block or image wall; retain `^c-*` compatibility for older chapter-level mappings. A learning source has a reader layer: verify its table schema and acceptance fields deterministically, while reporting readability and anti-summary gaps for human review rather than rewriting prose. A transcript meeting needs exact continuous timestamp-topic coverage, not whole-session or remaining-fragment rows. An active method needs verified direct v4 sources, `evidence-bound-method-v4`, E/D ledgers, output mapping, E/D-backed stop conditions, template and passed same-version dry run.
2. In default `report` mode, do not alter Vault files or state. With an explicit `repair` or `apply` request, repair only an `updated` date, a field deterministically derived from the current note, or a Wiki link with exactly one target.
3. Report missing evidence, contradictory claims, ambiguous targets, and duplicate candidates without guessing. Create a review note only when the user explicitly asks to apply findings.
4. Do not delete notes. Record run state only during an explicit write operation.

## Boundaries

- Fully inspect all `project_reference` notes under `03_Topics/项目/**` for Properties, links, duplicate targets, and evidence references. Do not infer or repair project facts.
- Do not assess evidence independence, practice validation, promotion, or archive readiness here. Use `$obsidian-maturity-audit` for those decisions.
- This Skill is manual and user-initiated; a disabled legacy scheduler must not invoke it.
