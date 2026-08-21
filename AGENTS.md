# Codex operating rules

This repository packages a local Obsidian workbench, four Codex Skills, and a reusable Starter Vault.

- Work only inside this checkout unless the user explicitly names a target Vault.
- Never commit `.env.local`, a real Vault, `.workbench-data`, browser state, logs, credentials, or customer data.
- Keep `WORKBENCH_WRITE_ENABLED=false` until the user has verified a temporary Vault and explicitly authorizes writes.
- The workbench is local-only. Keep its server bound to `127.0.0.1`; do not add hosting, login, telemetry, timers, or file watchers without explicit approval.
- Treat `starter-vault` as a template. Do not add personal projects, historical reports, or real source material to it.
- Validate code, Starter contracts, Skill manifests, and the privacy scan before a release. Do not silently delete user notes or replace installed Skills.
- `pnpm dev` and `pnpm build` can switch the generated route reference in `next-env.d.ts`; preserve a running developer's version and never stage that transient diff with feature work.
