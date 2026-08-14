# Reader-derived HTML and PDF delivery

Read this only after the user explicitly requests a delivery from an accepted 01 source. The accepted reader is the sole content and figure order; do not build a second export-only narrative or image sequence.

## Content boundary

- Remove YAML/Properties, Wiki links, block IDs, timecodes, input IDs, hashes, sidecar tables, every Vault path and machine evidence labels.
- Keep the reader body, natural speaker attribution, useful images and short Chinese captions. Do not turn unverified claims into unqualified facts while removing audit metadata.
- Do not use the resulting HTML or PDF as 01 evidence or as a source for 02.

## Single-file A4 HTML

- Use only Base64-embedded PNG, JPEG, WebP or GIF images with matching binary signatures. Do not leave local paths, external resources, clickable links, scripts, active elements, CSS `url(...)`, or `@import`; CSS resources are allowed only as inline `data:` values.
- Use A4 portrait CSS with print-safe margins.
- Keep each image, caption and first explanatory paragraph together when possible. Relationship diagrams, flows and tables may use a larger print height; never crop information-bearing text.
- Validate static hygiene and then render with headless Chrome for a screen and print check. Temporary PDFs and screenshots are validation artifacts, not Vault deliverables.

Run `scripts/validate_reader_export.py --html <file> --expected-images <count>` before delivery. Exit `1` means static hygiene failed; exit `2` means the validator could not read or parse the file. It is a static self-containment gate; then render with headless Chrome for visual QA.
