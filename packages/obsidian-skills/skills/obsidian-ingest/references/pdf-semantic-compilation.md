# PDF Semantic Compilation

Use this reference when a selected PDF must become a complete semantic source, not a summary. Generic PDF extraction/rendering is handled by Primary Runtime `pdf:pdf`; this workflow owns evidence completeness after extraction.

1. Inspect every physical page and keep a one-page-one-record coverage table.
2. Inventory headings, prose, tables and fields, formulas, charts and values, diagrams and arrows, screenshots and states, cases, claims, limitations, contacts, QR payloads, and approved exclusions as separate semantic units when present.
3. OCR is assistance only. Resolve uncertain text against rendered pages and record unreadable material instead of guessing. Do not reproduce repeated furniture or page geometry mechanically.
4. A reader layer may group sparse pages into an argument, topic, or case chapter, but cannot omit meaningful fields, values, roles, nodes, arrows, actions, or limitations. Put physical-page and visual coverage in the audit layer.
5. For an allowed same-session speaker explanation, preserve the source/time coverage and speaker in the audit layer while integrating substantive explanation in normal prose. Keep conflicting speakers, sessions, and permissions separate.

The source cannot become `complete / true` until every information-bearing unit is covered or explicitly unresolved, input hashes match, and `validate_source_coverage.py` passes.
