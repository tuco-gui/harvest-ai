#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
UPSTREAM="$ROOT/vendor/deskcommcrm"
if [[ ! -f "$UPSTREAM/package.json" ]]; then
  echo "[Harvest] Código upstream não encontrado. Inicializando submódulo fixado..."
  git -C "$ROOT" submodule update --init --recursive
fi
[[ -f "$UPSTREAM/package.json" && -f "$UPSTREAM/.env.example" ]] || { echo "Erro: upstream incompleto." >&2; exit 1; }
if [[ -e "$UPSTREAM/.env" ]]; then
  echo "Arquivo local .env já existe: nenhuma credencial/configuração foi modificada."
  exit 0
fi
cp "$UPSTREAM/.env.example" "$UPSTREAM/.env"
chmod 600 "$UPSTREAM/.env"
python3 - "$UPSTREAM/.env" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1])
keys={"APP_NAME":"Harvest AI","APP_ACCENT_HEX":"#C4191F","APP_LOGO_URL":""}
lines=p.read_text().splitlines()
found=set()
for i,line in enumerate(lines):
    if line.startswith("#") or "=" not in line:
        continue
    key,val=line.split("=",1)
    if key in keys:
        found.add(key)
        if not val.strip():
            lines[i]=key+"="+keys[key]
for key,val in keys.items():
    if key not in found: lines.append(key+"="+val)
p.write_text("\n".join(lines)+"\n")
PY
echo "Placeholders copiados com modo 0600 e nome Harvest AI. Nenhum serviço foi iniciado."
echo "Não preencher dados de produção; usar um Supabase isolado do piloto e QA próprio."
