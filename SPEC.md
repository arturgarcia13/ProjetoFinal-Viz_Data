# SPEC — A Cota de Gênero Leva Mulheres ao Poder ou Apenas ao Papel?

## 1. Objetivo
Construir do zero uma aplicação Web interativa (SPA em *Scrollytelling*) acompanhada de pipeline de dados Python auditável e reprodutível para investigar, ao longo de 5 atos (Papel, Dinheiro, Urna, Fraude Oculta e Geografia da Exclusão), onde a cota de gênero de 30% funciona, onde vaza e onde os dados são inconclusivos.

## 2. Escopo e Recortes Fechados
- **Ano âncora:** **2022** (prestações de contas finais e situação de candidatura consolidada).
- **Anos de comparação condicional:** **2018** (controle histórico pré-federações, com coligações proporcionais) e **2026** (dados preliminares de out/2026; limitações explicitadas e hipóteses afetadas marcadas como *Inconclusivo* quando a cobertura for insuficiente).
- **Cargos:** exclusivamente **Deputado Federal (`CD_CARGO = 6`)** e **Deputado Estadual (`CD_CARGO = 7`)** nas **27 UFs**. **Deputado Distrital (`CD_CARGO = 8`) fica excluído** do projeto.
- **Unidade legal de chapa:**
  - **2018:** Coligação proporcional (`SQ_COLIGACAO`) por `(UF, Cargo)`.
  - **2022 e 2026:** Federação partidária (`NR_FEDERACAO != -1` usando `SG_FEDERACAO`/`NR_FEDERACAO`) ou Partido Isolado (`SG_PARTIDO`) por `(UF, Cargo)`.
- **Elegibilidade (`APTO` vs. `INAPTO`):**
  - **Ato 1 (Papel):** compara registradas totais vs. candidaturas `APTO` para detectar perda de cumprimento da cota por indeferimento/renúncia.
  - **Atos 2–4 (Dinheiro, Urna, Sinais):** cálculos principais sobre candidaturas `APTO` (em 2018/2022), com regra condicional explícita para 2026 (onde `CD_SITUACAO_CANDIDATURA = -3 #NE`) e impacto documentado no Relatório de Cobertura.
- **Micro-chapas (`< 4` candidaturas):** mantidas nos totais individuais (Dinheiro, Urna, Sinais); excluídas apenas dos gráficos de distribuição percentual por chapa (H1 e H7), com contagem documentada no Relatório de Cobertura.
- **Privacidade / LGPD:** nenhum nome de candidata/o, CPF ou e-mail pode ser gravado em `data/*.json` ou exibido na interface.

## 3. Hipóteses e Visualizações (Alinhamento Seção 3 + Seção 6 da Proposta)
- **Ato 1 — No papel (P1 / H1):** Histograma de % de mulheres por chapa (corte `n >= 4`) com limiar de 30% e faixa 30%–33% (Observable Plot).
- **Ato 2 — No dinheiro (P2 / H2, H3, H4):**
  - H2: Dumbbell por partido (mediana mulheres vs. homens) + barras empilhadas por fonte (Público vs. Privado) (Observable Plot).
  - H3: Scatter plot por partido (`% candidatas × % Fundo Público [FEFC + FP]`) com diagonal `Y=X` e corte de 30% (Observable Plot).
  - H4: Sankey interativo (Fluxo do Fundo Público) + Grafo de Rede Bipartido (Candidaturas anônimas × Fornecedores compartilhados) (D3.js).
- **Ato 3 — Na urna (P3 / H5):** Barras agrupadas em 3 etapas por partido (`% Candidatas → % Votos Nominais → % Eleitas`) (Observable Plot).
- **Ato 4 — A fraude oculta (P4 / H6, H7, H8):**
  - H6: Barras agrupadas por gênero vs. volume de sinais acumulados (Observable Plot).
  - H7: Boxplot (faixas de % de candidatas × taxa de sinais) + Mapa por UF (Observable Plot + D3.js).
  - H8: Barras agrupadas comparativo temporal 2022 vs. 2026 (Observable Plot).
- **Ato 5 — Geografia da Exclusão (P5 / H9 + Cronograma 10–16/nov):**
  - H9: Mapa por UF colorido pela etapa crítica de maior perda + Coordenadas Paralelas por partido/UF pelos 5 eixos (D3.js).

## 4. Arquitetura Técnica e Interface Final (Etapa 17–23/nov)
- **ETL & Auditoria:** Python 3.14 (`.venv`), testes determinísticos com `pytest`, geração automatizada da base analítica e do Relatório de Cobertura por Fonte.
- **Frontend:** Vanilla JS modular empacotado com `esbuild` + **Observable Plot** + **D3.js** (`d3-sankey`, `topojson-client`).
- **Layout (Ato final):** SPA em *Scrollytelling* split-screen: painel de leitura rolável (narrativa, hipóteses H1–H9 e selo de diagnóstico: *A Cota Funciona*, *Vaza nesta Etapa* ou *Inconclusivo*) integrado a uma área principal fixa exibindo a visualização ativa, com filtros globais (`UF`, `Ano`, `Partido`, `Cargo`) e *brushing & linking*.
