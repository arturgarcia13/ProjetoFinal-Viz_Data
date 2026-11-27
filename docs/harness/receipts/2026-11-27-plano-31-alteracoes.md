# Recibo — Plano de 31 Alterações (H1–H6, Gráfico 7/H8, Gráfico 8/Limiar e Ato 5)

- **Data:** 2026-11-27
- **Commit inicial do ciclo:** `bd5fed7`
- **Último commit empurrado antes da Etapa 9:** `84a7649`

## O que mudou (Etapas 1 a 9)

1. **Gráfico 1 (`H1`):** `#legend-h1` oculta nos Passos 1–2; removidos callouts internos `addDirectAnnotation`; transição Passo 3 → 4 (`Registradas → Aptas`) com tween no mesmo `<svg>`; série `2022` fixa em `#4B636E`.
2. **Gráfico 2 (`H2` + `H2B`):** removidos pontilhados e `addDirectAnnotation`; setas terminando na borda dos círculos e coluna tabular alinhada; cores dedicadas por rótulo; zoom no eixo X (`[min−6%, max+6%]`); critério Top 10 explicitado; Passo 3 exclusivo `Composição 2022` e Passo 4 comparativo `2022 vs. 2026`.
3. **Gráfico 3 (`H3`):** escala 1:1 fixa `15%–65%` em toda a largura do card branco; *outliers* ancorados na borda; selo `Cota mínima (30%)`; rótulos dos 5 piores por distância em p.p.; `Geral → Federal` fluido no mesmo `<svg>`; legenda restrita ao tamanho das esferas.
4. **Gráfico 4 (`H4`):** Sankey 3 colunas `APTO`-only com corte em `1.000` votos e 4 destinos separados (`Fornecedores Compartilhados`, `Campanha Direta`, `Repasses a Candidaturas`, `Direção Partidária`), tooltips em todos os nós/faixas e remoção de `src/charts/h4Hubs.js`.
5. **Gráfico 5 (`H5`):** removidos `addDirectAnnotation`, modo *Slopegraph* e `#view-h5-group`.
6. **Gráfico 6 (`H6`):** removida referência a `≥ 2` sinais; universo `APTO`-only e definição explícita do Sinal C (`≥3` `APTO` mesma UF/partido com valor idêntico ao centavo); progressão 4 passos no mesmo `<svg>` (`2018 F → 2022 F → 2026 F → 2026 F+M`).
7. **Ato 4 (Gráficos 7 e 8):** removido `H7` (`#sec-h7`, `src/charts/h7Boxplot.js`); promovido `H8` como **Gráfico 7** animado `2018 → 2022 → 2026` sem `addDirectAnnotation`; convertido `#sec-limiar` (**Gráfico 8**) em **Slopegraph** com carga progressiva dos dados apenas ao entrar no respectivo passo.
8. **Ato 5 (`H9`):** removidas `.ato5-line-layer` / linhas pontilhadas dos 8 estados compactos; regra de empate na 5ª posição via `selectTopWithTies` (`RO` e `SE` `#5` com `21,9%` em `2022`); clareza explícita em **Concentração** (Top 10% do FEFC feminino); corrigido `lbl.g` para preservar `transform="translate(cx, cy)"` durante transições GSAP.
9. **Auditoria final:** atualizados `#boca-da-taca` (`Mulheres c/ Sinal A + B/C`), `#metodologia` em [public/index.html](../../public/index.html), [docs/guia_dos_graficos.md](../guia_dos_graficos.md), `syncH2UI` (Passo 1 `Baseline 2022` coerente em `src/main.js`), `tabindex` de barras ocultas em `src/charts/h8Temporal.js` e seta esquerda de *outlier* em `src/charts/h3Scatter.js`, após revisão adversarial em contexto frio.

## Evidências objetivas

- `npm run build:vercel` → `dist/app.js 302.0kb`, `site/` com `15` arquivos (`11.40 MB`)
- `./init.sh` → `18 passed in 18.08s`
- `E2E_ROOT=site node tests/e2e.mjs` → `E2E OK` (`stepDotsGroups: 9`, `h2RowsCount: 10`, `podiumCards: 26`, `leaderLines: 0`, `missingLblTransforms: 0`, `errors: []`, `overflowX: false`) + hover ao vivo nos cards Top 5 destacando a UF (`fillOpacity: "1"`, `stroke: "#142620"`, demais UFs `0.32`)
- Scroll ao vivo sem `?steps=full` → `{"errs":[],"h1Fill22":"#4B636E","lim0":2,"lim1":3,"lim2":4,"h9BadLbl":0}`

## Riscos residuais

- Em `2026`, `votacao_munzona_2026` no repositório é de `19/10/2026` (`232` candidaturas `APTO` ausentes recebem `0` votos por ausência de linha, documentado na interface e em `coverage.json`).
- Arquivo exploratório não rastreado pré-existente `data/definir_corte_de_votos_para_sankey.py` mantido fora dos commits.
