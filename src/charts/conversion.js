import * as d3 from 'd3';
import { C, chartFrame, fmtPct, fmtRatio, label, showTip, hideTip, short } from './helpers.js';

export function renderConversion(container, ctx) {
  const { partyContext, state, on } = ctx;
  let rows = partyContext.filter(p => p.n >= 50 && Number.isFinite(p.ratioSeat) && p.elF + p.elM > 0);
  if (rows.length < 3) { container.innerHTML = '<p class="empty">Poucos partidos com eleitas/os neste recorte.</p>'; return; }
  rows = rows.sort((a, b) => b.n - a.n).slice(0, 16).sort((a, b) => a.ratioSeat - b.ratioSeat);

  const rowH = 28;
  const height = Math.max(300, rows.length * rowH + 80);
  const { svg, width } = chartFrame(container, height, 620);
  const m = { top: 30, right: 56, bottom: 38, left: 116 };
  const w = width - m.left - m.right, h = height - m.top - m.bottom;
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  const xMax = Math.max(1.2, d3.max(rows, d => d.ratioSeat) * 1.06);
  const x = d3.scaleLinear().domain([0, xMax]).range([0, w]);
  const y = d3.scaleBand().domain(rows.map(d => d.leg)).range([0, h]).padding(.35);

  g.append('g').selectAll('line').data(x.ticks(4)).join('line')
    .attr('x1', d => x(d)).attr('x2', d => x(d)).attr('y1', 0).attr('y2', h)
    .attr('stroke', C.grid).attr('stroke-dasharray', '2 4').attr('opacity', .55);
  g.append('line').attr('x1', x(1)).attr('x2', x(1)).attr('y1', 0).attr('y2', h)
    .attr('stroke', C.ink).attr('stroke-width', 1.2);
  label(g, x(1) + 4, -10, 'paridade', { size: 8.5, fill: C.ink });

  g.selectAll('line.stem').data(rows).join('line')
    .attr('x1', x(1)).attr('x2', d => x(d.ratioSeat))
    .attr('y1', d => y(d.leg) + y.bandwidth() / 2).attr('y2', d => y(d.leg) + y.bandwidth() / 2)
    .attr('stroke', d => d.ratioSeat < 0.8 ? C.red : C.muted).attr('stroke-width', 1.4).attr('opacity', .6);
  g.selectAll('circle.c').data(rows).join('circle')
    .attr('cx', d => x(d.ratioSeat)).attr('cy', d => y(d.leg) + y.bandwidth() / 2)
    .attr('r', 4.6).attr('fill', d => d.ratioSeat < 0.8 ? C.red : d.ratioSeat > 1 ? C.green : C.accent)
    .style('cursor', 'pointer')
    .on('click', (event, d) => on.toggleParty(d.leg))
    .on('mousemove', (event, d) => showTip(`<strong>${d.leg}</strong><br>${fmtPct(d.candShare)} candidaturas · ${fmtPct(d.seatShare)} cadeiras<br>razão ${fmtRatio(d.ratioSeat)}×<br><span class="tip-muted">${d.elF} mulheres · ${d.elM} homens eleitos</span>`, event))
    .on('mouseleave', hideTip);

  g.selectAll('text.n').data(rows).join('text')
    .attr('x', -10).attr('y', d => y(d.leg) + y.bandwidth() / 2 + 3.5).attr('text-anchor', 'end')
    .attr('font-size', 9.5).attr('fill', C.ink).text(d => short(d.leg, 18));
  g.selectAll('text.v').data(rows).join('text')
    .attr('x', d => x(d.ratioSeat) + 9).attr('y', d => y(d.leg) + y.bandwidth() / 2 + 3.5)
    .attr('font-size', 9).attr('font-weight', 600).attr('fill', d => d.ratioSeat < 0.8 ? C.red : C.muted)
    .text(d => `${fmtRatio(d.ratioSeat)}×`);

  g.append('g').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(4).tickFormat(d => `${d.toFixed(1).replace('.', ',')}×`).tickSizeOuter(0))
    .call(sel => { sel.selectAll('text').attr('fill', C.muted).attr('font-size', 9); sel.select('.domain').attr('stroke', C.grid); });
  label(g, w / 2, h + 30, '% de mulheres entre eleitas/os ÷ % de mulheres entre candidaturas', { size: 9, anchor: 'middle' });
}
