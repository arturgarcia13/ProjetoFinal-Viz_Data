# Receipt — 2026-11-25 — Aplicação do UX System de Scrollytelling (Ref. The Pudding)

- **Commit inicial:** `95b998e`
- **Escopo:** Aplicação de [UX-SYSTEM.md](../../UX-SYSTEM.md) preservando integralmente o Brandbook flat ([DESIGN-SYSTEM.md](../../DESIGN-SYSTEM.md)) e o escopo metodológico/LGPD ([SPEC.md](../SPEC.md)).

## O que mudou
- **Indicadores auditáveis ([src/indicators.js](../../../src/indicators.js)):** adicionadas `computeScaleMosaic` (amostra proporcional de até 48 chapas `n ≥ 4` + 4 casos emblemáticos em Pull-Out) e `computeDivergentDisparity` (disparidade relativa `log2` ancorada em `Igual (1×)` com teto `15×`), além de suporte a filtro de *brush* (`parties`, `ufs`) em `computeH8`.
- **Componentes desacoplados (`src/components/`):**
  - `ChapterNav` ([chapterNav.js](../../../src/components/chapterNav.js)): navegação hierárquica em 2 camadas, menu `popover` de acesso direto aos gráficos com fallback progressivo e abertura automática de `<details>` via `.method-escape`.
  - `ScrollyContainer` ([scrollyContainer.js](../../../src/components/scrollyContainer.js)): observação passiva via `IntersectionObserver` (sem *scroll hijacking*) e suporte a `prefers-reduced-motion`.
  - `ReactiveStage` ([reactiveStage.js](../../../src/components/reactiveStage.js)): palco reativo para os 12 passos (`escala-macro`, `escala-micro`, `h1`, `h2`, `h2-div`, `h3`–`h9`) com barra de troca de contexto e sincronização completa do *brush* em `H9`.
  - `EvidenceCard` ([evidenceCard.js](../../../src/components/evidenceCard.js)): cartão atômico de 4 slots (metadado, link externo `↗︎`, texto com `<mark class="ev-highlight">` e tag de categoria).
- **Novos gráficos (`src/charts/`):**
  - [scaleMosaic.js](../../../src/charts/scaleMosaic.js): transição **Macro → Micro** (48 blocos para `opacity: 0.15` com 4 Pull-Outs em foco e 4 `EvidenceCard`s).
  - [divergentChart.js](../../../src/charts/divergentChart.js): gráfico divergente `← Mais para Homens | Igual (1×) | Mais para Mulheres →` acessível por teclado e clicável para filtrar partidos.
- **Estrutura, estilo e testes:** reestruturados [public/index.html](../../../public/index.html), [src/main.js](../../../src/main.js) e [public/styles.css](../../../public/styles.css) no funil de 5 etapas (com `.skip-link`, artefatos contextualizados TSE anonimizados, `#sintese` e `#metodologia`), atualizados [docs/guia_dos_graficos.md](../../guia_dos_graficos.md), [tests/test_indicators.py](../../../tests/test_indicators.py) e [tests/e2e.mjs](../../../tests/e2e.mjs), e gerado novo bundle em `dist/app.js` e `site/`.

## Evidências de verificação (pós-última edição)
- `npm run build:vercel` → `dist/app.js 451.5kb`, `site/` com 12 files (`7.63 MB`).
- `./init.sh` → `18 passed in 35.09s` (inclui `tests/test_indicators.py` e `tests/e2e.mjs`).
- `E2E_ROOT=site node tests/e2e.mjs` → `E2E OK` (`errors: []`, `filterH: 115.8125`, `mobileCheck: { overlap: false, overflowX: false }`, `mobileMicro: { stagePos: 'sticky', dimmedOp: '0.15', overflowX: false }`).
- **Revisão adversarial independente (`research`, `ae9fc082`):** `APROVADO` após correção dos 6 achados iniciais.

## Riscos residuais
- Nenhum risco funcional ou de LGPD aberto; recomenda-se inspeção visual humana na URL de deploy após publicação (sem `git push` automático).
