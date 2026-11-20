# Plano de Dados e Regras de Limpeza (U1 — Entregável 22–26/out)

Este documento define o contrato de entrada, limpeza, padronização, cruzamento e comparações condicionais entre as bases abertas do Tribunal Superior Eleitoral (TSE) para o projeto **"A Cota de Gênero Leva Mulheres ao Poder ou Apenas ao Papel?"** ([SPEC.md](../SPEC.md)).

---

## 1. Escopo Temporal, Territorial e de Cargos

| Dimensão | Regra Fechada | Justificativa & Comparabilidade |
| :--- | :--- | :--- |
| **Ano baseline (principal)** | `ANO_ELEICAO = 2022` | Prestações de contas consolidadas (predomínio de entrega `FINAL`) e regime vigente de federações partidárias. |
| **Comparativo direto** | `ANO_ELEICAO = 2026` | Mesmo regime jurídico de federações (comparação direta com 2022, inclusive H8). A elegibilidade final dos eixos financeiros/integridade depende da taxa de entregas `FINAL` apurada no Relatório de Cobertura (caso baixa, marcar *Inconclusivo*). |
| **Referência auxiliar (opcional)** | `ANO_ELEICAO = 2018` | Controle histórico pré-federações (coligações proporcionais); mantido apenas como apoio metodológico/ETL quando necessário, fora da comparação direta principal. |
| **Cargos incluídos** | `CD_CARGO IN ('6', '7')` (`DEPUTADO FEDERAL`, `DEPUTADO ESTADUAL`) | Exclui **Deputado Distrital (`CD_CARGO = '8'`)** por existir apenas no DF, além de cargos majoritários (`1–5`, `9–10`). |
| **Abrangência territorial** | Todas as **27 UFs** (`SG_UF` de `AC` a `TO`, incluindo `DF` para Deputado Federal) | Leitura exclusivamente dos arquivos consolidados `*_BRASIL.csv` para evitar dupla contagem entre UFs e `BR`/`BRASIL`. |

---

## 2. Fontes Oficiais e Chaves de Cruzamento

Todas as leituras usam **apenas os arquivos `*_BRASIL.csv`** de cada fonte (nunca `glob *.csv` que misturaria `BRASIL.csv` + `BR.csv` + 27 UFs).

| Fonte | Arquivo por Ano (`<ANO>` ∈ {2018, 2022, 2026}) | Chave Primária / Granularidade | Chave de Ligação | Volume Cargo 6+7 (2022) |
| :--- | :--- | :--- | :--- | :--- |
| **Candidaturas** | `consulta_cand_<ANO>/consulta_cand_<ANO>_BRASIL.csv` | `SQ_CANDIDATO` (único por ano: 27.367 em 2022; 26.580 em 2018; 19.098 em 2026) | `SQ_CANDIDATO` + `ANO_ELEICAO` | `27.367` registros |
| **Votação Nominal** | `votacao-<ANO>/votacao_candidato_munzona_<ANO>/votacao_candidato_munzona_<ANO>_BRASIL.csv` | `(SQ_CANDIDATO, NR_TURNO, CD_MUNICIPIO, NR_ZONA)` | Agregar por `SQ_CANDIDATO` antes de unir a `consulta_cand` | `9.175.975` linhas → `25.222` candidatos |
| **Receitas** | `prestacao_de_contas_eleitorais_candidatos_<ANO>/receitas_candidatos_<ANO>_BRASIL.csv` | Item de receita (múltiplos itens podem compartilhar o mesmo `SQ_RECEITA`) | Agregar por `SQ_CANDIDATO` antes de unir | `259.446` linhas → `26.875` candidatos |
| **Doador Originário** | `prestacao_de_contas_eleitorais_candidatos_<ANO>/receitas_candidatos_doador_originario_<ANO>_BRASIL.csv` | `(SQ_RECEITA, NR_CPF_CNPJ_DOADOR_ORIGINARIO, ...)` | Ligado a `receitas` **apenas após deduplicar/agregar `receitas` por `SQ_RECEITA`** para evitar multiplicação N:N | Checagem de origem em transferências |
| **Despesas Contratadas** | `prestacao_de_contas_eleitorais_candidatos_<ANO>/despesas_contratadas_candidatos_<ANO>_BRASIL.csv` | Item de despesa (múltiplos itens podem compartilhar `SQ_DESPESA`) | Agregar por `SQ_CANDIDATO` e por `(SQ_CANDIDATO, NR_CPF_CNPJ_FORNECEDOR)` | `1.993.422` linhas → `26.875` candidatos |

