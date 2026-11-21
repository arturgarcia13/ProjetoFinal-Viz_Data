# Receipt — U5 (Pós-Auditoria Independente em Contexto Frio)

- **Data:** 2026-11-20
- **Commit inicial:** `e3906ba`

## Achados da auditoria independente corrigidos
1. **LGPD / MEI ([etl/build_dataset.py](../etl/build_dataset.py), [data/network_hubs.json](../data/network_hubs.json), [tests/test_etl.py](../tests/test_etl.py)):** sanitizados `7` hubs MEI cujo nome RFB embutia CPF de 11 dígitos (`Fornecedor MEI (<UF>) #<n>`); checagem estendida para todos os hubs (`PF` e `PJ`).
2. **Click-to-filter ([src/charts/h2Dumbbell.js](../src/charts/h2Dumbbell.js), [src/charts/h3Scatter.js](../src/charts/h3Scatter.js), [src/charts/h5Conversion.js](../src/charts/h5Conversion.js)):** substituída leitura inexistente de `<title>` por índice `__data__` / faceta `g[aria-label="bar"] > g` e `pointer-events: none` nos rótulos de texto de H3.
3. **Partidos de 2026 ([src/main.js](../src/main.js)):** `syncPartySelect()` repopula `#filter-party` dinamicamente para o ano selecionado (incluindo `PCDOB`, `PRD`, `MISSÃO`, `MOBILIZA` em 2026).
4. **Brushing & Linking em H9 ([src/charts/h9MapAndParallel.js](../src/charts/h9MapAndParallel.js), [src/main.js](../src/main.js)):** domínios dinâmicos sem clamping nos 5 eixos, `onBrushFilter` sincronizado com o painel narrativo, persistência visual do brush após cliques no mapa e suporte ao modo `Eixos: UFs`.
5. **Amostra mínima em H4 ([src/indicators.js](../src/indicators.js)):** exigência `nF >= 20 && nM >= 20` para não declarar veredicto em recortes minúsculos.
6. **Layout desktop/mobile e labels SVG ([styles.css](../styles.css), [src/main.js](../src/main.js), [src/charts/h6Signals.js](../src/charts/h6Signals.js), [src/charts/h7Boxplot.js](../src/charts/h7Boxplot.js), [src/charts/h8Temporal.js](../src/charts/h8Temporal.js), [src/charts/h9MapAndParallel.js](../src/charts/h9MapAndParallel.js)):** `--filter-h` via `ResizeObserver` evitando sobreposição de `#filter-bar` sobre `.stage-pane` no desktop, fluxo estático sem colisão em `390×844` e ajuste de margens/rótulos em H6/H8/H9.
7. **Documentação e acessibilidade ([docs/plano_de_dados.md](../docs/plano_de_dados.md), [index.html](../index.html)):** nota explícita de exclusão mútua entre Sinal B e Sinal C, `tabindex="0"` + `Enter`/`Space` nos passos e `aria-pressed` nos botões `.seg`.

## Evidência Final
- `./init.sh` → `15 passed in 15.49s` (exit `0`) após build `dist/app.js` (`376.2kb`).
- Auditoria independente em contexto frio (`research`, conversa `955d51f8-da20-4b8d-abc6-6616a9222a53`): **`APROVADO SEM ERROS`**.
