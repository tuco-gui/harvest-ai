#!/usr/bin/env python3
"""Gera o workflow do n8n a partir de painel/index.html + do JSON base.

  python3 scripts/build-workflow.py            -> n8n/prospecta-ia.json (placeholders, versionado)
  python3 scripts/build-workflow.py --local    -> .local/prospecta-ia.local.json (URLs reais do .env)

O painel é a fonte da verdade: fica em painel/index.html e é injetado no nó HTML.
As URLs sensíveis viram placeholders __NOME__ no arquivo versionado.
"""
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / "n8n" / "prospecta-ia.json"
PAINEL = ROOT / "painel" / "index.html"

PLACEHOLDERS = ["SUPABASE_URL", "EVOLUTION_URL", "EVOLUTION_INSTANCE"]


def load_env():
    env = {}
    path = ROOT / ".env"
    if not path.exists():
        sys.exit(".env não encontrado — copie .env.example e preencha.")
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def main():
    local = "--local" in sys.argv
    wf = json.loads(BASE.read_text(encoding="utf-8"))

    # painel/index.html é a fonte da verdade do nó HTML
    painel = PAINEL.read_text(encoding="utf-8")
    for node in wf["nodes"]:
        if node["name"] == "HTML":
            node["parameters"]["html"] = painel

    out = json.dumps(wf, ensure_ascii=False, indent=2)

    if local:
        env = load_env()
        missing = [k for k in PLACEHOLDERS if not env.get(k)]
        if missing:
            sys.exit("faltando no .env: " + ", ".join(missing))
        for key in PLACEHOLDERS:
            out = out.replace(f"__{key}__", env[key])
        dest = ROOT / ".local" / "prospecta-ia.local.json"
        dest.parent.mkdir(exist_ok=True)
    else:
        dest = BASE
        restantes = set(re.findall(r"__([A-Z_]+)__", out))
        desconhecidos = restantes - set(PLACEHOLDERS)
        if desconhecidos:
            sys.exit("placeholder desconhecido: " + ", ".join(sorted(desconhecidos)))

    dest.write_text(out, encoding="utf-8")
    print(f"gerado: {dest.relative_to(ROOT)} ({len(out)} bytes)")


if __name__ == "__main__":
    main()
