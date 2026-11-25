# Receipt — Padronização do Hover/Tooltip (Modelo H1) em Todos os Gráficos

- **Data:** 2026-11-23
- **Commit inicial:** `abc99e3`

## O que mudou
1. **Utilitário compartilhado e CSS unificado ([src/charts/tooltip.js](../../../src/charts/tooltip.js), [styles.css](../../../public/styles.css)):**
   - Criado `createChartTooltip`, `buildTooltipCard` e `bindTooltipEvents` para todos os gráficos D3 e Observable Plot, com card em `--surface`, borda superior `--accent` de 3px, badge semântica, tabela `tabular-nums`, rodapé opcional de ação (`Clique para filtrar...`) e clamp automático dentro de `.chart-wrap`.
   - Definidos estados visuais `.is-hovered` consistentes para `circle`, `rect`, `path` e `.h1-row`.
2. **Migração completa de H1–H9 ([h1Histogram.js](../../../src/charts/h1Histogram.js), [h2Dumbbell.js](../../../src/charts/h2Dumbbell.js), [h3Scatter.js](../../../src/charts/h3Scatter.js), [h4SankeyNetwork.js](../../../src/charts/h4SankeyNetwork.js), [h5Conversion.js](../../../src/charts/h5Conversion.js), [h6Signals.js](../../../src/charts/h6Signals.js), [h7Boxplot.js](../../../src/charts/h7Boxplot.js), [h8Temporal.js](../../../src/charts/h8Temporal.js), [h9MapAndParallel.js](../../../src/charts/h9MapAndParallel.js)):**
   - Removidos todos os `<title>` nativos de SVG e `tip: true` do Observable Plot.
   - H2 (dumbbell + barras empilhadas), H6 e H8 replicam tabelas comparativas com destaque `.is-focus` no grupo/ano sob o cursor; H3, H4 (Sankey e Rede de Hubs), H5, H7 (pontos agregados, caixas e outliers do boxplot) e H9 (Mapa UF e Coordenadas Paralelas) usam o mesmo card e posicionamento.
3. **Verificação E2E ampliada ([tests/e2e.mjs](../../../tests/e2e.mjs)):**
   - Adicionado `assertUnifiedHover` validando ausência de `<title>`/`g[aria-label="tip"]` e abertura do `.chart-tooltip` dentro dos limites do container em H1–H9.

## Evidência
- `npm run build:vercel`: `dist/app.js 409.1kb` (`site/`: 10 arquivos, `7.57 MB`).
- `E2E_ROOT=site node tests/e2e.mjs`: `E2E OK`, `errors: []`, `overlap: false`, `overflowX: false`.
- `./init.sh`: `16 passed in 20.48s`, exit `0`.

## Riscos residuais
- Alterações commitadas localmente na `master`; falta `git push origin master` (sujeito a aprovação humana) para atualizar o ambiente publicado na Vercel.
