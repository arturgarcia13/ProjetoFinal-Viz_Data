/**
 * Scrolly — passos de rolagem em split-screen (35% narrativa / 65% gráfico sticky).
 * Cria os botões .step-dots em cada palco, sincroniza o passo ativo via IntersectionObserver
 * (com rootMargin distinto para desktop e mobile) e suporta ?steps=full / prefers-reduced-motion.
 */
export const steps = {};

export function stepOf(key) {
  return steps[key] ?? 0;
}

const FINAL_STEP = 2;

export function isStaticMode() {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return reduced || new URLSearchParams(window.location.search).get('steps') === 'full';
}

export function initScrolly(onStep) {
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const mobileMQ = window.matchMedia('(max-width: 960px)');
  const blocks = [...document.querySelectorAll('.scrolly-block')];

  function applyStepUI(block, idx) {
    const key = block.dataset.chart;
    steps[key] = idx;
    block.dataset.step = String(idx);
    block.querySelectorAll('.step-card').forEach((c, i) => c.classList.toggle('is-active', i === idx));
    block.querySelectorAll('.step-dot').forEach((d, i) => {
      d.classList.toggle('is-on', i === idx);
      d.setAttribute('aria-current', i === idx ? 'step' : 'false');
    });
  }

  blocks.forEach((block) => {
    const key = block.dataset.chart;
    const cards = [...block.querySelectorAll('.step-card')];
    const metaRow = block.querySelector('.chart-meta-row');
    if (metaRow && !metaRow.querySelector('.step-dots')) {
      const dots = document.createElement('div');
      dots.className = 'step-dots';
      dots.setAttribute('role', 'group');
      dots.setAttribute('aria-label', 'Passos deste gráfico');
      cards.forEach((c, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `step-dot${i === 0 ? ' is-on' : ''}`;
        b.setAttribute('aria-label', `Ir ao passo ${i + 1} de ${cards.length}`);
        b.setAttribute('aria-current', i === 0 ? 'step' : 'false');
        b.addEventListener('click', () => {
          c.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        });
        dots.appendChild(b);
      });
      metaRow.appendChild(dots);
    }
    applyStepUI(block, isStaticMode() ? FINAL_STEP : 0);
  });

  if (isStaticMode()) {
    document.body.classList.add('scrolly-static');
    return;
  }

  let observer = null;
  function buildObserver() {
    if (observer) observer.disconnect();
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const block = entry.target.closest('.scrolly-block');
          if (!block) return;
          const key = block.dataset.chart;
          const idx = Number(entry.target.dataset.step);
          if (steps[key] === idx) return;
          applyStepUI(block, idx);
          onStep(key, idx);
        });
      },
      { rootMargin: mobileMQ.matches ? '-62% 0px -22% 0px' : '-40% 0px -40% 0px' },
    );
    document.querySelectorAll('.scrolly-block .step-card').forEach((c) => observer.observe(c));
  }

  buildObserver();
  mobileMQ.addEventListener('change', buildObserver);
}
