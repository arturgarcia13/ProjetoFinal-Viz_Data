# Receipt — U4: Visões Especiais, Sinais H6–H8, Mapa por UF e Coordenadas Paralelas

- **Data:** 2026-11-20
- **Commit inicial:** `9684dd4`

## O que mudou
- Estendido [src/indicators.js](../src/indicators.js) com `computeH6`, `computeH7`, `computeH8`, `computeH9AndParallel` e estados `Inconclusivo` explícitos.
- Adicionado mapeamento `IBGE_TO_UF` em [src/data.js](../src/data.js) para `data/br_uf.json` (`codarea`).
- Criadas as visualizações especiais: [src/charts/h2Dumbbell.js](../src/charts/h2Dumbbell.js), [src/charts/h4SankeyNetwork.js](../src/charts/h4SankeyNetwork.js), [src/charts/h6Signals.js](../src/charts/h6Signals.js), [src/charts/h7Boxplot.js](../src/charts/h7Boxplot.js), [src/charts/h8Temporal.js](../src/charts/h8Temporal.js), [src/charts/h9MapAndParallel.js](../src/charts/h9MapAndParallel.js).
- Estendidos [tests/test_indicators.py](../tests/test_indicators.py), [index.html](../index.html), [styles.css](../styles.css) e [src/main.js](../src/main.js).

## Evidência
- `./init.sh && .venv/bin/python -m pytest -v`: `13 passed in 1.91s`.
- `npm run build`: `dist/app.js 367.5kb` em `58ms`.
- Verificação Puppeteer: todos os 11 containers renderizados (`MISSING: []`), `UF_PATHS: 27`, filtro `UF=CE` (`987 candidaturas registradas`), troca de modo do mapa `h9 -> h7` e troca de ano `2022 -> 2026` com `ERRORS: []`.

## Riscos residuais
- O layout ainda está em pilha linear para auditoria das visões; na **U5** entra a arquitetura definitiva em **Scrollytelling split-screen** pelos 5 atos.