**Observação sobre `despesas_pagas_candidatos_<ANO>_BRASIL.csv`:** conforme inspecionado nos cabeçalhos de 2022, esse arquivo **não contém `SQ_CANDIDATO` nem `NR_CPF_CNPJ_FORNECEDOR`** (apenas `SQ_PRESTADOR_CONTAS` e `SQ_DESPESA`). Portanto, a rede bipartida de fornecedores (H4) e o Sinal C utilizam **`despesas_contratadas`**, documentando explicitamente que se trata de valor *contratado*, não de caixa efetivamente liquidado.

---

## 3. Regras de Codificação, Tipos e Valores Especiais do TSE

Conforme os dicionários oficiais (`leiame.pdf` de `consulta_cand`, `votacao` e `prestacao_de_contas`):

1. **Codificação e delimitador:** arquivos CSV com encoding **`cp1252` (Windows-1252 / superset de Latin-1)**, campos entre aspas duplas e separador **`;`** (verificado empiricamente em `despesas_contratadas_candidatos_2026_BRASIL.csv`, linha 152.967, byte `0x88`, que falha em leitores `latin-1` estritos).
2. **Valores monetários:** `VR_RECEITA` e `VR_DESPESA_CONTRATADA` vêm no padrão brasileiro com vírgula decimal (ex.: `"8000,00"`). Converter trocando `,` por `.` e fazendo cast para decimal/float64 (`DECIMAL(14,2)` na soma).
3. **Sentinelas do TSE:**
   - Texto `"#NULO"` / `"#NULO#"` e numérico `"-1"` → **ausência/em branco** (`NULL` analítico).
   - Texto `"#NE"` e numérico `"-3"` → **campo não existente/não coletado naquele ano** (`NULL` estrutural — ex.: `CD_SITUACAO_CANDIDATURA = -3` em 2026).
   - Texto `"NÃO DIVULGÁVEL"` e numérico `"-4"` → **dado protegido/sigiloso** (ex.: `CD_GENERO = -4`: 21 registros em 2022, 51 em 2018).
4. **Privacidade e LGPD (Resolução TSE nº 23.729/2024):**
   - `NR_CPF_CANDIDATO` **nunca** é usado como chave de cruzamento (usar exclusivamente `SQ_CANDIDATO`).
   - `NM_CANDIDATO`, `NM_URNA_CANDIDATO`, `NM_SOCIAL_CANDIDATO`, `NR_CPF_CANDIDATO`, `DS_EMAIL`, `NR_TITULO_ELEITORAL_CANDIDATO` e `SQ_CANDIDATO` em claro **não são exportados** para os JSONs públicos do frontend. Para a rede bipartida (H4), usar identificador anônimo derivado (`cand_hash` determinístico sem reversão direta para CPF/nome).

---

## 4. Regras de Limpeza, Deduplicação e Normalização

### 4.1 Candidaturas e Unidade Legal da Chapa
- **Filtro base:** `CD_CARGO IN ('6', '7')` e `CD_TIPO_ELEICAO = '2'` (Eleição Ordinária).
- **Chave única verificada:** 1 linha por `SQ_CANDIDATO` em `consulta_cand` (`27.367` = `27.367` em 2022).
- **Gênero (`CD_GENERO` / `DS_GENERO`):**
  - `'4'` (`FEMININO`) → `'F'`
  - `'2'` (`MASCULINO`) → `'M'`
  - `'-4'` (`NÃO DIVULGÁVEL`) → `'ND'` — **excluído dos denominadores de % de gênero**, porém contabilizado no Relatório de Cobertura.
