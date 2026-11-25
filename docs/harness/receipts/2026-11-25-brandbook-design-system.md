# Receipt — Aplicação do Brandbook e Design System

- **Data:** 2026-11-25
- **Commit inicial:** `baf3e6e`

## O que mudou
1. **Tipografia auto-hospedada (`public/assets/fonts/`, `package.json`):**
   - Instalados `@fontsource/anton` e `@fontsource/barlow` e copiados `anton-400.woff2` e `barlow-{400,500,600,700}.woff2` para `public/assets/fonts/` (removidos `fraunces*.woff2`, `inter.woff2` e `@fontsource-variable/{fraunces,inter}`).
2. **Arquitetura visual, tokens e componentes flat ([public/index.html](../../../public/index.html), [public/styles.css](../../../public/styles.css), [src/main.js](../../../src/main.js)):**
   - Aplicados todos os tokens de [DESIGN-SYSTEM.md](../../DESIGN-SYSTEM.md) (`--brand-bg-primary: #00805A`, `--brand-bg-dark: #005C40`, `--brand-bg-darker: #003D2B`, `--brand-yellow: #FCE34D`, `--brand-orange: #FF5E2B`, `--brand-pink: #FF7AE5`, `--brand-text-primary: #FFFFFF`), estética 100% *flat* (sem gradientes, *backdrop-blur* ou sombras pesadas) e `color-scheme: dark` com estilo explícito para `<option>` nos seletores de filtro.
   - Adicionado Hero Editorial em split assimétrico com silhuetas vetoriais chapadas em 3 camadas com sangria inferior-esquerda, asterisco orgânico de 8 pontas no hero e nos 5 atos, CTAs imperativos (`.btn-primary` e `.btn-ghost`) e **Faixa de Big Numbers** dinâmica (`% candidatas`, `% Fundo Público`, `% cadeiras eleitas`) sincronizada com filtros globais e *brush* das Coordenadas Paralelas.
   - Removido `:target-current` em `.act-nav` para evitar duplo destaque simultâneo com `aria-current="true"`.
3. **Paleta de visualização de dados em todos os 9 gráficos ([src/charts/h1Histogram.js](../../../src/charts/h1Histogram.js)–[src/charts/h9MapAndParallel.js](../../../src/charts/h9MapAndParallel.js)) e guia ([docs/guia_dos_graficos.md](../../guia_dos_graficos.md)):**
   - Palco de visualização em Verde Noturno (`#003D2B`) com ordem cromática oficial (`#FCE34D`, `#FF7AE5`, `#FF5E2B`, `#FFFFFF`), halo `#003D2B` nos rótulos sobrepostos (H3, H4 Sankey e Rede) e cartões de tooltip brancos de alto contraste (`12,3:1`).
   - Atualizadas todas as referências de cor em [docs/guia_dos_graficos.md](../../guia_dos_graficos.md) e adicionada validação de tokens/tipografia/Big Numbers em [tests/e2e.mjs](../../../tests/e2e.mjs).

## Evidência
- `npm run build:vercel`: `dist/app.js 419.1kb`, `Vercel output ready in site/: 12 files (7.57 MB)`.
- `./init.sh`: `17 passed in 26.86s`, exit `0`.
- `E2E_ROOT=site node tests/e2e.mjs`: `E2E OK`, `errors: []`, `mobileCheck: { overlap: false, overflowX: false }`.
- Revisão adversarial independente (`research`, contexto frio, somente leitura): 4 achados corrigidos na 1ª rodada e reavaliados como **`APROVADO`** (sem pendências).

## Riscos residuais
- Nenhum bloqueador identificado. Arquivos não relacionados da raiz (`ux_system_scrollytelling_baseado_em_dados_the_pudding.md`) foram preservados sem alteração.
