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
