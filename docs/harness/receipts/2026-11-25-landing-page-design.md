# Receipt — 2026-11-25 — Aplicação de `/landing-page-design` (harmonizado com `docs/DESIGN-SYSTEM.md`)

- **Commit inicial:** `969fb53`
- **Escopo:** Aplicação das regras de conversão, estrutura, AEO, escala tipográfica, espaçamento, raios aninhados, remoção de bordas unilaterais, motion choreography e Tagline Reveal de `/landing-page-design`, preservando a paleta e tipografia (`Anton` + `Barlow`) de [DESIGN-SYSTEM.md](../../DESIGN-SYSTEM.md) e o escopo metodológico/LGPD de [SPEC.md](../SPEC.md).

## O que mudou
- **Estratégia de Conversão, AEO & Ship ([public/index.html](../../../public/index.html), [og-preview.svg](../../../public/assets/og-preview.svg)):**
  - CTA único acima da dobra e CTA final idêntico em `#cta-final` (`Explorar a investigação interativa` → `#escala`), acompanhado de garantia objetiva de transparência.
  - Adicionados bloco `#como-funciona` (3 passos), seção `#faq` (6 perguntas em `<details>` + schema JSON-LD `FAQPage`), tags Open Graph/Twitter com `og:image`, skeleton `.stage-skeleton` no palco e links institucionais/retorno ao topo no rodapé.
- **Tagline Reveal & Scroll Motion ([src/components/scrollReveal.js](../../../src/components/scrollReveal.js), [src/main.js](../../../src/main.js), [src/components/chapterNav.js](../../../src/components/chapterNav.js)):**
  - Nova seção `#tagline-reveal` com iluminação palavra por palavra via `IntersectionObserver` + `rAF` throttle (ativa apenas quando próxima da viewport) e `prefers-reduced-motion`.
  - Tratamento de erro em `init().catch(...)` substituindo o skeleton por alerta inline `role="alert"`; handler delegado de `chapterNav.js` estendido para qualquer `a[href^="#metodo-"]`.
- **Sistema Visual & Gráficos ([public/styles.css](../../../public/styles.css), [src/charts/h3Scatter.js](../../../src/charts/h3Scatter.js), [tests/e2e.mjs](../../../tests/e2e.mjs)):**
  - Todos os `font-size` convertidos para a escala Tailwind (`--fs-xs` a `--fs-6xl`), espaçamentos pela tabela B2 (`--space-0` a `--space-900`), raios pelos tokens `--radius-*`, `max-width: 680px` no hero, zero bordas unilaterais em cartões, zero itálico em HTML/CSS/SVG, `:active { transform: scale(0.98) }` e `cubic-bezier(0.32, 0.72, 0, 1)`.

## Evidências de verificação (pós-última edição)
- `npm run build:vercel` → `dist/app.js 453.8kb`, `site/` com 13 arquivos (`7.66 MB`).
- `./init.sh` → `18 passed in 29.66s`.
- `E2E_ROOT=site node tests/e2e.mjs` → `E2E OK` (`errors: []`, `filterH: 107`, `emCount: 0`, `stepUniformBorder: true`, `statUniformBorder: true`, `hasOgTitle: true`, `hasOgImage: true`, `hasFaqSchema: true`, `mobileCheck: { overlap: false, overflowX: false }`).
- **Revisão adversarial independente (`research`, `8c503df9`):** `APROVADO` após correção dos 5 achados iniciais.

## Riscos residuais
- Alterações estão apenas no working tree local (sem `git commit`/`git push` automático).
