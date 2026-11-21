# Receipt — U5: Scrollytelling Split-Screen, E2E e Revisão Adversarial

- **Data:** 2026-11-20
- **Commit inicial:** `c8689bb`

## O que mudou
- Reconstruída a interface completa em *Scrollytelling* split-screen nos 5 atos em [index.html](../index.html), [styles.css](../styles.css) e [src/main.js](../src/main.js), com painel de leitura (hipóteses H1–H9, métricas vivas e selos de diagnóstico) integrado à área principal fixa de visualização, filtros globais e *brushing & linking*.
- Corrigidos os 5 achados da revisão adversarial em contexto frio:
  1. Corrigida inversão PF/PJ em [etl/build_dataset.py](../etl/build_dataset.py) (`CD_TIPO_FORNECEDOR = '1'` + `PESSOA JURÍDICA`); todos os hubs PF (`42` em 2022, `21` em 2026) anonimizados em [data/network_hubs.json](../data/network_hubs.json) e validados em [tests/test_etl.py](../tests/test_etl.py).
  2. Ajustada razão de passo `Votos → Cadeiras` e `papelRatio` sobre registradas em `computeH9AndParallel` ([src/indicators.js](../src/indicators.js)).
  3. Preservada integridade de chapas de federações sob filtro por partido em [src/data.js](../src/data.js) e [src/indicators.js](../src/indicators.js); corrigido denominador `F + M` de gênero em [etl/report_coverage.py](../etl/report_coverage.py) / [docs/relatorio_cobertura_2022.md](../docs/relatorio_cobertura_2022.md).
  4. Aplicada checagem dinâmica de `finalRate >= 0.7` sobre o recorte filtrado em H2, H3, H4, H6, H7 (inclusive por UF) e H9.
  5. Integrados Mapa H7 no passo `h7`, alternância `Partidos / UFs` em `h9`, atualização da Seção 5 de [docs/plano_de_dados.md](../docs/plano_de_dados.md) e nota das 232 candidaturas de 2026 em [index.html](../index.html).
- Adicionados testes [tests/e2e.mjs](../tests/e2e.mjs), [tests/test_e2e.py](../tests/test_e2e.py) e atualizado [README.md](../README.md) e [package.json](../package.json).

## Evidência
- `npm run build`: `dist/app.js 373.2kb` em `71ms`.
- `./init.sh`: `15 passed in 10.35s`, exit `0`.
- `.venv/bin/python -m pytest -v`: `15 passed in 9.92s` (cobrindo `test_harness.py`, `test_data_plan.py`, `test_etl.py`, `test_indicators.py`, `test_e2e.py`).
- Revisor adversarial (`research`, contexto frio) após correções: **`APROVADO SEM GAPS DE CORRETUDE`** (`15 passed`).

## Riscos residuais
- Validação visual humana (estética editorial/responsividade fina) e comparação pontual com consultas públicas do portal DivulgaCandContas permanecem para a etapa `24–27/nov` do cronograma.
