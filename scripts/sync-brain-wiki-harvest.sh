#!/bin/bash
# Copia somente um registro datado para o vault local da Wiki, nunca substitui.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/docs/brain-sync/2026-10-24-harvest-deskcomm.md"
BRAIN="${FIGUEIRA_BRAIN_ROOT:-/Users/gui_t/Figueira_Marketing/brain}"
TARGET="$BRAIN/01-wiki/projetos/harvest/2026-10-24-harvest-deskcomm.md"
test -f "$SRC"
test -d "$BRAIN/00-sistema" || { echo "Vault canônico indisponível"; exit 2; }
if [ "${1:-}" != "--apply" ]; then
  echo "Prévia: $TARGET"
  echo "Para copiar a nota: bash scripts/sync-brain-wiki-harvest.sh --apply"
  exit 0
fi
mkdir -p "$(dirname "$TARGET")"
if [ -e "$TARGET" ]; then
  if cmp -s "$SRC" "$TARGET"; then echo "Nota já sincronizada"; exit 0; fi
  echo "Arquivo existente preservado; revise conflito"; exit 3
fi
cp -n "$SRC" "$TARGET"
echo "Nova nota adicionada ao Vault"
