# Cyber HUD icon set

Generated with the built-in image model (eight 2×2 source sheets), then chroma-keyed and normalized to 128×128 RGBA PNGs. The application uses each PNG only as an alpha mask; visual color comes from the current CSS theme.

| Group | Assets |
| --- | --- |
| Brand & navigation | `brand-core`, `nav-command`, `nav-tasks`, `nav-projects`, `nav-daily`, `nav-weekly`, `nav-monthly` |
| Tools | `theme-light`, `theme-dark`, `refresh`, `add`, `close`, `save`, `dismiss`, `external-link` |
| State | `state-ready`, `state-in-progress`, `state-waiting`, `state-review`, `state-backlog`, `state-done`, `state-cancelled` |
| Workflow & risk | `next-action`, `schedule`, `carryover`, `overdue`, `vault-linked`, `vault-disconnected` |
| Review & instrumentation | `review-report`, `review-plan`, `risk-watch`, `project-radar` |

Prompt system: monochrome white mechanical HUD line glyphs in four evenly spaced quadrants on a solid `#00ff00` chroma-key background; no text, gradients, shadows, or small detail; maximum two contours and stroke weight designed for 16–32px UI use. Source sheets and QA previews are intentionally kept in the Git-ignored `.workbench-data/qa/icons` directory.
