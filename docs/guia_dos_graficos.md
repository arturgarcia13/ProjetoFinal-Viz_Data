# Guia de Leitura dos Gráficos — A Cota de Gênero Leva Mulheres ao Poder ou Apenas ao Papel?

Este guia explica, em linguagem direta, **o que cada gráfico da aplicação mostra**, **como ler os eixos, cores e linhas de referência**, **o que significam os números reais de 2022 e 2026** e **quais interações existem na tela**.

---

## 0. Antes de começar: como ler a interface

A página funciona em **duas colunas (Scrollytelling split-screen)**:
- **Coluna esquerda (narrativa):** apresenta os 5 atos da investigação, as 9 hipóteses (**H1** a **H9**), um resumo numérico dinâmico e um **selo de diagnóstico** para cada etapa.
- **Coluna direita (palco fixo):** mostra automaticamente o gráfico correspondente ao bloco em leitura (você pode rolar a página ou clicar diretamente em qualquer cartão à esquerda).

### Filtros globais (barra no topo)
Qualquer ajuste na barra superior recalcula todos os gráficos e veredictos em tempo real:
- **Ano (`2022 baseline` / `2026 comparativo`):** 2022 é a referência consolidada; 2026 é o comparativo direto sob a mesma regra de federações partidárias.
- **Cargo (`Federal + Estadual` / `Federal` / `Estadual`):** o projeto analisa apenas Deputado Federal e Deputado Estadual nas 27 UFs (Deputado Distrital não entra).
- **UF e Partido:** restringem a análise a um estado ou a uma legenda específica.
- **Limiar A ≤ N (padrão: `10` votos):** ajusta o que é considerado "votação inexpressiva" no Ato 4 (Sinal A), permitindo testar se as conclusões mudam ao variar o corte entre 0 e 50 votos.
- **Limpar / Chips (`×`):** mostram filtros ativos (inclusive seleções feitas por clique nos gráficos) e permitem removê-los.

### Os três selos de diagnóstico
Cada hipótese recebe automaticamente um selo calculado sobre o recorte ativo:
- **A Cota Funciona:** o indicador atende ao critério de proporcionalidade ou não apresenta disparidade relevante desfavorável às mulheres.
- **Vaza nesta Etapa** *(ou **Vaza por Etapas Distintas** em H9)*: há evidência estatística de barreira, subfinanciamento, perda de conversão ou padrão anômalo no recorte.
- **Inconclusivo:** o recorte filtrado tem poucas candidaturas/chapas/cadeiras ou baixa entrega de prestações de contas `FINAL` (`< 70%`), impedindo uma conclusão segura.

### Conceito-chave: `Registradas` vs. `APTO`
- **Registradas:** todas as candidaturas protocoladas no TSE (`27.367` em 2022; `19.098` em 2026).
- **`APTO`:** candidaturas que efetivamente chegaram aptas à disputa (`24.733` em 2022; `17.712` em 2026), excluindo renúncias e indeferimentos (`INAPTO`).
- O **Ato 1 (H1)** olha ambos os universos para verificar se indeferimentos derrubam a cota; os **Atos 2 a 5 (H2–H9)** usam `APTO` para não misturar quem foi barrado antes da urna com candidaturas sem voto.

---

## Resumo Rápido de Todos os Gráficos

| Ato | Passo | Gráfico(s) na tela | Pergunta central que responde | Interação no gráfico |
| :---: | :---: | :--- | :--- | :--- |
| **01** | **H1** | Histograma espelhado (*Butterfly Chart*) 2022 vs. 2026 (5 faixas) | As chapas cumprem 30% ou estacionam coladas no piso (30%–33,3%), e como 2022 compara com 2026? | Alternar `Registradas`/`Aptas` + hover comparativo (`Δ p.p.`) |
| **02** | **H2** | Dumbbell facetado (`2022` vs. `2026`, escala linear) + Barras empilhadas 100% por fonte | Mulheres recebem menos dinheiro que homens dentro dos partidos e no recurso privado em 2022 e 2026? | Clique nos círculos filtra o partido + hover comparativo |
| **02** | **H3** | Dispersão (bolhas, escala `log₁₀`) `% Candidatas × % Fundo Público` | Quando um partido lança mais de 30% de mulheres, o Fundo Público acompanha? | Alternar `Escala Log` / `Linear` e `Foco (≤46%)` / `Todos` + clique nas bolhas filtra o partido + hover |
| **02** | **H4** | Diagrama de Sankey + Grafo de Rede Bipartida (Hubs) | Para onde vai o dinheiro público? Ele volta para o partido ou se concentra em fornecedores-hub? | Alternar `Sankey` / `Rede de Hubs`, hover no hub destaca ligações, clique filtra partido |
| **03** | **H5** | Barras agrupadas em 3 etapas (Funil de conversão) | Onde as mulheres mais perdem: para conquistar votos ou para converter votos em cadeiras? | Clique nas barras filtra o partido + hover |
| **04** | **H6** | Barras agrupadas de sinais acumulados (`0`, `1`, `2` sinais) | Mulheres acumulam mais sinais de alerta (voto baixo + conta zerada/lote padronizado) que homens? | Reage ao slider `Limiar A` + hover |
| **04** | **H7** | Boxplot por faixa de chapa + Mapa coroplético por UF | Os alertas se concentram nas chapas coladas no piso (30%–33,3%) e em quais estados? | Clique em uma UF no mapa filtra o painel + hover |
| **04** | **H8** | Barras agrupadas comparativo `2022 vs. 2026` | As contas zeradas caíram enquanto os pacotes padronizados cresceram de 2022 para 2026? | Reage a Cargo/UF/Partido e `Limiar A` + hover |
| **05** | **H9** | Mapa crítico por UF + Coordenadas Paralelas (5 eixos) | Qual é o pior gargalo de cada estado e de cada partido ao longo dos 5 eixos? | Alternar Mapa `H9`/`H7`, alternar Eixos `Partidos`/`UFs`, clicar em UF/linha, arrastar (*brush*) nos eixos |

---

## Ato 01 — No Papel (P1)

