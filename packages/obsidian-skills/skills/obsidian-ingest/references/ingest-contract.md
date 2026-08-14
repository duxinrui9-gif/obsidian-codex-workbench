# Ingest contract

Use only the personal Vault. Preserve original inputs and Inbox notes; derived sources, conclusions, and operating design stay separate from the raw material.

## v4 source and knowledge contracts

- A semantic source uses `source_contract: semantic-content-v4`, a supported `source_adapter`, `source_role: content`, `coverage_status`, literal `coverage_verified`, `coverage_check`, `semantic_check`, `visual_check`, `content_modalities`, `content_unit_scheme`, `visual_unit_scheme`, and inline-list `evidence_families`. Start `partial / false / pending / pending / pending`. Set `complete / true` only after each declared unit is covered or explicitly excluded, no information-bearing unit is unresolved, every input hash matches, and the original has been reread or rendered as needed.
- Small inputs use inline `source_inputs`, `原始输入清单`, and `覆盖附录`. Large input sets use `source_input_mode: manifest`, `source_manifest`, and `source_input_count`; the linked `source-input-manifest-v1` sidecar points back to the reader, carries the input, coverage, and visual ledgers, and shares the combined `content_hash`. The sidecar is audit data, never direct evidence.
- A navigation source is `navigation-index-v1 / index / index_only / false`; it routes readers but cannot support a card. Existing v2/v3 sources remain readable legacy context and are never a new write target.
- Before accepting a source, run `scripts/validate_source_coverage.py --vault <vault-root> --source <01-source-path>`. It fails on that source's fatal, error, or semantic findings, including incomplete visual/coverage gates; it does not fail on unrelated historical warnings or informational findings.
- New knowledge uses `direct-content-v4`, `knowledge_kind`, `operational_readiness`, `evidence_families`, `independent_source_count`, and `applied_validation_count`. A `method` additionally uses `evidence-bound-method-v4`. Keep frontmatter flat; required lists are inline lists and `source_count` equals the number of `source_notes`.

## Source-content gate

Score relevance, freshness, value, output potential, and connections from 0 to 2. Write a card only when provenance is known or explicitly unavailable, the conclusion is reusable and non-duplicative, its sensitivity is safe for the Vault, and it has a meaningful connection.

A verified `semantic-content-v4 / content / complete` source contains the substantive claims, reasoning, cases, questions, objections, failures, and exclusions needed to understand its declared range without reopening an index. Before creating `02_Knowledge`, reopen that source and its relevant visual blocks. If it is partial or missing, return to the selected 00 input.

Classify knowledge before drafting. A `principle` is a reusable judgment, a `method_fragment` preserves useful actions without a full loop, a `case` preserves context and observed result, and a `method` solves a reusable task with a defined output. Several actions do not automatically form a method.

For `evidence-bound-method-v4`, build two ledgers before prose. `直接证据台账` uses E IDs with action/judgment, evidence nature, modality, direct source, precise locator, family, and limitation. `编者操作设计` uses D IDs only for artifacts, sequencing, recordkeeping, parameters, or review gates; every row says its purpose, user choice, and non-claim boundary. Core execution actions cite at least one `explicit-action` E row. Claims, screenshots, and case results cannot become universal rules.

## Modality gates

Load [source adapters](source-adapters.md) for the selected input. Visual inputs require rendered or inspected pages/frames and concrete coverage for substantive text, data, tables, charts, flows, screenshots, roles, values, and limitations. Generic page summaries, generic visual descriptions, or OCR text alone are insufficient.

A full PDF source adds `content_fidelity: full`, `fidelity_check`, `page-element-v1`, and `page-region-v2`; it cannot be complete until fidelity passes. A transcript uses continuous precise `timestamp-topic-v1` ranges. Learning compilation, complete lecture cleanup, slide-photo mapping, and reader delivery have their own references; load them only when that mode is requested.

For a runnable method, require goal, applicability and prohibition boundary, inputs, output artifacts, direct evidence, compiler design, execution flow, decision table, complete/pause-or-stop conditions, copyable template, non-validating example, failure/recovery notes, and known unknowns. Missing thresholds remain user parameters or `unknown`. `runnable` does not raise maturity; `tested` needs a complete applied-validation source with an explicit result.

## Project-page evidence and change control

`03_Topics/项目/**` pages are readable project evidence. Cite their Vault path, `updated` date, and `evidence_status` for project-scoped answers. To extract cross-project knowledge or count an observation as applied validation, compile the page into a v4 source manifest with its SHA-256 and observed result. Do not modify project pages during ingest unless explicitly requested.

Before evidence-affecting recompilation, create a backup and set the source to review or partial. Layout, image placement, width, or export styling do not require a card review. Changed terms, numbers, result boundaries, evidence nature, or stable-block meaning require affected E items to be reviewed before promotion; do not alter card maturity without explicit authorization.
