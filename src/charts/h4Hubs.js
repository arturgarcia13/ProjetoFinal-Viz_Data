import * as d3 from 'd3';
import { SEMANTIC_PALETTE } from './palette.js';
import { bindTooltipEvents, buildTooltipCard, createChartTooltip, fmtCompactBrl, fmtInt, fmtPct } from './tooltip.js';

/**
 * H4 (Passo 2) — Rede Bipartida Real de Fornecedores-Hub (data/network_hubs.json).
 * Mostra os principais fornecedores compartilhados e a divisão entre candidaturas de baixa votação e demais.
 * Layout dimensionado para 0 cortes/clipping em desktop e mobile (390px).
 */
export function renderH4Hubs(container, yearData, { width = 740, year = 2022, uf = '', party = '' } = {}) {
  container.innerHTML = '';
  let hubsAll = yearData?.hubs || [];
  if (uf) hubsAll = hubsAll.filter((h) => h.uf === uf);
  if (party) hubsAll = hubsAll.filter((h) => h.p === party);

  if (hubsAll.length === 0) {
    container.innerHTML = `<p class="chart-empty">Sem fornecedores-hub registrados para este recorte em ${year}.</p>`;
    return;
  }

  const topHubs = [...hubsAll].sort((a, b) => (b.totalVal || 0) - (a.totalVal || 0)).slice(0, 4);
  const isCompact = width < 480;
  const svgW = width;
  const svgH = isCompact ? 310 : 350;

  const tipCtrl = createChartTooltip(container, { wrapClass: 'h4-hubs-wrap' });
  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('class', 'h4-hubs-svg')
    .attr('viewBox', `0 0 ${svgW} ${svgH}`)
    .attr('width', svgW)
    .attr('height', svgH)
    .attr('role', 'img')
    .attr('aria-label', `Principais fornecedores-hub em ${year}: candidaturas atendidas e baixa votação`)
    .style('font-family', 'Inter, system-ui, sans-serif');

  const cx = svgW / 2;
  const xL = isCompact ? 82 : 148;
  const xR = svgW - (isCompact ? 82 : 148);

  svg.append('text')
    .attr('x', cx)
    .attr('y', 18)
    .attr('text-anchor', 'middle')
    .attr('fill', SEMANTIC_PALETTE.ink)
    .style('font-size', isCompact ? '10.2px' : '12px')
    .style('font-weight', '700')
    .text(isCompact
      ? `Top ${topHubs.length} fornecedores-hub (${year})`
      : `Top ${topHubs.length} fornecedores-hub (${year}): candidaturas atendidas e baixa votação`);

  svg.append('text').attr('x', xL).attr('y', 40).attr('text-anchor', 'middle').attr('fill', '#D93814')
    .style('font-size', isCompact ? '9.2px' : '10.5px').style('font-weight', '700').text('Baixa votação');
  svg.append('text').attr('x', cx).attr('y', 40).attr('text-anchor', 'middle').attr('fill', '#7A5200')
    .style('font-size', isCompact ? '9.2px' : '10.5px').style('font-weight', '700').text('Fornecedor-hub');
  svg.append('text').attr('x', xR).attr('y', 40).attr('text-anchor', 'middle').attr('fill', SEMANTIC_PALETTE.male)
    .style('font-size', isCompact ? '9.2px' : '10.5px').style('font-weight', '700').text('Demais cand.');

  const maxN = d3.max(topHubs, (h) => h.candsN || 1) || 1;
  const wScale = d3.scaleLinear().domain([0, maxN]).range([3, isCompact ? 18 : 24]);
  const rScale = d3.scaleSqrt().domain([0, maxN]).range([10, isCompact ? 16 : 20]);
  const rowSpan = (svgH - 76) / Math.max(1, topHubs.length);

  const halo = (sel) => sel.attr('paint-order', 'stroke').attr('stroke', '#FFFFFF').attr('stroke-width', 3);

  topHubs.forEach((h, i) => {
    const cy = 74 + i * rowSpan + rowSpan * 0.25;
    const r = rScale(h.candsN || 10);
    const low = h.lowVoteN || 0;
    const rest = Math.max(0, (h.candsN || 0) - low);
    const rawName = h.label || h.hid || `Hub ${i + 1}`;
    const shortName = rawName.length > (isCompact ? 22 : 32) ? `${rawName.slice(0, isCompact ? 21 : 31)}…` : rawName;

    svg.append('line')
      .attr('x1', xL)
      .attr('x2', cx - r)
      .attr('y1', cy)
      .attr('y2', cy)
      .attr('stroke', SEMANTIC_PALETTE.female)
      .attr('stroke-opacity', 0.56)
      .attr('stroke-width', wScale(low));

    svg.append('line')
      .attr('x1', cx + r)
      .attr('x2', xR)
      .attr('y1', cy)
      .attr('y2', cy)
      .attr('stroke', SEMANTIC_PALETTE.male)
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', wScale(rest));

    svg.append('text')
      .attr('x', xL - 8)
      .attr('y', cy + 4)
      .attr('text-anchor', 'end')
      .attr('fill', '#D93814')
      .style('font-size', isCompact ? '9.5px' : '11px')
      .style('font-weight', '700')
      .text(isCompact ? `${low} cand.` : `${low} candidaturas`);

    svg.append('text')
      .attr('x', xR + 8)
      .attr('y', cy + 4)
      .attr('text-anchor', 'start')
      .attr('fill', SEMANTIC_PALETTE.ink)
      .style('font-size', isCompact ? '9.5px' : '11px')
      .style('font-weight', '700')
      .text(isCompact ? `${rest} cand.` : `${rest} candidaturas`);

    const node = svg.append('circle')
      .attr('class', 'h4-hub')
      .attr('cx', cx)
      .attr('cy', cy)
      .attr('r', r)
      .attr('fill', SEMANTIC_PALETTE.highlight)
      .attr('stroke', SEMANTIC_PALETTE.emerald)
      .attr('stroke-width', 2.2)
      .attr('tabindex', 0)
      .style('cursor', 'pointer');

    halo(
      svg.append('text')
        .attr('x', cx)
        .attr('y', cy - r - 6)
        .attr('text-anchor', 'middle')
        .attr('fill', '#7A5200')
        .style('font-size', isCompact ? '8.8px' : '10px')
        .style('font-weight', '700')
        .text(shortName),
    );

    const pctLow = h.candsN ? (low / h.candsN) * 100 : 0;
    bindTooltipEvents(node.node(), tipCtrl, () => buildTooltipCard({
      title: rawName,
      badge: `${h.p} · ${h.uf}`,
      badgeTone: pctLow >= 50 ? 'below' : 'floor',
      rows: [
        { label: 'Candidaturas atendidas', value: fmtInt(h.candsN) },
        { label: 'Com baixa votação', value: `${fmtInt(low)} (${fmtPct(pctLow)})`, focus: true },
        { label: 'Total pago ao hub', value: fmtCompactBrl(h.totalVal) },
      ],
      hint: 'Dados reais anonimizados de network_hubs.json (TSE)',
    }), { focusable: true });
  });
}
