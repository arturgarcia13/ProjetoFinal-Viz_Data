# Projeto de Visualização de Dados: A Cota de Gênero Leva Mulheres ao Poder ou Apenas ao Papel?

> **Pergunta Central de Pesquisa:**
>
> *A cota de gênero leva mulheres ao poder ou apenas ao papel? Em que medida a reserva mínima de* $30\%$ *de candidaturas e de recursos públicos se traduz em competitividade eleitoral efetiva, e como diferentes mecanismos de evasão e gargalos institucionais operam ao longo do sistema político?*

## Eixo 1: O Registro da Chapa (Piso de Inclusão vs. Teto Burocrático)

### P1. A cota de gênero de $30\%$ funciona como um piso de inclusão ou tornou-se um teto burocrático para as chapas partidárias?

* **H1 (Acúmulo no Limiar / *Bunching*):** A maioria das chapas cumpre estritamente o mínimo legal, gerando um acúmulo concentrado logo acima do limiar ($30\%$ a $33\%$) e poucas ultrapassam os $40\%$, demonstrando que a cota opera como um teto burocrático na prática.

* **Ajuste Metodológico (Controle do Denominador Discreto):** Como a legislação exige o arredondamento fracionário para cima no cálculo dos $30\%$ ($\lceil 0,30 \times N_{\text{total}} \rceil$), chapas pequenas apresentam percentuais nominais elevados mesmo cumprindo apenas o mínimo inteiro obrigatório. Para evitar esse viés, além do percentual bruto, calcula-se a **Folga sobre o Mínimo Legal (**$\Delta_{\text{cota}}$**)**:
  

  $$
  \Delta_{\text{cota}} = N_{\text{mulheres}} - \lceil 0,30 \times N_{\text{total}} \rceil
  $$

  
  Chapas com $\Delta_{\text{cota}} = 0$ operam estritamente no limite burocrático exigido pela lei.

#### O Impacto Narrativo (O que o dado revela)

