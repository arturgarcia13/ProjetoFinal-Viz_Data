import * as d3 from 'd3';
import { C, chartFrame, label, showTip, hideTip } from './helpers.js';

export function renderGapBars(container, ctx) {
  const g = ctx.stats.h6;
  if (!g) { container.innerHTML = '<p class="empty">Amostra insuficiente para o ajuste.</p>'; return; }
  const data = [
    { k: 'Gap bruto', v: g.raw, note: 'diferença sem controles' },
    { k: '+ dinheiro', v: g.money, note: 'controlado por receita' },
    { k: '+ partido, cargo, UF', v: g.full, note: 'controles completos' }
  ];
  const { svg, width, height } = chartFrame(container, 250);
  const m = { top: 30, right: 72, bottom: 34, left: 142 };
  const w = width - m.left - m.right, h = height - m.top - m.bottom;
  const gsvg = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  const min = Math.min(-0.2, d3.min(data, d => d.v) * 1.12);
  const x = d3.scaleLinear().domain([min, 0]).range([0, w]);
  const y = d3.scaleBand().domain(data.map(d => d.k)).range([0, h]).padding(.38);

  gsvg.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', h)
    .attr('stroke', C.ink).attr('stroke-width', 1);

  gsvg.selectAll('rect.gap').data(data).join('rect')
    .attr('x', d => x(d.v)).attr('y', d => y(d.k))
    .attr('width', d => Math.max(1, x(0) - x(d.v))).attr('height', y.bandwidth())
    .attr('fill', (d, i) => i === 0 ? '#C98A2E' : i === 1 ? '#B4664B' : C.women)
    .attr('opacity', .9)
    .on('mousemove', (event, d) => showTip(`<strong>${d.k}</strong><br>${d.v.toFixed(2)} log-pontos<br><span class="tip-muted">${d.note}</span>`, event))
    .on('mouseleave', hideTip);

  gsvg.selectAll('text.k').data(data).join('text')
    .attr('x', -10).attr('y', d => y(d.k) + y.bandwidth() / 2 + 3.5)
    .attr('text-anchor', 'end').attr('font-size', 10).attr('fill', C.ink)
    .text(d => d.k);
  gsvg.selectAll('text.v').data(data).join('text')
    .attr('x', d => x(d.v) - 7).attr('y', d => y(d.k) + y.bandwidth() / 2 + 3.5)
    .attr('text-anchor', 'end').attr('font-size', 10.5).attr('font-weight', 700).attr('fill', C.ink)
    .text(d => d.v.toFixed(2).replace('.', ','));
  gsvg.selectAll('text.note').data(data).join('text')
    .attr('x', 4).attr('y', d => y(d.k) + y.bandwidth() / 2 + 3.5)
    .attr('font-size', 8.5).attr('fill', C.muted)
    .text(d => x(d.v) < 60 ? '' : d.note);

  label(svg, m.left, 16, 'desvantagem feminina em log-pontos (negativo = menos votos)', { size: 9.5, fill: C.muted });
  label(svg, width - 12, height - 8, 'o ajuste não fecha o gap', { size: 9, fill: C.red, anchor: 'end', weight: 600 });
}
