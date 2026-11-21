# Receipt — Auditoria Independente dos Relatórios e Correções (A01–A08)

- **Data:** 2026-11-21
- **Commit inicial:** `2e28eea`
- **Auditoria em contexto frio:** subagente `report-auditor` (`83e1ea35-e4d8-43b3-ae19-9abdc5323485`, somente leitura)

## Achados corrigidos
1. **A01 — LGPD / Fornecedores individuais e MEIs pós-2022 ([etl/build_dataset.py](../etl/build_dataset.py), [data/network_hubs.json](../data/network_hubs.json), [tests/test_etl.py](../tests/test_etl.py)):** anonimizados hubs PJ cujo nome coincidia com `NM_CANDIDATO` de `consulta_cand_<ANO>` (ex.: `H2022_116`) ou seguia o padrão RFB pós-2022 de MEI (`^\d{2}\.\d{3}\.\d{3}\s+`, 4 hubs). Adicionadas asserções invariantes em `test_network_hubs_integrity_and_lgpd`.
2. **A02 — Sinal C por partido ([docs/plano_de_dados.md](../docs/plano_de_dados.md)):** mantido agrupamento por `(SG_UF, SG_PARTIDO)` entre candidaturas `APTO` (e `dest_kind = 'EXT'` para despesas) no ETL para evitar falsos positivos por valores redondos entre tesourarias partidárias distintas em federações; regra e justificativa documentadas explicitamente no Plano de Dados.
3. **A03 — Impacto quantitativo dos `INAPTO` ([etl/build_dataset.py](../etl/build_dataset.py), [etl/report_coverage.py](../etl/report_coverage.py), [data/coverage.json](../data/coverage.json), [docs/relatorio_cobertura_2022.md](../docs/relatorio_cobertura_2022.md)):** adicionado bloco `inapto_impact` (votos válidos/nominais, receita, FEFC, despesa efetiva e eleitos) no JSON e no Relatório de Cobertura de 2022 e 2026.
4. **A04 — Identificador anônimo `cid` ([etl/build_dataset.py](../etl/build_dataset.py), [docs/plano_de_dados.md](../docs/plano_de_dados.md)):** ordem de atribuição de `cid` embaralhada deterministicamente via `md5` de `SQ_CANDIDATO` (eliminando correspondência posicional com o CSV bruto) e Plano de Dados alinhado com nota sobre reidentificação indireta em microdados públicos.
5. **A05 — Reprodutibilidade ([etl/requirements.txt](../etl/requirements.txt), [progress.md](../progress.md)):** criado `etl/requirements.txt` com `duckdb==2.0.0`, `pytest==9.2.0`, `pypdf==7.1.1`, `numpy==2.5.4`, `matplotlib==3.11.2`; atualizados comandos em `progress.md`.
6. **A06–A08 — Alinhamento e rastreabilidade ([docs/plano_de_dados.md](../docs/plano_de_dados.md), [etl/config.py](../etl/config.py), [src/indicators.js](../src/indicators.js), `receipts/*.md`):** atualizada referência da linha do byte `0x88` (`639.117`), alinhado `DOUBLE` no Plano, preenchido `DT_GERACAO` de `doador_originario` no Relatório de Cobertura, removida constante não usada `DONATION_DRD_CODES`, atualizado cabeçalho de `src/indicators.js`, datado o extrato de 21/10/2026 no receipt de U1 e corrigidos os 70 links relativos (`../`) nos 6 receipts de `2026-11-20`. *(Nota de rastreabilidade: os commits intermediários `dbd5ae0` [refinamento de escopo 2022/2026] e `2e28eea` [guia Google Drive no README] estão registrados no histórico git da `master`.)*

## Evidência
- `.venv/bin/python -m etl.build_dataset`: `[ETL] Concluído com sucesso!`
- `npm run build`: `dist/app.js 376.2kb` em `74ms`.
- `./init.sh`: `15 passed in 12.83s`, exit `0` (incluindo novas invariantes LGPD/MEI/`NM_CANDIDATO`, `inapto_impact`, `DT_GERACAO` de `doador_originario` e suíte Puppeteer E2E).
- Verificação de links Markdown em `receipts/*.md`: `Broken links in receipts: 0`.

## Riscos residuais
- Mantém-se a nota metodológica de que `votacao_munzona_2026` no repositório é de `19/10/2026` (`232` candidaturas `APTO` ausentes assumem `0` votos).
