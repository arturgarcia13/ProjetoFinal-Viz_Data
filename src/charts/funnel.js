import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import { C, chartFrame, fmtNum, fmtPct, showTip, hideTip, label } from './helpers.js';

export function renderFunnel(container, ctx) {
  const { stats } = ctx;
  const F = stats.rows.filter(c => c.g === 'F'), M = stats.rows.filter(c => c.g === 'M');
  if (!F.length || !M.length) { container.innerHTML = '<p class="empty">Sem candidaturas dos dois gêneros neste recorte.</p>'; return; }

  const stages = ['Candidaturas', 'Deferidas', 'Votação ≥10% QE', 'Eleitas'];
  const qeMap = stats.h5.qeByKey || new Map();
  const count = (rows, stage) => {
    if (stage === 0) return rows.length;
    if (stage === 1) return rows.filter(c => c.cs === 1).length;
    if (stage === 2) return rows.filter(c => {
      const qe = qeMap.get(`${c.uf}|${c.cargo}`);
      return c.cs === 1 && Number.isFinite(qe) && c.v >= 0.10 * qe;
    }).length;
    return rows.filter(c => {
      const qe = qeMap.get(`${c.uf}|${c.cargo}`);
      return c.cs === 1 && Number.isFinite(qe) && c.v >= 0.10 * qe && c.el === 1;
    }).length;
  };
  const nF = stages.map((_, i) => count(F, i));
  const nM = stages.map((_, i) => count(M, i));

  const nodes = [], links = [];
  for (let i = 0; i < stages.length; i++) {
    nodes.push({ id: `F${i}`, label: 'Mulheres', stage: i, g: 'F', value: nF[i] });
    nodes.push({ id: `M${i}`, label: 'Homens', stage: i, g: 'M', value: nM[i] });
  }
  for (let i = 0; i < stages.length - 1; i++) {
    links.push({ source: `F${i}`, target: `F${i + 1}`, value: nF[i + 1], g: 'F' });
    links.push({ source: `M${i}`, target: `M${i + 1}`, value: nM[i + 1], g: 'M' });
  }

  const { svg, width, height } = chartFrame(container, 470, 620);
  const m = { top: 46, right: 30, bottom: 38, left: 22 };
  const w = width - m.left - m.right, h = height - m.top - m.bottom;
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  const sk = sankey().nodeId(d => d.id).nodeWidth(9).nodePadding(20)
    .extent([[0, 0], [w, h]]);
  const graph = sk({ nodes: nodes.map(d => ({ ...d })), links: links.map(d => ({ ...d })) });

  // estágios
  const xs = d3.group(graph.nodes, d => d.stage);
  for (const [stage, arr] of xs) {
    const x = d3.mean(arr, d => (d.x0 + d.x1) / 2);
    svg.append('text').attr('x', Math.max(42, Math.min(width - 42, m.left + x))).attr('y', 24).attr('text-anchor', 'middle')
      .attr('font-size', 10.5).attr('font-weight', 700).attr('fill', C.ink).text(stages[stage]);
  }

  g.selectAll('path.link').data(graph.links).join('path')
    .attr('d', sankeyLinkHorizontal())
    .attr('fill', 'none')
    .attr('stroke', d => d.g === 'F' ? C.women : C.men)
    .attr('stroke-width', d => Math.max(1, d.width))
    .attr('opacity', .28)
    .on('mousemove', (event, d) => showTip(`<strong>${d.g === 'F' ? 'Mulheres' : 'Homens'}</strong><br>${fmtNum(d.value)} seguem para a etapa seguinte<br><span class="tip-muted">${stages[d.target.stage]}</span>`, event))
    .on('mouseleave', hideTip);

  g.selectAll('rect.node').data(graph.nodes).join('rect')
    .attr('x', d => d.x0).attr('y', d => d.y0)
    .attr('width', d => d.x1 - d.x0).attr('height', d => Math.max(2, d.y1 - d.y0))
    .attr('fill', d => d.g === 'F' ? C.women : C.men).attr('rx', 1);

  // números nos nós
  g.selectAll('text.n').data(graph.nodes).join('text')
    .attr('x', d => d.x1 + 7).attr('y', d => (d.y0 + d.y1) / 2 + 3)
    .attr('font-size', 9).attr('fill', d => d.g === 'F' ? C.women : C.men).attr('font-weight', 600)
    .text(d => fmtNum(nF[d.stage] !== undefined && d.g === 'F' ? nF[d.stage] : nM[d.stage]));

  // retenção por gênero
  const retF = nF.map(v => nF[0] ? v / nF[0] : 0);
  const retM = nM.map(v => nM[0] ? v / nM[0] : 0);
  const ty = height - 18;
  svg.append('text').attr('x', 12).attr('y', ty).attr('font-size', 9.5).attr('fill', C.muted)
    .text(`Chegam a eleitas/os: mulheres ${fmtPct(retF[3])} · homens ${fmtPct(retM[3])}`);
  svg.append('text').attr('x', width - 12).attr('y', ty).attr('text-anchor', 'end').attr('font-size', 9).attr('fill', C.faint)
    .text('funil cumulativo: deferida → voto competitivo → cadeira');
}
