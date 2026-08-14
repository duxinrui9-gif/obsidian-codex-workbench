#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/bootstrap.sh --vault <empty-vault-path> [--apply] [--install-skills] [--skills-dir <path>] [--replace-skills]

Without --apply this command only checks and reports the intended work.
EOF
}

vault=''
apply=false
install_skills=false
replace_skills=false
skills_dir="${CODEX_HOME:-$HOME/.codex}/skills"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --vault) vault="${2:-}"; shift 2 ;;
    --apply) apply=true; shift ;;
    --install-skills) install_skills=true; shift ;;
    --skills-dir) skills_dir="${2:-}"; shift 2 ;;
    --replace-skills) replace_skills=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

[[ -n "$vault" ]] || { usage >&2; exit 2; }
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
starter="$repo_root/starter-vault"
[[ -d "$starter" ]] || { echo "Starter Vault is missing." >&2; exit 2; }

if [[ -e "$vault" ]] && [[ -n "$(find "$vault" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]]; then
  echo "Refusing non-empty Vault target: $vault" >&2
  exit 1
fi

skill_names=(obsidian-ingest obsidian-query obsidian-health-check obsidian-maturity-audit)
if [[ "$install_skills" == true ]]; then
  for name in "${skill_names[@]}"; do
    [[ -d "$repo_root/packages/obsidian-skills/skills/$name" ]] || { echo "Missing packaged Skill: $name" >&2; exit 2; }
    if [[ -e "$skills_dir/$name" && "$replace_skills" != true ]]; then
      echo "Refusing to overwrite installed Skill: $skills_dir/$name" >&2
      echo "Use --replace-skills only after reviewing the backup behavior." >&2
      exit 1
    fi
  done
fi

echo "Vault target: $vault"
echo "Mode: $([[ "$apply" == true ]] && echo apply || echo dry-run)"
echo "Skills: $([[ "$install_skills" == true ]] && echo install || echo skip)"
[[ "$apply" == true ]] || exit 0

mkdir -p "$vault"
ditto "$starter/" "$vault/"
if [[ "$install_skills" == true ]]; then
  mkdir -p "$skills_dir"
  timestamp="$(date +%Y%m%d-%H%M%S)"
  for name in "${skill_names[@]}"; do
    target="$skills_dir/$name"
    if [[ -e "$target" ]]; then
      backup="$skills_dir/.backup-obsidian-knowledge-skills-$timestamp/$name"
      mkdir -p "$(dirname "$backup")"
      mv "$target" "$backup"
    fi
    ditto "$repo_root/packages/obsidian-skills/skills/$name" "$target"
    echo "Installed $name"
  done
fi
echo "Starter created. Configure .env.local separately; writes remain disabled by default."