### 1. H1 — Histograma Espelhado (*Butterfly Chart*): `% de Mulheres por Chapa (2022 vs. 2026, n ≥ 4)`

**O que está sendo medido**  
Compara lado a lado a distribuição das **chapas eleitorais** (`Federação ou Partido Isolado × UF × Cargo`, com `n ≥ 4`) entre **2022** (lado esquerdo) e **2026** (lado direito). A lei exige no mínimo **30% de mulheres** por chapa.

**Como ler o gráfico**
- **Eixo vertical central (compartilhado):** 5 faixas limpas alinhadas à regra legal — `< 30%` (irregular), **`30%–33,3%`** (faixa crítica colada no piso legal), `33,4%–39%`, `40%–49%` e `50%+`.
- **Linha horizontal tracejada em âmbar (`Piso legal: 30%`):** cruza o gráfico inteiro separando visualmente chapas irregulares (`< 30%`, abaixo) e chapas em conformidade (`≥ 30%`, acima).
- **Lado esquerdo (`2022`, tom neutro) vs. Lado direito (`2026`, terracota):** escalas rigorosamente simétricas e travadas entre `Registradas` e `Aptas`, garantindo comparação visual fiel.
- **Controles no topo (`Registradas` / `Aptas`) e hover:** exibem 1 único rótulo limpo por barra (`%`); ao alternar para `Aptas`, observa-se a migração de chapas que caíram para `< 30%` após inaptidões; ao passar o mouse sobre qualquer barra/faixa, o tooltip exibe os percentuais de 2022 e 2026 e a variação em pontos percentuais (`Δ p.p.`).

**Por que só chapas com `n ≥ 4`?**  
Micro-chapas de 1 a 3 pessoas só conseguem gerar percentuais "aos saltos" (`0%`, `33%`, `50%`, `67%`, `100%`), o que distorceria o histograma. Elas não são apagadas do projeto: continuam em todos os cálculos individuais dos Atos 2–5 e têm sua contagem informada na legenda (`129` micro-chapas / `244` candidaturas em 2022; `91` micro-chapas / `204` candidaturas em 2026).

**O que os dados mostram (Brasil, Federal + Estadual)**
- **2022 (`1.060` chapas `n ≥ 4`):** `95,9%` cumprem ≥ 30% no registro, mas **`54,2%` de todas as chapas ficam espremidas entre 30% e 33,3%**, e apenas `14,0%` passam de 40%. Além disso, `64` chapas caem abaixo de 30% quando olhamos apenas candidaturas `APTO`. → **Vaza nesta Etapa**.
- **2026 (`756` chapas `n ≥ 4`):** o aperto na faixa 30%–33,3% alivia um pouco (`42,3%`), e chapas acima de 40% sobem para `22,1%`, mas a concentração no piso ainda supera o critério de alerta (`≥ 35%`); `17` chapas caem abaixo de 30% ao passar para `APTO`. → **Vaza nesta Etapa**.

**Por que 64 chapas caem abaixo de 30% quando olhamos apenas `APTO` (em 2022)?**  
Candidaturas **`INAPTO`** são aquelas que foram registradas na chapa, mas não chegaram aptas à disputa por **renúncia**, **indeferimento** (pendência documental, falta de quitação eleitoral, inelegibilidade), **cancelamento** ou **falecimento**. A queda não acontece porque mulheres sejam mais inaptas no país inteiro (no geral de 2022, a taxa de inaptidão feminina é até menor que a masculina: `9,14%` vs. `9,79%`), mas sim pela **falta de margem de segurança** nas chapas montadas no limite da lei:
- **49 das 64 chapas (`76,6%`)** já haviam sido registradas coladas no piso (**`30%–33,3%`**), caindo na média de **`33,2%`** no registro para **`25,9%`** entre aptas.
- Em **25 dessas 64 chapas (`39%`)**, bastou **apenas 1 única mulher** ficar inapta para derrubar a chapa inteira abaixo de 30%.
- Somando as 64 chapas, ficaram inaptas **`145` mulheres** contra **`102` homens** — sem reposição a tempo, a cota fica cumprida no papel, mas vaza antes mesmo de a urna abrir (ex.: em 2022, `REPUBLICANOS/SP` Estadual passou de `31/95 [32,6%]` para `26/90 [28,9%]`; `FED:PSDB/CIDADANIA/RJ` Estadual, de `22/72 [30,6%]` para `18/64 [28,1%]`; `PTB/BA` Estadual, de `17/56 [30,4%]` para `16/54 [29,6%]`).

---

## Ato 02 — No Dinheiro (P2)

### 2. H2 — Dumbbell Facetado (`2022` vs. `2026`) de Medianas por Partido + Composição por Fonte

Este passo exibe **dois gráficos empilhados**, ambos facetados com **2022 à esquerda** e **2026 à direita**.

#### Gráfico 2A (superior) — Dumbbell Facetado: Mediana de Receitas por Partido (`2022` × `2026`, escala linear)

**O que está sendo medido**  
Compara lado a lado, na mesma **escala linear em R$ mil**, a **receita total mediana** de candidatas mulheres e candidatos homens `APTO` (que prestaram contas) nos **12 maiores partidos** do recorte (por soma de candidaturas em 2022 e 2026, com pelo menos 5 mulheres e 5 homens).

**Por que mediana e não média?**  
Em eleições, poucos candidatos arrecadam milhões e puxam a média para cima. A **mediana** mostra o valor da candidatura "típica" (metade arrecadou mais, metade arrecadou menos).

**Como ler o gráfico**
- **Facetas horizontais (`2022` à esquerda | `2026` à direita):** compartilham o mesmo eixo vertical de partidos e a mesma **escala linear horizontal** (a partir de `R$ 0`), permitindo comparar diretamente a distância F vs. M e o salto nominal de recursos entre as duas eleições.
- **Eixo horizontal (X):** receita mediana em **R$ mil** (escala linear).
- **Eixo vertical (Y):** os 12 partidos com mais candidaturas no recorte.
- **Círculo terracota:** mediana das **Mulheres**.
- **Círculo azul:** mediana dos **Homens**.
- **Linha cinza ligando os dois círculos:** quanto maior a linha, maior a desigualdade dentro daquele partido. Se o círculo terracota está à **esquerda** do azul, a candidatura feminina típica recebeu menos que a masculina naquela legenda.
- **Interação:** passe o mouse para ver os valores exatos do ano focado e a comparação com o outro ano (`2022` ↔ `2026`) mais a razão `F/M`; **clique em qualquer círculo** para filtrar o site inteiro para aquele partido.