- **Raça/Cor (`DS_COR_RACA`):** normalizar capitalização; preservar `NÃO DIVULGÁVEL` / `NÃO INFORMADO` como categoria explícita (sem apagar o candidato).
- **Situação de candidatura (`APTO` vs. `INAPTO`):**
  - Em **2018 e 2022**, usar `CD_SITUACAO_CANDIDATURA`: `'12'` (`APTO`) vs. `'3'` (`INAPTO`).
  - **Regra por etapa (decisão de projeto):**
    - **Ato 1 (Papel):** calcular o % feminino tanto sobre **todas as registradas** quanto sobre **apenas `APTO`**, para evidenciar se indeferimentos/renúncias derrubam chapas abaixo de 30%.
    - **Atos 2, 3, 4 e 5 (Dinheiro, Urna, Sinais, Síntese):** o recorte analítico principal usa **candidaturas `APTO`** (`24.733` em 2022), evitando misturar quem foi barrado/renunciou antes da urna com candidaturas sem voto. As `2.634` `INAPTO` de 2022 (e eventuais recursos/votos recebidos) são quantificadas no Relatório de Cobertura.
- **Situação final de turno (`CD_SIT_TOT_TURNO`):**
  - Eleita/o = `CD_SIT_TOT_TURNO IN ('2', '3')` (`ELEITO POR QP`, `ELEITO POR MÉDIA`).
  - **Suplente (`'5'`) e Não Eleito (`'4'`)** entram como não eleitos nas cadeiras (suplentes não contam como eleitas/os).
- **Unidade de chapa (`chapa_id`):**
  - **2018:** se `TP_AGREMIACAO == 'COLIGAÇÃO'` (ou `SQ_COLIGACAO` válido compartilhado), `chapa_id = SQ_COLIGACAO` (ou `NM_COLIGACAO`); caso contrário `SG_PARTIDO`. Unidade: `(ANO_ELEICAO, SG_UF, CD_CARGO, chapa_id)`.
  - **2022 e 2026:** se `NR_FEDERACAO != '-1'` e `SG_FEDERACAO != '#NULO'`, `chapa_id = 'FED:' + SG_FEDERACAO` (ex.: `PT/PCdoB/PV`, `PSDB/CIDADANIA`, `PSOL/REDE`); caso contrário `chapa_id = SG_PARTIDO`. Unidade: `(ANO_ELEICAO, SG_UF, CD_CARGO, chapa_id)`.
- **Micro-chapas (`n < 4` candidaturas):**
  - Mantidas integralmente nos totais individuais (Dinheiro, Urna, Sinais).
  - Excluídas apenas dos gráficos de **distribuição percentual por chapa** (H1 e H7) para evitar saltos discretos (`0%`, `50%`, `100%`), sendo as 129 micro-chapas (244 candidaturas em 2022) explicitamente reportadas no Relatório de Cobertura.

### 4.2 Votação Nominal
- Agregar `votacao_candidato_munzona_<ANO>_BRASIL.csv` por `SQ_CANDIDATO`:
  - `votos_nominais = SUM(QT_VOTOS_NOMINAIS)`
  - `votos_validos = SUM(QT_VOTOS_NOMINAIS_VALIDOS)`
- **Cuidado de integridade:** usar `QT_VOTOS_NOMINAIS_VALIDOS` como métrica principal de desempenho na urna e manter `QT_VOTOS_NOMINAIS` para auditoria de votos anulados/`sub judice` (`NM_TIPO_DESTINACAO_VOTOS`).
- Candidato `APTO` sem linha em `votacao` recebe `0` votos (e é reportado no Relatório de Cobertura).

