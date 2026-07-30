#!/usr/bin/env python3
"""Injeta painel/index.html no nó HTML do workflow.

    python3 scripts/build-workflow.py

O painel é a fonte da verdade: edite painel/index.html, rode isso e reimporte
n8n/prospecta-ia.json. Editar o HTML dentro do n8n faz o repo e a produção divergirem.

Não há segredo nenhum no JSON — chaves da SerpAPI e da Evolution são preenchidas
pelo usuário na tela de configuração do painel; o Supabase usa credencial do n8n.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WF = ROOT / "n8n" / "prospecta-ia.json"
PAINEL = ROOT / "painel" / "index.html"

wf = json.loads(WF.read_text(encoding="utf-8"))
for node in wf["nodes"]:
    if node["name"] == "HTML":
        node["parameters"]["html"] = PAINEL.read_text(encoding="utf-8")

WF.write_text(json.dumps(wf, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"painel injetado em {WF.relative_to(ROOT)}")
