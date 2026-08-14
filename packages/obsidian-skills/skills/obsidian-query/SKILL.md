---
name: obsidian-query
description: Answer questions from the personal Obsidian Vault using verified semantic sources and runnable knowledge methods, with facts, inferences, compiler-designed operating scaffolds, conflicts, and explicit unknowns. Use when the user asks to search, verify, summarize, or answer how to act from 我的知识库 or an Obsidian evidence base.
---

# Obsidian Query

Answer from recorded evidence without silently turning prior answers into sources.

## Start

1. Read the Vault's `AGENTS.md`, `00_知识库配置.md`, `00_首页.md`, and `90_System/知识库自增长说明.md`.
2. Read [references/query-contract.md](references/query-contract.md).
3. Search source notes and knowledge cards first. Read `03_Topics/项目/**` in full when it is relevant to a project question; treat it as project evidence, cite its Vault path, `updated` date, and `evidence_status`, and distinguish it from independently verified external evidence.

## Workflow

1. Use an index, batch card or card only to discover material. Answer facts from the strongest `semantic-content-v4 / content / complete / coverage_verified: true / coverage_check: passed / semantic_check: passed / visual_check: passed|not_applicable` source; for PDF or slide-photo detail questions, cite a precise element, visual unit or reader block rather than an overview, page title or page-range digest. A completed `pdf-primary-learning-v1` or `slide-photo-primary-learning-v1` source may provide reader-facing explanation only when its acceptance and learning gates passed; follow its manifest only for raw location and never treat the manifest as factual prose. For a slide-photo detail, read the specific `^t-*` lecture block together with its sidecar visual transcription; a chapter-only `^c-*` mapping or an image wall is insufficient for a visual-detail claim. For meeting claims, cite a timestamp-topic block with a precise time range; if only a whole-session block exists, return `证据粒度不足`. v2/v3 are readable legacy context only.
2. Distinguish a visible chart value or interface state (`visual-observation`), the speaker's explanation, and compiler inference. If a visual is unreadable or excluded, say unknown rather than borrowing certainty from nearby prose.
3. Prefer same-version-dry-run `runnable` or `tested` methods for how-to questions, but reopen direct sources for factual claims. Label compiler-designed `D` scaffolds as operating design, not source fact; do not present cases, fragments, drafts, stale, superseded, partial, or legacy material as a complete SOP.
4. Return a conclusion, evidence-backed facts with reader-facing locators, clearly labeled inferences, and explicit unknowns or validation steps. Name a known single speaker in normal prose; reserve machine labels such as `speaker-claim` for evidence detail, not the main explanation. If no verified direct body exists, say `证据正文缺失`.
5. Preserve unresolved conflicts instead of selecting a winner without evidence.
6. Do not save a query record by default. When an answer is reusable, changes a decision, or exposes a concrete evidence gap, propose persistence; write only after the user explicitly asks.

## Boundaries

- This Skill is read-first and user-initiated; it never runs on the maintenance schedule.
- Do not turn a question about malformed Properties, links, hashes, or contract structure into an answer-only pass; use `$obsidian-health-check` first when structural validity is the question.
- Do not upgrade maturity or confidence because a claim appeared in a previous response.
- Do not expose passwords, API keys, tokens, cookies, private keys, or authentication configuration. Project pages may answer project facts only with their path, `updated` date, and `evidence_status`; they do not authorize edits to the project page or Vault-external project files.
