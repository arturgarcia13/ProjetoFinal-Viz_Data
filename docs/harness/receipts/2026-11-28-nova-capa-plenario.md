# Recibo — Nova Capa Editorial & Plenário de 100 Cadeiras

- **Data:** 2026-11-28
- **Commit inicial:** `c7d1f11`

## O que mudou

1. **Fontes & Tokens ([public/styles.css](../../public/styles.css), [package.json](../../package.json), [public/assets/fonts/](../../public/assets/fonts/)):**
   - Adicionadas `Fraunces` (`500`, `600`, `600 italic`, `700`) e `JetBrains Mono` (`500`, `600`) auto-hospedadas junto a `Inter` e `Newsreader`.
   - Configurados tokens `--emerald-bg` (`#046646`), `--emerald-deep` (`#034731`), `--emerald-card` (`#033927`), `--seat-empty` (`#135740`), `--ink-light` (`#F8FAF9`), `--ink-muted` (`#B8D8C9`), `--cota-yellow` (`#ECD64C`), `--fundo-pink` (`#E872D0`), `--cadeira-coral` (`#EE6A4B`) e textura `.editorial-grid-bg`.
2. **Navbar Fixa & Hero 5/7 ([public/index.html](../../public/index.html)):**
   - Navbar fixa de `64px` (`backdrop-filter: blur(12px)`) com marca em `Fraunces`, 5 âncoras (`01 · Papel` a `05 · Território`), botão clicável `Fonte: TSE`, botão `Explorar dados` e barra de progresso `#story-progress-bar`.
   - Removidas as silhuetas laterais (`.hero-silhouettes-bg`) e os 5 cards duplicados (`.roadmap`); reestruturada a capa em grid `5/7` (`min-h-[calc(100vh-4rem)]`) com CTA `Iniciar leitura guiada` (microanimação `floatDown`) e `Metodologia →`.
3. **Plenário Dinâmico de 100 Cadeiras ([src/charts/heroPlenario.js](../../src/charts/heroPlenario.js), [src/main.js](../../src/main.js)):**
   - Substituído `src/charts/heroFunnel.js` pelo hemiciclo SVG de 5 fileiras (`12/16/20/24/28 = 100` cadeiras), linha radial de `30%`, ciclo de `4,5s` com pausa automática no clique manual, badge `−16,3 p.p. na urna` na etapa 3, `prefers-reduced-motion: reduce` e vínculo dinâmico aos dados reais do TSE (`34,2%`, `34,4%`, `17,9%` em 2022).
4. **Modal de Metodologia & Testes ([tests/e2e.mjs](../../tests/e2e.mjs), [docs/guia_dos_graficos.md](../guia_dos_graficos.md)):**
   - Adicionado `<dialog id="methodology-modal" closedby="any">` com fechamento por `✕`, `Entendi`, `Escape` e clique no backdrop.

## Evidências objetivas

- `npm run build:vercel` → `dist/app.js 306.3kb`, `site/` com `21` arquivos (`11.53 MB`).
- `E2E_ROOT=site node tests/e2e.mjs` → `E2E OK` (`seatsCount: 100`, `filledInit: 34`, `heroVals: ['34,2%', '34,4%', '17,9%']`, `hemicycleCollisionCount: 0` com linha `30%` livre de todas as 100 cadeiras e pílula alinhada à extremidade da linha, `overflowX: false` em `1440×900`, `1280×820`, `768×1024`, `390×844`, `errors: []`).
- `./init.sh` → `18 passed in 24.64s`.
- Revisão adversarial independente (`research`, `8b7f8cab`) → `Veredicto: APROVADO`.

## Riscos residuais

- Em `2026`, `votacao_munzona_2026` no repositório permanece na extração de `19/10/2026` (risco já documentado).
- Arquivo exploratório não rastreado pré-existente `data/definir_corte_de_votos_para_sankey.py` mantido fora do commit.
