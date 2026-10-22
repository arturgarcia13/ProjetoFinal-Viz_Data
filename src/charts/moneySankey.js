import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal, sankeyJustify } from 'd3-sankey';
import { C, chartFrame, fmtMoney, fmtPct, fmtNum, label, showTip, hideTip } from './helpers.js';

const DEST = [
  { k: 'outros', label: 'Outros candidatos', color: '#8E4B3E' },
  { k: 'partido', label: 'Partido / órgão', color: '#A9762E' },
  { k: 'shared', label: 'Fornecedor compartilhado', color: '#6E7C6A' },
  { k: 'exclusive', label: 'Fornecedor exclusivo', color: '#9C9384' }
];

export function renderMoneySankey(container, ctx) {
  const { stats } = ctx;
  const F = stats.rows.filter(c => c.g === 'F'), M = stats.rows.filter(c => c.g === 'M');
  const fefcF = d3.sum(F, c => c.fefc), fefcM = d3.sum(M, c => c.fefc);
  const eF = d3.sum(F, c => c.e), eM = d3.sum(M, c => c.e);
  if (!fefcF || !fefcM || !eF || !eM) { container.innerHTML = '<p class="empty">Sem FEFC e despesa contratada suficientes neste recorte.</p>'; return; }

  const shares = (rows, total) => {
    const cand = d3.sum(rows, c => c.toCand) / total;
    const party = d3.sum(rows, c => c.toParty) / total;
    const shared = d3.sum(rows, c => c.shared) / total;
    return { outros: cand, partido: party, shared, exclusive: Math.max(0, 1 - cand - party - shared) };
  };
  const sF = shares(F, eF), sM = shares(M, eM);

  const nodes = [
    { id: 'fefc', label: 'FEFC', kind: 'source' },
    { id: 'F', label: 'Mulheres', kind: 'gender', total: fefcF, color: C.women },
    { id: 'M', label: 'Homens', kind: 'gender', total: fefcM, color: C.men },
    ...DEST.map(d => ({ id: `F-${d.k}`, label: d.label, kind: 'dest', color: d.color })),
    ...DEST.map(d => ({ id: `M-${d.k}`, label: d.label, kind: 'dest', color: d.color }))
  ];
  const links = [
    { source: 'fefc', target: 'F', value: fefcF, gender: 'F' },
    { source: 'fefc', target: 'M', value: fefcM, gender: 'M' },
    ...DEST.map(d => ({ source: 'F', target: `F-${d.k}`, value: fefcF * sF[d.k], gender: 'F' })),
    ...DEST.map(d => ({ source: 'M', target: `M-${d.k}`, value: fefcM * sM[d.k], gender: 'M' }))
  ];

  const { svg, width, height } = chartFrame(container, 430, 620);
  const m = { top: 36, right: 238, bottom: 24, left: 12 };
  const w = width - m.left - m.right, h = height - m.top - m.bottom;
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  const sk = sankey()
    .nodeId(d => d.id)
    .nodeWidth(10)
    .nodePadding(15)
    .extent([[0, 0], [w, h]]);
  const graph = sk({ nodes: nodes.map(d => ({ ...d })), links: links.map(d => ({ ...d })) });

  g.append('g').selectAll('path.link').data(graph.links).join('path')
    .attr('class', 'link')
    .attr('d', sankeyLinkHorizontal())
    .attr('fill', 'none')
    .attr('stroke', d => d.gender === 'F' ? C.women : C.men)
    .attr('stroke-width', d => Math.max(1, d.width))
    .attr('opacity', .22)
    .on('mousemove', (event, d) => showTip(`<strong>${d.source.label} → ${d.target.label}</strong><br>${fmtMoney(d.value)}<br><span class="tip-muted">alocação proporcional das despesas contratadas</span>`, event))
    .on('mouseleave', hideTip);

  g.selectAll('rect.node').data(graph.nodes).join('rect')
    .attr('class', 'node')
    .attr('x', d => d.x0).attr('y', d => d.y0)
    .attr('width', d => d.x1 - d.x0).attr('height', d => Math.max(2, d.y1 - d.y0))
    .attr('fill', d => d.kind === 'source' ? C.ink : d.kind === 'gender' ? d.color : d.color)
    .attr('rx', 1);

  // Tabela de destinos: evita rótulos empilhados em fluxos minúsculos.
  const tx = w + 10, ty = 48, rowH = 38;
  const SHORT = { outros: 'Outros cand.', partido: 'Partido', shared: 'Compartilhado', exclusive: 'Exclusivo' };
  svg.append('text').attr('x', tx).attr('y', 18).attr('font-size', 9).attr('letter-spacing', '.08em').attr('fill', C.muted).text('DESTINO');
  svg.append('text').attr('x', tx + 145).attr('y', 18).attr('text-anchor', 'end').attr('font-size', 8.5).attr('fill', C.women).text('mulheres');
  svg.append('text').attr('x', tx + 202).attr('y', 18).attr('text-anchor', 'end').attr('font-size', 8.5).attr('fill', C.men).text('homens');
  DEST.forEach((d, i) => {
    const y = ty + i * rowH;
    const vf = fefcF * sF[d.k], vm = fefcM * sM[d.k];
    svg.append('rect').attr('x', tx).attr('y', y - 7).attr('width', 7).attr('height', 7).attr('fill', d.color);
    svg.append('text').attr('x', tx + 12).attr('y', y).attr('font-size', 9).attr('fill', C.muted).text(SHORT[d.k] || d.label);
    svg.append('text').attr('x', tx + 145).attr('y', y).attr('text-anchor', 'end').attr('font-size', 8.7).attr('fill', C.ink).text(fmtMoney(vf));
    svg.append('text').attr('x', tx + 202).attr('y', y).attr('text-anchor', 'end').attr('font-size', 8.7).attr('fill', C.ink).text(fmtMoney(vm));
  });
  svg.append('text').attr('x', tx).attr('y', ty + 4 * rowH + 4).attr('font-size', 8.3).attr('fill', C.faint)
    .text('alocação proporcional do gasto');

  // labels de gênero no nó
  graph.nodes.filter(d => d.kind === 'gender').forEach(d => {
    svg.append('text').attr('x', m.left + d.x0).attr('y', m.top + d.y0 - 7)
      .attr('font-size', 11).attr('font-weight', 700).attr('fill', d.color)
      .text(`${d.label} · ${fmtMoney(d.total)}`);
  });
  svg.append('text').attr('x', m.left).attr('y', m.top + 2).attr('font-size', 9.5).attr('fill', C.muted).text('FEFC');

  // legenda de transparência
  svg.append('text').attr('x', 12).attr('y', height - 8)
    .attr('font-size', 9).attr('fill', C.faint)
    .text('A despesa não é vinculada à fonte no TSE: o destino é uma alocação proporcional do gasto contratado.');
}
