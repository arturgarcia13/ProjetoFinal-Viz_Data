/**
 * Utilitário compartilhado de tooltip/hover no padrão visual do gráfico H1.
 */

export function fmtPct(v, digits = 1) {
  return `${v.toFixed(digits).replace('.', ',')}%`;
}

export function fmtSignedPP(v) {
  const sign = v > 0.05 ? '+' : '';
  return `${sign}${v.toFixed(1).replace('.', ',')} p.p.`;
}

export function fmtInt(v) {
  return Math.round(v).toLocaleString('pt-BR');
}

export function fmtBrl(v) {
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
}

export function fmtCompactBrl(v) {
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(2).replace('.', ',')}M`;
  if (v >= 1e3) return `R$ ${Math.round(v / 1e3).toLocaleString('pt-BR')} mil`;
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
}

export function fmtRatio(v) {
  return `${v.toFixed(2).replace('.', ',')}×`;
}

/**
 * Cria o container relativo `.chart-wrap` e o tooltip HTML flutuante no padrão H1.
 */
export function createChartTooltip(container, { wrapClass = '', tooltipClass = '' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = ['chart-wrap', wrapClass].filter(Boolean).join(' ');

  const tooltip = document.createElement('div');
  tooltip.className = ['chart-tooltip', tooltipClass].filter(Boolean).join(' ');
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  wrap.appendChild(tooltip);
  container.appendChild(wrap);

  let activeEl = null;

  function show(targetEl, html, evt = null) {
    if (activeEl && activeEl !== targetEl) {
      activeEl.classList.remove('is-hovered');
    }
    activeEl = targetEl;
    if (targetEl) targetEl.classList.add('is-hovered');

    tooltip.innerHTML = html;
    tooltip.hidden = false;

    const wrapRect = wrap.getBoundingClientRect();
    const targetRect = targetEl
      ? targetEl.getBoundingClientRect()
      : { left: wrapRect.left, right: wrapRect.right, top: wrapRect.top, bottom: wrapRect.top, height: 0 };
    const tipRect = tooltip.getBoundingClientRect();

    const anchorX = evt && Number.isFinite(evt.clientX)
      ? evt.clientX - wrapRect.left
      : (targetRect.left + targetRect.right) / 2 - wrapRect.left;
    const clampedLeft = Math.max(
      6,
      Math.min(wrapRect.width - tipRect.width - 6, anchorX - tipRect.width / 2),
    );

    // Para alvos altos (barras verticais, UFs no mapa, linhas), ancora na altura do cursor.
    const usePointerBand = targetRect.height > 64 && evt && Number.isFinite(evt.clientY);
    const boxTop = usePointerBand ? evt.clientY - 12 : targetRect.top;
    const boxBottom = usePointerBand ? evt.clientY + 12 : targetRect.bottom;

    const spaceAbove = boxTop - wrapRect.top;
    const spaceBelow = wrapRect.bottom - boxBottom;
    let topPos;
    if (spaceAbove >= tipRect.height + 8) {
      topPos = (boxTop - wrapRect.top) - tipRect.height - 8;
    } else if (spaceBelow >= tipRect.height + 8) {
      topPos = (boxBottom - wrapRect.top) + 8;
    } else {
      topPos = Math.max(4, wrapRect.height - tipRect.height - 4);
    }
    topPos = Math.max(4, Math.min(wrapRect.height - tipRect.height - 4, topPos));

    tooltip.style.left = `${Math.round(clampedLeft)}px`;
    tooltip.style.top = `${Math.round(topPos)}px`;
  }

  function hide() {
    if (activeEl) {
      activeEl.classList.remove('is-hovered');
      activeEl = null;
    }
    tooltip.hidden = true;
  }

  return { wrap, tooltip, show, hide };
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Gera HTML estruturado no padrão visual de card + badge + tabela tabular-nums do H1.
 */
export function buildTooltipCard({
  title,
  badge = '',
  badgeTone = 'neutral',
  columns = null,
  rows = [],
  hint = '',
}) {
  const badgeHtml = badge
    ? `<span class="chart-tip-status chart-tip-tone-${escapeHtml(badgeTone)}">${escapeHtml(badge)}</span>`
    : '';

  const theadHtml = columns && columns.length > 0
    ? `<thead><tr>${columns.map((c) => {
        const cls = typeof c === 'object' && c.cls ? ` class="${escapeHtml(c.cls)}"` : '';
        const text = typeof c === 'object' ? c.text : c;
        return `<th${cls}>${escapeHtml(text)}</th>`;
      }).join('')}</tr></thead>`
    : '';

  const tbodyHtml = rows.map((row) => {
    if (Array.isArray(row.cells)) {
      return `<tr>${row.cells.map((cell, idx) => {
        const cls = typeof cell === 'object' && cell.cls ? ` class="${escapeHtml(cell.cls)}"` : '';
        const text = typeof cell === 'object' ? cell.text : cell;
        const inner = idx === 0 ? escapeHtml(text) : `<strong>${escapeHtml(text)}</strong>`;
        return `<td${cls}>${inner}</td>`;
      }).join('')}</tr>`;
    }
    const cls = row.focus ? ' class="is-focus"' : '';
    const sub = row.sub ? ` <span>(${escapeHtml(row.sub)})</span>` : '';
    return `<tr${cls}><td>${escapeHtml(row.label)}</td><td><strong>${escapeHtml(row.value)}</strong>${sub}</td></tr>`;
  }).join('');

  const hintHtml = hint ? `<p class="chart-tip-hint">${escapeHtml(hint)}</p>` : '';

  return `
    <div class="chart-tip-head">
      <strong>${escapeHtml(title)}</strong>
      ${badgeHtml}
    </div>
    <table class="chart-tip-table">
      ${theadHtml}
      <tbody>${tbodyHtml}</tbody>
    </table>
    ${hintHtml}
  `;
}

/**
 * Conecta eventos padronizados de hover (e opcionalmente foco/teclado) a um elemento SVG/DOM.
 */
export function bindTooltipEvents(el, controller, getHtml, { onEnter = null, onLeave = null, focusable = false } = {}) {
  const showFromEvent = (evt) => {
    const html = getHtml(evt);
    if (!html) return;
    controller.show(el, html, evt);
  };

  el.addEventListener('mouseenter', (evt) => {
    if (onEnter) onEnter(evt);
    showFromEvent(evt);
  });
  el.addEventListener('mousemove', (evt) => {
    showFromEvent(evt);
  });
  el.addEventListener('mouseleave', (evt) => {
    controller.hide();
    if (onLeave) onLeave(evt);
  });

  if (focusable) {
    el.addEventListener('focus', () => {
      if (onEnter) onEnter(null);
      const html = getHtml(null);
      if (html) controller.show(el, html, null);
    });
    el.addEventListener('blur', () => {
      controller.hide();
      if (onLeave) onLeave(null);
    });
    el.addEventListener('keydown', (evt) => {
      if (evt.key === 'Escape') {
        controller.hide();
        if (onLeave) onLeave(evt);
      }
    });
  }
}
