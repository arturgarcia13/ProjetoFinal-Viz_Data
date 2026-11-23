# Progress & Harness Contract

## Commands
- Install Python deps: `uv pip install --python .venv/bin/python -r etl/requirements.txt` (atual: `duckdb`, `pytest`, `pypdf`, `numpy`, `matplotlib`)
- Install JS deps: `npm install`
- Single test file: `.venv/bin/python -m pytest tests/<arquivo>.py -v`
- Full Python test suite: `.venv/bin/python -m pytest -v`
- Frontend build: `npm run build`
- End-to-end check: `node tests/e2e.mjs`
- Environment sanity check: `./init.sh`

---

## 1. Task Contract
- **Outcome:** Recriar o projeto final de Visualização de Dados conforme [SPEC.md](SPEC.md) e [Proposta do Projeto Final.md](Proposta%20do%20Projeto%20Final.md), entregando: (1) Plano de Dados e Regras de Limpeza; (2) Pipeline ETL Python reprodutível, Base Analítica Validada de 2022 e Relatório de Cobertura por Fonte; (3) Indicadores auditáveis H1–H9 e visualizações em Observable Plot + D3.js; (4) SPA *Scrollytelling* split-screen nos 5 atos com filtros globais e testes automatizados.
- **Scope & Non-goals:**
  - *In-scope:* Deputado Federal e Estadual (27 UFs); 2022 como âncora, 2018 e 2026 como comparações condicionais; arquivos em `docs/`, `etl/`, `tests/`, `data/`, `src/`, `index.html`, `styles.css`, `receipts/`.
  - *Non-goals:* Deputado Distrital; exibição de nomes/CPFs de candidatos; deploy em servidor remoto antes da revisão final (28–30/nov); alteração dos CSVs brutos do TSE.
- **Acceptance Evidence:**
  - `./init.sh` sai com código 0.
  - `.venv/bin/python -m pytest -v` passa integralmente após cada alteração no ETL ou nos indicadores.
  - `docs/plano_de_dados.md` e `docs/relatorio_cobertura_2022.md` gerados e consistentes com os CSVs reais do TSE.
  - `npm run build` gera bundle sem erros e verificação E2E em navegador (Puppeteer) percorre os 5 atos e filtros sem erros de console.
- **Actions Needing Human Approval:**
  - Alterar regras metodológicas fechadas em `SPEC.md` (ex.: corte `n >= 4`, exclusão de Distrital, critério `APTO` vs. `INAPTO`).
  - Fazer `git push` ou publicar em ambiente externo.
  - Aceitar desvios relevantes caso alguma fonte de 2026 esteja estruturalmente incompatível.
- **Iteration Ceiling & Retry Budget:**
  - Máximo de 3 tentativas de reparo por falha idêntica; se persistir, registrar bloqueio em `progress.md` e parar para decisão humana.

---

## 2. Checklist de Entregáveis (`feature_list.json`)

| ID | Unidade | Entregável | Status |
| :--- | :--- | :--- | :--- |
| F01 | U0 | Harness, preservação `archive/prototipo-v1` e `./init.sh` | Concluído (`./init.sh` -> 3 passed, 0.07s) |
| F02 | U1 | `docs/plano_de_dados.md` (22–26/out) | Concluído (`pytest` 5 passed; colunas 2022 validadas) |
| F03 | U2 | Pipeline ETL Python + Base validada 2022 (27/out–02/nov) | Concluído (`10 passed`; dif. 0 em votos e R$ 0,00 em receita/FEFC/despesa) |
| F04 | U2 | Relatório de cobertura por fonte (`docs/relatorio_cobertura_2022.md`) | Concluído (`97,1%` FINAL em 2022; `97,9%` FINAL em 2026 atualizado) |
| F05 | U3 | Indicadores auditáveis H1–H5 + testes unitários (03–09/nov) | Concluído (`test_indicators.py` 2 passed; 12 total passed) |
| F06 | U3 | 3 gráficos básicos reais (H1, H3, H5) em Observable Plot / D3 | Concluído (`esbuild` 293.7kb + Puppeteer 0 erros) |
| F07 | U4 | Gráficos de financiamento e sinais H2, H4, H6–H8 + estados Inconclusivo (10–16/nov) | Concluído (`13 passed`; Puppeteer 0 erros) |
| F08 | U4 | Mapa por UF (H7/H9) e Coordenadas Paralelas (Ato 5) (10–16/nov) | Concluído (27 UFs + brushY testados) |
| F09 | U5 | SPA Scrollytelling split-screen nos 5 atos + filtros globais + selos (17–23/nov) | Concluído (`npm run build` 373.2kb; 5 atos + 9 passos integrados) |
| F10 | U5 | Verificação E2E no navegador (Puppeteer) + revisão metodológica (17–23/nov) | Concluído (`pytest` 15 passed incl. `tests/e2e.mjs`; revisor adversarial aprovou) |