| Resultado Empírico | Significado para o Storytelling | Implicação Política e Institucional | 
| ----- | ----- | ----- | 
| **Hipótese Confirmada**  *(Pico massivo entre* $30\%$ *e* $33\%$ */* $\Delta_{\text{cota}} = 0$ *e queda abrupta depois)* | **A Cota como Teto Burocrático:** Prova que as cúpulas partidárias enxergam a presença feminina como um "pedágio" necessário apenas para viabilizar juridicamente o lançamento de candidatos homens (DRAP). A igualdade é tratada como checklist. | Demonstra que a sanção legal garante a presença formal na largada, mas não altera a cultura de recrutamento partidário sem incentivos adicionais. | 
| **Hipótese Refutada**  *(Distribuição suave e contínua com muitas chapas* $> 40\%$ *e* $\Delta_{\text{cota}} \ge 2$*)* | **A Cota como Piso Catalisador:** Demonstra que a legislação ultrapassou a função coercitiva e gerou uma mudança estrutural no recrutamento dos partidos, que passaram a integrar mulheres de forma orgânica. | Indica amadurecimento institucional das legendas e superação da barreira inicial de entrada na vida partidária. | 

#### Visualização Ideal (Vega-Lite)

* **Gráfico Principal:** Histograma de Densidade com Linha de Referência Vertical.

  * **Eixo X:** Percentual de candidatas mulheres na chapa ($0\%$ a $100\%$), com opção de alternar via *toggle* para a métrica de Excesso Inteiro ($\Delta_{\text{cota}}$).

  * **Eixo Y:** Número/densidade de chapas partidárias.

  * **Linha Vertical Destacada:** Linha tracejada em $X = 30\%$ indicando o limiar legal.

  * **Efeito Visual Esperado:** Uma "parede" vertical que nasce exatamente em $30\%$ e despenca logo após $33\%$, criando uma assimetria visual imediata.

## Eixo 2: O Financiamento de Campanha (Paridade Real vs. Maquiagem Contábil)

### P2. O financiamento eleitoral atinge a paridade real ou apenas cumpre a obrigação mínima?

### H2 (Assimetria nos Recursos de Campanha: Público vs. Privado)

* **Declaração:** A receita mediana de candidatas mulheres é sistematicamente inferior à de candidatos homens dentro do mesmo partido, cargo e UF (mesmo controlando por status de reeleição). Essa disparidade é menor nos fundos públicos (FEFC e Fundo Partidário, sujeitos à cota mínima) do que nas doações privadas e recursos próprios, demonstrando que a regra pública atenua, mas não elimina, a assimetria do mercado eleitoral.

#### O Impacto Narrativo (O que o dado revela)

| Resultado Empírico | Significado para o Storytelling | Implicação Política e Institucional | 
| ----- | ----- | ----- | 
| **Hipótese Confirmada**  *(Gap financeiro é significativamente menor nos fundos públicos do que nas doações privadas)* | **O Fundo Público como Escudo Incompleto:** A cota obrigatória garante um "piso de sobrevivência" para as candidatas. Contudo, o financiamento privado e o autofinanciamento permanecem territórios masculinizados que o fundo público não consegue equalizar sozinho. | Prova que a intervenção estatal via cota financeira é indispensável, mas revela que os partidos não aplicam o fundo público de forma progressiva para compensar a desvantagem privada. | 
| **Refutação A (Burla Estrutural)**  *(Gap mediano é IGUAL ou MAIOR nos fundos públicos do que nas doações privadas)* | **O "Efeito Concentração" / Laranjal Financeiro:** Os partidos cumprem formalmente os $30\%$ no agregado direcionando somas milionárias para pouquíssimas "super-candidatas" (cúpula/incumbentes), enquanto a candidata mediana recebe valores irrisórios. | Demonstra a falha da métrica agregada: a cota financeira cumpre a contabilidade global do partido, mas mantém a exclusão na base das candidaturas femininas. | 
| **Refutação B (Paridade Efetiva)**  *(Paridade financeira alcançada tanto no fundo público quanto no privado)* | **O Transbordamento da Igualdade:** A exigência das cotas públicas gerou um efeito indutor na cultura partidária, estruturando campanhas femininas competitivas que também atraem doadores privados. | Indica que a regulação atingiu maturidade estrutural no mercado eleitoral. | 

#### Visualização Ideal (Vega-Lite)

* **Painel 1 — Dumbbell Plot (Gráfico de Halteres):**

  * **Eixo Y:** Partidos / Federações (ordenados pela magnitude do *Gender Funding Gap*).

  * **Eixo X:** Receita Mediana por Candidatura ($\text{R\$}$).

  * **Marcadores:** Ponto Roxo/Rosa (Mediana das Mulheres) e Ponto Azul/Verde (Mediana dos Homens), conectados por uma barra representando o hiato financeiro.

  * **Interatividade:** *Hover* exibe a razão exata ($\text{Mediana}_M / \text{Mediana}_H$); *Click* seleciona o partido e filtra o Painel 2.

* **Painel 2 — Barras Empilhadas** $100\%$ **Coordenadas:**

  * **Estrutura:** Duas barras verticais lado a lado (Homens vs. Mulheres) para o partido selecionado, decompondo a origem do recurso: (1) FEFC/Fundo Partidário, (2) Doações Privadas de Pessoas Físicas/Coletivas e (3) Recursos Próprios.

  * **Filtros Globais:** Dropdown de Cargo/UF (Brasil vs. Ceará), Filtro de Incumbência (`Novatos` vs. `Reeleição`) e Seletor de Ciclo ($2018$, $2022$ e $2026$).

### H3 (O Achatamento Proporcional do Fundo Público)

* **Declaração:** Em partidos com mais de $30\%$ de candidatas registradas, a razão de alocação de recursos públicos ($\text{Razão}_{\text{FEFC}} = \frac{\% \text{FEFC Feminino}}{\% \text{Candidatas Mulheres}}$) fica sistematicamente abaixo de $1,0$: o dinheiro público estaciona no piso mínimo de $30\%$, não acompanhando o crescimento proporcional da bancada feminina na chapa.

#### O Impacto Narrativo (O que o dado revela)

| Resultado Empírico | Significado para o Storytelling | Implicação Política e Legal | 
| ----- | ----- | ----- | 
| **Hipótese Confirmada**  *(*$\text{Razão} < 1,0$ *quando* $\% \text{Candidatas} > 30\%$*)* | **O "Achatamento Proporcional":** O partido aumenta o número de mulheres na chapa, mas trava o cofre no mínimo de $30\%$. A inclusão feminina é diluída: mais candidatas passam a disputar a mesma fatia engessada do bolo público. | Inobservância da regra de proporcionalidade direta (ADI $5617$ / STF e Resoluções do TSE). O piso de $30\%$ é operado como uma taxa fixa máxima. | 
| **Refutação A (Proporcionalidade Efetiva)**  *(*$\text{Razão} \approx 1,0$ *em todas as faixas)* | **A Obediência Escalar:** As cúpulas partidárias respeitam o escalonamento dinâmico. Se a chapa possui $45\%$ de candidatas, $45\%$ da verba do FEFC é integralmente destinada a elas. | Demonstra eficácia da fiscalização da Justiça Eleitoral em impedir que o piso funcione como teto orçamentário. | 
| **Refutação B (Investimento Afirmativo)**  *(*$\text{Razão} > 1,0$ *quando* $\% \text{Candidatas} > 30\%$*)* | **O Impulso de Competitividade:** O partido aloca no segmento feminino uma proporção de recursos públicos superior à própria proporção de candidatas registradas. | Estratégia partidária deliberada de fortalecimento de lideranças femininas. | 

#### Visualização Ideal (Vega-Lite)

* **Scatter Plot de Proporcionalidade com Linhas Guias:**

  * **Eixo X:** Percentual de Candidatas Mulheres no Partido ($\% \text{Candidatas}$).

  * **Eixo Y:** Percentual do FEFC Destinado às Candidatas ($\% \text{FEFC}$).

  * **Linhas de Referência:** Diagonal tracejada de Proporcionalidade Perfeita ($Y = X$, onde $\text{Razão} = 1,0$) e linhas de corte legal ($X = 30\%$ e $Y = 30\%$).

  * **Zona de Subfinanciamento (Área Sombreada):** Região onde $X > 30\%$ e $Y < X$, destacando visualmente o déficit proporcional.

  * **Codificação das Bolhas:** Tamanho proporcional ao volume total do FEFC do partido em $\text{R\$}$; Cor codificando o diagnóstico (Vermelho/Laranja para $\text{Razão} < 0,95$; Verde para $\approx 1,0$; Azul para $> 1,05$).

  * **Visão Coordenada (Click):** Clicar na bolha de um partido abre a distribuição individual (Curva de Lorenz / Lista Ordenada) das candidatas daquela sigla para revelar a concentração interna.

### H4 (Triangulação Financeira e Escoamento para Terceiros)

* **Declaração:** Candidatas mulheres repassam uma proporção significativamente maior dos seus recursos públicos (FEFC/Fundo Partidário) para terceiros — direção partidária, candidaturas masculinas e fornecedores compartilhados de campanhas masculinas — do que os candidatos homens, atuando como indicador de maquiagem contábil ou "devolução indireta" da cota.

* **Ajuste Metodológico (Filtro Topológico Bipartido):** Para evitar poluição visual (*hairball*) na análise de rede, filtram-se apenas **Fornecedores-Hub**, definidos como CNPJs/CPFs que atendem simultaneamente a $\ge 2$ candidaturas do mesmo partido/federação e cujos contratos absorvem $> 15\%$ da despesa pública de ao menos uma candidata mulher com baixa votação.

#### O Impacto Narrativo (O que o dado revela)

| Resultado Empírico | Significado para o Storytelling | Implicação Política e Legal | 
| ----- | ----- | ----- | 
| **Hipótese Confirmada**  *(Mulheres apresentam* $\%$ *de repasses e gastos em fornecedores hubs masculinos significativamente maior que homens)* | **A Autonomia Ilusória / Triangulação Financeira:** O dinheiro público "entra" na conta da candidata para cumprir o checklist do TSE, mas "sai" imediatamente para abastecer a estrutura do partido ou pagar gráficas de candidatos homens ("dobradinhas forçadas"). | Revela o desvio de finalidade da cota do FEFC, utilizando o CNPJ de candidatas mulheres como "ponte contábil" para financiar campanhas masculinas. | 
| **Refutação (Padrões Simétricos)**  *(Proporção de gastos diretos e repasses é equivalente entre gêneros)* | **Gestão e Autonomia Efetiva:** O recurso repassado às mulheres permanece sob gestão direta de suas campanhas e é convertido em serviços exclusivos para sua própria viabilidade eleitoral. | Demonstra que os repasses públicos cumprem sua função constitucional de garantir independência operacional às candidatas. | 

#### Visualização Ideal (D3.js — Gráficos Especiais)

* **Painel 1 — Diagrama de Sankey Interativo (`d3-sankey`):**

  * **Fluxo de Nós:** $\text{Origem (FEFC / Fundo Partidário)} \longrightarrow \text{Gênero do Candidato} \longrightarrow \text{Destino do Gasto}$ (Gastos Exclusivos de Campanha vs. Transferências para Partido vs. Repasses a Outros Candidatos vs. Fornecedores Hubs Compartilhados).

* **Painel 2 — Grafo de Rede Bipartido (`d3-force`):**

  * **Nós:** Candidatos (Rosa = Mulheres, Azul = Homens) e Fornecedores-Hub (Cinza).

  * **Arestas:** Espessura proporcional ao valor transacionado ($\text{R\$}$).

  * **Interatividade (*Brushing & Highlight*):** Clicar em uma gráfica/fornecedor destaca instantaneamente todas as candidatas sem votos que pagaram esse fornecedor e quais deputados homens eleitos do mesmo partido também o utilizaram.

## Eixo 3: A Conversão em Voto e Cadeira (Urna, Dinheiro e Raça)

### P3. A candidatura vira voto e cadeira?

### H5 (O Funil de Conversão e a Barreira da Urna)

* **Declaração:** A razão global de conversão feminina é menor que $1,0$ ($\frac{\% \text{Eleitas}}{\% \text{Candidatas}} < 1,0$): mulheres estão mais presentes no registro inicial do que entre os eleitos, e a maior perda relativa ocorre já na fase de **votação nominal** (antes mesmo do cálculo institucional de quociente partidário e distribuição de sobras).

#### O Impacto Narrativo (O que o dado revela)

| Resultado Empírico | Significado para o Storytelling | Implicação Política e Institucional | 
| ----- | ----- | ----- | 
| **Hipótese Confirmada**  *(*$\text{Razão} < 1,0$*; queda concentrada na transição para Votação Relevante)* | **A Barreira da Urna (Inviabilidade Precoce):** O afunilamento ocorre antes da matemática das vagas. As candidaturas femininas existem no papel, mas chegam subestruturadas à campanha e não atingem patamar competitivo de votos. | Prova que o problema primário não é o design do cálculo proporcional (sobras), mas a falta de viabilidade material dada às mulheres durante a campanha. | 
| **Refutação A (Atrito Institucional)**  *(Perda concentrada na transição entre Votação Relevante e Eleitas)* | **Bloqueio no Guichê Institucional:** As mulheres conquistam votações expressivas na urna, mas ficam de fora do parlamento devido à mecânica intrapartidária do sistema proporcional e regras de sobras ($80/20$). | Desloca o foco da reforma política para o desenho do sistema eleitoral (ex.: listas fechadas com alternância de gênero ou reserva de cadeiras no parlamento). | 
| **Refutação B (Paridade de Conversão)**  *(*$\text{Razão de Conversão} \approx 1,0$*)* | **Eficiência Plena do Pipeline:** A proporção de mulheres eleitas espelha fielmente a proporção de candidatas lançadas na largada. | Indica que o único gargalo para a paridade parlamentar está no volume inicial de mulheres recrutadas pelos partidos. | 

#### Visualização Ideal (D3.js + Vega-Lite)

* **Gráfico Principal — Diagrama de Sankey em Funil (`d3-sankey`):**

  * **Etapas do Pipeline:** $\text{1. Registradas} \longrightarrow \text{2. Deferidas/Aptas} \longrightarrow \text{3. Votação Competitiva } (\ge 10\% \text{ do QE}) \longrightarrow \text{4. Eleitas (Quociente vs. Sobras)}$.

  * **Codificação:** Dois feixes paralelos (Rosa/Roxo = Mulheres; Azul/Verde = Homens) mostrando o estreitamento relativo em cada transição.

* **Visão Secundária Coordenada (Vega-Lite):** Gráfico de barras horizontais por Partido exibindo a Razão de Conversão ($\frac{\% \text{Eleitas}}{\% \text{Candidatas}}$) com linha vertical de referência em $1,0$.

### H6 (Elasticidade Voto-Receita e o Teto de Vidro Interseccional)

* **Declaração:** Parte substancial da diferença de votos entre gêneros se explica pela desigualdade de recursos financeiros; contudo, mesmo após controlar o dinheiro recebido e o status de reeleição, persiste um **resíduo estatístico negativo** na conversão em votos, sendo essa penalidade significativamente maior para **mulheres negras** (pretas e pardas).

* **Ajuste Metodológico (Tratamento de Zeros e Incumbência):** Para evitar a indefinição matemática de $\log_{10}(0)$ e não distorcer a inclinação da reta com candidaturas fantasmas (tratadas na H7), a regressão Log-Log é estimada sobre as **campanhas materialmente ativas** ($\text{Receita} > \text{R\$ } 1.000$ e $\text{Votos} > 10$), com controle explícito para candidaturas de **Não-Incumbentes** (`ST_REELEICAO = Não`).

#### O Impacto Narrativo (O que o dado revela)

| Resultado Empírico | Significado para o Storytelling | Implicação Política e Social | 
| ----- | ----- | ----- | 
| **Hipótese Confirmada**  *(Resíduo negativo significativo após controle de receita, mais severo para mulheres negras)* | **O Teto de Vidro Interseccional:** Mesmo quando uma mulher negra novata recebe exatamente o mesmo montante financeiro que um homem branco novato, ela converte esse dinheiro em menos votos. | Revela barreiras estruturais de capital político prévio, exposição midiática e viés do eleitorado que o financiamento igualitário, sozinho, não neutraliza. | 
| **Refutação A (Determinismo Financeiro Puro)**  *(O resíduo desaparece completamente ao controlar a receita)* | **O Voto Segue Estritamente o Cofre:** Prova que o eleitor não penaliza candidatas por gênero ou raça; toda a disparidade de votos observada nas urnas é reflexo direto do subfinanciamento de campanha. | Demonstra que garantir equidade financeira efetiva e fiscalizar os repasses é suficiente para igualar o desempenho eleitoral. | 
| **Refutação B (Soberania de Conversão)**  *(Resíduo positivo para mulheres negras/brancas em faixas equivalentes)* | **Alta Eficiência Orgânica:** Candidatas de grupos sub-representados conquistam mais votos por real investido (menor Custo por Voto) do que candidatos homens tradicionais. | Sinaliza forte demanda reprimida do eleitorado por renovação e diversidade quando há um mínimo de estrutura financeira. | 

#### Visualização Ideal (Vega-Lite)

* **Scatter Plot Log-Log com Retas de Regressão por Grupo (**$\log_{10}(\text{Receita})$ **vs.** $\log_{10}(\text{Votos})$**):**

  * **Eixo X (Escala Log):** Receita Total da Campanha em Reais.

  * **Eixo Y (Escala Log):** Votação Nominal Conquistada.

  * **Codificação Interseccional (4 Grupos):** Mulheres Negras, Mulheres Brancas, Homens Negros e Homens Brancos.

  * **Camada de Regressão (`transform: regression`):** 4 retas de tendência sobrepostas. A distância vertical entre a reta dos Homens Brancos e a das Mulheres Negras para um mesmo valor de $X$ visualiza diretamente o resíduo interseccional.

  * **Interatividade (*Box/Lasso Brush*):** Selecionar um quadrante de candidatas no gráfico atualiza instantaneamente o Funil de Sankey (H5) e exibe os detalhes nominais.

## Eixo 4: A Integridade do Processo (Candidaturas "No Papel" e Súmula 73)

### P4. Quantas candidaturas parecem existir só no papel?

### H7 (O Teste do Padrão de Controle: Gênero vs. Linha de Base Masculina)

* **Declaração:** A presença acumulada de três sinais operacionais de alerta (**Sinal A:** votação inexpressiva/zerada; **Sinal B:** receita e despesa zeradas ou insignificantes; **Sinal C:** ausência de atos próprios de campanha / repasses triangulados ou renúncia/indeferimento pós-DRAP) é significativamente mais frequente entre candidatas mulheres do que entre candidatos homens, aplicando-se exatamente a mesma régua de corte para ambos os gêneros.

#### O Impacto Narrativo (O que o dado revela)

| Resultado Empírico | Significado para o Storytelling | Implicação Política e Legal | 
| ----- | ----- | ----- | 
| **Hipótese Confirmada**  *(Acúmulo de* $2$ *ou* $3$ *sinais é desproporcionalmente concentrado nas mulheres;* $\text{Odds Ratio} \gg 1$*)* | **A Assimetria do Laranjal:** A disparidade estatística em relação à linha de base masculina prova que candidaturas fictícias são um instrumento fabricado para cumprir burocraticamente a cota de $30\%$, e não desistência orgânica de campanha. | Caracteriza indício robusto de fraude estrutural à cota de gênero nos termos da **Súmula** $73$ **do TSE**. | 
| **Refutação (Padrão Geral de Periferia)**  *(Taxa de ocorrência de sinais é equivalente entre homens e mulheres;* $\text{Odds Ratio} \approx 1$*)* | **A Periferia Partidária Simétrica:** A inexpressividade de votos e recursos afeta ambos os gêneros na mesma proporção, refletindo o abandono de candidatos sem capital político pela burocracia partidária. | Afasta a tese de fraude direcionada exclusivamente à cota feminina, apontando para um modelo geral de recrutamento precário. | 

#### Visualização Ideal (Vega-Lite)

* **Gráfico de Barras Agrupadas por Gênero vs. Volume de Sinais Acumulados (**$0, 1, 2 \text{ ou } 3$ **sinais):**

  * **Controle Interativo (*Slider Parameter*):** Slider dinâmico que permite ao usuário ajustar o limiar de votos do Sinal A (ex.: $\le 1$ voto, $\le 5$ votos, $\le 20$ votos, $\le 50$ votos) e observar em tempo real como a razão de chances (*Odds Ratio*) entre mulheres e homens reage.

### H8 (O "Bunching" da Fraude: Concentração por Faixa de Chapa e Geografia)

* **Declaração:** Chapas partidárias que se situam estritamente no limiar regulatório de $30\%$ a $33\%$ de candidatas ($\Delta_{\text{cota}} = 0 \text{ ou } 1$) apresentam uma densidade de sinais de candidaturas fictícias substancialmente maior do que chapas que atingem $40\%$ ou mais de presença feminina, concentrando-se em UFs e siglas específicas.

#### O Impacto Narrativo (O que o dado revela)

| Resultado Empírico | Significado para o Storytelling | Implicação Política e Legal | 
| ----- | ----- | ----- | 
| **Hipótese Confirmada**  *(Taxa de sinais despenca em chapas com* $> 40\%$ *de candidatas)* | **O Laranjal do Limiar:** Prova que o *bunching* observado na H1 ($30\%\text{–}33\%$) é sustentado artificialmente por candidaturas de fachada. As chapas que "cravam" o mínimo legal são as que mais fabricam candidatas no papel. | Oferece ao Ministério Público Eleitoral e ao TSE um **indicador preditivo de auditoria** focado nas chapas de limiar estrito. | 
| **Refutação (Dispersão Homogênea)**  *(A taxa de sinais independe do* $\%$ *de candidatas da chapa)* | **Fragilidade Difusa:** Candidaturas com sinais de abandono ocorrem de forma espalhada em todas as faixas de composição partidária. | Indica que encostar nos $30\%$ não está estatisticamente associado a maior incidência de candidaturas fictícias. | 

#### Visualização Ideal (Vega-Lite)

* **Painel 1 — Boxplot / Strip Plot por Faixas de Chapa:**

  * **Eixo X:** Faixas de composição da chapa (`30%–33% [Limiar Estrito]`, `33.1%–40% [Intermediária]`, `>40% [Alta Inclusão]`).

  * **Eixo Y:** Taxa de Candidatas com $\ge 2$ Sinais de Alerta na Chapa ($\%$).

* **Painel 2 — Mapa de Coropletas Coordenado (Brasil / Ceará):**

  * Colorido pela intensidade estadual/municipal da taxa de sinais, onde clicar em uma UF filtra instantaneamente a distribuição dos boxplots partidários.

### H9 (A Mutação da Maquiagem Pós-Súmula 73 do TSE: 2022 vs. 2026)

* **Declaração:** Na eleição de $2026$ (primeira eleição geral sob a vigência consolidada da Súmula $73$ do TSE, aprovada em $2024$), observa-se uma redução nas prestações de contas totalmente zeradas ($\text{R\$ } 0,00$ e $0$ votos), acompanhada por um aumento compensatório de prestações de contas **"mínimas e padronizadas em lote"**, demonstrando que a prática fraudulenta se adaptou à jurisprudência em vez de ser erradicada.

* **Ajuste Metodológico (Detecção Algorítmica de Padronização em Lote):** Uma candidatura feminina recebe a flag de *Maquiagem Padronizada* quando pertence a um diretório onde $\ge 3$ candidatas mulheres com votação irrisória ($< 20$ votos) recebem repasses **exatamente idênticos** do FEFC/Fundo Partidário (desvio-padrão intragrupo $= \text{R\$ } 0,00$) ou contratam exatamente o mesmo pacote de fornecedores pelo mesmo valor.

#### O Impacto Narrativo (O que o dado revela)

| Resultado Empírico | Significado para o Storytelling | Implicação Política e Legal | 
| ----- | ----- | ----- | 
| **Hipótese Confirmada**  *(Queda das contas zeradas em 2026 + Aumento das prestações mínimas padronizadas em lote)* | **A Mutação da Maquiagem:** A Súmula $73$ inibiu a fraude amadora (conta zerada), mas induziu os partidos a sofisticar o disfarce, emitindo "kits contábeis padronizados" (ex.: $\text{R\$ } 1.500$ idênticos para 5 candidatas pagarem o mesmo contador/gráfica) para simular campanha ativa. | Revela que a punição jurídica isolada gera adaptação tática. Exige que a auditoria do TSE evolua da busca por zeros para a detecção de **clusters de variância zero**. | 
| **Refutação A (Efeito Dissuasório Real)**  *(Queda geral dos sinais em 2026 sem substituição por padronização)* | **Pedagogia da Sanção:** O risco real de cassação de toda a chapa masculina (Súmula $73$) desestimulou efetivamente o uso de candidatas laranjas. | Demonstra alta eficácia dissuasória da jurisprudência punitiva do TSE. | 
| **Refutação B / Salvaguarda de Dados**  *(Prestação de contas final de 2026 ainda em processamento/retotalização nos TREs)* | **Status em Processamento Parcial:** Contas eleitorais de $2026$ em fase de consolidação pós-pleito. | Ativa o alerta metodológico (*Data Warning Badge*) na interface, comparando $2018 \leftrightarrow 2022$ consolidados e exibindo $2026$ como preliminar. | 

#### Visualização Ideal (Vega-Lite)

* **Gráfico de Barras Agrupadas / Slopegraph Temporal (**$2022 \leftrightarrow 2026$**):**

  * **Eixo X:** Tipologia da Anomalia (`1. Laranja Clássica [Zerada/Sem Votos]` vs. `2. Laranja Contábil [Kit Padronizado em Lote / Dobradinha]`).

  * **Eixo Y:** Percentual de Candidaturas Femininas Sinalizadas ($\%$).

  * **Componente de Salvaguarda:** *Data Warning Badge* dinâmico indicando a data de extração do SPCE/TSE de $2026$.

## Eixo 5: A Síntese Multidimensional do Sistema (Onde o Pipeline Falha?)

### P5. Onde o sistema realmente falha? O pipeline de exclusão de gênero é homogêneo ou assume formas diferentes segundo o partido e a geografia?

### H10 (Heterogeneidade dos Gargalos de Representatividade / Tipologia do Vazamento)

* **Declaração:** A perda de capital político e eleitoral das mulheres não possui um único ponto de estrangulamento universal. O vazamento de representatividade ocorre em etapas distintas a depender da cultura partidária e da unidade federativa (UF): enquanto certas legendas e estados bloqueiam as candidatas na distribuição orçamentária (**Gargalo de Financiamento**), outros perdem tração na conversão de votos (**Gargalo de Urna**), um terceiro grupo perde cadeiras na matemática final do quociente/sobras (**Gargalo Institucional**), e um quarto opera via candidaturas fictícias (**Gargalo de Integridade/Laranjal**).

* **Ajuste Metodológico (Regra Matemática do Gargalo Dominante via** $Z\text{-Score}$**):** Para comparar essas 4 dimensões (que possuem unidades diferentes) e definir a cor dominante de cada UF no mapa, cada métrica estadual é padronizada em desvios-padrão ($Z = \frac{x - \mu}{\sigma}$):

  1. $Z_{\text{Financiamento}}$: Déficit na razão de recursos públicos e privados ($H_2/H_3$).

  2. $Z_{\text{Urna}}$: Magnitude do resíduo negativo de conversão de votos controlado por receita ($H_6$).

  3. $Z_{\text{Institucional}}$: Taxa de perda feminina entre candidatas com votação competitiva ($\ge 10\%$ do QE) e eleitas ($H_5$).

  4. $Z_{\text{Integridade}}$: Proporção de candidatas na UF com $\ge 2$ sinais de candidatura fictícia ($H_7/H_8$).

  * O gargalo dominante da UF é determinado matematicamente por:
    

    $$
    \text{Gargalo Dominante}_{\text{UF}} = \arg\max \left( Z_{\text{Financiamento}}, Z_{\text{Urna}}, Z_{\text{Institucional}}, Z_{\text{Integridade}} \right)
    $$

#### O Impacto Narrativo (O que o dado revela)

| Resultado Empírico | Significado para o Storytelling | Implicação Política e Institucional | 
| ----- | ----- | ----- | 
| **Hipótese Confirmada**  *(O indicador máximo* $\arg\max(Z)$ *varia substancialmente entre UFs e partidos)* | **O Mapa dos Diagnósticos Diferenciados:** Prova que a sub-representação feminina não é um problema monolítico. Há partidos que financiam bem, mas lançam candidatas sem base eleitoral; e outros que estrangulam o caixa ou inflam a chapa com laranjas. | Impede soluções regulatórias genéricas. Exige fiscalização contábil rigorosa em certas regiões e incentivos de formação política ou reforma de lista em outras. | 
| **Refutação A (Gargalo Monolítico Nacional)**  *(Todas as UFs e partidos concentram a perda máxima exatamente na mesma etapa)* | **O Ponto Cego Universal:** Identifica um único "elo fatal" que neutraliza as campanhas femininas em todo o país (ex.: a falta de dinheiro na largada), independentemente da geografia. | Simplifica a agenda de reformas eleitorais, focando toda a energia regulatória em corrigir esse único gargalo primário. | 
| **Refutação B (Paridade Territorial Integrada)**  *(Ausência de desvios críticos em todos os eixos analisados)* | **Equilíbrio Sistêmico:** As variáveis de entrada, financiamento, votação e conversão mantêm-se simétricas entre regiões e siglas. | Sinaliza consolidação da equidade competitiva no sistema proporcional. | 

#### Visualização Ideal (Vega-Lite + D3.js Coordenados)

* **Painel 1 — Mapa Temático Categórico por UF / Município (Vega-Lite):**

  * **Codificação de Cores Categóricas (**$\arg\max(Z)$**):**

    * **Laranja/Vermelho:** Gargalo de Financiamento ($H_2/H_3$).

    * **Roxo/Lilás:** Gargalo de Urna/Conversão ($H_5/H_6$).

    * **Verde/Azul:** Gargalo Institucional de Quociente/Sobras ($H_5$).

    * **Cinza Escuro:** Gargalo de Integridade/Laranjal ($H_7/H_8$).

* **Painel 2 — Gráfico de Coordenadas Paralelas Interativo (`D3.js`):**

  * **Linhas:** Cada linha poligonal representa um Partido ou Federação.

  * **5 Eixos Verticais Padronizados:**

    1. *Inclusão Formal:* $\%$ de Candidatas Mulheres na Chapa ($H_1$).

    2. *Equidade Orçamentária:* Razão de Recursos Públicos $\frac{\% \text{FEFC}}{\% \text{Candidatas}}$ ($H_3$).

    3. *Integridade do Registro:* Taxa de Candidatas com $\ge 2$ Sinais de Alerta ($H_7/H_8$).

    4. *Rendimento nas Urnas:* Razão de Conversão em Votos $\frac{\% \text{Votos}}{\% \text{Candidatas}}$ ($H_5/H_6$).

    5. *Sucesso Parlamentar:* Razão de Cadeiras Conquistadas $\frac{\% \text{Eleitas}}{\% \text{Candidatas}}$ ($H_5$).

  * **Interatividade Avançada (*Multi-Axis Brushing & Linking*):** Arrastar o mouse sobre qualquer faixa de um eixo vertical (ex.: filtrar partidos com alta taxa de sinais no Eixo 3) destaca as linhas correspondentes e atualiza o Mapa do Brasil ao lado.

## Quadro-Síntese Consolidado do Projeto (Alinhado P1–P5 e H1–H10)

| Pergunta de Partida | Hipóteses Vinculadas | Foco do Storytelling | Visualização Principal e Biblioteca (D3.js / Vega-Lite) | 
| ----- | ----- | ----- | ----- | 
| **P1. Piso de Inclusão ou Teto Burocrático?** | **H1** (Acúmulo no Limiar $30\%\text{–}33\%$ e Folga Inteira $\Delta_{\text{cota}}$) | Testar se os $30\%$ funcionam como mola propulsora de inclusão ou como um "pedágio" burocrático que trava as chapas no mínimo legal. | **Histograma de Densidade / Kernel** com Linha de Referência em $X = 30\%$ e alternador para Folga Inteira ($\Delta_{\text{cota}}$) *(Vega-Lite)*. | 
| **P2. Paridade Financeira ou Maquiagem Contábil?** | **H2** (Gap Mediano Público vs. Privado)  **H3** (Achatamento Proporcional)  **H4** (Triangulação e Fornecedores-Hub) | A batalha entre o cumprimento formal do fundo público, o achatamento da razão financeira acima de $30\%$ e o escoamento para gráficas compartilhadas. | **Dumbbell Plot + Barras Empilhadas** $100\%$ (H2), **Scatter Plot com Diagonal** $Y=X$ (H3) *(Vega-Lite)* e **Sankey Financeiro + Grafo de Rede Bipartido** (H4) *(D3.js)*. | 
| **P3. A Candidatura Vira Voto e Cadeira?** | **H5** (Funil de Conversão)  **H6** (Elasticidade Voto-Receita e Resíduo Interseccional) | Onde ocorre o verdadeiro afunilamento (na urna ou nas sobras) e quanto da desigualdade de votos persiste para mulheres negras mesmo igualando o dinheiro. | **Diagrama de Sankey em Funil** (H5) *(D3.js)* coordenado via *Lasso Brush* ao **Scatter Plot Log-Log com Retas de Regressão por Raça/Gênero** (H6) *(Vega-Lite)*. | 
| **P4. Quantas Existem Só no Papel?** | **H7** (Linha de Base Masculina)  **H8** (*Bunching* da Fraude no Limiar)  **H9** (Mutação Pós-Súmula $73$: $2022 \leftrightarrow 2026$) | A prova estatística do "laranjal" comparada aos homens, sua concentração nas chapas de $30\%\text{–}33\%$ e a sofisticação da fraude em $2026$ via kits contábeis padronizados. | **Barras Agrupadas com Slider de Votos e Odds Ratio** (H7), **Boxplot por Faixa + Mapa Coroplético** (H8) e **Barras Temporais** $2022\text{–}2026$ **com Warning Badge** (H9) *(Vega-Lite)*. | 
| **P5. Onde o Sistema Realmente Falha?** | **H10** (Tipologia e Heterogeneidade dos Gargalos via $Z\text{-Score}$) | Síntese multidimensional demonstrando que o vazamento de representatividade muda de natureza conforme a cultura do partido e a geografia estadual. | **Coordenadas Paralelas com *Multi-Axis Brushing*** *(D3.js)* integradas em tempo real ao **Mapa Temático Categórico de Gargalo Dominante** *(Vega-Lite)*. | 
