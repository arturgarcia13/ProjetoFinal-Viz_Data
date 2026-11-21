# Receipt — U2: Base Validada 2022/2026 e Relatório de Cobertura por Fonte

- **Data:** 2026-11-20
- **Commit inicial:** `dbd5ae0`

## O que mudou
- Criado pipeline ETL reprodutível em passada única com DuckDB: [etl/__init__.py](../etl/__init__.py), [etl/config.py](../etl/config.py), [etl/build_dataset.py](../etl/build_dataset.py), [etl/report_coverage.py](../etl/report_coverage.py).
- Gerados os artefatos sem PII em `data/`: [data/analytical_base.json](../data/analytical_base.json) (`6,6 MB`, 27.367 registros de 2022 + 19.098 de 2026), [data/network_hubs.json](../data/network_hubs.json) (`203 KB`), [data/coverage.json](../data/coverage.json) (`5,7 KB`).
- Gerado automaticamente [docs/relatorio_cobertura_2022.md](../docs/relatorio_cobertura_2022.md) com volumetria bruta/filtrada, `APTO` vs. `INAPTO`, gênero, micro-chapas `< 4`, taxas de casamento entre fontes, distribuição `TP_PRESTACAO_CONTAS` e checagens de sanidade.
- Criada suíte [tests/test_etl.py](../tests/test_etl.py) e atualizado [docs/plano_de_dados.md](../docs/plano_de_dados.md) com regra empírica da conta `20240000`.

## Evidência
- `.venv/bin/python -m etl.build_dataset && .venv/bin/python -m pytest -v`:
  - `10 passed in 0.61s` (`test_harness.py`, `test_data_plan.py`, `test_etl.py`).
  - Sanidade **2022**: `204.070.241` votos válidos (dif `0`), `R$ 5.055.682.690,23` receita total (dif `R$ 0,00`), `R$ 3.808.225.463,27` FEFC (dif `R$ 0,00`), `R$ 4.790.848.454,16` despesa efetiva (dif `R$ 0,00`); `97,1%` das `APTO` com entrega `FINAL`.
  - Sanidade **2026**: `214.087.715` votos válidos (dif `0`), `R$ 5.487.916.504,58` receita total (dif `R$ 0,00`), `R$ 3.967.207.941,49` FEFC (dif `R$ 0,00`), `R$ 5.187.366.557,68` despesa efetiva (dif `R$ 0,00`); após atualização de 20/11/2026, **`97,9%` das `APTO` já têm entrega `FINAL`**.

## Riscos residuais
- Em 2026, `votacao_munzona_2026` é de `19/10/2026` enquanto `consulta_cand_2026` é de `20/11/2026` (`232` candidaturas `APTO`, 1,3%, sem linha correspondente em `votacao`), além de as contas de 2026 ainda aguardarem julgamento judicial pela Justiça Eleitoral.
