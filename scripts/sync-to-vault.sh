#!/usr/bin/env bash
# One-way sync: this repo -> the Obsidian vault.
#
# The vault (default: ~/Documents/GoogleDrive/Notes) is not a git repo, so
# this never reads anything back from it. By default it only adds/updates
# files; pass --delete to also remove vault files that no longer exist in
# the repo. Always shows a dry-run preview first and asks for confirmation
# unless --yes is given.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VAULT_ROOT="${DATACORE_VAULT_ROOT:-/home/andrew/Documents/GoogleDrive/Notes}"

DELETE=0
ASSUME_YES=0
for arg in "$@"; do
    case "$arg" in
        --delete) DELETE=1 ;;
        --yes|-y) ASSUME_YES=1 ;;
        --help|-h)
            echo "Usage: $0 [--delete] [--yes]"
            echo "  --delete  also remove vault files no longer present in the repo"
            echo "  --yes     skip the confirmation prompt"
            exit 0
            ;;
        *)
            echo "Unknown argument: $arg" >&2
            exit 1
            ;;
    esac
done

if [ ! -d "$VAULT_ROOT" ]; then
    echo "Vault root not found: $VAULT_ROOT" >&2
    echo "Set DATACORE_VAULT_ROOT to override." >&2
    exit 1
fi

RSYNC_FLAGS=(-av)
if [ "$DELETE" -eq 1 ]; then
    RSYNC_FLAGS+=(--delete)
fi

# repo path -> vault path
MAPPINGS=(
    "C. Dashboards/|C. Dashboards/"
    "datacore/|Z. Meta/datacore/"
)

echo "Repo:  $REPO_ROOT"
echo "Vault: $VAULT_ROOT"
echo "Delete removed files: $([ "$DELETE" -eq 1 ] && echo yes || echo no)"
echo

echo "== Preview (dry run) =="
for mapping in "${MAPPINGS[@]}"; do
    src="${mapping%%|*}"
    dest="${mapping##*|}"
    echo "--- ${src} -> ${dest} ---"
    rsync "${RSYNC_FLAGS[@]}" --dry-run "$REPO_ROOT/$src" "$VAULT_ROOT/$dest"
done
echo

if [ "$ASSUME_YES" -ne 1 ]; then
    read -r -p "Apply the sync above? [y/N] " reply
    case "$reply" in
        y|Y|yes|YES) ;;
        *) echo "Aborted."; exit 1 ;;
    esac
fi

echo "== Syncing =="
for mapping in "${MAPPINGS[@]}"; do
    src="${mapping%%|*}"
    dest="${mapping##*|}"
    mkdir -p "$VAULT_ROOT/$dest"
    rsync "${RSYNC_FLAGS[@]}" "$REPO_ROOT/$src" "$VAULT_ROOT/$dest"
done
echo "Done."
