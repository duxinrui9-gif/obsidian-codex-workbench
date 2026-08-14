#!/usr/bin/env bash
set -euo pipefail

version='v0.1.0'
if [[ "${1:-}" == "--version" ]]; then version="${2:-}"; shift 2; fi
[[ $# -eq 0 && "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Usage: scripts/build-release.sh [--version vX.Y.Z]" >&2; exit 2; }

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"
git diff --quiet && git diff --cached --quiet || { echo "Refusing to package a dirty checkout." >&2; exit 1; }
pnpm verify
python3 packages/obsidian-skills/verify.py

output_dir="$repo_root/.workbench-data/releases"
mkdir -p "$output_dir"
full="$output_dir/obsidian-codex-workbench-$version.zip"
starter="$output_dir/obsidian-codex-starter-$version.zip"
git archive --format=zip --prefix="obsidian-codex-workbench-$version/" HEAD > "$full"
git archive --format=zip --prefix="obsidian-codex-starter-$version/" HEAD:starter-vault > "$starter"
(
  cd "$output_dir"
  shasum -a 256 "$(basename "$full")" "$(basename "$starter")" > SHA256SUMS.txt
)
echo "Release assets written to $output_dir"
