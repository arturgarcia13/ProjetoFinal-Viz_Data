# Receipt — Organização do Repositório

- **Data:** 2026-11-25
- **Commit inicial:** `eecc226`

## O que mudou
1. **Limpeza de sobras e lixo local:**
   - Removida a pasta órfã `python/` (contendo apenas `__pycache__` do protótipo v1 arquivado), `660` arquivos `*:Zone.Identifier` e caches locais (`.pytest_cache/`, `__pycache__/`, `site/`).
2. **Centralização dos dados brutos do TSE (`data/raw/`):**
   - Movidas as 9 pastas brutas (`consulta_cand_*`, `prestacao_de_contas_eleitorais_candidatos_*`, `votacao-*`, ~45 GB) para `data/raw/`.
   - Atualizados [etl/config.py](../../../etl/config.py), [init.sh](../../../init.sh), [.gitignore](../../../.gitignore), [.vercelignore](../../../.vercelignore), [tests/test_data_plan.py](../../../tests/test_data_plan.py), [tests/test_etl.py](../../../tests/test_etl.py), [docs/plano_de_dados.md](../../plano_de_dados.md) e [README.md](../../../README.md).
3. **Separação da camada estática da web (`public/`):**
   - Movidos [public/index.html](../../../public/index.html), [public/styles.css](../../../public/styles.css) e `public/assets/` para `public/`.
   - Atualizados [scripts/build-vercel.mjs](../../../scripts/build-vercel.mjs) (copia apenas `public/`, `dist/app.js` e `data/*.json`, excluindo `data/raw/`), [package.json](../../../package.json) (`serve` e `dev`) e [tests/e2e.mjs](../../../tests/e2e.mjs) (servindo `public/` + `dist/` + `data/*.json` quando `E2E_ROOT` não está definido, e usando `scrollIntoView({ behavior: 'instant', block: 'center' })` antes do clique nos passos para evitar corrida com `scroll-behavior: smooth`).
4. **Agrupamento de documentação e harness (`docs/` e `docs/harness/`):**
   - Movida a proposta para [docs/proposta_projeto_final.md](../../proposta_projeto_final.md) e os artefatos de processo para `docs/harness/` ([SPEC.md](../SPEC.md), [progress.md](../progress.md), [feature_list.json](../feature_list.json) e `docs/harness/receipts/`).
   - Atualizado [tests/test_harness.py](../../../tests/test_harness.py) e corrigidos todos os links relativos em `docs/` e `README.md` (0 links quebrados).

## Evidência
- `npm run build:vercel`: `dist/app.js 417.3kb`, `Vercel output ready in site/: 10 files (7.58 MB)` (sem `data/raw/`).
- `./init.sh`: `17 passed in 33.53s`, exit `0`.
- `E2E_ROOT=site node tests/e2e.mjs`: `E2E OK`, `errors: []`, `overlap: false`, `overflowX: false`.

## Riscos residuais
- Nenhum bloqueador identificado. A suíte de CI no GitHub Actions continuará operando sem os CSVs brutos via `npm run build:vercel`, `pytest` filtrado e E2E tanto no modo raiz quanto em `E2E_ROOT=site`.
