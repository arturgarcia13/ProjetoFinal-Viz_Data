# Recibo — Nova Capa Editorial 6/6 & Plenário de 100 Cadeiras

- **Data:** 2026-11-28
- **Commit inicial do ciclo:** `c7d1f11`

## O que mudou

1. **Fontes & Tokens ([public/styles.css](../../public/styles.css), [package.json](../../package.json), [public/assets/fonts/](../../public/assets/fonts/)):**
   - Instalados `@fontsource/playfair-display`, `@fontsource/montserrat` e `@fontsource/red-hat-mono` auto-hospedados (`.woff2` locais) junto a `Inter` e `Newsreader`, sem dependência de CDNs externas.
   - Aplicados tokens `#006247`, `#004D38`, `#085E46`, `#0D6B50`, `#0B5741`, `#2F7D65`, `#79A694`, `#FBF8F1`, `#D4E8E0`, `#F8DF4F`, `#FC7CE5`, `#FA532E` e grade `.editorial-grid` (`48px`).
2. **Navbar Fixa & Hero 6/6 ([public/index.html](../../public/index.html)):**
   - Navbar fixa com pílula central dos 5 atos dot-coded (`#ato-01`..`#ato-05`), botão modal `Fonte: TSE`, botão `Pular para explorar` (`#boca-da-taca`), barra de progresso `#story-progress-bar` e compactação responsiva sem clipping em `390px`.
   - Hero em grid `6/6` (`min-height: 100vh`) com headline `Playfair Display`, faixa de escopo (`VOTOS NOMINAIS`, `CÂMARA & ASSEMBLEIAS`, `LEI DAS COTAS · 30%`), CTAs `Iniciar leitura guiada` (`#ato-01`) + `Explorar meu estado` (`#boca-da-taca`) e rodapé `ROLE PARA INICIAR O ATO 1 · NO PAPEL`.
3. **Plenário Dinâmico de 100 Cadeiras ([src/charts/heroPlenario.js](../../src/charts/heroPlenario.js), [src/main.js](../../src/main.js)):**
   - Hemiciclo `460×228` em 5 anéis (`14/17/20/23/26 = 100` cadeiras), ciclo `3,6s` com pausa automática no clique manual, linha do piso legal `30%` no corredor livre entre a 30ª e a 31ª cadeira (`minDist > 10px`) com pílula alinhada fora do arco, e ligação dinâmica à base TSE (`34,2%`, `34,4%`, `17,9%` em 2022).
4. **Testes & Documentação ([tests/e2e.mjs](../../tests/e2e.mjs), [docs/guia_dos_graficos.md](../guia_dos_graficos.md)):**
   - Asserções atualizadas para tipografia (`Playfair Display`, `Montserrat`), `navClip: false` em `390px`, `hemicycleCollisionCount: 0` (incluindo linha `30%` e pílula) e modal de metodologia.

## Evidências objetivas

- `npm run build:vercel` → `dist/app.js 306.2kb`, `site/` com `29` arquivos (`11.69 MB`).
- `E2E_ROOT=site node tests/e2e.mjs` → `E2E OK` (`seatsCount: 100`, `filledInit: 34`, `heroVals: ['34,2%', '34,4%', '17,9%']`, `hemicycleCollisionCount: 0`, `navClip: false`, `overflowX: false` em `1440×900`, `1280×820`, `768×1024` e `390×844`, `errors: []`).
- `./init.sh` → `18 passed in 30.90s`.
