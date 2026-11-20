# Progress & Harness Contract

## Commands
- Install Python deps: `uv pip install --python .venv/bin/python -r etl/requirements.txt` (atual: `pytest`, `pypdf`, `numpy`, `matplotlib`)
- Install JS deps: `npm install`
- Single test file: `.venv/bin/python -m pytest tests/<arquivo>.py -v`
- Full Python test suite: `.venv/bin/python -m pytest -v`
- Frontend build: `npm run build`
- End-to-end check: `node tests/e2e.mjs` (a criar na U5)
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
| F03 | U2 | Pipeline ETL Python + Base validada 2022 (27/out–02/nov) | Pendente |
| F04 | U2 | Relatório de cobertura por fonte (`docs/relatorio_cobertura_2022.md`) | Pendente |
| F05 | U3 | Indicadores auditáveis H1–H5 + testes unitários (03–09/nov) | Pendente |
| F06 | U3 | 3 gráficos básicos reais (H1, H3, H5) em Observable Plot / D3 | Pendente |
| F07 | U4 | Gráficos de financiamento e sinais H2, H4, H6–H8 + estados Inconclusivo (10–16/nov) | Pendente |
| F08 | U4 | Mapa por UF (H7/H9) e Coordenadas Paralelas (Ato 5) (10–16/nov) | Pendente |
| F09 | U5 | SPA Scrollytelling split-screen nos 5 atos + filtros globais + selos (17–23/nov) | Pendente |
| F10 | U5 | Verificação E2E no navegador (Puppeteer) + revisão metodológica (17–23/nov) | Pendente |

---

## 3. Current State & Decisions Log
- **2026-11-20 (U0):**
  - Protótipo anterior salvo na branch `archive/prototipo-v1` (commit `99b0446`, tag `prototipo-v1`).
  - `master` limpa dos arquivos do protótipo antigo, mantendo `Proposta do Projeto Final.md`, `package.json`, `assets/` e `data/br_uf.json`.
  - Decisões fechadas com o usuário: Federal + Estadual apenas (sem Distrital); Observable Plot + D3.js; Coordenadas Paralelas no Ato 5; tratamento de `APTO` vs. `INAPTO` por etapa; corte `n >= 4` apenas em H1/H7 mantendo todas as 244 candidaturas de micro-chapas nos totais individuais.
- **2026-11-20 (U1 — refinamento de recorte):**
  - Usuário definiu **2022** como baseline principal, **2026** como comparativo direto (mesmo regime de federações) e **2018** apenas como referência auxiliar opcional.
  - Descoberto byte `0x88` (`cp1252`) na linha 152.967 de `despesas_contratadas_candidatos_2026_BRASIL.csv`; Plano de Dados atualizado para leitura `cp1252`.
  - Verificado pelo calendário TSE 2026 que prazos finais de prestação de contas encerraram em 03/11 (1º turno) e 16/11 (2º turno); extração atual no repo é de 21/10/2026 (5,8% `FINAL` em receitas).

## 4. Open Risks & Questions
- Conferir na U2 se `receitas_2018` ou `despesas_2018/2022` possuem sobreposição de `TP_PRESTACAO_CONTAS` por candidato e medir a taxa exata de casamento entre `receitas` e `doador_originario`.

## 5. Next Action
1. Iniciar **U2 (F03 + F04 — Entregável 27/out–02/nov)**: implementar pipeline ETL em `etl/` com DuckDB gerando a base analítica validada de 2022 (e recortes condicionais 2018/2026) + `docs/relatorio_cobertura_2022.md` + testes `pytest` de integridade e não-duplicação.