### 4.3 Receitas e Classificação de Fontes
- **Não há sobreposição de `TP_PRESTACAO_CONTAS` por candidato em 2022** (`0` casos em `26.875` prestadores). Ainda assim, como regra defensiva para 2018/2026 e futuras atualizações, caso um `SQ_CANDIDATO` possua mais de um `TP_PRESTACAO_CONTAS`, priorizar na ordem: `FINAL > REGULARIZAÇÃO DA OMISSÃO > PARCIAL > RELATÓRIO FINANCEIRO` (nunca somar versões diferentes da mesma prestação).
- **Itemização de `SQ_RECEITA`:** em `receitas_candidatos_2022_BRASIL.csv`, múltiplos itens legítimos do mesmo recibo compartilham `SQ_RECEITA` (ex.: 4.171 chaves `(SQ_CANDIDATO, SQ_RECEITA)` possuem >1 item). Portanto:
  - Para **totais por candidato/fonte**, somar todas as linhas da prestação selecionada do candidato.
  - Para cruzar com **`doador_originario`**, agregar `receitas` por `(SQ_CANDIDATO, SQ_RECEITA)` antes do join para nunca duplicar valores.
- **Classificação de fontes (`CD_FONTE_RECEITA` e `CD_ORIGEM_RECEITA`):**
  - **Fundo Especial (FEFC):** `CD_FONTE_RECEITA = '2'` (também cobre `CD_ORIGEM_RECEITA = '10030101'` quando marcado com fonte 2).
  - **Fundo Partidário (FP):** `CD_FONTE_RECEITA = '0'`.
  - **Fundo Público Total:** `FEFC + FP`.
  - **Recursos Próprios:** `CD_FONTE_RECEITA = '1'` e `CD_ORIGEM_RECEITA = '10010100'`.
  - **Doações Privadas / Outros:** `CD_FONTE_RECEITA = '1'` e `CD_ORIGEM_RECEITA != '10010100'` (inclui pessoas físicas `10010200`, financiamento coletivo `10020500`, repasses de outros candidatos `10040000` com fonte privada etc.).
  - **Fonte `-1 (#NULO)`:** verificado em 2022 que todos os `2.902` casos têm `VR_RECEITA = 0,00` (declaração explícita de prestação zerada — registrar como `declarou_receita_zero = True`).

### 4.4 Despesas Contratadas e Fluxos (H4 e Sinais)
- **Exclusão de lançamentos contábeis internos:** conforme Nota `I.1` do `leiame_despesas-contratadas-candidatos.pdf`, ao calcular o gasto efetivo de campanha desconsiderar contas de movimentação interna (`20330000` Saque fundo de caixa, `20340000` Transferência entre contas), caso presentes. (Auditoria empírica em `despesas_contratadas_candidatos_2022_BRASIL.csv` mostrou `0` linhas nesses dois códigos e `5.294` linhas na conta `20240000` *Doações financeiras a outros candidatos/partidos*).
- **Destinos do Sankey (H4):**
  - *Repasse a outra candidatura:* `SQ_CANDIDATO_FORNECEDOR` válido (`NOT IN ('-1', '#NULO', '#NULO#')`), cruzado com `consulta_cand` para classificar o gênero (`F`/`M`/`ND`) da candidatura recebedora (`4.826` linhas em `20240000` em 2022, além de eventuais repasses em outras rubricas com `SQ_CANDIDATO_FORNECEDOR` preenchido).
  - *Repasse a partido:* quando não há `SQ_CANDIDATO_FORNECEDOR` válido, mas há `NR_PARTIDO_FORNECEDOR` válido (`NOT IN ('-1', '#NULO', '#NULO#')`) ou `CD_ESFERA_PART_FORNECEDOR` válido (ou `CD_ORIGEM_DESPESA = '20240000'` sem candidato destinatário).
  - *Fornecedores externos (compartilhados vs. exclusivos):* `NR_CPF_CNPJ_FORNECEDOR` válido não classificado acima; **fornecedor compartilhado** = atende `>= 2` candidaturas `APTO` da mesma chapa (`uf, chapa`) (e **fornecedor-hub** para a rede bipartida quando atende `>= 2` candidaturas `APTO` do mesmo partido/UF e absorve `> 15%` da despesa de ao menos uma candidatura com `< 20` votos).