---

## 3. Current State & Decisions Log
- **2026-11-20 (U0):**
  - Protótipo anterior salvo na branch `archive/prototipo-v1` (commit `99b0446`, tag `prototipo-v1`).
  - `master` limpa dos arquivos do protótipo antigo, mantendo `Proposta do Projeto Final.md`, `package.json`, `assets/` e `data/br_uf.json`.
  - Decisões fechadas com o usuário: Federal + Estadual apenas (sem Distrital); Observable Plot + D3.js; Coordenadas Paralelas no Ato 5; tratamento de `APTO` vs. `INAPTO` por etapa; corte `n >= 4` apenas em H1/H7 mantendo todas as 244 candidaturas de micro-chapas nos totais individuais.
- **2026-11-20 (U1 — refinamento de recorte):**
  - Usuário definiu **2022** como baseline principal, **2026** como comparativo direto (mesmo regime de federações) e **2018** apenas como referência auxiliar opcional.
  - Descoberto byte `0x88` (`cp1252`) na linha 152.967 de `despesas_contratadas_candidatos_2026_BRASIL.csv` (extrato de 21/10/2026; linha 639.117 no extrato atualizado de 20/11/2026); Plano de Dados atualizado para leitura `cp1252`.
  - Verificado pelo calendário TSE 2026 que prazos finais de prestação de contas encerraram em 03/11 (1º turno) e 16/11 (2º turno); extração atual no repo é de 21/10/2026 (5,8% `FINAL` em receitas).

- **2026-11-20 (U2 — ETL, Base 2022/2026 e Relatório de Cobertura):**
  - Usuário atualizou os arquivos brutos de 2026 (`DT_GERACAO = 20/11/2026` em `consulta_cand`, `receitas` e `despesas_contratadas`; `votacao_2026` de `19/10/2026`).
  - Implementado pipeline DuckDB em passada única (`etl/config.py`, `etl/build_dataset.py`, `etl/report_coverage.py`) gerando `data/analytical_base.json` (6,6 MB), `data/network_hubs.json` (203 KB), `data/coverage.json` (5,7 KB) e `docs/relatorio_cobertura_2022.md`.
  - Cobertura `FINAL` entre candidaturas `APTO`: **97,1%** em 2022 (`24.005` de `24.733`) e **97,9%** em 2026 (`17.341` de `17.712`), tornando **2026 comparável diretamente com 2022** em todos os eixos (com ressalva de que contas 2026 aguardam julgamento judicial e `votacao_2026` é de 19/10/2026, com match de 98,7% sobre `APTO`).
  - Sanidade verificada em `pytest` (`10 passed in 0.61s`): diferença `0` em votos e `R$ 0,00` em receita total, FEFC e despesa efetiva para 2022 e 2026; zero PII exportada.

