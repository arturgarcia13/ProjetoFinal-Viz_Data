import * as d3 from 'd3';
import { C, chartFrame, fmtMoney, fmtPct, fmtRatio, label, showTip, hideTip, short } from './helpers.js';

export function renderDumbbell(container, ctx) {
  const { state, on, partyContext } = ctx;
  let rows = partyContext.filter(p => p.n >= 30 && p.medRF > 0 && p.medRM > 0);
  if (!rows.length) { container.innerHTML = '<p class="empty">Sem partidos com candidaturas dos dois gêneros neste recorte.</p>'; return; }
  rows = rows.slice().sort((a, b) => b.n - a.n).slice(0, 16);
  // Da maior para a menor disparidade: menor razão F/M no topo.
  rows.sort((a, b) => (a.medRF / a.medRM) - (b.medRF / b.medRM));

  const rowH = 34;
  const height = Math.max(380, rows.length * rowH + 92);
  const { svg, width } = chartFrame(container, height, 620);
  const m = { top: 36, right: 78, bottom: 42, left: 128 };
  const w = width - m.left - m.right, h = height - m.top - m.bottom;
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  const lo = d3.min(rows, d => Math.min(d.medRF, d.medRM));
  const hi = d3.max(rows, d => Math.max(d.medRF, d.medRM));
  const x = d3.scaleLog().domain([Math.max(1000, lo * 0.75), hi * 1.25]).range([0, w]);
  const y = d3.scaleBand().domain(rows.map(d => d.leg)).range([0, h]).padding(0.36);
  const selected = state.parties;

  g.append('g').selectAll('line').data(x.ticks(5)).join('line')
    .attr('x1', d => x(d)).attr('x2', d => x(d)).attr('y1', 0).attr('y2', h)
    .attr('stroke', C.grid).attr('stroke-dasharray', '2 4').attr('opacity', .55);

  g.selectAll('line.conn').data(rows).join('line')
    .attr('class', 'conn')
    .attr('x1', d => x(d.medRF)).attr('x2', d => x(d.medRM))
    .attr('y1', d => y(d.leg) + y.bandwidth() / 2).attr('y2', d => y(d.leg) + y.bandwidth() / 2)
    .attr('stroke', d => (selected.size && !selected.has(d.leg)) ? '#CFC6B6' : '#9C9384')
    .attr('stroke-width', 2.2);

  const dot = g.selectAll('g.party').data(rows).join('g')
    .attr('class', 'party')
    .attr('transform', d => `translate(0,${y(d.leg) + y.bandwidth() / 2})`)
    .style('cursor', 'pointer')
    .on('click', (event, d) => on.toggleParty(d.leg))
    .on('mousemove', (event, d) => {
      showTip(`<strong>${d.leg}</strong><br>${d.nF} mulheres · ${d.nM} homens<br>
        mediana mulheres: <b>${fmtMoney(d.medRF)}</b><br>mediana homens: <b>${fmtMoney(d.medRM)}</b><br>
        razão F/M: ${fmtRatio(d.medRF / d.medRM)}<br>
        <span class="tip-muted">clique para filtrar o partido</span>`, event);
    })
    .on('mouseleave', hideTip);

  dot.append('circle')
    .attr('cx', d => x(d.medRF)).attr('r', 5.2)
    .attr('fill', C.women).attr('stroke', C.card).attr('stroke-width', 1.5)
    .attr('opacity', d => (selected.size && !selected.has(d.leg)) ? .28 : 1);
  dot.append('circle')
    .attr('cx', d => x(d.medRM)).attr('r', 5.2)
    .attr('fill', C.men).attr('stroke', C.card).attr('stroke-width', 1.5)
    .attr('opacity', d => (selected.size && !selected.has(d.leg)) ? .28 : 1);

  g.selectAll('text.name').data(rows).join('text')
    .attr('class', 'name')
    .attr('x', -10).attr('y', d => y(d.leg) + y.bandwidth() / 2 + 3.5)
    .attr('text-anchor', 'end').attr('font-size', 10.5).attr('font-weight', d => selected.has(d.leg) ? 700 : 500)
    .attr('fill', d => (selected.size && !selected.has(d.leg)) ? C.faint : C.ink)
    .text(d => short(d.leg, 20));

  g.selectAll('text.rat').data(rows).join('text')
    .attr('class', 'rat')
    .attr('x', w + 9).attr('y', d => y(d.leg) + y.bandwidth() / 2 + 3.5)
    .attr('font-size', 10).attr('font-weight', 600)
    .attr('fill', d => (d.medRF / d.medRM) < 0.9 ? C.red : ((d.medRF / d.medRM) > 1.08 ? C.green : C.muted))
    .text(d => `${fmtRatio(d.medRF / d.medRM)}×`);

  g.append('g').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(5, d => d >= 1e6 ? `${d / 1e6} mi` : `${d / 1e3} mil`).tickSizeOuter(0))
    .call(sel => { sel.selectAll('text').attr('fill', C.muted).attr('font-size', 9.5); sel.select('.domain').attr('stroke', C.grid); });

  label(g, w / 2, h + 34, 'mediana de receita total por candidatura (escala log)', { size: 10, anchor: 'middle', fill: C.muted });
  // legend
  svg.append('circle').attr('cx', m.left).attr('cy', 16).attr('r', 4.5).attr('fill', C.women);
  svg.append('text').attr('x', m.left + 9).attr('y', 19.5).attr('font-size', 10).attr('fill', C.muted).text('mulheres');
  svg.append('circle').attr('cx', m.left + 76).attr('cy', 16).attr('r', 4.5).attr('fill', C.men);
  svg.append('text').attr('x', m.left + 85).attr('y', 19.5).attr('font-size', 10).attr('fill', C.muted).text('homens');
  svg.append('text').attr('x', width - 12).attr('y', 19.5).attr('text-anchor', 'end').attr('font-size', 9).attr('fill', C.faint).text('razão F/M');
}
