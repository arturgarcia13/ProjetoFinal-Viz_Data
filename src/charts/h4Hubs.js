import * as d3 from 'd3';
import { SEMANTIC_PALETTE } from './palette.js';
import { bindTooltipEvents, buildTooltipCard, createChartTooltip, fmtCompactBrl, fmtInt } from './tooltip.js';

/**
 * H4 (passo 3) — Rede bipartida de fornecedores-hub, com dados reais de data/network_hubs.json.
 * Candidatas de baixa votação (esquerda) → fornecedores compartilhados (centro) → candidatos (direita).
 * Candidaturas são anônimas (cid); só aparecem gênero, votos e despesa.
 */
export function renderH4Hubs(container, yearData, { width = 700, year = 2022 } = {}) {
  container.querySelector('.h4-hub-panel')?.remove();
  const hubsAll = yearData?.hubs || [];
  if (hubsAll.length === 0) return;

  const candById = new Map((yearData.candidates || []).map((c) => [c.cid, c]));
  const hubs = [...hubsAll].sort((a, b) => b.totalVal - a.totalVal).slice(0, 3);
  const links = [];
  const leftIds = new Set();
  const rightIds = new Set();

  hubs.forEach((h) => {
    const mine = (yearData.links || []).filter((l) => l.hid === h.hid)
      .map((l) => ({ ...l, c: candById.get(l.cid) })).filter((l) => l.c);
    const women = mine.filter((l) => l.c.g === 'F').sort((a, b) => a.c.v - b.c.v).slice(0, 3);
    const men = mine.filter((l) => l.c.g === 'M').sort((a, b) => b.val - a.val).slice(0, 2);
    women.forEach((l) => { leftIds.add(l.cid); links.push({ hub: h, ...l }); });
    men.forEach((l) => { rightIds.add(l.cid); links.push({ hub: h, ...l }); });
  });

  const left = [...leftIds].map((id) => candById.get(id));
  const right = [...rightIds].map((id) => candById.get(id));
  const isCompact = width < 460;
  const rowH = 30;
  const H = Math.max(left.length, right.length, hubs.length * 2) * rowH + 56;
  const lx = isCompact ? 12 : 16;
  const rx = width - (isCompact ? 12 : 16);
  const cx = width / 2;

  const panel = document.createElement('div');
  panel.className = 'h4-hub-panel';
  container.appendChild(panel);
  const tipCtrl = createChartTooltip(panel);
  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('class', 'h4-hubs-svg')
    .attr('viewBox', `0 0 ${width} ${H}`).attr('width', width).attr('height', H)
    .attr('role', 'img')
    .attr('aria-label', `Rede de fornecedores-hub que atendem várias candidaturas em ${year}`)
    .style('font-family', 'Inter, system-ui, sans-serif');

  svg.append('text').attr('x', cx).attr('y', 16).attr('text-anchor', 'middle').attr('font-size', 12)
    .attr('font-weight', 700).attr('fill', SEMANTIC_PALETTE.ink)
    .text(isCompact ? 'Fornecedores-hub em comum' : 'Fornecedores-hub conectam candidatas de baixa votação a candidatos');

  const yL = (i) => 40 + i * ((H - 60) / Math.max(1, left.length - 1 || 1));
  const yR = (i) => 40 + i * ((H - 60) / Math.max(1, right.length - 1 || 1));
  const yH = (i) => 40 + (i + 0.5) * ((H - 60) / hubs.length);
  const posL = new Map(left.map((c, i) => [c.cid, { x: lx + (isCompact ? 8 : 110), y: left.length === 1 ? H / 2 : yL(i) }]));
  const posR = new Map(right.map((c, i) => [c.cid, { x: rx - (isCompact ? 8 : 110), y: right.length === 1 ? H / 2 : yR(i) }]));
  const posH = new Map(hubs.map((h, i) => [h.hid, { x: cx, y: yH(i) }]));
  const rHub = d3.scaleSqrt().domain([0, d3.max(hubs, (h) => h.totalVal) || 1]).range([9, 20]);

  links.forEach((l) => {
    const isF = l.c.g === 'F';
    const a = isF ? posL.get(l.cid) : posH.get(l.hub.hid);
    const b = isF ? posH.get(l.hub.hid) : posR.get(l.cid);
    const mx = (a.x + b.x) / 2;
    svg.append('path').attr('class', 'h4-hub-link')
      .attr('d', `M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`)
      .attr('fill', 'none').attr('stroke', isF ? SEMANTIC_PALETTE.alert : SEMANTIC_PALETTE.men)
      .attr('stroke-opacity', isF ? 0.5 : 0.6).attr('stroke-width', isF ? 1.8 : 2.4);
  });

  const nodeLabel = (c, side) => `Cand. ${side} · ${fmtInt(c.v)} voto${c.v === 1 ? '' : 's'}`;
  left.forEach((c) => {
    const p = posL.get(c.cid);
    svg.append('circle').attr('cx', p.x).attr('cy', p.y).attr('r', 5.5).attr('fill', SEMANTIC_PALETTE.alert);
    svg.append('text').attr('x', p.x - 10).attr('y', p.y + 3.5).attr('text-anchor', 'end').attr('font-size', 9.5)
      .attr('fill', SEMANTIC_PALETTE.muted).text(isCompact ? `F · ${fmtInt(c.v)}` : nodeLabel(c, 'F'));
  });
  right.forEach((c) => {
    const p = posR.get(c.cid);
    svg.append('circle').attr('cx', p.x).attr('cy', p.y).attr('r', 6.5).attr('fill', SEMANTIC_PALETTE.men);
    svg.append('text').attr('x', p.x + 10).attr('y', p.y + 3.5).attr('font-size', 9.5).attr('font-weight', 600)
      .attr('fill', SEMANTIC_PALETTE.ink).text(isCompact ? `M · ${fmtInt(c.v)}` : nodeLabel(c, 'M'));
  });
  hubs.forEach((h) => {
    const p = posH.get(h.hid);
    const node = svg.append('circle').attr('class', 'h4-hub').attr('cx', p.x).attr('cy', p.y).attr('r', rHub(h.totalVal))
      .attr('fill', '#F8DF4F').attr('stroke', SEMANTIC_PALETTE.ok).attr('stroke-width', 2.2).attr('tabindex', 0);
    const short = h.label.length > 26 ? `${h.label.slice(0, 25)}…` : h.label;
    svg.append('text').attr('x', p.x).attr('y', p.y - rHub(h.totalVal) - 6).attr('text-anchor', 'middle')
      .attr('font-size', 10).attr('font-weight', 700).attr('fill', '#7A5200').text(isCompact ? short.slice(0, 14) : short);
    bindTooltipEvents(node.node(), tipCtrl, () => buildTooltipCard({
      title: h.label,
      rows: [
        { label: 'Candidaturas atendidas', value: fmtInt(h.candsN) },
        { label: 'Com baixa votação', value: fmtInt(h.lowVoteN) },
        { label: 'Total pago', value: fmtCompactBrl(h.totalVal) },
        { label: 'Partido / UF', value: `${h.p} · ${h.uf}` },
      ],
      hint: 'Mesmo CNPJ ou CPF contratado por várias candidaturas da chapa',
    }), { focusable: true });
  });
}
