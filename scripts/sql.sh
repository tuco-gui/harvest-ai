#!/usr/bin/env bash
# Roda SQL no Supabase self-hosted pelo endpoint do Studio (pg-meta).
#
#   ./scripts/sql.sh "select 1"
#   ./scripts/sql.sh -f arquivo.sql
#
# Lê SUPABASE_URL, SUPABASE_STUDIO_USER e SUPABASE_STUDIO_PASSWORD do .env.
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f .env ] || { echo "sem .env" >&2; exit 1; }
set -a; source .env; set +a

if [ "${1:-}" = "-f" ]; then
  sql=$(cat "$2")
else
  sql="${1:?uso: sql.sh \"SELECT ...\" | sql.sh -f arquivo.sql}"
fi

body=$(jq -Rs '{query: .}' <<<"$sql")

curl -sS --max-time 120 \
  -u "${SUPABASE_STUDIO_USER}:${SUPABASE_STUDIO_PASSWORD}" \
  -X POST "${SUPABASE_URL}/api/platform/pg-meta/default/query" \
  -H "Content-Type: application/json" \
  --data-binary "$body"
