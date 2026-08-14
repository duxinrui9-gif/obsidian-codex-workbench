# Quick Start

## Requirements

- Desktop Obsidian with Templates, Daily Notes, Properties, and Bases.
- Node.js 20.9 or newer and pnpm 11.
- A local Codex installation if you want to install the bundled Skills.

## Start safely

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Set `OBSIDIAN_VAULT_PATH` in `.env.local`. Keep `WORKBENCH_WRITE_ENABLED=false`. The workbench is intentionally local-only and binds to `127.0.0.1`.

## Create a template Vault and install Skills

```bash
scripts/bootstrap.sh --vault "$HOME/Documents/My Obsidian Starter"
scripts/bootstrap.sh --vault "$HOME/Documents/My Obsidian Starter" --apply --install-skills
```

The first command is a dry run. The apply command refuses a non-empty target Vault and refuses to replace existing Skills unless `--replace-skills` is explicit.

Open the resulting Vault in Obsidian and give Codex the instruction in `00_从这里开始.md`. First inspect and configure the Vault in read-only mode. Use the included Demo to practice Plan → Report → carryover before enabling writes.