- **2026-11-20 (U4 — Visões Especiais, Sinais H6–H8, Mapa UF e Coordenadas Paralelas):**
  - Implementados indicadores `computeH6`, `computeH7`, `computeH8`, `computeH9AndParallel` em `src/indicators.js` com estado `Inconclusivo` explícito para amostras insuficientes.
  - Descoberta empírica relevante em H8: entre 2022 e 2026, contas zeradas declaradas caíram (`5,5% → 4,5%`), enquanto movimentações padronizadas em lote subiram (`35,6% → 39,0%`). Em H7, chapas no piso (`30%–33,3%`) registram `3,4%` de mulheres com ≥2 sinais vs. `0,9%` em chapas `>40%`.
  - Implementadas todas as visualizações especiais (`src/charts/h2Dumbbell.js`, `h4SankeyNetwork.js`, `h6Signals.js`, `h7Boxplot.js`, `h8Temporal.js`, `h9MapAndParallel.js`), mapeando `data/br_uf.json` via `IBGE_TO_UF` (`codarea`).

- **2026-11-20 (U5 — Auditoria Independente Final em Contexto Frio):**
  - Subagente auditor sem contexto (`955d51f8`) analisou todo o repositório, identificou 7 defeitos iniciais (CPFs de MEI em 7 hubs de `network_hubs.json`, click-to-filter quebrado em H2/H3/H5, partidos de 2026 ausentes no dropdown, brush H9, amostra mínima H4, colisão mobile e label H6) e depois 1 pendência de sobreposição sticky desktop em H9 + 3px em H6 mobile.
  - Todos os pontos foram corrigidos, `tests/e2e.mjs` e `tests/test_etl.py` reforçados, e o auditor concluiu **`APROVADO SEM ERROS`** (`./init.sh` → `15 passed`, `ERRORS: []` em `1280×820` e `390×844`, observando apenas `-4px` cosmético em `REPUBLICANOS` no eixo Y de H2 a `390px`).

- **2026-11-21 (Auditoria Independente dos Relatórios — A01–A08):**
  - Subagente auditor dedicado (`report-auditor`, contexto frio, somente leitura) auditou `docs/plano_de_dados.md`, `docs/relatorio_cobertura_2022.md`, os 7 arquivos em `receipts/` e a consistência cruzada com CSVs brutos do TSE, `data/*.json`, `etl/`, `src/` e `git log` (reconciliação numérica 100% confirmada; 8 achados A01–A08 identificados).
  - Todos os achados foram corrigidos: anonimização adicional em `etl/build_dataset.py` para fornecedores individuais coincidentes com `NM_CANDIDATO` (`H2022_116`) e 4 MEIs pós-2022 (`^\d{2}\.\d{3}\.\d{3}\s+`), com invariante em `tests/test_etl.py`; `cid` embaralhado deterministicamente via `md5`; bloco `inapto_impact` e `DT_GERACAO` de `doador_originario` incluídos em `data/coverage.json` e `docs/relatorio_cobertura_2022.md`; `docs/plano_de_dados.md` alinhado ao ETL (Sinal C por `(UF, partido)` entre `APTO` e fornecedores `EXT`, `cid`, `DOUBLE`, linha `639.117`); criado `etl/requirements.txt`; corrigidos os 70 links relativos em `receipts/*.md`, `DONATION_DRD_CODES` não utilizada e cabeçalho de `src/indicators.js`.

- **2026-11-23 (H1 — Histograma Espelhado / Butterfly Chart 2022 vs. 2026 simplificado):**
  - Substituído o histograma simples de H1 (`src/charts/h1Histogram.js`) por um **Histograma Espelhado (Butterfly Chart)** enxuto com 5 faixas estratégicas (`< 30%`, `30%–33,3%`, `33,4%–39%`, `40%–49%`, `50%+`), 1 barra limpa por ano (2022 à esquerda com eixo invertido; 2026 à direita), linha horizontal divisória de `30%`, escalas rigorosamente simétricas e travadas entre os modos `Registradas` e `Aptas` (evitando a ambiguidade visual da migração de chapas entre faixas por inaptidão), exibição em `%` (sem alternador `%`/`N`), 1 único rótulo por barra e tooltip comparativo único no hover exibindo apenas a proporção e `Δ 22→26` em p.p. (sem tooltip nativo `<title>` duplicado e sem linha de número absoluto), mantendo integralmente a paleta e a stack D3.js do projeto.
  - Cobertura de testes atualizada em `tests/test_indicators.py` (`test_h1_mirror_comparison_bins_partition_and_totals`) e `tests/e2e.mjs` (5 faixas, simetria das escalas, linha 30%, hover comparativo sem linha absoluta, ausência do botão `N` e alternância `Registradas`/`Aptas`).

