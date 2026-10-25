#!/usr/bin/env bash
# Auditoria somente leitura. Não realiza chamadas de rede, não imprime env e não altera serviços.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
UP="$ROOT/vendor/deskcommcrm"
FAIL=0
check() {
  if [[ "$2" == "sim" ]]; then echo "[OK] $1"; else echo "[PENDENTE] $1"; FAIL=1; fi
}
check "Fonte Deskcomm obtida" "$(if [[ -f "$UP/package.json" && -f "$UP/LICENSE" ]]; then echo sim; else echo nao; fi)"
check "Configuração local criada" "$(if [[ -f "$UP/.env" ]]; then echo sim; else echo nao; fi)"
# As três comprovações abaixo exigem registro explícito local; nunca deduzir que produção = piloto.
PILOTO_AMBIENTE_ISOLADO="${PILOTO_AMBIENTE_ISOLADO:-nao}"
PILOTO_BANCO_SEPARADO="${PILOTO_BANCO_SEPARADO:-nao}"
PILOTO_WHATSAPP_QA_SEPARADO="${PILOTO_WHATSAPP_QA_SEPARADO:-nao}"
check "Ambiente isolado validado" "$PILOTO_AMBIENTE_ISOLADO"
check "Supabase/banco separado validado" "$PILOTO_BANCO_SEPARADO"
check "Canal WhatsApp QA separado validado" "$PILOTO_WHATSAPP_QA_SEPARADO"
if [[ "$FAIL" -ne 0 ]]; then
  echo "PILOTO NAO APTO A DEPLOY. Nenhuma alteração foi feita."
  exit 2
fi
echo "Pré-flight documental passou; isto NÃO substitui testes de integração, segurança ou operação."
