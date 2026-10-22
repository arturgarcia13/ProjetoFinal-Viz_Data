import * as d3 from 'd3';
import { C, chartFrame, fmtPct, fmtRatio, showTip, hideTip, short } from './helpers.js';

// H10: cinco eixos padronizados (Z-score). O sinal de cada eixo é mantido:
// valores altos = mais inclusão/recurso/voto/cadeira; em integridade, alto = mais sinais.
const AXES = [
  { key: 'candShare', label: 'inclusão', full: 'inclusão formal (% mulheres)', fmt: d => fmtPct(d, 0) },
  { key: 'ratioRes', label: 'recursos', full: 'equidade orçamentária (FEFC)', fmt: d => `${fmtRatio(d)}×` },
  { key: 'sig2F', label: 'integridade', full: 'candidatas com ≥ 2 sinais', fmt: d => fmtPct(d) },
  { key: 'ratioVote', label: 'votos', full: 'rendimento nas urnas', fmt: d => `${fmtRatio(d)}×` },
  { key: 'ratioSeat', label: 'cadeiras', full: 'sucesso parlamentar', fmt: d => `${fmtRatio(d)}×` }
];

function standardize(rows, key) {
  const vals = rows.map(d => d[key]).filter(Number.isFinite);
  const mean = d3.mean(vals) || 0;
  const sd = d3.deviation(vals) || 0;
  return { mean, sd };
}

