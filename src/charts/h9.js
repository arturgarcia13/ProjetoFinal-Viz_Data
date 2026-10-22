import * as d3 from 'd3';
import { C, chartFrame, fmtPct, label, showTip, hideTip } from './helpers.js';

const IND = [
  { k: 'classic', label: 'Laranja clássica', sub: 'R$ 0 e 0 votos', color: '#8E8678' },
  { k: 'kit', label: 'Laranja contábil', sub: 'kit padronizado em lote', color: C.women }
];

export function renderH9(container, ctx) {
  const { h9 } = ctx;
  const { svg, width, height } = chartFrame(container, 360);
  const m = { top: 58, right: 24, bottom: 76, left: 54 };
  const w = width - m.left - m.right, h = height - m.top - m.bottom;
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  const vals = IND.flatMap(d => [h9[2022][d.k], h9[2026][d.k]]).filter(Number.isFinite);
  const ymax = Math.max(.02, (d3.max(vals) || 0) * 1.4);
  const x = d3.scaleBand().domain(IND.map(d => d.k)).range([0, w]).padding(.36);
  const y = d3.scaleLinear().domain([0, ymax]).range([h, 0]);

  g.append('g').selectAll('line').data(y.ticks(4)).join('line')
    .attr('x1', 0).attr('x2', w).attr('y1', d => y(d)).attr('y2', d => y(d))
    .attr('stroke', C.grid).attr('stroke-dasharray', '2 4').attr('opacity', .65);

  const defs = svg.append('defs');
  const pat = defs.append('pattern').attr('id', 'hatch26').attr('width', 6).attr('height', 6)
    .attr('patternTransform', 'rotate(45)').attr('patternUnits', 'userSpaceOnUse');
  pat.append('rect').attr('width', 6).attr('height', 6).attr('fill', C.women).attr('opacity', .85);
  pat.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 6).attr('stroke', C.card).attr('stroke-width', 2);

  const bw = x.bandwidth() / 2;
  const series = [
    { y: 2022, color: '#7C7568', label: '2022 · final', hatch: false },
    { y: 2026, color: C.women, label: '2026 · preliminar', hatch: true }
  ];
  series.forEach((s, si) => {
    const bars = g.selectAll(`rect.y${s.y}`).data(IND).join('rect')
      .attr('class', `sbar y${s.y}`)
      .attr('x', d => x(d.k) + si * bw).attr('y', d => y(h9[s.y][d.k] ?? 0))
      .attr('width', bw - 5).attr('height', d => h - y(h9[s.y][d.k] ?? 0))
      .attr('fill', s.color).attr('opacity', s.y === 2022 ? .78 : .92)
      .on('mousemove', (event, d) => showTip(`<strong>${s.label} · ${d.label}</strong><br>${fmtPct(h9[s.y][d.k])} das candidaturas femininas<br><span class="tip-muted">${d.sub}${s.y === 2026 ? ' · prestação preliminar' : ' · prestação final'}</span>`, event))
      .on('mouseleave', hideTip);
    if (s.hatch) {
      bars.attr('fill', 'url(#hatch26)').attr('stroke', s.color).attr('stroke-width', 1.2);
    }
    g.selectAll(`text.v${s.y}`).data(IND).join('text')
      .attr('x', d => x(d.k) + si * bw + (bw - 5) / 2).attr('y', d => y(h9[s.y][d.k] ?? 0) - 6)
      .attr('text-anchor', 'middle').attr('font-size', 9).attr('font-weight', 700).attr('fill', s.y === 2022 ? C.muted : C.women)
      .text(d => fmtPct(h9[s.y][d.k], 2));
  });

  g.append('g').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).tickFormat('').tickSizeOuter(0))
    .call(sel => { sel.select('.domain').attr('stroke', C.grid); });
  IND.forEach(d => {
    const cx = x(d.k) + x.bandwidth() / 2;
    g.append('text').attr('x', cx).attr('y', h + 18).attr('text-anchor', 'middle').attr('font-size', 10.5).attr('font-weight', 700).attr('fill', C.ink).text(d.label);
    g.append('text').attr('x', cx).attr('y', h + 31).attr('text-anchor', 'middle').attr('font-size', 8.8).attr('fill', C.muted).text(d.sub);
  });
  g.append('g')
    .call(d3.axisLeft(y).ticks(4).tickFormat(d => `${(d * 100).toFixed(d < .02 ? 1 : 0)}%`).tickSizeOuter(0))
    .call(sel => { sel.selectAll('text').attr('fill', C.muted).attr('font-size', 9.5); sel.select('.domain').attr('stroke', C.grid); });
  label(g, -42, h / 2, '% de candidaturas femininas', { size: 9.5, anchor: 'middle' }).attr('transform', `rotate(-90,-42,${h / 2})`);

  svg.append('rect').attr('x', m.left).attr('y', 16).attr('width', 10).attr('height', 10).attr('fill', '#7C7568').attr('opacity', .8);
  svg.append('text').attr('x', m.left + 14).attr('y', 25).attr('font-size', 9.5).attr('fill', C.muted).text('2022 · final');
  svg.append('rect').attr('x', m.left + 94).attr('y', 16).attr('width', 10).attr('height', 10).attr('fill', 'url(#hatch26)').attr('stroke', C.women);
  svg.append('text').attr('x', m.left + 108).attr('y', 25).attr('font-size', 9.5).attr('fill', C.muted).text('2026 · preliminar');
  const warn = `⚠ ${fmtPct(h9[2026].finalShare)} das contas de 2026 finalizadas · extração 22/10/2026`;
  const warnW = Math.max(150, Math.min(300, width - m.left - 24));
  const warnX = width - 12 - warnW;
  svg.append('rect').attr('x', warnX).attr('y', 10).attr('width', warnW).attr('height', 20)
    .attr('rx', 2).attr('fill', C.amber).attr('opacity', .12);
  svg.append('text').attr('x', warnX + 7).attr('y', 24).attr('font-size', 8.4).attr('fill', C.amber).attr('font-weight', 600)
    .text(warn);
  label(svg, 12, height - 8, 'Clássica: R$ 0,00 recebidos, R$ 0,00 gastos e 0 votos. Contábil: ≥ 3 mulheres com < 20 votos no diretório e FEFC/Fundo Partidário idênticos ou mesmo pacote de fornecedor/valor/data.', { size: 8.1, fill: C.faint });
}
