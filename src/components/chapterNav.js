/**
 * ChapterNav — Navegação enxuta em camada única (01 Papel ... Métodos)
 * sincronizada com a rolagem vertical + divulgação progressiva em #metodologia.
 */

export function openMethodDetails(hashId) {
  const cleanId = (hashId || '').replace(/^#/, '');
  if (!cleanId) return;
  const target = document.getElementById(cleanId);
  if (!target) return;
  const details = target.tagName === 'DETAILS' ? target : target.closest('details');
  if (details) details.open = true;
}

export function createChapterNav() {
  const actLinks = [...document.querySelectorAll('.act-nav a[data-act]')];

  function setCurrentAct(actId) {
    const key = String(actId);
    actLinks.forEach((a) => {
      if (a.dataset.act === key) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }

  // Links de escape metodológico e âncoras diretas para seções em #metodologia
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a.method-escape, a[href^="#metodo-"]');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    if (href.startsWith('#')) {
      openMethodDetails(href);
      setCurrentAct('methods');
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

  if (typeof IntersectionObserver !== 'undefined') {
    const sections = [
      { el: document.getElementById('ato-1'), act: '1' },
      { el: document.getElementById('ato-2'), act: '2' },
      { el: document.getElementById('ato-3'), act: '3' },
      { el: document.getElementById('ato-4'), act: '4' },
      { el: document.getElementById('ato-5'), act: '5' },
      { el: document.getElementById('sintese'), act: 'synthesis' },
      { el: document.getElementById('metodologia'), act: 'methods' },
    ].filter((s) => s.el);

    if (sections.length > 0) {
      const obs = new IntersectionObserver(
        (entries) => {
          const hit = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
          if (!hit) return;
          const match = sections.find((s) => s.el === hit.target);
          if (match) setCurrentAct(match.act);
        },
        { rootMargin: '-20% 0px -55% 0px', threshold: [0.05, 0.25] },
      );
      sections.forEach((s) => obs.observe(s.el));
    }
  }

  return { setCurrentAct };
}
