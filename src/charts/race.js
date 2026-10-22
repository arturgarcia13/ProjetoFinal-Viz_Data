import * as d3 from 'd3';
import { C, chartFrame, fmtNum, fmtPct, label, showTip, hideTip } from './helpers.js';
import { RACE_LABEL } from '../data.js';

const RACES = ['BRANCA', 'PARDA', 'PRETA', 'AMARELA', 'INDÍGENA'];

export function renderRace(container, ctx) {
  const { rows } = ctx;
  const data = [];
  for (const race of RACES) {
    for (const g of ['F', 'M']) {
      const arr = rows.filter(c => c.race === race && c.g === g);
      if (arr.length < 30) continue;
      const med = d3.median(arr, c => c.v) || 0;
      const succ = d3.mean(arr, c => c.el);
      data.push({ race, g, n: arr.length, med, succ });
    }
  }
  const races = RACES.filter(r => data.some(d => d.race === r) && data.filter(d => d.race === r).length === 2);
  if (races.length < 2) { container.innerHTML = '<p class="empty">Amostra racial insuficiente.</p>'; return; }

  const { svg, width, height } = chartFrame(container, 300);
  const m = { top: 34, right: 24, bottom: 40, left: 80 };
  const w = width - m.left - m.right, h = height - m.top - m.bottom;
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
  const x = d3.scaleLog().domain([100, 5000]).range([0, w]);
  const y = d3.scaleBand().domain(races).range([0, h]).padding(.35);

  g.append('g').selectAll('line').data(x.ticks(4)).join('line')
    .attr('x1', d => x(d)).attr('x2', d => x(d)).attr('y1', 0).attr('y2', h)
    .attr('stroke', C.grid).attr('stroke-dasharray', '2 4').attr('opacity', .55);

  for (const race of races) {
    const f = data.find(d => d.race === race && d.g === 'F');
    const mrow = data.find(d => d.race === race && d.g === 'M');
    const yy = y(race) + y.bandwidth() / 2;
    if (f && mrow) {
      g.append('line').attr('x1', x(f.med)).attr('x2', x(mrow.med)).attr('y1', yy).attr('y2', yy).attr('stroke', '#9C9384').attr('stroke-width', 2);
      g.append('circle').attr('cx', x(f.med)).attr('cy', yy).attr('r', 4.8).attr('fill', C.women);
      g.append('circle').attr('cx', x(mrow.med)).attr('cy', yy).attr('r', 4.8).attr('fill', C.men);
      g.append('text').attr('x', x(f.med) - 7).attr('y', yy - 7).attr('text-anchor', 'end').attr('font-size', 8.5).attr('fill', C.women).text(fmtNum(Math.round(f.med)));
    }
  }
  g.selectAll('text.r').data(races).join('text')
    .attr('x', -10).attr('y', d => y(d) + y.bandwidth() / 2 + 3.5).attr('text-anchor', 'end')
    .attr('font-size', 10).attr('fill', C.ink).text(d => RACE_LABEL[d] || d);

  g.append('g').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(4, d => d >= 1000 ? `${d / 1000} mil` : d).tickSizeOuter(0))
    .call(sel => { sel.selectAll('text').attr('fill', C.muted).attr('font-size', 9); sel.select('.domain').attr('stroke', C.grid); });
  label(g, w / 2, h + 30, 'mediana de votos nominais', { size: 9, anchor: 'middle' });
  const leg = g.append('g').attr('transform', 'translate(0,-16)');
  leg.append('circle').attr('cx', 0).attr('cy', 0).attr('r', 3.5).attr('fill', C.women);
  leg.append('text').attr('x', 6).attr('y', 3).attr('font-size', 8.5).attr('fill', C.muted).text('mulheres');
  leg.append('circle').attr('cx', 62).attr('cy', 0).attr('r', 3.5).attr('fill', C.men);
  leg.append('text').attr('x', 68).attr('y', 3).attr('font-size', 8.5).attr('fill', C.muted).text('homens');
  label(g, w, -16, 'bolinha = mediana; traço = distância entre gêneros', { size: 8.3, anchor: 'end', fill: C.faint });
}
