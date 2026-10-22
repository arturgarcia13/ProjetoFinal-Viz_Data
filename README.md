# A cota no papel e na urna

Visualização interativa sobre a cota de gênero nas eleições brasileiras de 2022 e 2026. O painel segue a mesma geração de candidaturas por quatro etapas — **papel, dinheiro, urna e sombra** — e pergunta, em cada uma, se a presença feminina se mantém ou vaza.

- **2022** é o ano âncora: as prestações de contas estão na versão final.
- **2026** é comparação preliminar: a maior parte das contas ainda não foi julgada.
- Recorte principal: deputadas/os **federais e estaduais**. Distritais aparecem como opção.
- Nenhum nome de candidata ou candidato é exibido. Todos os gráficos são agregados.

## Como rodar

```bash
npm install
npm run build
npm run serve
```

Abra <http://localhost:8000>. `npm run serve` usa o servidor HTTP embutido do Python; qualquer servidor estático funciona. O painel não abre corretamente via `file://` porque carrega JSON com `fetch`.

Para desenvolver:

```bash
npm run build   # gera dist/app.js com esbuild
npm run serve   # serve a pasta na porta 8000
```

## O que o painel mostra

| Etapa | Pergunta | Hipóteses | Figuras |
| --- | --- | --- | --- |
| Papel | As chapas cumprem a cota? O piso virou teto? | H1 | 1–3 |
| Dinheiro | O FEFC e o dinheiro privado acompanham a presença feminina? | H2, H3, H4 | 4–8 |
| Urna | A candidatura vira voto e cadeira? | H5, H6 | 9–14 |
| Sombra | Quais sinais de candidatura fictícia se concentram em quem? | H7, H8, H9 | 15–18 |
| Síntese | Onde cada UF e cada partido perde mais? | H10 | 19–20 |

Cada hipótese termina em um de três veredictos: **a cota funciona nesta etapa**, **a cota vaza nesta etapa** ou **inconclusivo**. O veredicto é recalculado quando o ano, o cargo, a UF, o partido, a faixa de chapa ou o limiar do Sinal A mudam.

### Definições operacionais

- **Papel**: candidatura registrada e proporção de mulheres na chapa. Chapa = legenda ou federação × UF × cargo, com pelo menos quatro candidaturas.
- **Poder**: recursos, votos e cadeiras.
- **Razão de recursos**: `% do FEFC recebido por mulheres ÷ % de mulheres nas candidaturas`. Valores abaixo de 1 indicam vazamento.
- **Razão de conversão**: `% de mulheres eleitas ÷ % de mulheres nas candidaturas`.
- **Sinal A**: votos nominais menores ou iguais ao limiar ajustável (padrão: 10).
- **Sinal B**: prestação declarada com receita e despesa iguais a zero.
- **Sinal C**: mesma legenda, mesmo fornecedor, mesmo valor e mesma data em três ou mais candidaturas.
- **Sinais são compatíveis com candidatura fictícia; não são prova de fraude.** O terceiro elemento da Súmula 73 do TSE — ausência de atos de campanha — não está nos arquivos.

## Dados e método

Fontes: arquivos abertos do Tribunal Superior Eleitoral (TSE).

- `consulta_cand_2022` e `consulta_cand_2026`
- `votacao_candidato_munzona_2022` e `votacao_candidato_munzona_2026`
- `receitas_candidatos_2022` e `receitas_candidatos_2026`
- `receitas_candidatos_doador_originario_2022` e `..._2026`
- `despesas_contratadas_candidatos_2022` e `..._2026`

Junções por `SQ_CANDIDATO` + `ANO_ELEICAO`. **`NR_CPF_CANDIDATO` não é usado como chave**, em linha com a LGPD e a Resolução TSE nº 23.729/2024. Nomes de candidaturas não entram no painel.

### Dinheiro

- **FEFC**: `CD_FONTE_RECEITA = 2` (ou `CD_ORIGEM_RECEITA = 10030203`).
- **Fundo Partidário**: `CD_FONTE_RECEITA = 0`.
- **Repasses entre candidaturas**: `CD_ORIGEM_RECEITA = 10040000` na receita. A base `receitas_candidatos_doador_originario`, ligada por `SQ_RECEITA`, confirma a cadeia do doador, mas não carrega o código da fonte; por isso o FEFC é lido na própria receita, não inferido pelo nome do doador.
- **Despesas**: a rede de fornecedores e o Sinal C usam **despesas contratadas**. Os arquivos de despesas pagas não trazem `SQ_CANDIDATO` nem o CNPJ/CPF do fornecedor no leiaute oficial. As despesas contratadas são um proxy do gasto, não o caixa realizado.
- **Sankey**: a despesa não é vinculada à fonte de receita no TSE; o gasto é alocado proporcionalmente ao FEFC recebido.

### Limites

- **2022**: 95,7% das contas na versão final.
- **2026**: 8,5% das contas na versão final. Ausência de linha não é zero; pode ser prestação pendente. H2, H3, H4, H6, H7, H8, H9 e H10 ficam **inconclusivos** em 2026.
- **Gênero**: o campo do TSE é binário. Pessoas com gênero não divulgável ficam fora dos denominadores de gênero.
- **Incumbência**: não há marcador de reeleição nos arquivos. É uma variável de confusão em H5 e H6.
- **Cadeiras**: “eleitas/os” inclui eleição por quociente partidário e por média; suplentes não entram.
- **Federações**: tratadas como uma unidade de chapa, porque a cota se aplica à chapa.
- **Agregados pequenos**: quando a amostra é insuficiente, o gráfico ou o veredicto diz isso em vez de inventar um resultado.

## Arquivos

```
index.html            narrativa, figuras e método
styles.css            desenho editorial e layout responsivo
src/main.js           orquestra filtros, gráficos e veredictos
src/state.js          filtros, estatísticas, H1–H10 e regras de veredicto
src/data.js           decodifica data/dashboard.json e monta as chapas
src/charts/           os 20 gráficos em D3
data/dashboard.json   candidaturas anonimizadas e fornecedores (4,0 MB)
data/br_uf.json       malha das UFs
dist/app.js           bundle gerado por esbuild
assets/fonts/         Fraunces e Inter servidas localmente
```

O painel usa D3 v7, `d3-sankey` e `topojson-client`. O build é feito com esbuild.

## Interações

- **Ano** e **cargo** trocam o recorte; **Limiar A** muda o Sinal A em todos os gráficos.
- Clique em **UF**, **partido**, **barra do histograma** ou **linha das coordenadas paralelas** para filtrar o painel.
- Arraste no **dispersão de recursos × votos** para selecionar uma faixa; o filtro vale para os demais gráficos. Os pontos e as linhas são codificados por gênero e raça (mulheres/homens negras/os e brancas/os).
- Arraste nos eixos das **coordenadas paralelas** para filtrar partidos por faixa.
- “Limpar filtros” volta ao estado inicial: 2022, federal + estadual, limiar 10.
- Em telas estreitas, gráficos densos ficam em um cartão com rolagem horizontal; o aviso “arraste para o lado” aparece no topo do gráfico.

## Atualização

Dados extraídos e processados em 22 de outubro de 2026. Os números de 2026 são preliminares e podem mudar até a prestação final.
