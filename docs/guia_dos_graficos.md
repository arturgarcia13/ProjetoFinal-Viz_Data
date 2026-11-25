# Guia de Leitura dos Gráficos — A Cota de Gênero Leva Mulheres ao Poder ou Apenas ao Papel?

Este guia documenta os **10 gráficos da aplicação** após a revisão geral de UX, paleta semântica, visões coordenadas, integração da série **2018–2026** no Ato 4 e **auditoria visual sênior quadro a quadro** (desktop `1440×900` / `1280×820` e mobile `390×844`).

---

## 1. Fluxo Editorial Vertical, Funil Narrativo e Paleta Semântica

* **Abertura em funil de 3 passos (acima da dobra):** a faixa de Big Numbers traduz o argumento central logo nos primeiros 5 segundos — **1. No Papel (`% candidatas`) → 2. No Dinheiro (`% Fundo Público`) → 3. Na Urna (`% cadeiras eleitas`)** — com selos de variação sobre `2022` e atualização instantânea pelos filtros.
* **Manchetes-síntese (*Takeaway Headlines*):** cada seção exibe em destaque o achado empírico dinâmico do recorte ativo (`#title-h1`..`#title-h9`) e legenda analítica concisa, reduzindo a dependência de leitura lateral longa e tornando cada quadro autoexplicativo em ~5 segundos.
* **Fluxo editorial vertical:** cada gráfico aparece lado a lado com sua narrativa (ou em largura ampliada em H9), sem palco `sticky` travando o scroll e sem o antigo Panorama em Escala.
* **Barra superior fina (`58px`):** mantém a navegação rápida pelos capítulos (`01 Papel` a `Métodos`), os filtros globais estruturais (`Cargo`, `UF`, `Partido`, `Limpar`) e os **chips ativos** de filtro cruzado. Seletores de ano (`2022 | 2026`), universo (`Registradas | Aptas`), perfil (`Todas | Competitivas Top 10% | Base 90%`) e métrica vivem **dentro do cabeçalho de cada gráfico**.
* **Paleta semântica única ([palette.js](../src/charts/palette.js)):**
  * **Gênero:** Rosa Vibrante (`#FF7AE5`) = **Mulheres** · Amarelo Solar (`#FCE34D`) = **Homens**.
  * **Diagnóstico:** Verde-menta (`#00D09C`) = **Cota respeitada / Superávit feminino** · Laranja-vermelho (`#FF5E2B`) = **Subfinanciamento / Déficit / Irregular (`< 30%`) / Alerta**.
  * **Tempo (`2018`, `2022`, `2026`):** Cinza-gelo translúcido (`2018`), Branco puro / anel vazado (`2022`) e Ciano editorial (`2026`) — nunca reutilizando cores de gênero ou alerta.
* **Visões coordenadas e clique reversível:** clicar em uma faixa de **H1** (ex.: `< 30%`) filtra sincronizadamente os partidos nos gráficos seguintes tanto em `Registradas` quanto em `Aptas`; clicar em um partido destaca-o sem colapsar os demais, e **clicar novamente no ponto, na barra, no fundo vazio do gráfico, em uma linha da matriz H9 ou no chip `×` desfaz a seleção**. Cartões de evidência (`#ev-h1`, `#ev-h2`, `#ev-h5`) também oferecem ações diretas de foco/inspeção.

---

## 2. Mapa dos Gráficos (`H1`–`H9`), Anotações Diretas e Adaptação Mobile (`390px`)

