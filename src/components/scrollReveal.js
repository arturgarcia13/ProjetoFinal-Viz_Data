export function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Inicializa animações de scroll conforme /landing-page-design:
 * 1) Reveal de blocos abaixo da dobra via IntersectionObserver (B7)
 * 2) Tagline Reveal palavra por palavra com listener rAF ligado apenas
 *    enquanto a seção está próxima da viewport (B11)
 */

function setupScrollReveals() {
  const targets = [...document.querySelectorAll('[data-reveal]')];
  if (targets.length === 0) return;

  if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
    targets.forEach((el) => el.classList.add('is-revealed'));
    return;
  }

  targets.forEach((el) => el.classList.add('reveal-pending'));

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-revealed');
        entry.target.classList.remove('reveal-pending');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );

  targets.forEach((el) => observer.observe(el));
}

function wrapTaglineWords(container) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node = walker.nextNode();
  while (node) {
    if (node.nodeValue && node.nodeValue.trim().length > 0) {
      textNodes.push(node);
    }
    node = walker.nextNode();
  }

  const words = [];
  for (const textNode of textNodes) {
    const frag = document.createDocumentFragment();
    const tokens = textNode.nodeValue.split(/(\s+)/);
    for (const token of tokens) {
      if (!token) continue;
      if (/^\s+$/.test(token)) {
        frag.appendChild(document.createTextNode(' '));
      } else {
        const span = document.createElement('span');
        span.className = 'reveal-word';
        span.textContent = token;
        frag.appendChild(span);
        words.push(span);
      }
    }
    textNode.parentNode.replaceChild(frag, textNode);
  }
  return words;
}

function setupTaglineReveal() {
  const section = document.getElementById('tagline-reveal');
  const textEl = section?.querySelector('[data-tagline-text]');
  if (!section || !textEl) return;

  const words = wrapTaglineWords(textEl);
  if (words.length === 0) return;

  if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
    words.forEach((w) => w.classList.add('is-lit'));
    return;
  }

  let rafId = null;
  let active = false;

  function updateWords() {
    rafId = null;
    const rect = section.getBoundingClientRect();
    const vh = window.innerHeight || 800;
    const startY = vh * 0.78;
    const endY = vh * 0.25;
    const span = Math.max(120, startY - endY + rect.height * 0.45);
    const progress = Math.max(0, Math.min(1, (startY - rect.top) / span));
    const litCount = Math.round(progress * words.length);
    for (let i = 0; i < words.length; i += 1) {
      words[i].classList.toggle('is-lit', i < litCount);
    }
  }

  function onScroll() {
    if (!active || rafId !== null) return;
    rafId = window.requestAnimationFrame(updateWords);
  }

  const obs = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          if (!active) {
            active = true;
            window.addEventListener('scroll', onScroll, { passive: true });
            window.addEventListener('resize', onScroll, { passive: true });
          }
          updateWords();
        } else if (active) {
          active = false;
          window.removeEventListener('scroll', onScroll);
          window.removeEventListener('resize', onScroll);
          updateWords();
        }
      }
    },
    { rootMargin: '15% 0px 15% 0px', threshold: 0 },
  );

  obs.observe(section);
  updateWords();
}

export function initScrollMotion() {
  setupScrollReveals();
  setupTaglineReveal();
}
