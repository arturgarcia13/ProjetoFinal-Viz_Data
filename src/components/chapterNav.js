import { prefersReducedMotion } from './scrollyContainer.js';

/**
 * ChapterNav — Shell de Navegação Hierárquica em 2 camadas + Popover de Acesso Direto aos Gráficos
 * + Divulgação Progressiva (.method-escape abre o <details> alvo em #metodologia).
 */

export const CHAPTER_TREE = [
  {
    act: '0',
    label: 'Intro',
    href: '#escala',
    subs: [
      { id: 'escala-macro', label: 'Mosaico em Escala', type: 'step' },
      { id: 'escala-micro', label: '4 Chapas em Foco', type: 'step' },
    ],
  },
  {
    act: '1',
    label: '01 Papel',
    href: '#ato-1',
    subs: [
      { id: 'h1', label: 'H1 Registro e Piso 30%', type: 'step' },
    ],
  },
  {
    act: '2',
    label: '02 Dinheiro',
    href: '#ato-2',
    subs: [
      { id: 'h2', label: 'H2 Medianas', type: 'step' },
      { id: 'h2-div', label: 'Divergente Privado/Público', type: 'step' },
      { id: 'h3', label: 'H3 Fundo Público', type: 'step' },
      { id: 'h4', label: 'H4 Fluxo & Hubs', type: 'step' },
    ],
  },
  {
    act: '3',
    label: '03 Urna',
    href: '#ato-3',
    subs: [
      { id: 'h5', label: 'H5 Funil 3 Etapas', type: 'step' },
    ],
  },
  {
    act: '4',
    label: '04 Fraude',
    href: '#ato-4',
    subs: [
      { id: 'h6', label: 'H6 Sinais', type: 'step' },
      { id: 'h7', label: 'H7 Piso vs. >40%', type: 'step' },
      { id: 'h8', label: 'H8 2022→2026', type: 'step' },
    ],
  },
  {
    act: '5',
    label: '05 Geografia',
    href: '#ato-5',
    subs: [
      { id: 'h9', label: 'H9 Mapa & Eixos Paralelos', type: 'step' },
    ],
  },
  {
    act: 'synthesis',
    label: 'Síntese',
    href: '#sintese',
    subs: [
      { id: 'sintese', label: 'Achados dos 5 Atos', type: 'anchor' },
      { id: 'como-funciona', label: 'Como funciona', type: 'anchor' },
      { id: 'leituras', label: 'Fontes e Leituras', type: 'anchor' },
      { id: 'faq', label: 'FAQ', type: 'anchor' },
    ],
  },
  {
    act: 'methods',
    label: 'Métodos',
    href: '#metodologia',
    subs: [
      { id: 'metodo-geral', label: 'População & LGPD', type: 'method' },
      { id: 'metodo-h1', label: 'Corte n≥4', type: 'method' },
      { id: 'metodo-h4', label: 'Sankey & Hubs', type: 'method' },
      { id: 'metodo-h6', label: 'Súmula 73', type: 'method' },
      { id: 'metodo-h8', label: 'Cobertura 2026', type: 'method' },
    ],
  },
];

