# Receipt — H1 Butterfly Chart, Configuração Vercel e Pipeline CI/CD

- **Data:** 2026-11-23
- **Commit inicial:** `80cba72`

## O que mudou
1. **Empacotamento estático para Vercel ([vercel.json](../../../vercel.json), [.vercelignore](../../../.vercelignore), [scripts/build-vercel.mjs](../../../scripts/build-vercel.mjs), [package.json](../../../package.json), [.gitignore](../../../.gitignore)):**
   - Adicionado `npm run build:vercel`, que gera o bundle `dist/app.js` via `esbuild` e copia somente os ativos de runtime (`index.html`, `styles.css`, `dist/app.js`, `assets/`, `data/`) para `site/` (10 arquivos, `7,56 MB`).
   - Movido `puppeteer` para `devDependencies` e configurado `installCommand: "npm ci --omit=dev"` no `vercel.json` para evitar download de Chromium nos builds da Vercel; adicionados cabeçalhos de cache e segurança.
   - Adicionado `.vercelignore` bloqueando CSVs brutos do TSE, `.venv/`, `etl/`, `tests/`, `docs/` e `receipts/`.
2. **CI/CD no GitHub Actions ([.github/workflows/ci-cd.yml](../../../.github/workflows/ci-cd.yml), [tests/e2e.mjs](../../../tests/e2e.mjs)):**
   - Job `ci`: executa `npm run build:vercel`, suíte `pytest` compatível com o ambiente sem os CSVs brutos (`test_harness.py`, `test_indicators.py`, seção documental de `test_data_plan.py`, invariantes sem CSV bruto de `test_etl.py`), checagem LGPD de `data/network_hubs.json` e E2E em Puppeteer sobre a raiz e sobre `E2E_ROOT=site`.
   - Job `deploy`: condicionado ao sucesso de `ci`; quando `VERCEL_TOKEN`, `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID` estão configurados, faz `vercel pull`, `vercel build` e `vercel deploy --prebuilt` (preview com comentário em PR; `--prod` em `master`) seguido de smoke test HTTP.
3. **Atualização H1 incluída nesta versão ([src/charts/h1Histogram.js](../../../src/charts/h1Histogram.js), [src/indicators.js](../../../src/indicators.js), [src/main.js](../../../src/main.js), [styles.css](../../../public/styles.css), [docs/guia_dos_graficos.md](../../guia_dos_graficos.md), [tests/test_indicators.py](../../../tests/test_indicators.py)):**
   - Histograma espelhado 2022 vs. 2026 com 5 faixas estratégicas, linha de 30% e alternância `Registradas` / `Aptas`.

## Evidência
- `npm run build:vercel`: `dist/app.js 400.4kb`, `Vercel output ready in site/: 10 files (7.56 MB)`.
- `E2E_ROOT=site node tests/e2e.mjs`: `E2E OK`, `errors: []`, `overlap: false`, `overflowX: false`.
- `./init.sh`: `16 passed in 20.37s`, exit `0`.

## Riscos residuais / Ação humana pendente
- Este ambiente não possui sessão Vercel autenticada (`vercel whoami` retornou `Logged out`, e `vercel deploy --temporary` exige OAuth no navegador). É necessário autenticar na Vercel (`npx vercel login && npx vercel link` ou importar o repositório no dashboard da Vercel) e configurar `VERCEL_TOKEN`, `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID` nos Secrets do GitHub para ativar o CD automático.
