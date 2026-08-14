# Query contract

Search notes before answering. Treat source notes as evidence and knowledge cards as reusable conclusions that may still need review.

`navigation-index-v1 / source_role: index` notes are navigation only, never factual evidence. Trace each factual answer through an available `semantic-content-v4 / content / complete / coverage_verified: true / coverage_check: passed / semantic_check: passed / visual_check: passed|not_applicable` source (and its content/visual locators when relevant). For PDF detail, require a concrete page-element content block; for a slide-photo learning source, require a concrete reader block whose sidecar visual unit identifies its input and transcript range. For image-specific detail, pair the visual transcription with its exact `^t-*` lecture block; a chapter-only `^c-*` mapping, unreadable visual or image wall returns `证据粒度不足`. A `source-input-manifest-v1` sidecar is a locator only, never an answer source. A `pdf-primary-learning-v1` or `slide-photo-primary-learning-v1` source also requires `learning_check: passed`, `anti_summary_check: passed`, and `acceptance_status: accepted`; its narrative block improves explanation but does not replace exact evidence locations. For meeting detail, require a `timestamp-topic-v1` block with an exact time range; a whole-session compatibility anchor is navigation only. If the only available record is an index, incomplete compilation, legacy record, or knowledge-card assertion, report `证据正文缺失` or `证据粒度不足` and name the missing direct source instead of filling the gap from the index. Label a screenshot value as visible evidence, not independently verified fact.

Treat stale, superseded, and legacy cards as historical leads. For a how-to answer, use only a canonical method marked `runnable` or `tested`; distinguish its source-backed E steps from compiler-designed D scaffolds. Facts, results, numeric claims, and platform mechanisms still require the complete 01 source and locator. A `case`, `principle`, `method_fragment`, or `draft` may explain context but is not a complete SOP. Preserve conflicts across complete sources; for time-sensitive material compare capture time, stated scope, and source applicability rather than automatically preferring the newest capture. A saved query is never evidence for later knowledge or maturity.

## Answer shape

1. Conclusion.
2. Facts, each linked to its source note.
3. Inferences derived from those facts.
4. Unknowns, conflicts, and the next validation that would resolve them.

## Project evidence and persistence gate

Project pages under `03_Topics/项目/**` may be read and cited directly for project-scoped facts. Cite the Vault-relative path, `updated` date, and `evidence_status`; label the result as project evidence rather than independently verified external fact. They do not justify changing the page or scanning a Vault-external project directory.

Do not create a query record by default. If an answer changes a decision, can be reused, or creates a testable evidence gap, recommend persistence and wait for explicit approval. An approved record includes question, answer, evidence layers, confidence, follow-up date, and the writeback reason.