#### Gráfico 2B (inferior) — Barras Empilhadas 100% Facetadas (`2022` vs. `2026`): Composição das Fontes

**O que está sendo medido**  
Mostra de onde vem cada R$ 100 arrecadados por **Mulheres** e por **Homens**, divididos em 4 fontes:
- **FEFC** (terracota) e **Fundo Partidário** (laranja): **dinheiro público**, sujeito à regra de cota mínima de 30% (ADI 5617).
- **Recursos Próprios** (bege) e **Doações Privadas/Outros** (azul): **dinheiro privado**, que não tem cota legal.

**O que os dados mostram**
- Olhando só a mediana geral nacional, mulheres chegam a empatar ou superar homens (`R$ 49,7 mil` F vs. `R$ 42,5 mil` M em 2022; `R$ 73,3 mil` vs. `R$ 72,2 mil` em 2026) — mas isso acontece quase exclusivamente pela obrigatoriedade do **dinheiro público** (`91,0%` da receita feminina em 2022 e `90,6%` em 2026 vêm de FEFC+FP, contra `78,4%` e `76,9%` nos homens).
- Quando separamos o **recurso privado/próprio**, o abismo aparece: em 2022, a mediana privada feminina é de apenas **`R$ 22`** contra **`R$ 2.128`** dos homens (em 2026: `R$ 1.341` vs. `R$ 5.187`). Além disso, em **5 dos 10 maiores partidos** em 2022 (PL, UNIÃO, REPUBLICANOS, MDB, PODE) e **7 de 10** em 2026, a mediana total feminina é menor que a masculina. → **Vaza nesta Etapa**.

**Por que em alguns partidos a mediana das mulheres aparece maior que a dos homens?**  
Isso ocorre por dois mecanismos diferentes:
1. **Efeito piso do Fundo Público + concentração masculina no topo (maioria dos casos):** a mediana mede apenas a candidatura do meio (`50%`), não o topo da tabela (`P90`). Para cumprir a cota obrigatória de 30% do Fundo Público sem risco, vários partidos espalham verba pública para quase todas as mulheres, enquanto entre os homens deixam uma fatia maior da base com `R$ 0` de Fundo Público e concentram os valores milionários nos homens mais competitivos. Assim, a **mediana** feminina fica maior, mas os homens seguem na frente na **média** e no **topo (P90)**:
   - `PSB` (2022): mediana `R$ 80k` F > `R$ 61k` M, mas média `R$ 181k` < `R$ 232k` e P90 `R$ 444k` < `R$ 489k` (`9%` dos homens sem Fundo Público vs. `3%` das mulheres).
   - `PDT` (2022): mediana `R$ 50k` F > `R$ 42k` M, mas média `R$ 108k` < `R$ 137k` e P90 `R$ 200k` < `R$ 331k`.
   - `PATRIOTA` (2022): mediana `R$ 32k` F > `R$ 22k` M (`23%` dos homens sem Fundo Público vs. `7%` das mulheres), mas média `R$ 94k` < `R$ 109k`.
   - `UNIÃO` (2026): mediana `R$ 542k` F > `R$ 428k` M, mas média `R$ 740k` < `R$ 795k` e topo P90 **`R$ 1,65M` F vs. `R$ 2,70M` M**.
   - `PSDB` (2026): mediana `R$ 52k` F > `R$ 33k` M (`35%` dos homens sem Fundo Público vs. `8%` das mulheres), mas média `R$ 155k` < `R$ 201k` e P90 `R$ 506k` < `R$ 610k`.
2. **Priorização real acima da cota (caso do `PT`):** o PT repassou às mulheres uma fatia de Fundo Público superior ao peso feminino na chapa (`40,8%` em 2022 e `52,2%` em 2026), fazendo **tanto a mediana quanto a média** femininas superarem as masculinas (`2022`: média `R$ 382k` vs. `R$ 363k`; `2026`: média `R$ 598k` vs. `R$ 432k` e P90 `R$ 1,49M` vs. `R$ 1,23M`).
3. **No dinheiro privado, homens seguem à frente em todos:** mesmo nesses partidos, a mediana de recursos privados/próprios masculina é maior ou igual à feminina em todos os 12 maiores partidos (ex.: `UNIÃO 2026` `R$ 3k` F vs. `R$ 22k` M; `PT 2026` `R$ 12k` vs. `R$ 31k`).

---

### 3. H3 — Gráfico de Dispersão (Bolhas, Escala Logarítmica): `% de Candidatas × % do Fundo Público`

**O que está sendo medido**  
Testa se, quando um partido lança **mais do que 30% de mulheres**, ele repassa uma fatia **proporcional** do Fundo Público (`FEFC + Fundo Partidário`) ou se "trava" o repasse próximo dos 30%.

**Por que escala logarítmica (`log₁₀`) + modo `Foco (≤46%)`?**  
Nos dados reais, cerca de **90% dos partidos** (que concentram mais de `99,9%` de todo o Fundo Público) ficam entre `32%` e `44%` de candidatas e entre `23%` e `55%` de verba pública feminina, enquanto 3 ou 4 micro-partidos extremos (como `UP`, `PCO`, `PSTU` e `NOVO` em 2022, ou `DEMOCRATA` em 2026) ficam isolados em `0%` ou `65%–81%`. Para evitar que esses extremos esmaguem todas as bolhas grandes num canto:
- **Escala `log₁₀` nos dois eixos (padrão):** ajusta automaticamente os limites de X e Y aos valores positivos reais, ampliando o espaçamento relativo na região de `30%–45%` e comprimindo o topo da escala.
- **Modo `Foco (≤46%)` (padrão) vs. `Todos`:** abre o quadro no miolo onde estão os grandes partidos (até `46%` em X e `58%` em Y) para eliminar a condensação visual. Todos os partidos que ficam fora desse recorte — ou com `0%` na escala `log₁₀` (como o `NOVO` em 2022) — são **listados explicitamente logo abaixo do gráfico** e podem ser vistos a qualquer momento clicando em **`Todos`** ou **`Escala Linear`**.
- **Diagonal `Y = X` sempre reta:** como X e Y usam a mesma transformação `log₁₀`, a linha de proporcionalidade perfeita (`log₁₀(Y) = log₁₀(X)`) permanece uma reta exata: acima dela (verde) o repasse é proporcional ou superior; abaixo dela (terracota) há subfinanciamento relativo.

