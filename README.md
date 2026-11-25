# A Cota de Gênero Leva Mulheres ao Poder ou Apenas ao Papel?

Aplicação Web interativa em **Scrollytelling** e pipeline reprodutível de dados eleitorais do TSE (2022 como baseline principal, 2026 como comparativo direto e 2018 como referência auxiliar), investigando o cumprimento da cota de gênero de 30% nas eleições para **Deputado Federal e Deputado Estadual** em cinco atos:

1. **No Papel (P1 / H1):** cumprimento formal vs. teto burocrático (30%–33%).
2. **No Dinheiro (P2 / H2–H4):** mediana por partido e fonte, proporcionalidade do Fundo Público (FEFC + FP), Sankey e rede de fornecedores-hub.
3. **Na Urna (P3 / H5):** funil de conversão em 3 etapas (`% Candidatas → % Votos Nominais → % Eleitas`).
4. **A Fraude Oculta (P4 / H6–H8):** sinais acumulados, concentração no piso e evolução tática 2022 → 2026.
5. **Geografia da Exclusão (P5 / H9):** mapa crítico por UF e coordenadas paralelas pelos 5 eixos.

## Estrutura do Repositório

```text
.
├── public/                 # Entrada HTML, CSS e fontes locais (assets/fonts/)
├── src/                    # Código-fonte JS modular (indicadores e gráficos H1–H9)
├── dist/                   # Bundle gerado pelo esbuild (dist/app.js)
├── data/                   # Base analítica validada (JSONs sem PII)
│   └── raw/                # Dados brutos do TSE (ignorados no Git; ~45 GB)
├── etl/                    # Pipeline DuckDB/Python e geração do relatório de cobertura
├── docs/                   # Proposta, plano de dados, cobertura, guia dos gráficos e harness/
├── scripts/                # Empacotamento estático para Vercel (site/)
└── tests/                  # Suíte pytest (ETL, plano, indicadores) e E2E Puppeteer
```

## Documentação e Rastreabilidade
- [docs/proposta_projeto_final.md](docs/proposta_projeto_final.md) — proposta original do projeto.
- [docs/plano_de_dados.md](docs/plano_de_dados.md) — dicionário, chaves, regras de limpeza e comparações condicionais.
- [docs/relatorio_cobertura_2022.md](docs/relatorio_cobertura_2022.md) — relatório automático de cobertura por fonte e checagens de sanidade.
- [docs/guia_dos_graficos.md](docs/guia_dos_graficos.md) — especificação visual e interativa dos gráficos H1–H9.
- [docs/harness/SPEC.md](docs/harness/SPEC.md), [docs/harness/progress.md](docs/harness/progress.md), [docs/harness/feature_list.json](docs/harness/feature_list.json) e `docs/harness/receipts/` — histórico auditável de entregas.

## Como executar
```bash
# 1. Reprocessar base analítica validada (sem PII) a partir dos CSVs *_BRASIL.csv do TSE
.venv/bin/python -m etl.build_dataset

# 2. Gerar bundle JS (Observable Plot + D3.js) ou artefato completo em site/
npm install
npm run build
npm run build:vercel

# 3. Rodar todos os testes (ETL, indicadores e E2E em Puppeteer)
./init.sh

# 4. Servir localmente em http://localhost:8000
npm run serve
```

## Como baixar os dados brutos do TSE (Google Drive)

> **Nota:** Você só precisa baixar estes arquivos se quiser **reprocessar o pipeline ETL** (`.venv/bin/python -m etl.build_dataset`). Para apenas rodar ou desenvolver o site (`npm run build && npm run serve`), os JSONs já processados em `data/` estão versionados no repositório.

**Pasta no Google Drive:** https://drive.google.com/drive/folders/1dsDaznt5W9vjkb3lQTtuGkeO1G-jBvVs?usp=drive_link

### Opção 1 — Download enxuto pelo navegador (Recomendado: ~10 GB)

O pipeline padrão (`2022` + `2026`, ver `etl/config.py`) lê **apenas os 10 arquivos consolidados `*_BRASIL.csv`** sob `data/raw/` (não é necessário baixar os arquivos separados por UF nem 2018, que somam ~42 GB).

