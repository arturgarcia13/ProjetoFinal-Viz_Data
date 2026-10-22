import * as d3 from 'd3';
import { C, chartFrame, fmtMoney, fmtPct, fmtRatio, label, showTip, hideTip, short } from './helpers.js';

export function renderFefcScatter(container, ctx) {
  const { partyContext, state, on } = ctx;
  const rows = partyContext.filter(p => p.n >= 30 && p.fefcF + p.fefcM > 0 && p.candShare > 0);
  if (rows.length < 3) { container.innerHTML = '<p class="empty">Poucos partidos com FEFC neste recorte.</p>'; return; }

  const { svg, width, height } = chartFrame(container, 400, 620);
  const m = { top: 28, right: 24, bottom: 50, left: 52 };
  const w = width - m.left - m.right, h = height - m.top - m.bottom;
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  const x = d3.scaleLinear().domain([0.25, 0.5]).range([0, w]);
  const y = d3.scaleLinear().domain([0.2, 0.6]).range([h, 0]);
  const s = d3.scaleSqrt().domain([0, d3.max(rows, d => d.fefcF + d.fefcM) || 1]).range([3, 15]);
  const col = d3.scaleDiverging(t => d3.interpolateRgbBasis(['#A9362A', '#D8B9A4', '#2E6B4F'])(t)).domain([0.75, 1, 1.25]).clamp(true);

  g.append('g').selectAll('line.x').data(y.ticks(5)).join('line')
    .attr('x1', 0).attr('x2', w).attr('y1', d => y(d)).attr('y2', d => y(d))
    .attr('stroke', C.grid).attr('stroke-dasharray', '2 4').attr('opacity', .55);
  g.append('g').selectAll('line.y').data(x.ticks(5)).join('line')
    .attr('y1', 0).attr('y2', h).attr('x1', d => x(d)).attr('x2', d => x(d))
    .attr('stroke', C.grid).attr('stroke-dasharray', '2 4').attr('opacity', .55);

  // zona de subfinanciamento: abaixo da diagonal (FEFC < presença feminina)
  const under = [
    [0.25, 0.20], [0.25, 0.25], [0.50, 0.50], [0.50, 0.20]
  ];
  g.append('path')
    .attr('d', `M${under.map(([a, b]) => `${x(a)},${y(b)}`).join('L')}Z`)
    .attr('fill', C.women).attr('opacity', .055);
  label(g, x(0.365), y(0.255), 'abaixo da diagonal = subfinanciamento', { size: 8, fill: C.women, anchor: 'middle' });

  // diagonal
  g.append('line').attr('x1', x(0.25)).attr('y1', y(0.25)).attr('x2', x(0.5)).attr('y2', y(0.5))
    .attr('stroke', C.ink).attr('stroke-width', 1).attr('stroke-dasharray', '5 4').attr('opacity', .55);
  label(g, x(0.47), y(0.47) - 8, 'proporcionalidade', { size: 9, fill: C.ink, anchor: 'end' });
  g.append('line').attr('x1', x(0.30)).attr('x2', x(0.30)).attr('y1', 0).attr('y2', h).attr('stroke', C.accent).attr('stroke-dasharray', '3 4');
  g.append('line').attr('x1', 0).attr('x2', w).attr('y1', y(0.30)).attr('y2', y(0.30)).attr('stroke', C.accent).attr('stroke-dasharray', '3 4');
  label(g, x(0.30) + 4, 10, '30%', { size: 9, fill: C.accent });

  const sel = state.parties;
  const dots = g.selectAll('g.dot').data(rows).join('g')
    .attr('class', 'dot')
    .attr('transform', d => `translate(${x(d.candShare)},${y(d.fefcShare)})`)
    .style('cursor', 'pointer')
    .on('click', (event, d) => on.toggleParty(d.leg))
    .on('mousemove', (event, d) => showTip(`<strong>${d.leg}</strong><br>${fmtPct(d.candShare)} das candidaturas<br>${fmtPct(d.fefcShare)} do FEFC<br>razão ${fmtRatio(d.ratioRes)}×<br>FEFC total ${fmtMoney(d.fefcF + d.fefcM)}<br><span class="tip-muted">clique para filtrar</span>`, event))
    .on('mouseleave', hideTip);

  dots.append('circle')
    .attr('r', d => s(d.fefcF + d.fefcM))
    .attr('fill', d => col(d.ratioRes))
    .attr('opacity', d => (sel.size && !sel.has(d.leg)) ? .2 : .82)
    .attr('stroke', d => sel.has(d.leg) ? C.ink : C.white)
    .attr('stroke-width', d => sel.has(d.leg) ? 2 : 1);

  const extremes = rows.slice().sort((a, b) => a.ratioRes - b.ratioRes);
  const toLabel = [...extremes.slice(0, 2), ...extremes.slice(-2)];
  g.selectAll('text.plabel').data(toLabel).join('text')
    .attr('class', 'plabel')
    .attr('x', d => x(d.candShare) + s(d.fefcF + d.fefcM) + 3)
    .attr('y', d => y(d.fefcShare) + 3)
    .attr('font-size', 9).attr('fill', C.ink).attr('font-weight', 600)
    .text(d => short(d.leg, 15));

  g.append('g').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d => `${Math.round(d * 100)}%`).tickSizeOuter(0))
    .call(sel => { sel.selectAll('text').attr('fill', C.muted).attr('font-size', 9.5); sel.select('.domain').attr('stroke', C.grid); });
  g.append('g')
    .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${Math.round(d * 100)}%`).tickSizeOuter(0))
    .call(sel => { sel.selectAll('text').attr('fill', C.muted).attr('font-size', 9.5); sel.select('.domain').attr('stroke', C.grid); });
  label(g, w / 2, h + 38, '% de mulheres entre as candidaturas', { size: 10, anchor: 'middle' });
  label(g, -40, h / 2, '% do FEFC para mulheres', { size: 10, anchor: 'middle', fill: C.muted }).attr('transform', `rotate(-90,-40,${h / 2})`);
  label(g, w, -12, 'tamanho = FEFC total; cor = razão de recursos', { size: 9, anchor: 'end', fill: C.faint });

  // H3: clique em uma bolha seleciona o partido; com um único partido
  // selecionado, abre a distribuição interna (curva de Lorenz) das candidatas.
  if (state.parties.size === 1) {
    const leg = [...state.parties][0];
    const vals = ctx.rows.filter(c => c.g === 'F' && c.leg === leg)
      .map(c => c.fefc).filter(v => v > 0).sort(d3.ascending);
    if (vals.length >= 5) {
      const total = d3.sum(vals);
      const n = vals.length;
      let run = 0;
      const pts = [{ x: 0, y: 0 }];
      vals.forEach((v, i) => { run += v; pts.push({ x: (i + 1) / n, y: run / total }); });
      const gini = 1 - 2 * d3.sum(pts.slice(0, -1), (p, i) => (pts[i + 1].x - p.x) * (p.y + pts[i + 1].y) / 2);
      const pw = Math.min(width, 640), ph = 194;
      const panel = d3.select(container).append('div').attr('class', 'lorenz-panel');
      panel.append('div').attr('class', 'lorenz-title')
        .html(`<strong>Concentração interna · ${leg}</strong><span>${n} candidatas com FEFC > 0 · Gini ${gini.toFixed(2).replace('.', ',')}</span>`);
      const lsvg = panel.append('svg').attr('width', pw).attr('height', ph).attr('viewBox', `0 0 ${pw} ${ph}`);
      const lm = { top: 18, right: 20, bottom: 34, left: 44 };
      const lw = pw - lm.left - lm.right, lh = ph - lm.top - lm.bottom;
      const lg = lsvg.append('g').attr('transform', `translate(${lm.left},${lm.top})`);
      const lx = d3.scaleLinear().domain([0, 1]).range([0, lw]);
      const ly = d3.scaleLinear().domain([0, 1]).range([lh, 0]);
      lg.append('line').attr('x1', lx(0)).attr('y1', ly(0)).attr('x2', lx(1)).attr('y2', ly(1))
        .attr('stroke', C.ink).attr('stroke-dasharray', '4 4').attr('opacity', .45);
      lg.append('path').datum(pts).attr('fill', 'none').attr('stroke', C.women).attr('stroke-width', 2.2)
        .attr('d', d3.line().x(d => lx(d.x)).y(d => ly(d.y)));
      lg.append('g').attr('transform', `translate(0,${lh})`).call(d3.axisBottom(lx).ticks(4).tickFormat(d => `${Math.round(d * 100)}%`).tickSizeOuter(0))
        .call(sel => { sel.selectAll('text').attr('fill', C.muted).attr('font-size', 8.5); sel.select('.domain').attr('stroke', C.grid); });
      lg.append('g').call(d3.axisLeft(ly).ticks(4).tickFormat(d => `${Math.round(d * 100)}%`).tickSizeOuter(0))
        .call(sel => { sel.selectAll('text').attr('fill', C.muted).attr('font-size', 8.5); sel.select('.domain').attr('stroke', C.grid); });
      label(lg, lw / 2, lh + 28, 'candidatas ordenadas (acumulado)', { size: 8.5, anchor: 'middle' });
      label(lg, -32, lh / 2, 'FEFC acumulado', { size: 8.5, anchor: 'middle' }).attr('transform', `rotate(-90,-32,${lh / 2})`);
      label(lg, lw - 4, 12, 'diagonal = distribuição igual', { size: 8, anchor: 'end', fill: C.faint });
    }
  }
}
