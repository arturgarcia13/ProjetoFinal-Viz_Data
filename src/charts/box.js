import * as d3 from 'd3';
import { C, chartFrame, fmtPct, fmtNum, label, showTip, hideTip } from './helpers.js';

const BANDS = ['30–33', '33–40', '40+'];
const BAND_LABEL = { '<30': '< 30%', '30–33': '30–33%\nΔ ≤ 1', '33–40': '33–40%', '40+': '40%+' };

export function renderBox(container, ctx) {
  const { stats } = ctx;
  const slates = stats.h1.slates;
  if (!slates.length) { container.innerHTML = '<p class="empty">Sem chapas neste recorte.</p>'; return; }

  const groups = BANDS.map(b => ({ band: b, values: slates.filter(s => s.band === b).map(s => s.sig2), slates: slates.filter(s => s.band === b) }))
    .filter(g => g.values.length >= 3);
  if (!groups.length) { container.innerHTML = '<p class="empty">Poucas chapas por faixa.</p>'; return; }

  const { svg, width, height } = chartFrame(container, 340);
  const m = { top: 32, right: 20, bottom: 58, left: 48 };
  const w = width - m.left - m.right, h = height - m.top - m.bottom;
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
  const x = d3.scaleBand().domain(groups.map(d => d.band)).range([0, w]).padding(.34);
  const yMax = Math.max(.08, (d3.max(groups, g => d3.max(g.values)) || 0) * 1.25);
  const y = d3.scaleLinear().domain([0, yMax]).range([h, 0]);

  g.append('g').selectAll('line').data(y.ticks(4)).join('line')
    .attr('x1', 0).attr('x2', w).attr('y1', d => y(d)).attr('y2', d => y(d))
    .attr('stroke', C.grid).attr('stroke-dasharray', '2 4').attr('opacity', .65);

  groups.forEach(gr => {
    const v = gr.values.slice().sort(d3.ascending);
    const q1 = d3.quantile(v, .25), med = d3.quantile(v, .5), q3 = d3.quantile(v, .75);
    const iqr = q3 - q1;
    const lo = Math.max(0, q1 - 1.5 * iqr), hi = Math.min(yMax, q3 + 1.5 * iqr);
    const cx = x(gr.band) + x.bandwidth() / 2;
    const bw = Math.min(42, x.bandwidth() * .55);
    const col = gr.band === '30–33' ? C.accent : gr.band === '40+' ? C.men : '#9C9384';

    g.append('line').attr('x1', cx).attr('x2', cx).attr('y1', y(lo)).attr('y2', y(hi)).attr('stroke', col).attr('stroke-width', 1.2);
    g.append('line').attr('x1', cx - 8).attr('x2', cx + 8).attr('y1', y(lo)).attr('y2', y(lo)).attr('stroke', col);
    g.append('line').attr('x1', cx - 8).attr('x2', cx + 8).attr('y1', y(hi)).attr('y2', y(hi)).attr('stroke', col);
    g.append('rect').attr('x', cx - bw / 2).attr('y', y(q3)).attr('width', bw).attr('height', Math.max(1, y(q1) - y(q3)))
      .attr('fill', col).attr('opacity', .18).attr('stroke', col).attr('stroke-width', 1.2);
    g.append('line').attr('x1', cx - bw / 2).attr('x2', cx + bw / 2).attr('y1', y(med)).attr('y2', y(med))
      .attr('stroke', col).attr('stroke-width', 2.2);

    // pontos
    g.selectAll(`circle.j-${gr.band.replace(/\W/g, '')}`).data(gr.slates).join('circle')
      .attr('cx', () => cx + (Math.random() - .5) * bw * .8)
      .attr('cy', d => y(d.sig2))
      .attr('r', d => Math.max(1.2, Math.sqrt(d.n) / 3.2))
      .attr('fill', col).attr('opacity', .28)
      .on('mousemove', (event, d) => showTip(`<strong>${d.leg}</strong><br>${d.uf} · ${d.n} candidaturas<br>${fmtPct(d.pct)} mulheres · Δ ${d.delta}<br>≥ 2 sinais: ${fmtPct(d.sig2)}`, event))
      .on('mouseleave', hideTip);

    g.append('text').attr('x', cx).attr('y', h + 16).attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', C.ink).text(BAND_LABEL[gr.band].split('\n')[0]);
    if (BAND_LABEL[gr.band].includes('\n')) g.append('text').attr('x', cx).attr('y', h + 27).attr('text-anchor', 'middle').attr('font-size', 8).attr('fill', C.accent).text(BAND_LABEL[gr.band].split('\n')[1]);
    g.append('text').attr('x', cx).attr('y', h + (BAND_LABEL[gr.band].includes('\n') ? 39 : 29)).attr('text-anchor', 'middle').attr('font-size', 8.5).attr('fill', C.muted).text(`${gr.slates.length} chapas`);
    g.append('text').attr('x', cx).attr('y', y(med) - 5).attr('text-anchor', 'middle').attr('font-size', 8.5).attr('fill', col).attr('font-weight', 700).text(fmtPct(med, 1));
  });

  g.append('g').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).tickFormat('').tickSizeOuter(0))
    .call(sel => { sel.select('.domain').attr('stroke', C.grid); });
  g.append('g')
    .call(d3.axisLeft(y).ticks(4).tickFormat(d => `${(d * 100).toFixed(d < .1 ? 1 : 0)}%`).tickSizeOuter(0))
    .call(sel => { sel.selectAll('text').attr('fill', C.muted).attr('font-size', 9.5); sel.select('.domain').attr('stroke', C.grid); });
  label(g, w / 2, h + 62, '% de mulheres na chapa', { size: 9.5, anchor: 'middle' });
  label(g, -36, h / 2, 'taxa com ≥ 2 sinais', { size: 9.5, anchor: 'middle' }).attr('transform', `rotate(-90,-36,${h / 2})`);
  label(g, w, -14, 'cada ponto = uma chapa; tamanho = nº de candidaturas', { size: 8.5, anchor: 'end', fill: C.faint });
}