**Como ler o gráfico**
- **Cada bolha** é um partido com pelo menos `10` candidaturas `APTO` e algum Fundo Público.
- **Eixo horizontal (X, escala `log₁₀`):** `% de candidatas mulheres (APTO)` no partido.
- **Eixo vertical (Y, escala `log₁₀`):** `% de todo o Fundo Público (FEFC + FP)` do partido que foi para mulheres.
- **Tamanho (raio) da bolha:** volume total de Fundo Público do partido (em R$ milhões, área proporcional ao valor). Os 10 maiores partidos exibem a sigla com afastamento automático de colisões.
- **Diagonal cinza tracejada (`Y = X`):** linha de **proporcionalidade perfeita** (ex.: 35% de candidatas recebendo 35% da verba pública).
- **Linhas pontilhadas vermelhas em `30%` (X e Y):** piso mínimo legal.
- **Cor da bolha:**
  - **Verde (`Y ≥ X`):** o partido destina às mulheres uma fatia igual ou superior ao peso feminino na chapa.
  - **Terracota/vermelha (`Y < X`):** o partido fica **abaixo da diagonal** (subfinanciamento relativo ao número de candidatas).
- **Interação:** use os botões **`Escala Log` / `Escala Linear`** e **`Foco (≤46%)` / `Todos`** no topo do gráfico; passe o mouse sobre qualquer bolha para ver o detalhamento completo; **clique em uma bolha** para filtrar o partido.

**Como ler o cartão ao passar o mouse (tooltip)**  
Ao repousar o cursor sobre uma bolha, aparecem 4 linhas (exemplo real de `UNIÃO` em 2022):
1. **`UNIÃO · 1.349 candidaturas APTO`:** sigla do partido e total de candidaturas aptas (`F + M`) no recorte ativo.
2. **`Mulheres na chapa: 33,3% (449 mulheres)`:** valor do **eixo X** — percentual e quantidade exata de candidatas mulheres do partido.
3. **`Fundo Público p/ mulheres: 31,6% (R$ 223,2M de R$ 706,6M)`:** valor do **eixo Y** — fatia do Fundo Público (`FEFC + FP`) que foi para mulheres, seguida de **quanto efetivamente foi para mulheres** (`R$ 223,2M`) do **total de Fundo Público do partido inteiro** (`R$ 706,6M`, que também define o tamanho da bolha).
4. **`Proporcionalidade: 0,95× (-1,7 p.p. · abaixo do proporcional)`:** mede se o partido cumpre a regra de proporcionalidade da ADI 5617 do STF (se mulheres são `35%` da chapa, deveriam receber ao menos `35%` do Fundo Público). A conta divide o eixo Y pelo eixo X (`31,6% ÷ 33,3% = 0,95×`) e mostra também a diferença em pontos percentuais (`31,6% − 33,3% = -1,7 p.p.`).
   - **Leitura intuitiva:** pense como *"para cada R$ 1,00 de Fundo Público que seria proporcional ao peso feminino na chapa, quanto de fato chegou às mulheres?"*
   - **`1,00×` (`0,0 p.p.` · R$ 1,00):** repasse perfeitamente proporcional (em cima da diagonal `Y = X`) — em média, cada mulher recebeu o mesmo valor público que cada homem.
   - **`< 1,00×` (negativo · bolha terracota):** mulheres receberam proporcionalmente **menos** que seu peso na chapa (ex.: `0,95×` = **R$ 0,95** para cada R$ 1,00 proporcional).
   - **`> 1,00×` (positivo · bolha verde):** mulheres receberam proporcionalmente **mais** (ex.: `PT` em 2022 marca `1,09× · +3,3 p.p.` = **R$ 1,09** para cada R$ 1,00 proporcional).

**O que os dados mostram**
- No agregado nacional (`Federal + Estadual`), a regra judicial do STF (ADI 5617) funciona: em **2022**, mulheres são `34,2%` das candidaturas `APTO` e recebem `34,4%` do Fundo Público (`razão 1,00×`; `18` partidos acima/sobre a diagonal e `14` abaixo; `PT` e `PSDB` aparecem claramente acima da linha, enquanto `UNIÃO`, `PP`, `PL`, `PSB` e `MDB` ficam abaixo; `NOVO` em `0%` e `UP`/`PSTU`/`PCO` aparecem na nota de extremos). Em **2026**, são `35,9%` das candidaturas e recebem `36,6%` (`razão 1,02×`; `16` acima e `12` abaixo, com `PT` em destaque acima e `PL`/`PDT` abaixo). → **A Cota Funciona** no agregado.

**Por que há tantos partidos acima de `1,00×` — e o que muda ao filtrar por cargo?**  
Ver várias bolhas verdes não é erro de cálculo nem enfraquece a pergunta principal; na prática, revela **dois mecanismos importantes**:
1. **Mais bolhas verdes não significa mais dinheiro:** em `Federal + Estadual`, os partidos acima de `1,00×` são maioria em quantidade (`18/32` em 2022; `16/28` em 2026), mas tendem a ser menores — **os partidos abaixo da diagonal concentram mais da metade de todo o Fundo Público** (`51,5%` em 2022 e `52,9%` em 2026).
2. **Compensação entre cargos (`Federal` vs. `Estadual`):** como o TSE cobra os 30% sobre o bolo total do partido, muitas legendas pagam acima da proporção nas campanhas **Estaduais** (mais baratas) e subfinanciam mulheres nas campanhas **Federais** (mais caras e disputadas). Clique nos filtros de cargo no topo para ver a virada:
   - **Só Deputado Federal:** em 2022 cai para **`0,91×`** (`35,3%` cand. → `32,0%` Fundo Público, com **`76,9%`** do dinheiro em partidos abaixo da diagonal); em 2026 cai para **`0,90×`** (`37,3%` → `33,8%`, com **`87,8%`** do dinheiro abaixo da diagonal). → **Vaza nesta Etapa**.
   - **Só Deputado Estadual:** em 2022 sobe para **`1,17×`** (`33,6%` → `39,4%`); em 2026 sobe para **`1,24×`** (`35,0%` → `43,3%`).
