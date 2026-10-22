import * as d3 from 'd3';
import { C, chartFrame, fmtPct, fmtMoney, fmtNum, label, showTip, hideTip, short } from './helpers.js';

export function renderStageStrip(container, ctx) {
  const { stats, state } = ctx;
  if (!stats.rows.length || !Number.isFinite(stats.womenShare) || !Number.isFinite(stats.fefcShare) || !Number.isFinite(stats.voteShare) || !Number.isFinite(stats.seatShare)) {
    container.innerHTML = '<p class="empty">Sem candidaturas dos dois gêneros neste recorte.</p>';
    return;
  }
  const { svg, width, height } = chartFrame(container, 250);
  const m = { top: 34, right: 96, bottom: 26, left: 132 };
  const w = width - m.left - m.right;
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  const compact = x => x >= 1e6 ? `${(x / 1e6).toFixed(1).replace('.', ',')} mi` : x >= 1e3 ? `${Math.round(x / 1e3)} mil` : fmtNum(x);
  const rows = [
    { k: 'Candidaturas', v: stats.womenShare, n: `${fmtNum(stats.N)} candidaturas`, c: C.ink },
    { k: 'FEFC recebido', v: stats.fefcShare, n: fmtMoney(stats.h2 ? stats.rows.reduce((s, c) => s + c.fefc, 0) : 0), c: C.accent },
    { k: 'Votos', v: stats.voteShare, n: `${compact(stats.rows.reduce((s, c) => s + c.v, 0))} votos nominais`, c: C.men },
    { k: 'Cadeiras', v: stats.seatShare, n: `${fmtNum(stats.totalSeats)} eleitas/os`, c: C.women }
  ];

  const x = d3.scaleLinear().domain([0, 0.5]).range([0, w]);
  const rowH = (height - m.top - m.bottom) / rows.length;

  const ref = stats.womenShare;
  g.append('line')
    .attr('x1', x(ref)).attr('x2', x(ref)).attr('y1', -16).attr('y2', rows.length * rowH - 6)
    .attr('stroke', C.ink).attr('stroke-dasharray', '3 4').attr('stroke-width', 1);
  label(svg, m.left + x(ref) + 5, m.top - 20, 'presença nas candidaturas', { size: 9.5, fill: C.ink });

  rows.forEach((r, i) => {
    const y = i * rowH;
    g.append('text').attr('x', -14).attr('y', y + 15).attr('text-anchor', 'end')
      .attr('font-size', 12).attr('font-weight', 600).attr('fill', C.ink).text(r.k);
    g.append('text').attr('x', -14).attr('y', y + 29).attr('text-anchor', 'end')
      .attr('font-size', 9.5).attr('fill', C.muted).text(r.n);

    g.append('rect').attr('x', 0).attr('y', y + 4).attr('width', w).attr('height', 24)
      .attr('fill', '#E7E0D3').attr('rx', 1);
    g.append('rect').attr('x', 0).attr('y', y + 4).attr('width', Math.max(1, x(r.v))).attr('height', 24)
      .attr('fill', r.c).attr('rx', 1)
      .attr('class', 'bar-anim');

    g.append('text').attr('x', x(r.v) + 8).attr('y', y + 21)
      .attr('font-size', 14).attr('font-weight', 700).attr('fill', r.c)
      .text(fmtPct(r.v));

    const parity = r.v / ref;
    g.append('text').attr('x', w + 10).attr('y', y + 21)
      .attr('font-size', 10.5).attr('fill', C.muted)
      .text(r.k === 'Candidaturas' ? 'referência' : `${parity.toFixed(2).replace('.', ',')}×`);
  });

  // anotação do vazamento
  label(svg, m.left, height - 6, 'a perda começa na votação', { size: 9.5, fill: C.women, weight: 600 });

  if (state.year === 2026) {
    label(svg, width - m.right, height - 4, '2026: votos finais; contas preliminares', { size: 9, fill: C.amber, anchor: 'end' });
  }
}
