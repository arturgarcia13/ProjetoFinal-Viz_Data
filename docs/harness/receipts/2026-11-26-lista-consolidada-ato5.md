# Receipt — Lista Consolidada de Alterações + Ato 5 "Onde a Cota Vira Voto"

- **Data:** 2026-11-26
- **Commit base:** `55b5272`
- **Escopo alterado:** `public/index.html`, `public/styles.css`, `src/main.js`, `src/indicators.js`, `src/components/scrolly.js`, `src/charts/{h1Histogram,h2Dumbbell,h3Scatter,h4Hubs,h6Signals,h6ThresholdCompare,h9MapAndParallel}.js`, `tests/{test_indicators.py,e2e.mjs}`, `docs/harness/progress.md`.

## O que mudou
1. **Ato 1 (`H1`):** título e texto narrativo atualizados; ordem alterada para **Todas Registradas** primeiro com transição automática para **Aptas** ao entrar no passo 3; destaque às chapas `< 30%` em 2022 e 2026; reset automático do filtro ao sair da etapa/tela do passo 3. Mantidos capa atual e corte `n ≥ 4`.
2. **Ato 2 (`H2`, `H3`, `H4`):** título do Ato 2 atualizado para **"A barreira invisível do orçamento"**; `H2` com distinção cromática clara entre **Fundo Público** (`#007D5B`) e **Recursos Privados** (`#F8DF4F`/`#C98A00`) para todos os partidos e sem sobreposição de rótulos; `H3` sem zoom (escala fixa), título atualizado e rótulos apenas nas legendas `< Y=X`; passo 3 de `H4` (Hubs) sinalizado para remoção futura.
3. **Ato 4 (`H6` + `#sec-limiar` + `H7`/`H8` sinalizados):** `H6` consolidado em gráfico único de sinais (A, B, C e `≥2` sinais para F vs. M) com registro formal **Inconclusivo**; adicionado comparativo `30%–33%` vs. `>33%` (excluindo `<30%`) nas 4 dimensões com alternador **`Por Chapa | Por Partido`**; `H7` e `H8` mantidos com sinalização explícita de remoção na próxima etapa.
4. **Ato 5 (`H9` → "Onde a Cota Vira Voto"):** *scrollytelling* geográfico em 5 passos com dados reais do TSE (`2018`, `2022`, `2026` × `Todos`, `Dep. Estadual`, `Dep. Federal`), contorno real (`data/br_uf.json`), anéis dourados acumulativos (`★1/4`–`★4/4`), 8 callouts laterais com *leader lines*, mini-cards Top 5 clicáveis, Síntese de Causa e Efeito e tooltip unificado no design system atual.

## Evidências executadas
- `npm run build:vercel` → `dist/app.js 416.0kb`, `site/` (15 arquivos / `11.51 MB`)
- `.venv/bin/python -m pytest -v` → `17 passed in 18.64s`
- `E2E_ROOT=site node tests/e2e.mjs` → `E2E OK`, `errors: []`, `overflowX: false` (`1280×820` e `390×844`), `h2RowsCount: 10`, `h9Check: { ufPaths: 27, compactCallouts: 8, stepsCount: 5, navPills: 5, hasSynthesis: true, podiumCards: 25 }`
- Rolagem ao vivo sem `?steps=full` → `initialH1: "reg"`, `afterEnterStep3: "apto"`, `chipVisible: true`, `chipHiddenAfterExit: true`, `ato5Pill: "Passo 5/5 · Mulheres Eleitas"`, `ato5GoldRings: 16`, `errors: []`

## Riscos residuais e próximos passos
- Itens explicitamente mantidos para decisão na próxima etapa: remoção definitiva de `H7`, `H8` e `H4 Hubs`; escolha entre `Por Chapa` e `Por Partido` no comparativo `30%–33%` vs. `>33%`; reforma visual da capa e revisão global de cópia restante.
- Alterações permanecem no working tree local (sem commit/`git push`).
