---
name: obsidian-maturity-audit
description: Audit knowledge-card evidence maturity, operational readiness, confidence, evidence-family independence, applied validation, contradictions, supersession, and review dates in the personal Obsidian Vault. Use when the user asks for 知识成熟度审计, method readiness review, evidence review, stale-card review, contradiction review, or maturity promotion in 我的知识库.
---

# Obsidian Maturity Audit

Audit the evidence behind knowledge cards without deleting records or promoting unsupported claims.

## Start

1. Read the Vault's `AGENTS.md`, `00_知识库配置.md`, `00_首页.md`, and `90_System/知识库自增长说明.md`.
2. Read [references/maturity-contract.md](references/maturity-contract.md).
3. Read only the cards and source notes required for the audit; read relevant `03_Topics/项目/**` pages in full when they are cited as project evidence, without modifying them by default.

## Workflow

1. Find cards with overdue review dates, insufficient independent families or applied validation for their maturity, confidence that conflicts with evidence, unsupported actions, insufficient operational readiness, or likely contradictions and supersession.
2. If a cited source has malformed Properties, broken links, hash mismatch, or an incomplete structural contract, record the evidence gap and route the deterministic repair question to `$obsidian-health-check`; do not duplicate its structural pass here.
3. Count `evidence_families`, not files. An index, summary, repost, mirror, transcript, slides, and images from the same origin do not increase independence. A partial or unverified compilation cannot support promotion.
4. Apply the type-specific gate: a `principle`, `case`, or `method_fragment` needs a scoped claim and verified v4 direct evidence, but no full method contract. A `method` needs the complete v4 E/D contract. A source whose PDF elements are generic, slide-photo sidecar is missing or unresolved, visual descriptions are boilerplate, learning acceptance is pending, or meeting coverage lacks precise timestamp-topic blocks is not usable direct evidence even when its structural fields say complete. For either type, validated needs two independent families or one family plus one observed applied-validation source; evergreen needs two families, two cross-context applied validations, a current review, and no unresolved core conflict. PDF crops, slide photos, sidecars, transcript and meeting notes from the same event remain one family; learning reorganization, visual completion and full-fidelity transcription raise traceability, never maturity.
5. Treat `maturity` as evidence strength and `operational_readiness` as usability. A same-version paper dry run only proves output production; `tested` needs a real applied-validation record with a stated result.
6. Treat a 01 recompile that changes only reading layout, image placement or export styling as a traceability improvement, not new evidence. If a recompile changes a cited term, number, case boundary, evidence nature or stable-block meaning, require review of the affected E items before any promotion; do not automatically lower maturity or edit the card.
7. In default `report` mode, do not move cards, change maturity, or write review state. Only with an explicit `更新成熟度`、`归档` or `应用审计结论` request may a retained `superseded` method move to `02_Knowledge/归档/方法/...`; explain the newer evidence. Delete only a redirect-only duplicate when the user explicitly authorizes it, a recoverable backup exists, and non-project links have been migrated or are absent.
8. A project-page observation counts as applied validation only after it is explicitly recorded as an observed result and compiled into a hash-traceable v4 source; a project page alone never promotes maturity.

## Boundaries

- Do not repair links or Properties beyond what is necessary to record the audit; use `$obsidian-health-check` for deterministic structural work.
- Do not validate a speaker's claim through repetition inside the same event.
- Do not update project-reference status or project facts; the audit changes only knowledge cards and reviews after explicit apply authorization.
- This Skill is manual and user-initiated; a disabled legacy scheduler must not invoke it.
