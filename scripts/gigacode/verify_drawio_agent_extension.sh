#!/usr/bin/env bash
set -Eeuo pipefail

EXTENSION_NAME="publish-drawio-skill"
EXPECTED_VERSION="${DRAWIO_EXTENSION_VERSION:-1.22.0-corporate.1}"
GIGACODE_HOME="${GIGACODE_HOME:-$HOME/.gigacode}"
GIGACODE_BIN="${GIGACODE_BIN:-$GIGACODE_HOME/bin/gigacode}"
GIGACODE_SKILLS_DIR="${GIGACODE_SKILLS_DIR:-$GIGACODE_HOME/skills}"
GIGACODE_EXTENSIONS_DIR="${GIGACODE_EXTENSIONS_DIR:-$GIGACODE_HOME/extensions}"
GIGACODE_EXTENSION_SOURCES_DIR="${GIGACODE_EXTENSION_SOURCES_DIR:-$GIGACODE_HOME/extension-sources}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
skip_self_check=0
source_path=""

usage() {
  cat <<'EOF'
Usage: verify_drawio_agent_extension.sh [--source PATH] [--skip-self-check]

Checks the installed manifest, four agent definitions, native GigaCode
registration, legacy-skill conflicts, and the extension self-check.
EOF
}

log() { printf '[drawio-extension:verify] %s\n' "$*"; }
die() { printf '[drawio-extension:verify] ERROR: %s\n' "$*" >&2; exit 1; }

while (($#)); do
  case "$1" in
    --source) [[ $# -ge 2 ]] || die "--source requires PATH"; source_path="$2"; shift 2 ;;
    --skip-self-check) skip_self_check=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown option: $1" ;;
  esac
done

[[ -x "$GIGACODE_BIN" ]] || die "GigaCode CLI not executable: $GIGACODE_BIN"
command -v "$PYTHON_BIN" >/dev/null 2>&1 || die "Python not found: $PYTHON_BIN"

if [[ -z "$source_path" ]]; then
  current="$GIGACODE_EXTENSION_SOURCES_DIR/$EXTENSION_NAME/current"
  installed="$GIGACODE_EXTENSIONS_DIR/$EXTENSION_NAME"
  if [[ -e "$current/gemini-extension.json" ]]; then
    source_path="$current"
  elif [[ -e "$installed/gemini-extension.json" ]]; then
    source_path="$installed"
  else
    die "Cannot locate $EXTENSION_NAME in extension-sources or extensions"
  fi
fi

[[ -f "$source_path/gemini-extension.json" ]] || die "Missing manifest: $source_path/gemini-extension.json"
read -r manifest_name manifest_version < <("$PYTHON_BIN" - "$source_path/gemini-extension.json" <<'PY'
import json, sys
data = json.load(open(sys.argv[1], encoding="utf-8"))
print(data.get("name", ""), data.get("version", ""))
PY
)
[[ "$manifest_name" == "$EXTENSION_NAME" ]] || die "Unexpected manifest name: $manifest_name"
[[ "$manifest_version" == "$EXPECTED_VERSION" ]] || die "Expected version $EXPECTED_VERSION, found $manifest_version"

for agent in diagram-supervisor diagram-reviewer diagram-repair diagram-semantic-analyst; do
  [[ -s "$source_path/agents/$agent.md" ]] || die "Missing agent definition: agents/$agent.md"
done

if [[ -e "$GIGACODE_SKILLS_DIR/drawio-skill" ]]; then
  die "Legacy skill is still active at $GIGACODE_SKILLS_DIR/drawio-skill; it would compete with the extension"
fi

list_output="$($GIGACODE_BIN extensions list 2>&1)" || die "GigaCode extensions list failed: $list_output"
grep -Fq "$EXTENSION_NAME" <<<"$list_output" || die "$EXTENSION_NAME is absent from GigaCode extensions list"

log "Running native GigaCode extension validation"
"$GIGACODE_BIN" extensions validate "$source_path"

if (( ! skip_self_check )); then
  [[ -f "$source_path/scripts/self_check.py" ]] || die "Missing scripts/self_check.py"
  log "Running extension self-check"
  "$PYTHON_BIN" "$source_path/scripts/self_check.py"
else
  log "Self-check skipped by request"
fi

log "Verified $EXTENSION_NAME $manifest_version"
log "Restart GigaCode, run /agents list, and confirm: diagram-supervisor, diagram-reviewer, diagram-repair, diagram-semantic-analyst."
