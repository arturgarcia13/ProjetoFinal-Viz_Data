# Relatório de Cobertura por Fonte — Baseline 2022 e Comparativo 2026

> Gerado automaticamente por `etl/build_dataset.py` (`etl/report_coverage.py`). Todos os números refletem os CSVs oficiais `*_BRASIL.csv` do TSE filtrados para `CD_CARGO IN ('6', '7')` e `CD_TIPO_ELEICAO = '2'`.

## Ano 2022 — Baseline Principal

### 1. Volumetria por Fonte Oficial (`*_BRASIL.csv`, Cargos 6 + 7)

| Fonte | `DT_GERACAO` | Linhas Brutas | Linhas Cargos 6+7 | `SQ` Distintos | Observação |
| :--- | :---: | ---: | ---: | ---: | :--- |
| `consulta_cand_2022` | 22/10/2026 | 29.322 | 27.367 | 27.367 | Chave única 1:1 (`rows == unique_sq`: True) |
| `votacao_munzona_2022` | 21/10/2026 | 9.377.845 | 9.175.975 | 25.222 | Agregada por `SQ_CANDIDATO` antes do join |
| `receitas_candidatos_2022` | 18/10/2026 | 674.944 | 259.446 | 26.875 | Prioriza maior precedência de `TP_PRESTACAO_CONTAS` |
| `despesas_contratadas_2022` | 18/10/2026 | 2.209.835 | 1.993.422 | 26.875 | Exclui contas internas `20330000`/`20340000` |
| `doador_originario_2022` | 18/10/2026 | 199.241 | — | 7.384 (`SQ_RECEITA`) | 6.460 / 109.752 recibos de transferência casados (5,9%) |

### 2. Universo Analítico, Elegibilidade e Micro-Chapas
- **Candidaturas registradas (Cargos 6+7):** **27.367** → **24.733 APTO** (90,4%) e **2.634 INAPTO** (9,6%).
- **Impacto das candidaturas `INAPTO` (2.634):** `346.133` votos válidos (`1.661.530` nominais totais), `R$ 60.514.556,58` em receita declarada (`R$ 44.243.917,06` de FEFC), `R$ 52.692.037,13` em despesa efetiva e `1` eleito(s) no recorte `INAPTO`.
- **Gênero (Registradas, sobre F+M = 27.346):** Mulheres `9.320` (34,1%), Homens `18.026` (65,9%), Não divulgável `21` (excluído dos denominadores de gênero).
- **Gênero (`APTO`, sobre F+M = 24.729):** Mulheres `8.468` (34,2%), Homens `16.261` (65,8%), Não divulgável `4`.
- **Chapas (Registradas):** `1.189` chapas totais; **`129` micro-chapas (`n < 4`)** somando **`244` candidaturas** (mantidas nos totais individuais e excluídas da distribuição percentual de H1/H7).
- **Chapas (`APTO`):** `1.138` chapas totais; `106` micro-chapas (`n < 4`, `199` candidaturas).

### 3. Taxa de Casamento (*Match Rate*) e Status da Prestação de Contas

| Cruzamento / Status | Sobre Registradas | % Registradas | Sobre `APTO` | % `APTO` |
| :--- | ---: | ---: | ---: | ---: |
| Presentes em `votacao` | 25.222 | 92,2% | 24.733 | 100,0% |
| Presentes em `receitas` | 26.875 | 98,2% | 24.578 | 99,4% |
| Presentes em `despesas_contratadas` | 26.875 | 98,2% | 24.578 | 99,4% |
| Contas zeradas declaradas (`r=0` e `e=0`) | 2.778 | 10,2% | 1.593 | 6,4% |
| Ausentes em `receitas` (sem linha) | 492 | 1,8% | 155 | 0,6% |

**Distribuição por `TP_PRESTACAO_CONTAS` (candidaturas `APTO`):**

| Tipo de Prestação (`APTO`) | Candidaturas | % `APTO` |
| :--- | ---: | ---: |
| `FINAL` | 24.005 | 97,1% |
| `PARCIAL` | 251 | 1,0% |
| `REGULARIZAÇÃO DA OMISSÃO` | 196 | 0,8% |
| `AUSENTE` | 155 | 0,6% |
| `RELATÓRIO FINANCEIRO` | 126 | 0,5% |

### 4. Checagens de Sanidade (Zero Inflação em Joins 1:N)

| Métrica | Soma Direta na Fonte Bruta (Cargos 6+7) | Soma na Base Analítica Exportada | Diferença |
| :--- | ---: | ---: | ---: |
| Votos Nominais Válidos | 204.070.241 | 204.070.241 | 0 |
| Votos Nominais Totais | 206.672.548 | 206.672.548 | 0 |
| Receita Total Declarada | R$ 5.055.682.690,23 | R$ 5.055.682.690,23 | R$ 0,00 |
| FEFC (`CD_FONTE_RECEITA = 2`) | R$ 3.808.225.463,27 | R$ 3.808.225.463,27 | R$ 0,00 |
| Despesa Contratada Efetiva | R$ 4.790.848.454,16 | R$ 4.790.848.454,16 | R$ 0,00 |

