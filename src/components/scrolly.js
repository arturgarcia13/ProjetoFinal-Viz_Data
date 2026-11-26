/**
 * Scrolly — passos de rolagem que revelam cada gráfico por etapas.
 * Marca o cartão ativo, publica o passo em `data-step` no bloco/canvas
 * e avisa o chamador só quando o passo muda.
 */
export const steps = {};

export function stepOf(key) {
  return steps[key] || 0;
}

const FINAL_STEP = 2;

/** Modo estático: movimento reduzido ou ?steps=full mostram o estado final sem passos. */
export function isStaticMode() {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return reduced || new URLSearchParams(window.location.search).get('steps') === 'full';
}

export function initScrolly(onStep) {
  if (isStaticMode()) {
    document.body.classList.add('scrolly-static');
    document.querySelectorAll('.scrolly-block').forEach((block) => {
      steps[block.dataset.chart] = FINAL_STEP;
      block.dataset.step = String(FINAL_STEP);
    });
    return;
  }
  document.querySelectorAll('.scrolly-block').forEach((block) => {
    const key = block.dataset.chart;
    const cards = [...block.querySelectorAll('.step-card')];
    steps[key] = 0;
    block.dataset.step = '0';

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const idx = Number(entry.target.dataset.step);
          cards.forEach((c) => c.classList.toggle('is-active', c === entry.target));
          if (steps[key] !== idx) {
            steps[key] = idx;
            block.dataset.step = String(idx);
            onStep(key, idx);
          }
        });
      },
      { rootMargin: '-30% 0px -42% 0px', threshold: 0.08 },
    );
    cards.forEach((c) => observer.observe(c));
  });
}
