# Receipt — U3: Indicadores Auditáveis H1–H5 e 3 Gráficos Básicos

- **Data:** 2026-11-20
- **Commit inicial:** `d93d674`

## O que mudou
- Criado [src/data.js](../../../src/data.js) (decodificador de `analytical_base.json` e filtros) e [src/indicators.js](../../../src/indicators.js) (cálculo puro e auditável de H1–H5 + regras de veredicto).
- Adicionado `@observablehq/plot` em [package.json](../../../package.json) e implementados os 3 gráficos básicos reais: [src/charts/h1Histogram.js](../../../src/charts/h1Histogram.js), [src/charts/h3Scatter.js](../../../src/charts/h3Scatter.js) e [src/charts/h5Conversion.js](../../../src/charts/h5Conversion.js).
- Criado shell funcional de auditoria e visualização em [index.html](../../../public/index.html), [styles.css](../../../public/styles.css), [src/main.js](../../../src/main.js) e bundle [dist/app.js](../../../dist/app.js).
- Criada suíte [tests/test_indicators.py](../../../tests/test_indicators.py) conferindo denominadores e totais de H1–H5 contra `data/coverage.json`.

## Evidência
- `./init.sh && .venv/bin/python -m pytest -v`: `12 passed in 1.61s`.
- `npm run build`: `dist/app.js 293.7kb` em `69ms`.
- Verificação Puppeteer (headless): `6` SVGs renderizados, troca de ano `2022 -> 2026` (`27.367` → `19.098` candidaturas), `ERRORS: []`.

## Riscos residuais
- Gráficos especiais (`H2`, `H4` Sankey/Rede, `H6–H8`, Mapa UF e Coordenadas Paralelas) entram na **U4**; layout *Scrollytelling* split-screen completo entra na **U5**.
