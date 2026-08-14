# Learning semantic compilation

Use this mode for a user-requested learning source whose PDF supplies the visible structure and whose same-speaker oral explanation supplies reasoning or live context.

## Choose the shape

Use `pdf-primary-learning-v1` when a PDF and oral material cover the same session, the primary speaker is known, and the oral material mostly explains rather than replaces the slides. Use `slide-photo-primary-learning-v1` under the same conditions when only user-supplied session photographs are available. Retain separate sources when the material has different speakers, sessions, permissions, substantive conflicts, or independent reuse value.

## Write two layers

The reader layer follows topic, argument, step and case logic. It is continuous prose with only the visuals that help understanding. The audit layer holds the input manifest, full page/image and time coverage, element inventory, visual manifest, evidence mapping and exclusions. For slide photographs, show diagrams, flows and tables inline with `![[...|900]]`; after fully transcribing a text-only slide, place the original or a safe crop in a folded `查看课件原图` callout. A readable grouping never permits lost information: retain each meaningful field, value, role, node, arrow, screenshot state, example and limitation.

## Reading rules

- Use `primary_speaker` in prose after the first full introduction. Use role labels only when identity is unknown or speakers are mixed.
- Put biography in a short collapsed background block, not inside the argument.
- Merge adjacent low-information pages or steps into a shared section, while preserving their individual content and stable anchors.
- Give parallel cases the same order: trigger/material, hypothesis, live action, proof boundary.
- Match each retained slide photo to the first reader block that directly explains it. Semantic correspondence is primary; capture time is only a tiebreaker. Use a precise `^t-*` reader block whenever the source has timestamp-topic units; retain `^c-*` for legacy chapter navigation.
- Show one representative image once. Put diagrams, tables, flows and relationship visuals immediately before their explanation; fold a fully transcribed text slide beside its explanation. Never leave several images together without intervening explanatory prose.
- Use reader-facing footnotes for source locations. Consolidate repeated locations. Keep input IDs, evidence-family notes and labels such as `speaker-claim` in the appendix.
- Keep a conflict or a non-result boundary visible in prose when it materially changes interpretation; do not hide it only in a footnote.

## Acceptance gate

Set `learning_check` to `passed` only after the main body can be read without reopening the PDF and no structured artifact has been reduced to a generic summary. Set `anti_summary_check` to `passed` only after each meaningful input unit has a readable destination with its original detail. Set `acceptance_status: accepted` only after the user approves the learning presentation. Until then keep the note `review / partial` and exclude it from 02 evidence.
