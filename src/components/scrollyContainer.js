/**
 * ScrollyContainer — Motor de scrollytelling não-invasivo.
 * Usa exclusivamente IntersectionObserver (proibido scroll hijacking).
 * Respeita prefers-reduced-motion em saltos programáticos.
 */

export function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function createScrollyContainer({
  stepSelector = '.story-step',
  onStepChange,
  onStepReenter = null,
  getActiveStep,
} = {}) {
  const steps = [...document.querySelectorAll(stepSelector)];
  let manualLockUntil = 0;

  function lockObserver(ms = 550) {
    manualLockUntil = Date.now() + ms;
  }

  function scrollToStep(stepId, { behavior = null } = {}) {
    const stepEl = document.querySelector(`${stepSelector}[data-step="${stepId}"]`);
    if (!stepEl) return;
    lockObserver(650);
    const resolvedBehavior = behavior || (prefersReducedMotion() ? 'auto' : 'smooth');
    stepEl.scrollIntoView({ behavior: resolvedBehavior, block: 'center' });
  }

  steps.forEach((step) => {
    step.addEventListener('click', (e) => {
      if (e.target.closest('a, button')) return;
      lockObserver(550);
      onStepChange(step.dataset.step);
    });
    step.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target.closest('a, button')) return;
        e.preventDefault();
        lockObserver(550);
        onStepChange(step.dataset.step);
      }
    });
  });

  let observer = null;
  if (typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < manualLockUntil) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          const id = visible[0].target.dataset.step;
          if (id && id !== getActiveStep()) {
            onStepChange(id);
          } else if (id && typeof onStepReenter === 'function') {
            onStepReenter(id);
          }
        }
      },
      { rootMargin: '-25% 0px -35% 0px', threshold: [0.15, 0.5, 0.8] },
    );
    steps.forEach((s) => observer.observe(s));
  }

  return {
    lockObserver,
    scrollToStep,
    destroy() {
      if (observer) observer.disconnect();
    },
  };
}