export function renderParallel(container, ctx) {
  const { partyContext, state, on } = ctx;
  const rows = partyContext.filter(p => p.n >= 50
    && AXES.every(a => Number.isFinite(p[a.key])));
  if (rows.length < 3) { container.innerHTML = '<p class="empty">Poucos partidos com candidaturas dos dois gêneros.</p>'; return; }

  const stats = Object.fromEntries(AXES.map(a => [a.key, standardize(rows, a.key)]));
  for (const d of rows) {
    d.z = {};
    for (const a of AXES) {
      const { mean, sd } = stats[a.key];
      d.z[a.key] = sd > 1e-9 ? (d[a.key] - mean) / sd : 0;
    }
  }

  const { svg, width, height } = chartFrame(container, 450, 620);
  const m = { top: 64, right: 54, bottom: 36, left: 76 };
  const w = width - m.left - m.right, h = height - m.top - m.bottom;
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
  const xs = d3.scalePoint().domain(AXES.map(a => a.key)).range([0, w]);
  const zMax = Math.max(2.5, d3.max(rows, d => d3.max(AXES, a => Math.abs(d.z[a.key]))) || 2.5);
  const y = d3.scaleLinear().domain([-zMax, zMax]).range([h, 0]);
  const yraw = Object.fromEntries(AXES.map(a => [a.key, d3.scaleLinear().domain([-zMax, zMax]).range([h, 0])]));

  const color = d3.scaleDiverging(t => d3.interpolateRgbBasis(['#A9362A', '#D7B9A2', '#2E6B4F'])(t))
    .domain([0.3, 0.75, 1.1]).clamp(true);

  // eixos
  AXES.forEach((a, ai) => {
    const x = xs(a.key);
    g.append('line').attr('x1', x).attr('x2', x).attr('y1', 0).attr('y2', h).attr('stroke', C.grid).attr('stroke-width', 1.2);
    g.append('text').attr('x', x).attr('y', -34).attr('text-anchor', 'middle').attr('font-size', 9.6).attr('font-weight', 700).attr('fill', C.ink).text(a.label);
    g.append('text').attr('x', x).attr('y', -23).attr('text-anchor', 'middle').attr('font-size', 8).attr('fill', C.faint).text(a.full.includes('(') ? a.full.split('(')[0].trim() : a.full);
    const ticks = [-2, 0, 2].filter(t => Math.abs(t) <= zMax);
    ticks.forEach(t => {
      g.append('line').attr('x1', x - 3).attr('x2', x + 3).attr('y1', y(t)).attr('y2', y(t)).attr('stroke', C.muted);
      const left = ai === 0;
      g.append('text').attr('x', left ? x + 7 : x - 7).attr('y', y(t) + 3)
        .attr('text-anchor', left ? 'start' : 'end').attr('font-size', 8).attr('fill', C.muted)
        .text(`${t > 0 ? '+' : ''}${t}σ`);
    });
    g.append('line').attr('x1', x - 8).attr('x2', x + 8).attr('y1', y(0)).attr('y2', y(0))
      .attr('stroke', C.ink).attr('stroke-width', 1.1);
  });
  g.append('text').attr('x', -46).attr('y', h / 2).attr('text-anchor', 'middle').attr('font-size', 9).attr('fill', C.muted)
    .attr('transform', `rotate(-90,-46,${h / 2})`).text('desvios-padrão (Z)');

  const path = d => AXES.map(a => `${xs(a.key)},${y(d.z[a.key])}`).join('L');
  const pcAllowed = state.pcParties;

  const lines = g.selectAll('path.pc').data(rows).join('path')
    .attr('class', 'pc')
    .attr('d', d => `M${path(d)}`)
    .attr('fill', 'none')
    .attr('stroke', d => color(d.ratioSeat))
    .attr('stroke-width', d => state.parties.has(d.leg) ? 2.6 : 1.6)
    .attr('opacity', d => {
      if (state.parties.size && !state.parties.has(d.leg)) return .12;
      if (pcAllowed.size && !pcAllowed.has(d.leg)) return .08;
      return .55;
    })
    .style('cursor', 'pointer');

  // camada de clique/hover
  const hit = g.selectAll('path.hit').data(rows).join('path')
    .attr('class', 'hit')
    .attr('d', d => `M${path(d)}`)
    .attr('fill', 'none').attr('stroke', 'transparent').attr('stroke-width', 12)
    .style('cursor', 'pointer')
    .on('click', (event, d) => on.toggleParty(d.leg))
    .on('mousemove', (event, d) => {
      lines.attr('opacity', x => x === d ? 1 : .08).attr('stroke-width', x => x === d ? 3 : 1.4);
      showTip(`<strong>${d.leg}</strong><br>
        ${fmtPct(d.candShare)} candidaturas · ${fmtRatio(d.ratioRes)}× recursos<br>
        ${fmtPct(d.sig2F)} com ≥ 2 sinais · ${fmtRatio(d.ratioVote)}× votos · ${fmtRatio(d.ratioSeat)}× cadeiras<br>
        <span class="tip-muted">${d.elF + d.elM} eleitas/os · clique para filtrar</span>`, event);
    })
    .on('mouseleave', () => {
      lines.attr('opacity', x => {
        if (state.parties.size && !state.parties.has(x.leg)) return .12;
        if (pcAllowed.size && !pcAllowed.has(x.leg)) return .08;
        return .55;
      }).attr('stroke-width', x => state.parties.has(x.leg) ? 2.6 : 1.6);
      hideTip();
    });

  // brushes por eixo (em Z-score)
  const brushState = state.pcRanges || {};
  AXES.forEach(a => {
    const x = xs(a.key);
    const brush = d3.brushY()
      .extent([[x - 11, 0], [x + 11, h]])
      .on('end', event => {
        if (!event.sourceEvent) return;
        const ranges = { ...state.pcRanges };
        if (!event.selection) delete ranges[a.key];
        else {
          const [y0, y1] = event.selection;
          const v0 = y.invert(y1), v1 = y.invert(y0);
          ranges[a.key] = [Math.min(v0, v1), Math.max(v0, v1)];
        }
        const allowed = new Set(rows.filter(d => AXES.every(ax => {
          const r = ranges[ax.key];
          return !r || (d.z[ax.key] >= r[0] && d.z[ax.key] <= r[1]);
        })).map(d => d.leg));
        on.setPCRanges(ranges, allowed);
      });
    const bg = g.append('g').attr('class', 'pcbrush').call(brush);
    const r = brushState[a.key];
    if (r) bg.call(brush.move, [y(r[1]), y(r[0])]);
  });

  // legenda de cor
  const lg = svg.append('g').attr('transform', `translate(${m.left},${height - 12})`);
  const lw = 90;
  const grad = svg.append('defs').append('linearGradient').attr('id', 'pcgrad');
  for (let i = 0; i <= 10; i++) grad.append('stop').attr('offset', `${i * 10}%`).attr('stop-color', color(0.3 + (1.1 - 0.3) * i / 10));
  lg.append('rect').attr('width', lw).attr('height', 6).attr('fill', 'url(#pcgrad)');
  lg.append('text').attr('x', 0).attr('y', -5).attr('font-size', 8.5).attr('fill', C.muted).text('cor = razão de cadeiras');
  lg.append('text').attr('x', lw + 6).attr('y', 6).attr('font-size', 8.5).attr('fill', C.muted).text('1,0×');
  svg.append('text').attr('x', width - 12).attr('y', height - 8).attr('text-anchor', 'end').attr('font-size', 8.5).attr('fill', C.faint)
    .text('eixos em Z-score · arraste para filtrar · clique numa linha para selecionar');
}