1. Crie as pastas dentro de `data/raw/`:
   ```bash
   mkdir -p \
     data/raw/consulta_cand_2022 \
     data/raw/consulta_cand_2026 \
     data/raw/prestacao_de_contas_eleitorais_candidatos_2022 \
     data/raw/prestacao_de_contas_eleitorais_candidatos_2026 \
     data/raw/votacao-2022/votacao_candidato_munzona_2022 \
     data/raw/votacao-2026/votacao_candidato_munzona_2026
   ```
2. Abra o link do Drive, faça download (botão direito → **Fazer download**) dos 10 arquivos `*_BRASIL.csv` abaixo e salve exatamente nestes caminhos:
   - `data/raw/consulta_cand_2022/consulta_cand_2022_BRASIL.csv` (~16 MB)
   - `data/raw/votacao-2022/votacao_candidato_munzona_2022/votacao_candidato_munzona_2022_BRASIL.csv` (~4,1 GB)
   - `data/raw/prestacao_de_contas_eleitorais_candidatos_2022/receitas_candidatos_2022_BRASIL.csv` (~413 MB)
   - `data/raw/prestacao_de_contas_eleitorais_candidatos_2022/receitas_candidatos_doador_originario_2022_BRASIL.csv` (~53 MB)
   - `data/raw/prestacao_de_contas_eleitorais_candidatos_2022/despesas_contratadas_candidatos_2022_BRASIL.csv` (~1,3 GB)
   - `data/raw/consulta_cand_2026/consulta_cand_2026_BRASIL.csv` (~12 MB)
   - `data/raw/votacao-2026/votacao_candidato_munzona_2026/votacao_candidato_munzona_2026_BRASIL.csv` (~3,0 GB)
   - `data/raw/prestacao_de_contas_eleitorais_candidatos_2026/receitas_candidatos_2026_BRASIL.csv` (~180 MB)
   - `data/raw/prestacao_de_contas_eleitorais_candidatos_2026/receitas_candidatos_doador_originario_2026_BRASIL.csv` (~87 MB)
   - `data/raw/prestacao_de_contas_eleitorais_candidatos_2026/despesas_contratadas_candidatos_2026_BRASIL.csv` (~1,1 GB)

*(Opcional — referência auxiliar de 2018: repita o mesmo padrão dentro de `data/raw/` para `consulta_cand_2018/`, `votacao-2018/votacao_candidato_munzona_2018/` e `prestacao_de_contas_eleitorais_candidatos_2018/`.)*

### Opção 2 — Download completo pelo navegador (~42 GB)

1. Abra o link do Drive e baixe cada pasta uma por vez (botão direito → **Fazer download**): `consulta_cand_2022`, `consulta_cand_2026`, `prestacao_de_contas_eleitorais_candidatos_2022`, `prestacao_de_contas_eleitorais_candidatos_2026`, `votacao-2022` e `votacao-2026` (e as de `2018`, se desejar).
2. O Google Drive divide pastas grandes em múltiplos `.zip`. Descompacte todos dentro de `data/raw/`, mesclando pastas de mesmo nome:
   ```bash
   mkdir -p data/raw && for z in ~/Downloads/*.zip; do unzip -o "$z" -d data/raw; done
   ```
3. Confirme que não ficou nenhuma pasta duplicada (ex.: `data/raw/consulta_cand_2022/consulta_cand_2022/`).

> **Sobre `gdown`:** Evite `gdown --folder` para esta pasta do Drive, pois o `gdown` limita downloads de pasta a 50 arquivos e as pastas `prestacao_de_contas_*` (120 arquivos) e `votacao-*` (60–90 arquivos) excedem esse limite.

### Verificação após o download

Na raiz do projeto, confirme que todos os arquivos estão nos caminhos esperados pelo ETL:

```bash
.venv/bin/python -c "
from etl.config import source_paths
for year in (2022, 2026):
    for name, path in source_paths(year).items():
        status = 'OK' if path.exists() else 'FALTANDO'
        print(f'[{status}] {year}/{name}: {path}')
"
```

A pasta `data/raw/` já está listada no `.gitignore` e não será versionada no Git.
