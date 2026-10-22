import * as d3 from 'd3';
import { C, chartFrame, fmtMoney, fmtPct, label, showTip, hideTip } from './helpers.js';

export function renderFundingLine(container, ctx) {
  const rows = ctx.rows.filter(c => c.g === 'F' || c.g === 'M');
  if (rows.length < 200) { container.innerHTML = '<p class="empty">Amostra insuficiente.</p>'; return; }

  const sorted = rows.slice().sort((a, b) => a.r - b.r);
  const nBins = 10;
  const bins = [];
  for (let i = 0; i < nBins; i++) {
    const a = Math.floor(i * sorted.length / nBins), b = Math.floor((i + 1) * sorted.length / nBins);
    const part = sorted.slice(a, b);
    if (!part.length) continue;
    const F = part.filter(c => c.g === 'F'), M = part.filter(c => c.g === 'M');
    if (F.length < 10 || M.length < 10) continue;
    bins.push({
      i: bins.length + 1,
      medR: d3.median(part, c => c.r),
      f: d3.mean(F, c => c.el),
      m: d3.mean(M, c => c.el),
      nF: F.length, nM: M.length
    });
  }
  if (bins.length < 3) { container.innerHTML = '<p class="empty">Poucas faixas com os dois gêneros.</p>'; return; }

  const { svg, width, height } = chartFrame(container, 320);
  const m = { top: 28, right: 78, bottom: 58, left: 44 };
  const w = width - m.left - m.right, h = height - m.top - m.bottom;
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  const x = d3.scalePoint().domain(bins.map(d => d.i)).range([0, w]).padding(.4);
  const yMax = Math.max(0.05, d3.max(bins, d => Math.max(d.f, d.m)) * 1.15);
  const y = d3.scaleLinear().domain([0, yMax]).range([h, 0]);

  g.append('g').selectAll('line').data(y.ticks(4)).join('line')
    .attr('x1', 0).attr('x2', w).attr('y1', d => y(d)).attr('y2', d => y(d))
    .attr('stroke', C.grid).attr('stroke-dasharray', '2 4');

  for (const gender of ['M', 'F']) {
    const key = gender === 'F' ? 'f' : 'm';
    const color = gender === 'F' ? C.women : C.men;
    const line = d3.line().x(d => x(d.i)).y(d => y(d[key])).curve(d3.curveMonotoneX);
    g.append('path').datum(bins).attr('d', line).attr('fill', 'none').attr('stroke', color).attr('stroke-width', 2.4);
    g.selectAll(`circle.${gender}`).data(bins).join('circle')
      .attr('cx', d => x(d.i)).attr('cy', d => y(d[key])).attr('r', 3.4)
      .attr('fill', color).attr('stroke', C.card).attr('stroke-width', 1.2)
      .on('mousemove', (event, d) => showTip(`<strong>${gender === 'F' ? 'Mulheres' : 'Homens'}</strong> · faixa ${d.i} de receita<br>mediana ${fmtMoney(d.medR)}<br>sucesso ${fmtPct(d[key])}<br><span class="tip-muted">${gender === 'F' ? d.nF : d.nM} candidaturas</span>`, event))
      .on('mouseleave', hideTip);
  }

  const last = bins[bins.length - 1];
  g.append('line').attr('x1', x(last.i)).attr('x2', x(last.i)).attr('y1', y(last.f)).attr('y2', y(last.m))
    .attr('stroke', C.ink).attr('stroke-width', 1);
  label(g, x(last.i) + 6, y(last.m) + 3, `homens ${fmtPct(last.m)}`, { size: 9, fill: C.men, weight: 600 });
  label(g, x(last.i) + 6, y(last.f) + 3, `mulheres ${fmtPct(last.f)}`, { size: 9, fill: C.women, weight: 600 });

  g.append('g').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).tickFormat(i => `${i}º`).tickSizeOuter(0))
    .call(sel => { sel.selectAll('text').attr('fill', C.muted).attr('font-size', 9); sel.select('.domain').attr('stroke', C.grid); });
  g.append('g')
    .call(d3.axisLeft(y).ticks(4).tickFormat(d => `${Math.round(d * 100)}%`).tickSizeOuter(0))
    .call(sel => { sel.selectAll('text').attr('fill', C.muted).attr('font-size', 9); sel.select('.domain').attr('stroke', C.grid); });
  label(g, w / 2, h + 42, 'faixas de receita (1 = menos recursos, 10 = mais recursos)', { size: 9.5, anchor: 'middle' });
  label(g, -32, h / 2, 'taxa de sucesso', { size: 9.5, anchor: 'middle' }).attr('transform', `rotate(-90,-32,${h / 2})`);
}
