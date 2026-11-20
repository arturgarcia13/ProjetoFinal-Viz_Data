# A Cota de Gênero Leva Mulheres ao Poder ou Apenas ao Papel?

Aplicação Web interativa em **Scrollytelling** e pipeline reprodutível de dados eleitorais do TSE (2022 como baseline principal, 2026 como comparativo direto e 2018 como referência auxiliar), investigando o cumprimento da cota de gênero de 30% nas eleições para **Deputado Federal e Deputado Estadual** em cinco atos:

1. **No Papel (P1 / H1):** cumprimento formal vs. teto burocrático (30%–33%).
2. **No Dinheiro (P2 / H2–H4):** mediana por partido e fonte, proporcionalidade do Fundo Público (FEFC + FP), Sankey e rede de fornecedores-hub.
3. **Na Urna (P3 / H5):** funil de conversão em 3 etapas (`% Candidatas → % Votos Nominais → % Eleitas`).
4. **A Fraude Oculta (P4 / H6–H8):** sinais acumulados, concentração no piso e evolução tática 2022 → 2026.
5. **Geografia da Exclusão (P5 / H9):** mapa crítico por UF e coordenadas paralelas pelos 5 eixos.

## Documentação e Rastreabilidade (Harness)
- [SPEC.md](SPEC.md) — escopo fechado e arquitetura.
- [docs/plano_de_dados.md](docs/plano_de_dados.md) — dicionário, chaves, regras de limpeza e comparações condicionais.
- [docs/relatorio_cobertura_2022.md](docs/relatorio_cobertura_2022.md) — relatório automático de cobertura por fonte e checagens de sanidade.
- [progress.md](progress.md), [feature_list.json](feature_list.json) e `receipts/` — histórico auditável de entregas.

## Como executar
```bash
# 1. Reprocessar base analítica validada (sem PII) a partir dos CSVs *_BRASIL.csv do TSE
.venv/bin/python -m etl.build_dataset

# 2. Gerar bundle JS (Observable Plot + D3.js)
npm install
npm run build

# 3. Rodar todos os testes (ETL, indicadores e E2E em Puppeteer)
./init.sh

# 4. Servir localmente em http://localhost:8000
npm run serve
```
