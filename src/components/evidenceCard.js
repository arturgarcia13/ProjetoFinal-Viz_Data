/**
 * EvidenceCard — Componente atômico com 4 slots fixos:
 * 1. Metadado (Data + Fonte)
 * 2. Link Externo (↗︎)
 * 3. Texto com destaque semântico (<mark class="ev-highlight">)
 * 4. Tag de Categoria
 */

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function createEvidenceCard({
  meta,
  linkLabel = 'TSE ↗︎',
  linkHref = 'https://dadosabertos.tse.jus.br/',
  htmlText,
  tag,
  tagTone = 'neutral',
  actionLabel = '',
  onAction = null,
}) {
  const card = document.createElement('article');
  card.className = 'evidence-card';

  const head = document.createElement('div');
  head.className = 'ev-head';

  const metaEl = document.createElement('span');
  metaEl.className = 'ev-meta';
  metaEl.textContent = meta || '';

  const linkEl = document.createElement('a');
  linkEl.className = 'ev-link';
  linkEl.href = linkHref;
  linkEl.target = '_blank';
  linkEl.rel = 'noopener noreferrer';
  linkEl.textContent = linkLabel.includes('↗') ? linkLabel : `${linkLabel} ↗︎`;

  head.append(metaEl, linkEl);

  const body = document.createElement('p');
  body.className = 'ev-body';
  body.innerHTML = htmlText || '';

  const foot = document.createElement('div');
  foot.className = 'ev-foot';

  const tagEl = document.createElement('span');
  tagEl.className = `ev-tag ev-tag-${escapeHtml(tagTone)}`;
  tagEl.textContent = tag || '';
  foot.appendChild(tagEl);

  if (typeof onAction === 'function' && actionLabel) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ev-action';
    btn.textContent = actionLabel;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onAction();
    });
    foot.appendChild(btn);
  }

  card.append(head, body, foot);
  return card;
}

export function renderEvidenceSlot(containerOrId, props) {
  const container = typeof containerOrId === 'string'
    ? document.getElementById(containerOrId)
    : containerOrId;
  if (!container) return;
  container.innerHTML = '';
  if (!props) return;
  container.appendChild(createEvidenceCard(props));
}
