#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$repo_root"
version="v$(node -p 'require("./package.json").version')"
if [[ $# -gt 0 ]]; then
  [[ $# -eq 2 && "$1" == "--version" && "$2" == "$version" ]] || { echo "Usage: scripts/build-release.sh [--version $version]" >&2; exit 2; }
fi
node scripts/release-version.mjs clean
pnpm release:verify
pnpm verify
python3 packages/obsidian-skills/verify.py

output_dir="$repo_root/.workbench-data/releases"
mkdir -p "$output_dir"
full="$output_dir/obsidian-codex-workbench-$version.zip"
starter="$output_dir/obsidian-codex-starter-$version.zip"
notes="$output_dir/RELEASE_NOTES.md"
git archive --format=zip --prefix="obsidian-codex-workbench-$version/" HEAD > "$full"
git archive --format=zip --prefix="obsidian-codex-starter-$version/" HEAD:starter-vault > "$starter"
pnpm release:notes -- --version "${version#v}" --output ".workbench-data/releases/RELEASE_NOTES.md"
(
  cd "$output_dir"
  shasum -a 256 "$(basename "$full")" "$(basename "$starter")" > SHA256SUMS.txt
)
echo "Release assets written to $output_dir"
