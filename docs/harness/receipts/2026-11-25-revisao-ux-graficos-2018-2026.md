# Receipt — 2026-11-25 — Revisão Geral UX, Paleta Semântica, Série 2018–2026 e Auditoria Sênior Quadro a Quadro

- **Commit inicial:** `e9d9ca4`
- **Objetivo:** Concluir todas as alterações aprovadas de UX, paleta semântica, visões coordenadas, ETL `2018–2026` e refatoração `H1`–`H9`, seguido de loop iterativo Sênior em Visualização de Dados (Auditor Cético → Planejador → Executor, referências FT / NYT Upshot / The Pudding / The Economist) até aprovação rigorosa quadro a quadro em desktop (`1440×900` / `1280×820`) e mobile (`390×844`), dentro do escopo de [proposta_projeto_final.md](../../proposta_projeto_final.md) e [DESIGN-SYSTEM.md](../../DESIGN-SYSTEM.md).

## O que mudou
- **ETL & Cobertura `2018–2026` ([etl/config.py](../../../etl/config.py), [etl/report_coverage.py](../../../etl/report_coverage.py), [src/data.js](../../../src/data.js)):**
  - Integração de `2018` em [analytical_base.json](../../../data/analytical_base.json) (`73.045` registros entre `2018`, `2022` e `2026`, `0` PII), regeneração de [coverage.json](../../../data/coverage.json) e [relatorio_cobertura_2022.md](../../relatorio_cobertura_2022.md); remoção do `fetch('data/network_hubs.json')` preservando o arquivo em disco para o CI.
- **UX Editorial Fluida, Paleta Semântica & Visões Coordenadas ([public/index.html](../../../public/index.html), [public/styles.css](../../../public/styles.css), [src/main.js](../../../src/main.js), [palette.js](../../../src/charts/palette.js)):**
  - Remoção do `#escala` (`scaleMosaic.js`), `reactiveStage.js`, `scrollyContainer.js`, funções mortas de [indicators.js](../../../src/indicators.js) e CSS órfão; adoção de fluxo editorial vertical fluido com barra superior `58px` + chips ativos e controles locais nos gráficos.
  - Transformação da faixa de Big Numbers em **funil de 3 passos** (`1. No Papel → 2. No Dinheiro → 3. Na Urna`), **Takeaway Headlines dinâmicas** (`#title-h1`..`#title-h9`), redução de ~45% da prosa lateral redundante e cartões de evidência interativos (`#ev-h1`, `#ev-h2`, `#ev-h5`).
  - Paleta semântica única sem reuso de cores (`#FF7AE5` Mulheres, `#FCE34D` Homens, `#FF5E2B` Alerta/Déficit, `#00D09C` Cota respeitada, Branco/Ciano/Gelo por ano), clique reversível e sincronização de `H1` (`Registradas ↔ Aptas`) e `H9` (seletor do mapa ↔ ordenação da matriz).
- **Visualizações `H1`–`H9` & Rigor Geométrico (`src/charts/`, [guia_dos_graficos.md](../../guia_dos_graficos.md), [tests/e2e.mjs](../../../tests/e2e.mjs)):**
  - **H1** com anotações diretas desktop (`Faixas ≥ 40%` e `Teto −11,9 p.p.`); **H2** dumbbell `2022 → 2026` ordenado pelo gap de 2026 com setas direcionais e callout `UNIÃO`; **H2B** com folga proporcional (`pad 0.64`) em `390px` e `0` colisão barra×rótulo; **H3** em escala linear fixa no modo foco com quadrantes, rótulo diagonal adaptativo, repulsão AABB + grid determinística e `0` colisão texto×círculo em `1280px` e `390px`; **H4** Sankey 100% entre mulheres (`% eleitas`); **H5** barras horizontais ordenadas por `% eleitas` com faixa global; **H6/H7/H8** com série `2018 → 2022 → 2026` (`ADI 5617 + Súmula 73`, stagger vertical determinístico); **H9** com legenda contínua, botões de extremos e `.h9-clear-bar`/`.h9-scroll-hint`.

## Suposições Adotadas
1. **Inspeção sobre `site/` equivalente à Vercel:** respeitando a regra contra `git push` sem sign-off humano, a inspeção quadro a quadro rodou sobre o build estático `site/` idêntico ao deploy da Vercel.
2. **Escopo & Design System:** mantidos estritamente os 5 atos de [proposta_projeto_final.md](../../proposta_projeto_final.md) (Federal + Estadual, sem PII) e o visual flat sem itálico (`Anton` + `Barlow`) de [DESIGN-SYSTEM.md](../../DESIGN-SYSTEM.md).
3. **Universo P90 em H2 (`UNIÃO` 2026):** calculado sobre `c.apto && c.hasRec` (`R$ 2,70M` homens vs. `R$ 1,65M` mulheres), alinhado a `computeH2`.
4. **`data/network_hubs.json`:** preservado em disco para checagens de LGPD no CI, sem uso pelo frontend.

## Evidências de Verificação (pós-última edição de código)
- `npm run build:vercel` → `dist/app.js 234.3kb`, `site/` com `13` arquivos (`11.27 MB`).
- `./init.sh` → `16 passed in 18.04s` (`pytest`: ETL, cobertura, indicadores, harness e E2E).
- `E2E_ROOT=site node tests/e2e.mjs` → `E2E OK` (`errors: []`, `overflowX: false`, `h2bDeskBarLabelHits: []`, `h2bMobBarLabelHits: []`, `h3Check.overlaps: 0`, `textCircleHits: []`, `mobIssues: {}`).
- **Auditoria Cética Sênior (`research`, `09dc7e8a`, Rodada 3):** **`APROVADO`** — Clareza 5s **`9,5/10`** · Tipografia/Legibilidade **`9,4/10`** · UX/Visões Coordenadas **`9,5/10`** · Fidelidade/LGPD/Higiene **`9,6/10`** (**Média ponderada `9,49/10`**; evoluindo de `R1 8,75` → `R2 9,01` → `R3 9,49`).

## Riscos Residuais
- Extração de `votacao_2026` no repositório é de `19/10/2026` (`232` `APTO` com `0` votos por ausência de linha, explicitado na UI e em [plano_de_dados.md](../../plano_de_dados.md)).
- Alterações consolidadas em commit local em `master`; publicação em `https://viz-data-phi.vercel.app` aguarda `git push` aprovado pelo usuário.
