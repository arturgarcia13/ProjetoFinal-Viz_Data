import * as d3 from 'd3';
import { C, chartFrame, fmtPct, fmtNum, label, showTip, hideTip } from './helpers.js';

export function renderHistogram(container, ctx) {
  const { stats, state, on } = ctx;
  const slates = stats.h1.slates;
  if (!slates.length) { container.innerHTML = '<p class="empty">Sem chapas com ao menos 4 candidaturas neste recorte.</p>'; return; }

  const mode = state.histMode || 'pct';
  container.innerHTML = '';

  // Alternador entre o percentual bruto e a folga inteira sobre o mínimo.
  const head = d3.select(container).append('div').attr('class', 'hist-head');
  const seg = head.append('div').attr('class', 'seg');
  const opts = [
    { k: 'pct', label: '% de mulheres' },
    { k: 'delta', label: 'folga Δ' }
  ];
  seg.selectAll('button').data(opts).join('button')
    .attr('type', 'button')
    .classed('active', d => d.k === mode)
    .text(d => d.label)
    .on('click', (event, d) => {
      if (state.histMode === d.k) return;
      state.histMode = d.k;
      renderHistogram(container, ctx);
    });

  const host = d3.select(container).append('div');
  const { svg, width, height } = chartFrame(host.node(), 430);
  const narrow = width < 520;
  const m = { top: 36, right: 24, bottom: 54, left: 54 };
  const w = width - m.left - m.right, h = height - m.top - m.bottom;
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  const isDelta = mode === 'delta';
  const vals = isDelta ? slates.map(s => s.delta) : slates.map(s => Math.min(s.pct, 0.999));
  const lo = isDelta ? Math.min(-1, d3.min(vals)) : 0;
  const hi = isDelta ? Math.max(2, d3.max(vals)) : 1;
  const x = d3.scaleLinear().domain([lo, hi + (isDelta ? 1 : 0)]).range([0, w]).nice();
  const thresholds = isDelta
    ? d3.range(Math.floor(x.domain()[0]), Math.ceil(x.domain()[1]) + 1, 1)
    : d3.range(0, 1.001, 0.02);
  const bins = d3.bin().domain(x.domain()).thresholds(thresholds)(vals);
  const y = d3.scaleLinear().domain([0, d3.max(bins, d => d.length) || 1]).nice().range([h, 0]);

  g.append('g').selectAll('line').data(y.ticks(5)).join('line')
    .attr('x1', 0).attr('x2', w).attr('y1', d => y(d)).attr('y2', d => y(d))
    .attr('stroke', C.grid).attr('stroke-dasharray', '2 4').attr('opacity', .7);
  g.append('g').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(isDelta ? Math.min(9, Math.max(2, Math.round(hi - lo))) : (narrow ? 5 : 6))
      .tickFormat(d => isDelta ? d : `${Math.round(d * 100)}%`).tickSizeOuter(0))
    .call(sel => { sel.selectAll('text').attr('fill', C.muted).attr('font-size', 10.5); sel.select('.domain').attr('stroke', C.grid); sel.selectAll('line').attr('stroke', C.grid); });
  g.append('g')
    .call(d3.axisLeft(y).ticks(5).tickSizeOuter(0))
    .call(sel => { sel.selectAll('text').attr('fill', C.muted).attr('font-size', 10.5); sel.select('.domain').attr('stroke', C.grid); sel.selectAll('line').attr('stroke', C.grid); });
  label(g, 0, -14, 'chapas', { size: 9.5, fill: C.muted });

  const selLo = !isDelta && state.slate ? state.slate[0] : null;
  const selHi = !isDelta && state.slate ? state.slate[1] : null;

  // Faixa de referência: piso de 30% ou folga zero.
  const ref = isDelta ? 0 : 0.30;
  const refW = isDelta ? Math.max(1, x(1) - x(0)) : Math.max(1, x(0.3334) - x(0.30));
  g.append('rect').attr('x', x(ref)).attr('y', 0).attr('width', refW).attr('height', h)
    .attr('fill', C.accentSoft).attr('opacity', .45);
  g.append('line').attr('x1', x(ref)).attr('x2', x(ref)).attr('y1', -8).attr('y2', h)
    .attr('stroke', C.ink).attr('stroke-width', 1.4);

  const refY = narrow ? -24 : -12;
  const medY = narrow ? -8 : -12;
  const refText = isDelta ? 'Δ = 0 · mínimo estrito' : 'piso de 30%';
  g.append('text').attr('x', x(ref) - 6).attr('y', refY).attr('text-anchor', isDelta ? 'start' : 'end')
    .attr('font-size', 9.5).attr('fill', C.ink).attr('font-weight', 600).text(refText);

  g.selectAll('rect.bin').data(bins).join('rect')
    .attr('class', 'bin')
    .attr('x', d => x(d.x0) + 1)
    .attr('y', d => y(d.length))
    .attr('width', d => Math.max(1, x(d.x1) - x(d.x0) - 2))
    .attr('height', d => h - y(d.length))
    .attr('fill', d => {
      const mid = (d.x0 + d.x1) / 2;
      if (isDelta) return mid >= 0 && mid < 1 ? C.accent : '#B9B0A1';
      if (selLo != null && mid >= selLo && mid < selHi) return C.women;
      if (mid >= 0.30 && mid < 0.3334) return C.accent;
      return '#B9B0A1';
    })
    .attr('opacity', d => (!isDelta && selLo != null && !((d.x0 + d.x1) / 2 >= selLo && (d.x0 + d.x1) / 2 < selHi)) ? .4 : .92)
    .style('cursor', isDelta ? 'default' : 'pointer')
    .on('mousemove', (event, d) => {
      if (isDelta) {
        showTip(`<strong>folga ${d.x0}${d.x1 > d.x0 + 1 ? `–${d.x1 - 1}` : ''}</strong><br>${d.length} chapas · ${fmtNum(d3.sum(d, s => s.n))} candidaturas<br><span class="tip-muted">Δ = N mulheres − ⌈30% × N total⌉</span>`, event);
      } else {
        const inRange = d.x0 >= 0.30 ? ' · dentro do piso' : '';
        showTip(`<strong>${Math.round(d.x0 * 100)}–${Math.round(d.x1 * 100)}% mulheres</strong><br>${d.length} chapas · ${fmtNum(d3.sum(d, s => s.n))} candidaturas<br><span class="tip-muted">clique para filtrar esta faixa${inRange}</span>`, event);
      }
    })
    .on('mouseleave', hideTip)
    .on('click', (event, d) => {
      if (isDelta) return;
      const lo = d.x0, hi = d.x1;
      if (state.slate && Math.abs(state.slate[0] - lo) < 1e-9) on.clearSlate();
      else on.setSlate([lo, hi]);
    });

  label(g, w / 2, h + 42, isDelta
    ? (narrow ? 'folga inteira sobre o mínimo' : 'folga inteira sobre o mínimo legal: Δ = N mulheres − ⌈30% × N total⌉')
    : (narrow ? '% de mulheres na chapa' : '% de mulheres na chapa (legenda/federação × UF × cargo)'),
  { size: narrow ? 10 : 10.5, anchor: 'middle', fill: C.muted });

  const med = isDelta ? stats.h1.deltaMedian : stats.h1.median;
  g.append('line').attr('x1', x(med)).attr('x2', x(med)).attr('y1', h).attr('y2', h + 7)
    .attr('stroke', C.ink).attr('stroke-width', 1.5);
  label(g, x(med) + 6, medY, isDelta ? `mediana Δ ${med}` : `mediana ${fmtPct(med)}`, { size: 9.5, fill: C.ink });
}