- **Alocação no Sankey:** como o TSE não vincula diretamente `despesa` à `fonte de receita` em `despesas_contratadas`, o gasto por destino é ponderado proporcionalmente pela fração de Fundo Público (`FEFC + FP`) na receita total do candidato (premissa explicitada na nota metodológica).

### 4.5 Definição Operacional dos Sinais de Alerta (P4 / H6–H8)
- **Sinal A (Votação inexpressiva):** `votos_validos <= limiar_A` (padrão: `10` votos; ajustável na interface para análise de sensibilidade).
- **Sinal B (Movimentação financeira zerada):** candidato apresentou prestação de contas com `receita_total == 0` e `despesa_contratada_total == 0` (distinguido explicitamente de ausência de prestação em 2026!).
- **Sinal C (Pacote padronizado / compartilhamento suspeito em lote):** mesma legenda/federação, mesmo `NR_CPF_CNPJ_FORNECEDOR`, mesmo valor unitário e mesma `DT_DESPESA` (ou mesmo valor exato de FEFC/FP em lote) em `>= 3` candidaturas.
- **Limitação explícita (Súmula 73 do TSE):** o terceiro critério jurisprudencial (*ausência efetiva de atos de campanha*) não consta nos microdados do TSE; além disso, **Sinal B** (`r=0` e `e=0`) e **Sinal C** (`vr > 0` ou `fefc/fp > 0`) são mutuamente exclusivos por construção contábil (máximo observável simultâneo = 2 sinais: `A+B` ou `A+C`). A aplicação reporta **sinais estatísticos compatíveis com candidatura fictícia**, nunca acusação de fraude.

---

## 5. Regras de Comparação Condicional (2018 e 2026)

| Ano | Comparabilidade Permitida | Condições e Restrições Obrigatórias |
| :--- | :--- | :--- |
| **2018** | Papel (H1), Dinheiro (H2–H4), Urna (H5), Sinais (H6–H7), Geografia (H9) | **1)** Unidade de chapa é **Coligação**, não Federação (não comparar partido isolado diretamente sem nota); **2)** Contas são majoritariamente finais (`286.671` de `289.110` linhas em `receitas`), mas 1.096 candidatos não têm prestação no arquivo. |
| **2026** | Papel (H1), Dinheiro (H2–H4), Urna (H5), Sinais (H6–H8), Geografia (H9) | **1)** `CD_SITUACAO_CANDIDATURA = -3 (#NE)` em `consulta_cand_2026`; portanto `apto` usa `COALESCE(julg_deferido [CD_SITUACAO_JULGAMENTO IN ('2','16') de votacao_2026], CD_SIT_TOT_TURNO IN ('2','3','4','5'))`;<br>**2)** Na extração atualizada de `20/11/2026`, `receitas_2026` e `despesas_contratadas_2026` atingiram **97,9% de entregas `FINAL`** entre candidaturas `APTO` (habilitando comparação direta com 2022 em H2–H9, ressalvando-se que o julgamento judicial das contas ainda está em curso);<br>**3)** `votacao_munzona_2026` foi extraída em `19/10/2026`, deixando `232` candidaturas `APTO` (1,3%) sem linha em `votacao` (assumem `v = 0` por ausência de linha).<br>**4)** Em `despesas_contratadas`, os arquivos reais trazem `CD_TIPO_FORNECEDOR = '0'` como `PESSOA FÍSICA` e `'1'` como `PESSOA JURÍDICA` (inverso do texto do `leiame`); o ETL valida `DS_TIPO_FORNECEDOR` para anonimizar toda Pessoa Física. |