- **2026-11-23 (Deploy Vercel + Pipeline CI/CD para testes):**
  - Configurado build estático isolado em `site/` (`scripts/build-vercel.mjs` + script `build:vercel` em `package.json`, empacotando apenas `index.html`, `styles.css`, `dist/app.js`, `assets/` e `data/` = 10 arquivos / `7,56 MB`), movido `puppeteer` para `devDependencies` (`npm ci --omit=dev` na Vercel), e adicionados `vercel.json` (com `"framework": null` para impedir detecção automática de Python pela presença de `etl/` e `tests/`) e `.vercelignore` (garantindo exclusão dos CSVs brutos do TSE, `.venv/`, `etl/`, `tests/` e docs internos).
  - Adicionado workflow `.github/workflows/ci-cd.yml` com job `ci` (build `site/`, testes Python sem CSVs brutos, validação LGPD de `network_hubs.json` e Puppeteer E2E tanto na raiz quanto em `E2E_ROOT=site`) e job `deploy` na Vercel (preview em PRs com comentário automático e produção/testes em `master` via `VERCEL_TOKEN`, `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID`).
  - Integração GitHub–Vercel conectada pelo usuário (`artur-garcias-projects/viz-data`) e deploy concluído após ajuste de `"framework": null` (`abc99e3`, CI `45205362606` verde).

- **2026-11-23 (Padronização do hover/tooltip H1 em todos os gráficos):**
  - Extraído utilitário compartilhado [src/charts/tooltip.js](src/charts/tooltip.js) (`createChartTooltip`, `buildTooltipCard`, `bindTooltipEvents`, formatadores pt-BR) e classes unificadas em [styles.css](styles.css) (`.chart-wrap`, `.chart-tooltip`, `.chart-tip-head`, `.chart-tip-status`, `.chart-tip-table`, `.chart-tip-hint`, `.is-hovered`) seguindo exatamente o card flutuante de H1 (fundo papel `--surface`, borda superior `--accent` de 3px, pílula de status, tabela `tabular-nums` e posicionamento clamped dentro do container).
  - Removidos tooltips nativos `<title>` e `tip: true` do Observable Plot em todos os gráficos (`h1Histogram.js`–`h9MapAndParallel.js`), incluindo ambos os gráficos de H2, Sankey e Rede em H4, caixas/pontos/outliers em H7, comparativo 2022×2026 em H8 e Mapa UF + Coordenadas Paralelas em H9.
  - Ampliado [tests/e2e.mjs](tests/e2e.mjs) com `assertUnifiedHover` cobrindo todas as 9 visualizações (`H1`–`H9`), garantindo ausência de `<title>`/`g[aria-label="tip"]` e abertura do card dentro da área visível; `./init.sh` (`16 passed`) e `E2E_ROOT=site node tests/e2e.mjs` verdes.

## 4. Open Risks & Questions
- Em 2026, `votacao_munzona_2026` no repositório é de `19/10/2026` (`232` candidaturas `APTO` ausentes recebem `0` votos por ausência de linha, explicitado no Plano de Dados e na interface). Se uma nova extração de `votacao_2026` for baixada posteriormente, basta rodar `.venv/bin/python -m etl.build_dataset && npm run build`.

## 5. Next Action
1. Fazer `git push origin master` quando desejar publicar os tooltips padronizados na Vercel (o pipeline CI/CD e a integração Vercel atualizarão automaticamente a URL de testes).
2. Seguir na janela **24–27/nov** com inspeção visual na URL publicada, validação cruzada pontual com o DivulgaCandContas/TSE e ajustes finais (28–30/nov).