3. **Relação com a pergunta principal:** mostrar onde a lei **funcionou** (Fundo Público agregado) em contraste com onde **vaza** (cargo Federal, recursos privados em H2 — onde mulheres ficam com só `15,8%`–`16,8%` — e urnas/cadeiras em H5) demonstra que cumprir o piso público agregado não bastou para levar mulheres ao poder.

---

### 4. H4 — Fluxo da Verba Pública (Sankey) e Rede de Fornecedores-Hub

Este passo tem **duas abas** alternáveis no topo do palco (`Sankey` e `Rede de Hubs`).

#### Gráfico 4A (aba `Sankey`) — Diagrama de Sankey do Fluxo Proporcional do Fundo Público

**O que está sendo medido**  
Rastreia **para onde vai o dinheiro público gasto pelas campanhas** de mulheres e de homens, separando gastos de campanha própria de possíveis desvios ou concentrações.

**Como ler o gráfico**
- Leia sempre da **esquerda para a direita** (a espessura de cada faixa é proporcional ao valor em **R$ milhões**):
  1. **Coluna esquerda:** `Fundo Público (FEFC+FP)` total efetivamente gasto.
  2. **Coluna central:** divisão entre `Candidatas (F)` (terracota) e `Candidatos (M)` (azul).
  3. **Coluna direita (5 destinos):**
     - **Campanha Direta (Exclusiva)** *(verde)*: fornecedores externos (gráficas, equipe local, motoristas, produtoras etc.) que atenderam **apenas 1 candidatura `APTO`** dentro daquela chapa naquele estado (`UF × Chapa`). Indica gasto em estrutura própria da campanha.
     - **Fornecedor Compartilhado** *(laranja)*: fornecedores externos (mesmo CNPJ ou CPF) contratados por **2 ou mais candidaturas `APTO`** da mesma chapa no mesmo estado. Inclui casos totalmente legítimos (mesmo contador, advogado eleitoral, gráfica grande ou plataformas como Meta/Google), mas também é o canal monitorado para desvios indiretos (ex.: material "dobradinha" pago por candidatas para promover outro nome da chapa).
     - **Direção Partidária** *(laranja)*: repasses/doações financeiras de volta para o partido.
     - **Outras Candidaturas (M)** *(azul)* e **Outras Candidaturas (F/ND)** *(cinza)*: repasses de recursos para outros candidatos.
- **Cuidado na interpretação:** compartilhar fornecedor, por si só, **não é prova de fraude** — tanto homens quanto mulheres gastam fatia parecida em fornecedores compartilhados (`~31%–36%`). Por isso existe a segunda aba (**Rede de Hubs**), que filtra apenas os fornecedores compartilhados ligados a campanhas com baixíssima votação.
- **Nota metodológica importante:** nos arquivos do TSE, a tabela de despesas contratadas não diz qual conta bancária (pública ou privada) pagou cada nota fiscal. Por isso, o Sankey atribui a parcela pública de cada despesa proporcionalmente à fração de Fundo Público na receita total da candidatura (`(FEFC + FP) / receita_total`).

**O que os dados mostram**
- No agregado nacional, mulheres **não** desviam mais dinheiro diretamente para partidos ou candidatos homens do que os próprios homens (`0,66%` F vs. `3,11%` M em 2022; `0,26%` vs. `1,83%` em 2026), e a fatia em fornecedores compartilhados também é similar (`31,2%` F vs. `32,2%` M em 2022; `35,3%` vs. `36,1%` em 2026). → **A Cota Funciona** no agregado, o que leva à segunda aba para inspecionar casos localizados.

#### Gráfico 4B (aba `Rede de Hubs`) — Grafo de Rede Bipartida (Candidaturas Anônimas × Fornecedores-Hub)

**O que está sendo medido**  
Mesmo quando o agregado parece limpo, existem focos suspeitos localizados? Esta rede mapeia os **top 15 fornecedores-hub** (por valor financeiro) do recorte ativo, organizados em **constelações separadas por grupo (`Partido/UF`)** para evitar sobreposição.

Um fornecedor entra como **fornecedor-hub** somente se cumprir **duas condições simultâneas**:
1. Atender **≥ 2 candidaturas `APTO`** do mesmo partido e mesma UF; **e**
2. Absorver **mais de 15% de toda a despesa** de pelo menos uma candidatura com **menos de 20 votos**.

**Como ler o gráfico**
- **Círculos pontilhados de fundo com rótulo (`Partido/UF`):** agrupam visualmente cada constelação conectada (um fornecedor-hub e suas candidaturas, ou vários hubs que compartilham candidaturas no mesmo partido/UF).
- **Quadrados pretos:** fornecedores-hub (empresas ou fornecedores anonimizados; por LGPD, pessoas físicas e MEIs têm o nome civil mascarado).
- **Círculos:** candidaturas **anônimas** ligadas a esses hubs:
  - **Terracota:** candidata mulher; **Azul:** candidato homem.
  - **Círculo maior com borda preta grossa:** candidatura com **`< 20` votos** (sinal de atenção).
