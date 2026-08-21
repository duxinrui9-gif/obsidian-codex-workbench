# Contributing

Use a branch and keep each change scoped to the workbench, Skills, Starter Vault, or documentation.

Before opening a pull request, run:

```bash
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm release:check
python3 packages/obsidian-skills/verify.py
```

Do not submit real Vault content, personal configuration, credentials, or generated local runtime data. Changes that alter Vault fields or Starter templates must retain the workbench contract and include a matching test or fixture.

## Version and release policy

`package.json` is the source of truth for stable `X.Y.Z` versions. Use PATCH for backward-compatible fixes, dependency security updates, and documentation; use MINOR for backward-compatible features and optional Vault contract additions; use MAJOR for breaking stable contracts. Before 1.0, any breaking change must be called out in `CHANGELOG.md`.

Keep changes under `Unreleased` during normal development. A release owner runs `pnpm release:prepare -- X.Y.Z` on a clean branch, reviews the generated Changelog section, and includes the version metadata in the release PR. After a successful Squash merge to `main`, create and push an annotated matching `vX.Y.Z` tag. The tag workflow builds and verifies the artifacts before publishing the GitHub Release. Published releases and tags are never moved or overwritten; correct a release issue with a later PATCH version.
