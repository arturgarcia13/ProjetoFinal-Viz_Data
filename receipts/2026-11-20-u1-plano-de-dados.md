# Receipt — U1: Plano de Dados e Regras de Limpeza

- **Data:** 2026-11-20
- **Commit inicial:** `cc92dec`

## O que mudou
- Criado [docs/plano_de_dados.md](../docs/plano_de_dados.md) com o contrato completo das fontes do TSE (2018, 2022, 2026), chaves de junção (`SQ_CANDIDATO`), sentinelas (`#NULO`/`-1`, `#NE`/`-3`, `NÃO DIVULGÁVEL`/`-4`), regras de privacidade/LGPD, tratamento de `APTO` vs. `INAPTO`, unidade legal de chapa (`Coligação` em 2018 vs. `Federação/Partido` em 2022/2026), micro-chapas `< 4`, classificação de fontes (`FEFC`, `FP`, `Próprio`, `Privado`), regras de despesas contratadas/Sankey e comparações condicionais para 2018 e 2026.
- Criado [tests/test_data_plan.py](../tests/test_data_plan.py) verificando as seções obrigatórias e conferindo todas as colunas citadas contra os cabeçalhos reais dos CSVs de 2022.

## Evidência
- `./init.sh && .venv/bin/python -m pytest -v`:
  - `tests/test_data_plan.py::test_plano_de_dados_exists_and_has_required_sections PASSED`
  - `tests/test_data_plan.py::test_plano_de_dados_columns_match_2022_sources PASSED`
  - Total: `5 passed in 0.08s`, exit code `0`.

## Descobertas empíricas registradas
- `receitas_candidatos_2022_BRASIL.csv`: `0` sobreposições de `TP_PRESTACAO_CONTAS` por candidato (`26.875` prestadores); `4.171` pares `(SQ_CANDIDATO, SQ_RECEITA)` têm múltiplos itens legítimos no mesmo recibo; `2.902` linhas com `CD_FONTE_RECEITA = -1` possuem `VR_RECEITA = 0,00`.
- `despesas_pagas_candidatos_2022_BRASIL.csv`: não possui `SQ_CANDIDATO` nem `NR_CPF_CNPJ_FORNECEDOR`.
- `consulta_cand_2026_BRASIL.csv`: `CD_SITUACAO_CANDIDATURA = -3 (#NE)` em todos os `19.098` registros de Federal/Estadual; julgamento aparece em `votacao_candidato_munzona_2026` (`CD_SITUACAO_JULGAMENTO`).
- `receitas_candidatos_2026_BRASIL.csv` *(extrato inicial de 21/10/2026, posteriormente substituído em U2 pela extração de 20/11/2026 com 97,9% `FINAL`)*: apenas `9.346` de `160.564` linhas eram `FINAL` (~5,8%) na data da U1, justificando o mecanismo de selo `Inconclusivo` nos eixos financeiros/integridade quando a cobertura for insuficiente.

## Riscos residuais
- Conferir na U2 se `receitas_2018` ou `despesas_2018/2022` possuem retificações/múltiplas entregas por candidato e medir a taxa exata de casamento entre `receitas` e `doador_originario`.