- **Linhas (arestas):** ligam a candidatura ao fornecedor que ela contratou; **quanto mais grossa a linha**, maior a fração do orçamento daquela candidatura concentrada naquele único fornecedor.
- **Legenda no rodapé:** resume os quatro símbolos diretamente no gráfico.
- **Interação:** passe o cursor sobre um **quadrado preto** para destacar apenas aquela constelação e suas ligações em terracota, além de ver o resumo completo (nome/tipo do fornecedor, `Partido/UF`, total de candidaturas, quantas tiveram `< 20` votos e valor total); **clique no quadrado** para filtrar aquele partido.

**O que os dados mostram**
- Em **2022**, a base registra `157` fornecedores-hub ligando `595` candidaturas (`827` conexões). Em **2026**, são `60` hubs ligando `358` candidaturas (`528` conexões).

---

## Ato 03 — Na Urna (P3)

### 5. H5 — Barras Agrupadas em 3 Etapas: Funil de Conversão por Partido

**O que está sendo medido**  
Mostra o "funil" de perda feminina nos **10 partidos que mais elegeram deputados** no recorte (partidos com `n ≥ 15` `APTO` e pelo menos `1` eleito), acompanhando a fatia de mulheres em três momentos consecutivos:
1. **`1. Candidatas`** *(barra bege)*: `% de mulheres entre as candidaturas APTO do partido`.
2. **`2. Votos nominais`** *(barra laranja)*: `% dos votos nominais válidos do partido que foram para mulheres`.
3. **`3. Eleitas`** *(barra terracota)*: `% das cadeiras conquistadas pelo partido ocupadas por mulheres` (apenas eleitas por QP ou Média; suplentes não contam).

**Como ler o gráfico**
- **Eixo horizontal:** os 10 partidos, ordenados do maior para o menor número de cadeiras conquistadas.
- **Eixo vertical (Y):** participação feminina em `%`.
- **Linha horizontal verde tracejada:** referência dos **30%**.
- **Como ler a "escadinha" de cada partido:**
  - Queda da **barra 1 → barra 2:** perda na **disputa por votos** (mulheres recebem menos votos médios que homens da mesma legenda).
  - Queda da **barra 2 → barra 3:** perda na **conversão de votos em cadeiras** (votos femininos ficam pulverizados em candidatas que não atingem o topo da lista do partido, enquanto poucos "puxadores" homens levam as vagas).
- **Interação:** passe o mouse para ver o número de cadeiras e porcentagens; **clique nas barras** para filtrar aquele partido.

**O que os dados mostram**
- **2022:** `34,2%` candidatas → `20,8%` votos nominais → **`17,9%` eleitas** (`277` mulheres em `1.547` cadeiras; razão de conversão `0,52×`). A maior queda ocorre na passagem da chapa para o voto (`-13,4 p.p.`), seguida de nova queda na conversão em cadeiras (`-2,9 p.p.`). → **Vaza nesta Etapa**.
- **2026:** há avanço, mas o vazamento continua forte: `35,9%` candidatas → `24,7%` votos → **`20,6%` eleitas** (`312` de `1.512` cadeiras; razão `0,57×`). Note como partidos se comportam de modo diferente (ex.: em 2026, o PT converte `37,4% → 36,7% → 33,3%`, enquanto o PL vai de `34,1% → 23,5% → 20,1%`). → **Vaza nesta Etapa**.

---

## Ato 04 — A Fraude Oculta (P4)

Os três gráficos deste ato investigam **sinais estatísticos compatíveis com candidaturas fictícias** (popularmente chamadas de "laranjas") usando apenas evidências objetivas dos microdados do TSE:
- **Sinal A (Votação inexpressiva):** candidatura `APTO` com `votos_validos ≤ Limiar A` (padrão `10` votos, ajustável no topo).
- **Sinal B (Conta zerada):** prestação de contas entregue com receita total `= R$ 0` **e** despesa contratada `= R$ 0` (diferente de quem simplesmente não entregou prestação).
- **Sinal C (Pacote padronizado em lote):** dentro do mesmo `(Partido, UF)` entre candidaturas `APTO`, ocorre em **≥ 3 candidaturas** exatamente o mesmo fornecedor externo com mesmo valor positivo na mesma data **ou** exatamente o mesmo valor positivo de repasse de `FEFC`/`FP` em lote.

> **Salvaguarda metodológica (Súmula 73 do TSE):** o terceiro critério usado pela Justiça Eleitoral (*ausência efetiva de atos de campanha*) não existe nos arquivos numéricos do TSE. Além disso, **Sinal B** (`R$ 0`) e **Sinal C** (`valor > 0`) são **mutuamente exclusivos** por definição contábil — portanto, o máximo simultâneo observável nos dados é **2 sinais** (`A + B` ou `A + C`). Os gráficos apontam padrões estatísticos de risco, **nunca acusação individual de fraude**.

---

### 6. H6 — Barras Agrupadas: Volume de Sinais Observáveis por Gênero

**O que está sendo medido**  
Compara a proporção de **Mulheres** (terracota) e **Homens** (azul) `APTO` que acumulam `0 sinais`, `1 sinal` ou `2 sinais (A+B ou A+C)`.

**Como ler o gráfico**
- **3 grupos no eixo horizontal:** `0 sinais` (nenhum alerta), `1 sinal` (um indicador isolado, muito influenciado pelo Sinal C que também ocorre em compras/repasses coletivos legítimos) e **`2 sinais (A+B/C)`** (a coluna crítica: combina votação mínima **com** conta zerada ou pacote padronizado).
- **Eixo vertical (Y):** `% das candidaturas APTO` daquele gênero.
- **Regra do veredicto:** só acusa **Vaza nesta Etapa** se a taxa feminina em `≥ 2 sinais` for mais de **1,25×** a taxa masculina **e** a diferença absoluta superar **1 ponto percentual**.

**O que os dados mostram (com `Limiar A ≤ 10` votos)**
- **2022:** `2,55%` das mulheres (`216` de `8.468`) acumulam `2 sinais`, contra `2,08%` dos homens (`338` de `16.261`) — razão de `1,23×` (diferença de `+0,47 p.p.`). Como não ultrapassa o duplo critério de corte no agregado nacional, o selo é **A Cota Funciona** (mas o próximo gráfico mostra que isso muda quando olhamos por faixa de chapa!).
- **2026:** `1,12%` das mulheres (`71`) vs. `1,00%` dos homens (`114`, razão `1,11×`). → **A Cota Funciona**. *(Experimente arrastar o slider `Limiar A` até 50 votos para testar a sensibilidade.)*

