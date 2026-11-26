import * as d3 from 'd3';

/**
 * Utilitário central de motion para o scrollytelling:
 * - Respeita prefers-reduced-motion e ?steps=full (modo estático/E2E)
 * - Centraliza durações, easings e desenho de paths SVG (stroke-dashoffset)
 */
export function shouldAnimate() {
  if (typeof window === 'undefined') return false;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const isFull = new URLSearchParams(window.location.search).get('steps') === 'full';
  return !reduced && !isFull;
}

export const MOTION = {
  quick: 220,
  standard: 520,
  chart: 620,
  draw: 680,
  easeOut: d3.easeCubicOut,
  easeInOut: d3.easeCubicInOut,
};

export function animDur(ms = MOTION.chart) {
  return shouldAnimate() ? ms : 0;
}

export function animDelay(ms = 0) {
  return shouldAnimate() ? ms : 0;
}

/**
 * Anima um path SVG como traço contínuo usando getTotalLength().
 * Preserva stroke-dasharray original (se houver, como linhas tracejadas) ao finalizar.
 */
export function drawPath(pathSel, { duration = MOTION.draw, delay = 0, preserveDash = null } = {}) {
  if (!shouldAnimate()) return pathSel;
  pathSel.each(function () {
    const el = this;
    const len = typeof el.getTotalLength === 'function' ? el.getTotalLength() : 0;
    if (!len || !Number.isFinite(len)) return;
    const sel = d3.select(el);
    sel
      .attr('stroke-dasharray', `${len} ${len}`)
      .attr('stroke-dashoffset', len)
      .transition()
      .duration(duration)
      .delay(delay)
      .ease(MOTION.easeOut)
      .attr('stroke-dashoffset', 0)
      .on('end', () => {
        sel.attr('stroke-dasharray', preserveDash);
        sel.attr('stroke-dashoffset', null);
      });
  });
  return pathSel;
}

/**
 * Anima suavemente uma anotação direta (opacity + micro-deslocamento vertical).
 */
export function revealAnnotation(gSel, { delay = 220, duration = 360 } = {}) {
  if (!shouldAnimate()) return gSel;
  gSel
    .style('opacity', 0)
    .attr('transform', 'translate(0, 6)')
    .transition()
    .duration(duration)
    .delay(delay)
    .ease(MOTION.easeOut)
    .style('opacity', 1)
    .attr('transform', 'translate(0, 0)');
  return gSel;
}

/**
 * Anima a contagem numérica de percentuais nos indicadores do Hero e da Boca da Taça.
 */
export function tweenPctText(el, targetRatio, { duration = 420, digits = 1 } = {}) {
  if (!el) return;
  const targetPct = Number(targetRatio || 0) * 100;
  const fmt = (v) => `${v.toFixed(digits).replace('.', ',')}%`;
  if (!shouldAnimate()) {
    el.textContent = fmt(targetPct);
    return;
  }
  const prevRaw = parseFloat(String(el.textContent || '').replace('%', '').replace(',', '.'));
  const startPct = Number.isFinite(prevRaw) ? prevRaw : 0;
  if (Math.abs(targetPct - startPct) < 0.05) {
    el.textContent = fmt(targetPct);
    return;
  }
  const interp = d3.interpolateNumber(startPct, targetPct);
  d3.select(el)
    .interrupt()
    .transition()
    .duration(duration)
    .ease(MOTION.easeOut)
    .tween('text', () => (t) => {
      el.textContent = fmt(interp(t));
    });
}
