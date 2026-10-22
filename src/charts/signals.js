import * as d3 from 'd3';
import { C, chartFrame, fmtPct, fmtNum, label, showTip, hideTip } from './helpers.js';

export function renderSignals(container, ctx) {
  const { stats, state } = ctx;
  const h = stats.h7;
  if (!h.nF || !h.nM) { container.innerHTML = '<p class="empty">Sem candidaturas dos dois gêneros.</p>'; return; }

  const { svg, width, height } = chartFrame(container, 330);
  const m = { top: 38, right: 20, bottom: 64, left: 48 };
  const w = width - m.left - m.right, hh = height - m.top - m.bottom;
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  const data = [0, 1, 2, 3].map(k => ({
    k,
    F: h.sigF[k] / h.nF,
    M: h.sigM[k] / h.nM,
    nF: h.sigF[k], nM: h.sigM[k]
  }));
  const odds = (a, b) => {
    if (![a, b].every(Number.isFinite) || a <= 0 || a >= 1 || b <= 0 || b >= 1) return NaN;
    return (a / (1 - a)) / (b / (1 - b));
  };
  const or3 = odds(h.sigF[3] / h.nF, h.sigM[3] / h.nM);
  const x = d3.scaleBand().domain([0, 1, 2, 3]).range([0, w]).padding(.28);
  const y = d3.scaleLinear().domain([0, Math.max(.6, d3.max(data, d => Math.max(d.F, d.M)) * 1.15)]).range([hh, 0]);

  g.append('g').selectAll('line').data(y.ticks(5)).join('line')
    .attr('x1', 0).attr('x2', w).attr('y1', d => y(d)).attr('y2', d => y(d))
    .attr('stroke', C.grid).attr('stroke-dasharray', '2 4').attr('opacity', .65);

  const bw = x.bandwidth() / 2;
  const series = [
    { key: 'F', color: C.women, label: 'Mulheres' },
    { key: 'M', color: C.men, label: 'Homens' }
  ];
  series.forEach((s, si) => {
    g.selectAll(`rect.${s.key}`).data(data).join('rect')
      .attr('x', d => x(d.k) + si * bw).attr('y', d => y(d[s.key]))
      .attr('width', bw - 3).attr('height', d => hh - y(d[s.key]))
      .attr('fill', s.color).attr('opacity', .92)
      .on('mousemove', (event, d) => showTip(`<strong>${d.k} sinal${d.k === 1 ? '' : 'is'}</strong><br>${s.label}: ${fmtPct(d[s.key])} · ${fmtNum(d[s.key === 'F' ? 'nF' : 'nM'])} candidaturas<br><span class="tip-muted">limiar de votos ≤ ${state.threshold}</span>`, event))
      .on('mouseleave', hideTip);
    g.selectAll(`text.lab-${s.key}`).data(data).join('text')
      .attr('x', d => x(d.k) + si * bw + (bw - 3) / 2).attr('y', d => y(d[s.key]) - 5)
      .attr('text-anchor', 'middle').attr('font-size', 8.5).attr('fill', s.color)
      .text(d => d[s.key] > 0.02 ? fmtPct(d[s.key], 0) : '');
  });

  g.append('g').attr('transform', `translate(0,${hh})`)
    .call(d3.axisBottom(x).tickFormat(d => `${d}`).tickSizeOuter(0))
    .call(sel => { sel.selectAll('text').attr('fill', C.muted).attr('font-size', 10); sel.select('.domain').attr('stroke', C.grid); });
  g.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${Math.round(d * 100)}%`).tickSizeOuter(0))
    .call(sel => { sel.selectAll('text').attr('fill', C.muted).attr('font-size', 9.5); sel.select('.domain').attr('stroke', C.grid); });
  label(g, w / 2, hh + 44, 'número de sinais (A + B + C)', { size: 10, anchor: 'middle' });
  label(g, -34, hh / 2, '% das candidaturas', { size: 9.5, anchor: 'middle' }).attr('transform', `rotate(-90,-34,${hh / 2})`);

  svg.append('circle').attr('cx', m.left).attr('cy', 16).attr('r', 4).attr('fill', C.women);
  svg.append('text').attr('x', m.left + 9).attr('y', 19.5).attr('font-size', 9.5).attr('fill', C.muted).text('mulheres');
  svg.append('circle').attr('cx', m.left + 76).attr('cy', 16).attr('r', 4).attr('fill', C.men);
  svg.append('text').attr('x', m.left + 85).attr('y', 19.5).attr('font-size', 9.5).attr('fill', C.muted).text('homens');
  svg.append('text').attr('x', width - 12).attr('y', 19.5).attr('text-anchor', 'end').attr('font-size', 9).attr('fill', C.faint)
    .text(`A = votos ≤ ${state.threshold}${Number.isFinite(or3) ? ` · OR 3 sinais = ${or3.toFixed(2).replace('.', ',')}×` : ''}`);
}