- **Rede Bipartida (Fornecedores-Hub):** `157` fornecedores-hub, `595` candidaturas anônimas ligadas e `827` arestas.

## Ano 2026 — Comparativo Direto

### 1. Volumetria por Fonte Oficial (`*_BRASIL.csv`, Cargos 6 + 7)

| Fonte | `DT_GERACAO` | Linhas Brutas | Linhas Cargos 6+7 | `SQ` Distintos | Observação |
| :--- | :---: | ---: | ---: | ---: | :--- |
| `consulta_cand_2026` | 20/11/2026 | 21.017 | 19.098 | 19.098 | Chave única 1:1 (`rows == unique_sq`: True) |
| `votacao_munzona_2026` | 19/10/2026 | 6.735.370 | 6.532.889 | 17.934 | Agregada por `SQ_CANDIDATO` antes do join |
| `receitas_candidatos_2026` | 20/11/2026 | 270.339 | 223.515 | 18.729 | Prioriza maior precedência de `TP_PRESTACAO_CONTAS` |
| `despesas_contratadas_2026` | 20/11/2026 | 1.792.750 | 1.612.086 | 18.729 | Exclui contas internas `20330000`/`20340000` |
| `doador_originario_2026` | 20/11/2026 | 317.631 | — | 7.381 (`SQ_RECEITA`) | 6.548 / 87.036 recibos de transferência casados (7,5%) |

### 2. Universo Analítico, Elegibilidade e Micro-Chapas
- **Candidaturas registradas (Cargos 6+7):** **19.098** → **17.712 APTO** (92,7%) e **1.386 INAPTO** (7,3%).
- **Impacto das candidaturas `INAPTO` (1.386):** `246.302` votos válidos (`1.228.464` nominais totais), `R$ 43.825.821,17` em receita declarada (`R$ 29.488.227,18` de FEFC), `R$ 40.458.112,52` em despesa efetiva e `4` eleito(s) no recorte `INAPTO`.
- **Gênero (Registradas, sobre F+M = 19.098):** Mulheres `6.801` (35,6%), Homens `12.297` (64,4%), Não divulgável `0` (excluído dos denominadores de gênero).
- **Gênero (`APTO`, sobre F+M = 17.712):** Mulheres `6.366` (35,9%), Homens `11.346` (64,1%), Não divulgável `0`.
- **Chapas (Registradas):** `847` chapas totais; **`91` micro-chapas (`n < 4`)** somando **`204` candidaturas** (mantidas nos totais individuais e excluídas da distribuição percentual de H1/H7).
- **Chapas (`APTO`):** `823` chapas totais; `86` micro-chapas (`n < 4`, `193` candidaturas).

### 3. Taxa de Casamento (*Match Rate*) e Status da Prestação de Contas

| Cruzamento / Status | Sobre Registradas | % Registradas | Sobre `APTO` | % `APTO` |
| :--- | ---: | ---: | ---: | ---: |
| Presentes em `votacao` | 17.934 | 93,9% | 17.480 | 98,7% |
| Presentes em `receitas` | 18.729 | 98,1% | 17.529 | 99,0% |
| Presentes em `despesas_contratadas` | 18.729 | 98,1% | 17.529 | 99,0% |
| Contas zeradas declaradas (`r=0` e `e=0`) | 1.654 | 8,7% | 972 | 5,5% |
| Ausentes em `receitas` (sem linha) | 369 | 1,9% | 183 | 1,0% |

**Distribuição por `TP_PRESTACAO_CONTAS` (candidaturas `APTO`):**

| Tipo de Prestação (`APTO`) | Candidaturas | % `APTO` |
| :--- | ---: | ---: |
| `FINAL` | 17.341 | 97,9% |
| `AUSENTE` | 183 | 1,0% |
| `PARCIAL` | 117 | 0,7% |
| `RELATÓRIO FINANCEIRO` | 71 | 0,4% |

### 4. Checagens de Sanidade (Zero Inflação em Joins 1:N)

| Métrica | Soma Direta na Fonte Bruta (Cargos 6+7) | Soma na Base Analítica Exportada | Diferença |
| :--- | ---: | ---: | ---: |
| Votos Nominais Válidos | 214.087.715 | 214.087.715 | 0 |
| Votos Nominais Totais | 215.069.877 | 215.069.877 | 0 |
| Receita Total Declarada | R$ 5.487.916.504,58 | R$ 5.487.916.504,58 | R$ 0,00 |
| FEFC (`CD_FONTE_RECEITA = 2`) | R$ 3.967.207.941,49 | R$ 3.967.207.941,49 | R$ 0,00 |
| Despesa Contratada Efetiva | R$ 5.187.366.557,68 | R$ 5.187.366.557,68 | R$ 0,00 |

- **Rede Bipartida (Fornecedores-Hub):** `60` fornecedores-hub, `358` candidaturas anônimas ligadas e `528` arestas.