---

### 7. H7 — Boxplot por Faixa de Chapa + Mapa de Sinais por UF

Este passo traz **dois gráficos** (Boxplot acima e Mapa do Brasil abaixo) para testar se os alertas de 2 sinais se escondem justamente nas chapas que cumpriram a cota "no limite".

#### Gráfico 7A (superior) — Boxplot: Taxa de Sinais (`≥ 2`) por Faixa de `% de Mulheres na Chapa`

**O que está sendo medido**  
Separa todas as chapas (`n ≥ 4`) em 4 grupos conforme o percentual de mulheres registradas: `< 30%`, **`30%–33,3%`** (destacada em terracota), `33,3%–40%` e `> 40%`. Para cada chapa, calcula qual `%` das suas candidatas mulheres tem `≥ 2 sinais`.

**Como ler o gráfico**
- **Eixo horizontal (X):** as 4 faixas de composição da chapa.
- **Eixo vertical (Y):** `% de candidatas mulheres com ≥ 2 sinais` dentro de cada chapa (`0%` a `100%`).
- **Boxplot (caixa e traços pretos):** mostra a dispersão entre chapas (a maioria das chapas tem `0%` de alertas, por isso a mediana fica colada no chão e os círculos soltos acima mostram chapas outliers com taxas altas).
- **Círculo grande terracota com borda branca em cada faixa:** é o ponto mais importante para comparar os grupos — representa a **taxa agregada ponderada** (soma de todas as mulheres com `≥ 2 sinais` naquela faixa dividida por todas as mulheres daquela faixa). Passe o mouse sobre ele para ler os números exatos.

**O que os dados mostram**
- **2022:** nas chapas coladas no piso **`30%–33,3%`** (`571` chapas), **`3,4%`** das mulheres acumulam `≥ 2 sinais`, quase **4 vezes mais** do que nas chapas **`> 40%`** (`0,9%` em `141` chapas). → **Vaza nesta Etapa**.
- **2026:** a diferença entre o piso (`0,9%`) e chapas `> 40%` (`1,2%`) desaparece no agregado (`< 30%` ainda marca `6,9%`, mas em apenas `19` chapas). → **A Cota Funciona**.

#### Gráfico 7B (inferior) — Mapa Coroplético do Brasil por UF (Modo Sinais H7)

**O que está sendo medido**  
Mostra, estado por estado, qual percentual das candidatas mulheres `APTO` acumulou **`≥ 2 sinais`**.

**Como ler o gráfico**
- **Escala de cor contínua (amarelo → laranja → vermelho escuro):** vai de `0%` até `≥ 12%` de candidatas com `≥ 2 sinais`. Quanto mais vermelho o estado, maior a concentração de alertas.
- **Cinza claro:** estado `Inconclusivo` (menos de 10 mulheres ou menos de 70% de entregas `FINAL` no recorte filtrado).
- **Interação:** passe o mouse para ver a taxa e a contagem exata (ex.: em **2022**, lideram **SP** com `11,4%` [`122/1.069`], **RR** com `5,9%` e **MA** com `4,6%`; em **2026**, **RR** `7,1%`, **AL** `4,8%` e **PB** `3,7%`). **Clique em qualquer UF** para filtrar o painel inteiro para aquele estado.

---

### 8. H8 — Barras Agrupadas: Comparativo Temporal `2022 vs. 2026` (Adaptação Tática)

**O que está sendo medido**  
Testa a hipótese de **adaptação tática** após o endurecimento da jurisprudência (Súmula 73 do TSE): os partidos pararam de entregar "contas zeradas" óbvias e passaram a registrar despesas/repasses padronizados em lote?

**Como ler o gráfico**
- Compara **sempre os dois anos lado a lado** (**2022** em bege/cinza vs. **2026** em terracota) sobre o universo de **candidatas mulheres `APTO`** (respeitando filtros de Cargo, UF, Partido e Limiar A).
- **4 pares de barras no eixo horizontal:**
  1. **`Zerada (B)`:** `%` de candidatas com conta declarada zerada (`r = 0` e `e = 0`).
  2. **`Padronizada (C)`:** `%` de candidatas inseridas em lote padronizado de despesa externa ou repasse público (`≥ 3` no mesmo partido/UF).
  3. **`Zer.+≤N votos`:** combinação clássica (`Sinal A + Sinal B`).
  4. **`Pad.+≤N votos`:** combinação adaptada (`Sinal A + Sinal C`).

**O que os dados mostram**
- Entre **2022** e **2026**, as **contas zeradas (Sinal B) caíram** de **`5,5%` para `4,5%`**, enquanto as **movimentações padronizadas em lote (Sinal C) subiram** de **`35,6%` para `39,0%`**. Já os casos combinados com votação mínima (`≤ 10` votos) caíram nos dois formatos (`1,2% → 0,8%` nas zeradas e `1,3% → 0,4%` nas padronizadas).
- Como houve queda nas zeradas junto com alta nos lotes padronizados, o veredicto marca **Vaza nesta Etapa**.
- *Nota de cautela para 2026:* a base de prestação de contas tem `97,9%` de entregas `FINAL` (extrato de `20/11/2026`, ainda aguardando julgamento judicial), mas o arquivo de votação de 2026 é de `19/10/2026` (`232` candidaturas `APTO` — `1,3%` — não têm linha no arquivo e assumem `0` votos).

---

## Ato 05 — Geografia da Exclusão (P5)

### 9. H9 — Mapa Crítico por UF + Coordenadas Paralelas (5 Eixos)

Este último ato reúne **todos os 5 estágios da investigação em um único painel interativo**, com 4 botões no topo do palco para alternar o mapa (`Mapa H9 (Etapa)` / `Mapa H7 (Sinais)`) e a unidade das linhas nas coordenadas paralelas (`Eixos: Partidos` / `Eixos: UFs`).