| Ato | Gráfico | Formato, Métrica e Anotações Diretas no SVG | Controles e Adaptação Mobile (`390px`) |
| :---: | :--- | :--- | :--- |
| **01** | **H1** | Histograma espelhado (`2022` branco vs. `2026` ciano) por faixa de `% mulheres` (`n ≥ 4`), linha de piso `30%` e anotações diretas desktop (`Faixas ≥ 40%: 18,6% → 26,5%` e `Teto 30%–33,3%: −11,9 p.p.`). | `Registradas \| Aptas`, clique na faixa coordena `H2–H9`, gaveta *Quem está abaixo de 30%?* com detalhamento percentual. |
| **02** | **H2** | Dumbbell temporal `2022 → 2026` da diferença de medianas (`Δ = Mediana F − M` em R$), ordenado pelo gap de 2026, setas direcionais `2022 → 2026`, aresta verde (`F > M` em 2026) vs. laranja (`F < M`), coluna lateral `Gap 2026` e callout desktop no `UNIÃO` (`Piso p/ 99% F · M lidera P90 →`). | Legenda encapsulada dinamicamente em `390px` acima dos cabeçalhos direcionais (`← Homens lideram \| Mulheres lideram →`), clique destaca/limpa partido. |
| **02** | **H2B** | Barras divergentes pareadas em R$ (`Fundo Público` vs. `Privado/Próprio`) + Barra 100% de composição das fontes (`FEFC`, `FP`, `Próprios`, `Privadas`). | `2022 \| 2026`; em `390px`, rótulos compactos (`+239k`, `−58k`, `−692`) com folga lateral (`pad 0.64`) garantindo 0 colisão barra×rótulo. |
| **02** | **H3** | Dispersão fixa em modo foco e escala linear (`% Candidatas × % Fundo Público`), reta diagonal rotacionada adaptativa `% verba = % mulheres`, quadrantes nomeados (`Cota respeitada`, `Subfinanciamento relativo`, `Descumprimento < 30% verba`), 100% das bolhas vermelhas rotuladas sem colisão e legenda com déficit total em `R$`. | `2022 \| 2026`, escala linear fixa (sem botões de escala/zoom); repulsão AABB + busca determinística garante 0 colisão texto×círculo em `1280px` e `390px` (`−16,2M` compacto no mobile). |
| **02** | **H4** | Sankey 100% proporcional entre mulheres: `Origem da receita → Competitivas (Top 10%) vs. Base (90%) → Eleitas / Não eleitas`, sem nós hub intermediários e com sub-rótulos de `% eleitas` (`Top 10%: 78,3% eleitas` vs. `Base 90%: só 21,7% das eleitas`). | `Todas (100%) \| Competitivas (Top 10%) \| Base (90%)` + `2022 \| 2026`, rótulos exclusivamente em `%` (zero `R$`), cabeçalhos compactos em `390px`. |
| **03** | **H5** | Barras agrupadas horizontais (`% Candidatas → % Votos → % Eleitas`) ordenadas por `% de Eleitas` (PT no topo), faixa-resumo global no SVG (`Mulheres: 34,2% das candidatas → 23,3% dos votos → 17,9% das cadeiras`) e chaves de leitura na linha 0. | `2022 \| 2026`, zero sobreposição de siglas, legenda encapsulada em `390px` (evitando corte de `3. Eleitas`), clique destaca/limpa partido. |
| **04** | **H6** | Linhas conectadas **`2018 → 2022 → 2026`** de `% ≥ 2 sinais` (`Mulheres` vs. `Homens`), linha de marco histórico **`ADI 5617 + Súmula 73`** e pílulas sem colisão com razão `F/M` (`3,7× → 3,6× → 3,4×`). | Slider inline `Limiar Sinal A ≤ N votos` com rótulos adaptados no mobile `390px`. |
| **04** | **H7** | Lollipop comparativo `2022 vs. 2026` (e `2018` opcional) por faixa de chapa (`< 30%`, `30–33,3%`, `33,3–40%`, `> 40%`), bandas de zona `Irregular` e `Piso legal`. | Botão `Mostrar 2018`, escalonamento vertical determinístico por faixa com `2018` ativo evitando colisão de valores em `390px`. |
| **04** | **H8** | Dois painéis em linha **`2018 → 2022 → 2026`**: `Conta Zerada (B)` vs. `Lote Padronizado (C)` e combinações `A+B` / `A+C`. | Reage ao `Limiar Sinal A`; rótulos afastados do eixo `0%` quando séries se separam e legendas compactas em `390px`. |
| **05** | **H9** | Mapa coroplético quantitativo por UF com barra `<linearGradient>` contínua (`Mín → Máx`) + botões de extremos clicáveis (`Maior` / `Menor` UF) + Matriz Heatmap ordenável (`27 UFs \| Top 15 Partidos` × 6 métricas). | Seletor de métrica sincronizado entre mapa e ordenação automática da matriz; faixa `.h9-clear-bar` para desmarcar seleção, clique no fundo da matriz e `.h9-scroll-hint` no mobile `390px`. |
