#!/usr/bin/env bash
set -euo pipefail

replace=false
if [[ "${1:-}" == "--replace" ]]; then
  replace=true
elif [[ $# -ne 0 ]]; then
  echo "Usage: ./install.sh [--replace]" >&2
  exit 2
fi

package_root="$(cd "$(dirname "$0")" && pwd)"
target_root="${CODEX_HOME:-${HOME}/.codex}/skills"
timestamp="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$target_root"
for skill_name in obsidian-ingest obsidian-query obsidian-health-check obsidian-maturity-audit; do
  source_dir="$package_root/skills/$skill_name"
  target_dir="$target_root/$skill_name"
  if [[ ! -d "$source_dir" ]]; then
    echo "Missing packaged skill: $source_dir" >&2
    exit 2
  fi
  if [[ -e "$target_dir" ]]; then
    if [[ "$replace" != true ]]; then
      echo "Refusing to overwrite existing skill: $target_dir" >&2
      echo "Run ./install.sh --replace to create a backup and replace it." >&2
      exit 1
    fi
    backup_dir="$target_root/.backup-obsidian-knowledge-skills-$timestamp/$skill_name"
    mkdir -p "$(dirname "$backup_dir")"
    mv "$target_dir" "$backup_dir"
  fi
  cp -R "$source_dir" "$target_dir"
  echo "Installed $skill_name"
done
