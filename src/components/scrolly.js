/**
 * Scrolly — passos de rolagem em split-screen (35% narrativa / 65% gráfico sticky).
 * Cria os botões .step-dots em cada palco, envia (key, step, prevStep) para transições
 * bidirecionais com constância de objeto e suporta ?steps=full / prefers-reduced-motion.
 */
export const steps = {};

export function stepOf(key) {
  return steps[key] ?? 0;
}

export function isStaticMode() {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return reduced || new URLSearchParams(window.location.search).get('steps') === 'full';
}

export function initScrolly(onStep, { onExitBlock = null } = {}) {
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
          if (isStaticMode()) {
            const key = block.dataset.chart;
            const prevIdx = steps[key] ?? 0;
            applyStepUI(block, i);
            onStep(key, i, prevIdx);
          } else {
            c.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
          }
        });
        dots.appendChild(b);
      });
      metaRow.appendChild(dots);
    }
    const finalStep = Math.max(0, cards.length - 1);
    applyStepUI(block, isStaticMode() ? finalStep : 0);
  });

  // Revela divisores de atos e blocos finais suavemente ao entrarem no viewport
  if (!isStaticMode() && typeof IntersectionObserver !== 'undefined') {
    const revealEls = [...document.querySelectorAll('.act-divider, .recap, .boca-da-taca-section')];
    revealEls.forEach((el) => el.classList.add('reveal-ready'));
    const revObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-revealed');
            revObs.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    );
    revealEls.forEach((el) => revObs.observe(el));
  } else {
    document.querySelectorAll('.act-divider, .recap, .boca-da-taca-section').forEach((el) => el.classList.add('is-revealed'));
  }

  if (isStaticMode()) {
    document.body.classList.add('scrolly-static');
    return;
  }

  let observer = null;
  let exitObserver = null;
  function buildObserver() {
    if (observer) observer.disconnect();
    if (exitObserver) exitObserver.disconnect();
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const block = entry.target.closest('.scrolly-block');
          if (!block) return;
          const key = block.dataset.chart;
          const idx = Number(entry.target.dataset.step);
          const prevIdx = steps[key] ?? 0;
          if (prevIdx === idx) return;
          applyStepUI(block, idx);
          onStep(key, idx, prevIdx);
        });
      },
      { rootMargin: mobileMQ.matches ? '-62% 0px -22% 0px' : '-40% 0px -40% 0px' },
    );
    document.querySelectorAll('.scrolly-block .step-card').forEach((c) => observer.observe(c));

    if (onExitBlock && typeof IntersectionObserver !== 'undefined') {
      const seen = new Set();
      exitObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const key = entry.target.dataset.chart;
            if (entry.isIntersecting) {
              seen.add(key);
            } else if (seen.has(key)) {
              onExitBlock(key);
            }
          });
        },
        { threshold: 0 },
      );
      blocks.forEach((b) => exitObserver.observe(b));
    }
  }

  buildObserver();
  mobileMQ.addEventListener('change', buildObserver);
}
