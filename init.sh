#!/usr/bin/env bash
set -euo pipefail

echo "=== Harness Environment Sanity Check ==="

command -v git >/dev/null
command -v node >/dev/null
command -v npm >/dev/null
test -x .venv/bin/python

git rev-parse --verify archive/prototipo-v1 >/dev/null
git rev-parse --verify prototipo-v1 >/dev/null

for d in consulta_cand_2018 consulta_cand_2022 consulta_cand_2026 votacao-2018 votacao-2022 votacao-2026 prestacao_de_contas_eleitorais_candidatos_2018 prestacao_de_contas_eleitorais_candidatos_2022 prestacao_de_contas_eleitorais_candidatos_2026; do
  test -d "$d" || { echo "Missing raw TSE dir: $d"; exit 1; }
done

test -f "Proposta do Projeto Final.md"
test -f "SPEC.md"
test -f "progress.md"
test -f "feature_list.json"
test -f "data/br_uf.json"

.venv/bin/python -m pytest -q
echo "=== OK: environment ready ==="
