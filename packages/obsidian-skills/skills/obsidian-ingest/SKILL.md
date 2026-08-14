---
name: obsidian-ingest
description: Organize explicitly selected material in the personal Obsidian Vault into preserved raw inputs, complete semantic evidence, and usable evidence-bound knowledge. Use when the user asks to process a named 00_Inbox file or folder, organize documents/images/audio/websites/social links/conversations/data, or turn direct evidence into a principle, case, method fragment, or runnable method in 我的知识库.
---

# Obsidian Ingest

Compile a user-selected input package into traceable knowledge. Preserve originals and do not turn project evidence into project-state records.

## Start

1. Read the Vault's `AGENTS.md`, `00_知识库配置.md`, `00_首页.md`, and `90_System/知识库自增长说明.md`.
2. Read [references/ingest-contract.md](references/ingest-contract.md). Then load only the relevant modality reference: [source adapters](references/source-adapters.md), [learning compilation](references/learning-semantic-compilation.md), [lecture cleaning](references/transcript-cleaning.md), or [reader export](references/reader-export.md).
3. Require a named file, folder, URL set, or bounded batch. If none is named, list candidates and wait; never compile all of `00_Inbox` by default.
4. Read only the selected package, relevant existing notes, and relevant `03_Topics/项目/**` pages. Project pages are readable evidence; do not scan Vault-external project directories or edit a project page without explicit authorization.

## Compile

1. Preserve each original input. For a named public URL, store an immutable Markdown capture with URL, time, and hash; do not use login state or capture private content.
2. Score relevance, freshness, value, output potential, and connections. Record the decision without deleting or moving the Inbox input. Create or update one `ingest-batch-v1` status card per named batch.
3. Create a `semantic-content-v4` source as `partial / false / pending / pending / pending`. Use inline input/coverage tables for small inputs and a `source-input-manifest-v1` sidecar for large inputs. Preserve hashes, stable content blocks, visual units, declared exclusions, and unresolved material.
4. Choose one source shape before writing. Keep separate PDF and transcript sources by default. Use a learning compilation only for one known speaker explaining the same bounded slide session; keep different speakers, sessions, permissions, conflicts, or reuse cases separate.
5. For visual material, inspect every declared page, frame, or supplied photo. Record meaningful text, data, tables, formulae, charts, flows, screenshots, cases, limitations, and visual relationships. A generic page summary, OCR output, title, or image wall does not close coverage. Load the modality reference for exact handling.
6. For a requested complete lecture record, preserve the teaching path and substantive reasoning while removing only noise and identical local repetition. Keep time ranges, corrections, uncertainty, and exclusions in the audit layer. For slide photos, map each retained visual to the first precise reader block that explains it; diagrams, flows, tables, and relationship visuals appear before that explanation.
7. Run `scripts/validate_source_coverage.py --vault <vault-root> --source <01-source-path>` after coverage, semantic, visual, and where applicable fidelity checks. It blocks source-local fatal, error, and semantic findings; legacy or unrelated informational debt does not block acceptance. A source becomes `complete / true` only after applicable checks pass, input hashes match, and no information-bearing unit remains unresolved. A learning source also needs passed learning and anti-summary checks plus explicit acceptance. An `index / index_only` note is navigation, never direct evidence.
8. Open the verified v4 source itself before writing `02_Knowledge`; an index, digest, partial source, old card, or sidecar cannot substitute. Classify the result as a `principle`, `case`, `method_fragment`, or `method`. Create a method only when the direct material supports a repeatable entry condition, core actions, and observable output or judgment loop.
9. For a method, build `direct-content-v4` and `evidence-bound-method-v4` ledgers before prose. E rows point to real direct evidence; D rows are transparent compiler design and cannot claim source effects. A runnable method needs inputs, outputs, output mapping, decisions, E/D-backed completion or stop conditions, a copyable template, and a same-version dry run. A dry run does not raise maturity.

## Change and project evidence

- Count evidence families, not files or formats. Slides, transcripts, photos, screenshots, summaries, reposts, and mirrors from one event remain one family.
- Project pages may answer project-specific questions when cited with their Vault path, `updated` date, and `evidence_status`. Cross-project knowledge or practice validation requires a hash-traceable v4 source input; a project page alone never promotes maturity.
- Before evidence-affecting recompilation, back up the accepted 01 source and identify linked cards for review. Layout, image placement, or export styling alone is presentation-only; changed terms, numbers, results, evidence nature, or stable-block meaning require later explicit review.

## Boundaries

- Do not store credentials, tokens, cookies, QR payloads, or authentication configuration.
- Preserve uncertainty, speaker claims, case boundaries, and high-risk examples. Do not invent authors, dates, thresholds, roles, sequences, metrics, causal effects, or operating rules.
- HTML/PDF delivery is downstream of accepted 01, never evidence. Run the reader-export validator and visual QA before delivery.
- This Skill is manual and content-triggered. Do not create a watcher, cron job, or catch-up batch.
