# Guia de Leitura dos Gráficos — A Cota de Gênero Leva Mulheres ao Poder ou Apenas ao Papel?

Este guia documenta os **9 blocos gráficos da aplicação** (`Gráfico 1` a `Gráfico 8` + `Ato 5 / Mapa em 5 Passos`) após o plano de 31 ajustes editoriais e visuais em arquitetura *Martini Glass* (*scrollytelling* 35%/65% em papel claro + exploração livre na Boca da Taça).

---

## 1. Arquitetura Editorial, Paleta Semântica e Interações

* **Abertura em Plenário Dinâmico de 100 Cadeiras (Hero Esmeralda `#046646` + textura `.editorial-grid-bg`):** traduz o argumento central logo na primeira dobra — **01 · Papel (`34,2%`) → 02 · Dinheiro (`34,4%`) → 03 · Cadeira (`17,9%`, `−16,3 p.p. na urna`)** — em um hemiciclo interativo de 5 fileiras com piso legal de `30%`, conectado aos filtros globais e acompanhado de modal metodológico (`Fonte: TSE`).
* **Scrollytelling em split-screen (35% narrativa / 65% palco sticky):** cada gráfico evolui no mesmo `<svg>` conforme a rolagem pelos cartões `.step-card` (ou cliques nos `.step-dot`), preservando constância de objeto.
* **Paleta semântica clara ([palette.js](../src/charts/palette.js)):**
  * **Papel & tinta:** Creme `#FBF8F1`, superfície `#FFFFFF` / `#F3EFE6`, tinta `#142620`, ardósia `#4B636E`.
  * **Semântica principal:** Esmeralda `#007D5B` (**Acima / Abertura / Cota respeitada**), Coral `#FA532E` (**Mulheres / Alerta / Subfinanciamento**), Ouro `#F8DF4F` / `#C98A00` (**Faixa limiar `30%–33%` / Anéis estruturais ★**), Ardósia `#4B636E` (**Baseline `2022` / Homens**) e Azul `#0284C7` (**Avanço em `2026`**).
* **Hover unificado ([tooltip.js](../src/charts/tooltip.js)):** todos os gráficos usam cartões flutuantes em HTML sem `<title>` nativo no SVG, acessíveis também via teclado (`tabindex="0"`).

---

## 2. Mapa dos 9 Gráficos Ativos

| Ato | Bloco | Tipo e O Que Mostra | Passos e Controles |
| :---: | :--- | :--- | :--- |
| **01** | **Gráfico 1 (`H1`)** | Histograma por faixa de `% mulheres` na chapa (`n ≥ 4`), linha de piso `30%` e comparação `2022` (ardósia `#4B636E` fixo) vs. `2026`. | 4 passos: `2022` → `2022 vs. 2026` (revela `#legend-h1`) → `Registradas` → `Aptas` (mesmo SVG + tween). Clique na faixa filtra partidos nos atos seguintes. |
| **02** | **Gráfico 2 (`H2`)** | Dumbbell da razão das medianas (`Mulheres ÷ Homens`, em `×`, com zoom no intervalo observado) nos Top 10 partidos em `2026` por candidaturas `APTO` com receita (`≥5 F` e `≥5 M` em `2022` e `2026`) + composição em 4 fontes (`H2B`). | 4 passos: `Baseline 2022` → `2022 vs. 2026` (cores fixas por rótulo, sem pontilhados) → `Composição 2022` → `Composição 2022 vs. 2026`. |
| **02** | **Gráfico 3 (`H3`)** | Dispersão quadrada `1:1` (`15%–65%` em toda a largura útil do card) de `% candidatas` × `% Fundo Público F`, com marcação de *outliers* na borda (`NOVO 0% ↓`, `UP 79% ↑`), selo `Cota mínima (30%)` e rótulos dos 5 piores por distância negativa em p.p. | 3 passos: `Cota 30%` → `Diagonal e 5 piores` → `Geral → Dep. Federal` (mesmo SVG com transição fluida). Legenda explica apenas o raio proporcional ao fundo público. |
| **02** | **Gráfico 4 (`H4`)** | Sankey interativo em 3 colunas exclusivamente para candidaturas `APTO` com corte em `1.000` votos: `Origem (Fundo Público FEFC+FP / Recursos Privados)` → `Perfis F/M ≤1000 / >1000` → 4 destinos (`Fornecedores Compartilhados`, `Campanha Direta`, `Repasses a Candidaturas`, `Direção Partidária`). | Realce de caminhos e tooltips detalhados em todos os nós e conexões; responde aos filtros globais da barra superior / Boca da Taça. |
| **03** | **Gráfico 5 (`H5`)** | Barras agrupadas **verticais** (`% Candidatas`, `% Votos`, `% Eleitas`) por partido (até 10 maiores), ordenadas por `% de Eleitas`. | Hover completo por partido, clique para destacar/filtrar sigla e resposta aos filtros globais. |
| **04** | **Gráfico 6 (`H6`)** | Sinais objetivos exclusivamente em candidaturas `APTO`: `Sinal A` (≤ limiar de votos), `Sinal B` (receita zerada `R$ 0`) e `Sinal C` (lote padronizado: `≥3` `APTO` na mesma UF e partido com valor idêntico ao centavo). Sem `≥2` combinados. | 4 passos no mesmo SVG (`2018 F` → `2022 F` → `2026 F` → `2026 F + M`) + slider `Limiar Sinal A ≤ N votos`. |
| **04** | **Gráfico 7 (`H8`)** | Evolução temporal **`2018 → 2022 → 2026`** exclusivamente entre **mulheres aptas**, exibindo `Sinal B` (Conta Zerada), `Sinal C` (Lote Padronizado) e a soma combinada `B + C`. | 3 passos com constância de objeto no mesmo `<svg>`: `2018` → `2022 e 2026` → `Curvas de soma combinada B + C`. |
| **04** | **Gráfico 8 (`#sec-limiar`)** | **Slopegraph** comparando faixas `30%–33%` vs. `>33%` (excluindo `<30%`) em 4 painéis: `Mediana F`, `Proporcionalidade Pública`, `Distribuição Top 10%` e `Mulheres Eleitas`. | 3 passos com carga progressiva de dados (moldura com trilhos vazios até liberar o passo) e seletores locais `Por Chapa \| Por Partido` e `2022 \| 2026`. |
| **05** | **Ato 5 (`H9`)** | Mapa geográfico real das 27 UFs (`data/br_uf.json`) sem linhas conectoras + 8 *callouts* compactos (`RN..RJ`) e pódio lateral em 5 passos estruturais (`Mediana`, `Fundo Púb.`, `Concentração no Top 10%`, `Teto 30–33%`, `Mulheres Eleitas`). | Anéis dourados cumulativos (`★1/4–4/4`), inclusão de **todas as UFs empatadas na 5ª posição** (`selectTopWithTies`, ex.: `RO` e `SE` `#5` em `2022`), seletores locais de ano (`2018 \| 2022 \| 2026`) e cargo (`Todos / Estadual / Federal`), e clique para isolar UF. |