export function openMethodDetails(hashId) {
  const cleanId = (hashId || '').replace(/^#/, '');
  if (!cleanId) return;
  const target = document.getElementById(cleanId);
  if (!target) return;
  const details = target.tagName === 'DETAILS' ? target : target.closest('details');
  if (details) details.open = true;
}

export function createChapterNav({ onJumpStep, onLayoutChange } = {}) {
  const actLinks = [...document.querySelectorAll('.act-nav a[data-act]')];
  const subnavEl = document.getElementById('chapter-subnav');
  const jumpPopover = document.getElementById('chart-jump-popover');
  const jumpBtn = document.querySelector('[popovertarget="chart-jump-popover"]');

  const supportsPopover = typeof HTMLElement !== 'undefined'
    && Object.hasOwn(HTMLElement.prototype, 'popover');

  function closeJumpPopover() {
    if (!jumpPopover) return;
    if (supportsPopover && typeof jumpPopover.hidePopover === 'function') {
      try {
        if (jumpPopover.matches(':popover-open')) jumpPopover.hidePopover();
      } catch {
        // Ignora se já fechado
      }
    } else {
      jumpPopover.classList.remove('is-open');
      jumpPopover.hidden = true;
      if (jumpBtn) jumpBtn.setAttribute('aria-expanded', 'false');
    }
  }

  // Fallback progressivo para navegadores sem Popover API nativa
  if (jumpPopover && jumpBtn && !supportsPopover) {
    jumpPopover.hidden = true;
    jumpBtn.setAttribute('aria-expanded', 'false');
    jumpBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const willOpen = jumpPopover.hidden;
      jumpPopover.hidden = !willOpen;
      jumpPopover.classList.toggle('is-open', willOpen);
      jumpBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeJumpPopover();
    });
    document.addEventListener('click', (e) => {
      if (!jumpPopover.hidden && !jumpPopover.contains(e.target) && !jumpBtn.contains(e.target)) {
        closeJumpPopover();
      }
    });
  }

  function scrollToElement(el) {
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  function handleTargetLink(el) {
    const jumpStep = el.dataset.jumpStep;
    if (jumpStep && typeof onJumpStep === 'function') {
      closeJumpPopover();
      onJumpStep(jumpStep);
      return true;
    }
    const href = el.getAttribute('href') || '';
    if (href.startsWith('#metodo-')) {
      closeJumpPopover();
      openMethodDetails(href);
      const target = document.getElementById(href.slice(1));
      scrollToElement(target);
      return true;
    }
    if (href.startsWith('#')) {
      closeJumpPopover();
      const target = document.getElementById(href.slice(1));
      if (target) {
        scrollToElement(target);
        return true;
      }
    }
    return false;
  }

  if (jumpPopover) {
    jumpPopover.querySelectorAll('a, button').forEach((item) => {
      item.addEventListener('click', (e) => {
        if (handleTargetLink(item)) e.preventDefault();
      });
    });
  }

  // Links de escape metodológico e âncoras diretas para seções em #metodologia
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a.method-escape, a[href^="#metodo-"]');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    if (href.startsWith('#')) {
      e.preventDefault();
      openMethodDetails(href);
      const target = document.getElementById(href.slice(1));
      scrollToElement(target);
      sync({ act: 'methods', subId: href.slice(1) });
    }
  });

  window.addEventListener('hashchange', () => {
    if (window.location.hash.startsWith('#metodo-')) {
      openMethodDetails(window.location.hash);
    }
  });

  if (window.location.hash.startsWith('#metodo-')) {
    openMethodDetails(window.location.hash);
  }

  let currentAct = '0';
  let currentSub = 'escala-macro';

  function renderSubnav(actId, activeSubId) {
    if (!subnavEl) return;
    const chapter = CHAPTER_TREE.find((c) => c.act === String(actId)) || CHAPTER_TREE[0];
    subnavEl.innerHTML = '';

    chapter.subs.forEach((sub, idx) => {
      if (idx > 0) {
        const sep = document.createElement('span');
        sep.className = 'subnav-sep';
        sep.setAttribute('aria-hidden', 'true');
        sep.textContent = '•';
        subnavEl.appendChild(sep);
      }

      const link = document.createElement('a');
      link.href = sub.type === 'step' ? `#step-${sub.id}` : `#${sub.id}`;
      link.textContent = sub.label;
      if (sub.id === activeSubId) link.setAttribute('aria-current', 'true');

      link.addEventListener('click', (e) => {
        e.preventDefault();
        if (sub.type === 'step' && typeof onJumpStep === 'function') {
          onJumpStep(sub.id);
        } else if (sub.type === 'method') {
          openMethodDetails(sub.id);
          scrollToElement(document.getElementById(sub.id));
          sync({ act: 'methods', subId: sub.id });
        } else {
          scrollToElement(document.getElementById(sub.id));
          sync({ act: chapter.act, subId: sub.id });
        }
      });

      subnavEl.appendChild(link);
    });

    if (typeof onLayoutChange === 'function') onLayoutChange();
  }

  function sync({ act, subId }) {
    currentAct = String(act ?? currentAct);
    currentSub = subId ?? currentSub;

    actLinks.forEach((a) => {
      if (a.dataset.act === currentAct) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });

    renderSubnav(currentAct, currentSub);
  }

  // Observa seções finais (#sintese, #metodologia) para manter ChapterNav sincronizado
  if (typeof IntersectionObserver !== 'undefined') {
    const tailSections = [
      { el: document.getElementById('sintese'), act: 'synthesis', sub: 'sintese' },
      { el: document.getElementById('metodologia'), act: 'methods', sub: 'metodo-geral' },
      { el: document.getElementById('faq'), act: 'synthesis', sub: 'faq' },
    ].filter((x) => x.el);

    if (tailSections.length > 0) {
      const tailObs = new IntersectionObserver(
        (entries) => {
          const hit = entries.find((e) => e.isIntersecting);
          if (!hit) return;
          const match = tailSections.find((x) => x.el === hit.target);
          if (match) sync({ act: match.act, subId: match.sub });
        },
        { rootMargin: '-25% 0px -45% 0px', threshold: 0.1 },
      );
      tailSections.forEach((x) => tailObs.observe(x.el));
    }
  }

  return { sync, closeJumpPopover };
}