#### Os 5 Eixos (como cada pontuação é calculada)
Para cada UF ou partido, o sistema calcula 5 indicadores na mesma lógica (quanto mais alto, melhor; nas razões `×`, `1,00×` significa paridade exata):
1. **`Inclusão (%)` — Papel:** `% de candidatas mulheres registradas` (comparada ao piso de `30%`, gerando o score `inclusão / 30%`).
2. **`Eq. FEFC (×)` — Dinheiro:** `(% do Fundo Público para mulheres) ÷ (% de candidatas APTO mulheres)`. Se `< 1,0×`, mulheres recebem menos fundo público do que seu peso na chapa.
3. **`Rend. Urna (×)` — Urna (Votos):** `(% de votos válidos femininos) ÷ (% de candidatas APTO mulheres)`. Mede se candidatas conseguem atrair votos na mesma proporção em que concorrem.
4. **`Suc. Cadeiras (×)` — Urna (Cadeiras):** `(% de eleitas) ÷ (% de votos válidos femininos)`. Mede especificamente o passo **votos → cadeiras**, sem contar duas vezes a perda que já aconteceu no eixo anterior.
5. **`Integridade (%)` — Integridade:** `100% − (% de candidatas APTO com ≥ 2 sinais)`. Quanto mais próximo de `100%`, menor a taxa de alertas.

#### Gráfico 9A (superior) — Mapa Crítico do Brasil por UF (Modo H9)

**O que está sendo medido**  
Para cada estado, o algoritmo compara os 5 scores acima e identifica qual etapa teve a **menor pontuação relativa** (desde que abaixo de `0,95`), pintando o estado com a cor daquele gargalo:
- **Marrom:** `Papel`
- **Laranja:** `Dinheiro`
- **Terracota/vermelho:** `Urna (Votos)`
- **Vinho/bordô:** `Urna (Cadeiras)`
- **Mostarda:** `Integridade`
- **Verde:** `Sem Vazamento Crítico` (todas as etapas ≥ `0,95`)
- **Cinza claro:** `Inconclusivo` (amostra `< 10` `APTO`, `FINAL < 70%` ou menos de 3 eixos disponíveis)

**O que os dados mostram**
- Em **2022**, **23 UFs** têm o pior gargalo em **`Urna (Votos)`** e **4 UFs** (**DF, MT, SC e TO**) perdem proporcionalmente mais na etapa **`Urna (Cadeiras)`**.
- Em **2026**, **21 UFs** têm gargalo em **`Urna (Votos)`** e **6 UFs** (**AC, DF, MS, MT, SC e SP**) em **`Urna (Cadeiras)`**.
- Ou seja: depois que as regras legais forçaram o cumprimento formal no Papel e no Fundo Público, o funil eleitoral passou a travar principalmente **na conquista de votos** e, em alguns estados, **na conversão desses votos em cadeiras**.

#### Gráfico 9B (inferior) — Coordenadas Paralelas Interativas (5 Eixos)

**O que está sendo medido**  
Permite comparar o "perfil completo" de cada **Partido** (top 20 partidos com `n ≥ 25`) ou de cada **UF** através dos 5 eixos verticais ao mesmo tempo.

**Como ler o gráfico**
- **Cada linha contínua** atravessa os 5 eixos da esquerda para a direita representando um único partido (ou uma única UF).
- **Cor da linha:** mesma cor do mapa acima (indica qual é a etapa crítica daquele partido/UF).
- **Leitura visual rápida:** linhas que sobem alto nos dois primeiros eixos (`Inclusão` e `Eq. FEFC`) e despencam bruscamente no 3º e 4º eixos (`Rend. Urna` e `Suc. Cadeiras`) mostram visualmente o padrão **"cumpre no papel e no fundo público, mas vaza na urna"**.

**Como interagir (*Brushing & Linking*)**
- **Passar o mouse sobre uma linha:** mostra o nome do partido/UF, sua etapa crítica e os valores exatos nos 5 eixos.
- **Clicar em uma linha:** filtra o painel inteiro para aquele partido (ou UF).
- **Arrastar verticalmente em qualquer eixo (*brush*):** cria uma faixa de seleção (você pode combinar seleções em mais de um eixo ao mesmo tempo!). As linhas fora do intervalo ficam apagadas e **o mapa acima + todos os números da narrativa atualizam na hora** apenas para os partidos/UFs selecionados. Para limpar o *brush*, clique fora da seleção no eixo ou clique no chip `Brush ×` no topo.

---

## Glossário Rápido

- **Chapa:** unidade legal avaliada para a cota de 30% em 2022 e 2026 — é a **Federação partidária** (ex.: `PT/PCdoB/PV`, `PSDB/CIDADANIA`, `PSOL/REDE`) quando o partido faz parte de uma, ou o **Partido Isolado**, sempre por `UF × Cargo`.
- **FEFC:** Fundo Especial de Financiamento de Campanha (principal verba pública eleitoral).
- **FP:** Fundo Partidário (outra fatia de verba pública).
- **Fundo Público:** soma de `FEFC + FP`.
- **Mediana:** valor central que divide o grupo exatamente ao meio (50% abaixo, 50% acima); mais resistente a distorções extremas do que a média.
- **Micro-chapa:** chapa com menos de 4 candidaturas (`n < 4`). Mantida em todos os totais individuais, excluída apenas dos gráficos de percentual por chapa (H1 e H7).
- **QP / Média:** Quociente Partidário e sobras (média) — únicas situações contadas como **eleita/o**; suplentes não contam como cadeira conquistada.
- **Súmula 73 do TSE:** enunciado do Tribunal Superior Eleitoral que define os critérios para caracterização de fraude à cota de gênero (votação zerada ou inexpressiva, prestação de contas zerada/padronizada e ausência de atos efetivos de campanha).
- **Escala logarítmica (`log₁₀`):** transformação logarítmica de base 10 aplicada aos eixos do gráfico de dispersão (H3) para dar espaço proporcional às diferenças na região de `30%–45%` e comprimir valores extremos; exige valores positivos (casos com `0%`, como o `NOVO` em 2022, são informados na nota e exibidos em `Escala Linear`).
