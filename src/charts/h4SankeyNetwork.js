import * as d3 from 'd3';
import { sankey as d3Sankey, sankeyLinkHorizontal } from 'd3-sankey';
import { SEMANTIC_PALETTE } from './palette.js';
import {
  bindTooltipEvents,
  buildTooltipCard,
  createChartTooltip,
  fmtCompactBrl,
  fmtInt,
  fmtPct,
} from './tooltip.js';

/**
 * H4 — Diagrama de Sankey 100% proporcional entre mulheres APTO (sem Hub e sem valores absolutos nos rótulos):
 * Fonte da Receita → Perfil (Competitivas Top 10% vs. Base 90%) → Resultado (Eleitas vs. Não eleitas)
 */
export function renderH4Sankey(container, h4Data, { width = 700 } = {}) {
  container.innerHTML = '';
  if (!h4Data || !h4Data.links || h4Data.links.length === 0 || h4Data.activeTotalRev <= 0) {
    container.innerHTML = '<p class="chart-empty">Sem receita feminina declarada neste recorte.</p>';
    return;
  }

  const isCompact = width < 520;
  const height = isCompact ? 350 : 330;
  const tipCtrl = createChartTooltip(container);
  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('class', 'h4-sankey-svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', width)
    .attr('height', height)
    .attr('role', 'img')
    .attr('aria-label', 'Sankey proporcional da distribuição da receita entre candidatas competitivas e base até a eleição')
    .style('font-family', 'Barlow, Inter, system-ui, sans-serif');

  const layout = d3Sankey()
    .nodeWidth(16)
    .nodePadding(16)
    .extent([[10, 32], [width - 10, height - 16]]);

  const graph = layout({
    nodes: h4Data.nodes.map((d) => ({ ...d })),
    links: h4Data.links.map((d) => ({ ...d })),
  });

  // Cabeçalhos das 3 colunas (enxutos no mobile para 0 colisão)
  const colTitles = isCompact
    ? ['1. Origem (%)', '2. Perfil (%)', '3. Resultado (%)']
    : ['1. Origem da verba (%)', '2. Perfil de investimento (%)', '3. Resultado na urna (%)'];
  const colPositions = [10, width / 2, width - 10];
  const colAnchors = ['start', 'middle', 'end'];
  colTitles.forEach((t, idx) => {
    svg.append('text')
      .attr('x', colPositions[idx])
      .attr('y', 16)
      .attr('text-anchor', colAnchors[idx])
      .attr('font-size', isCompact ? 9.5 : 10.5)
      .attr('font-weight', 700)
      .attr('fill', SEMANTIC_PALETTE.muted)
      .text(t);
  });

  const nodeColor = (n) => {
    if (n.id === 'fefc') return SEMANTIC_PALETTE.fefc;
    if (n.id === 'fp') return SEMANTIC_PALETTE.fp;
    if (n.id === 'prop') return SEMANTIC_PALETTE.prop;
    if (n.id === 'priv') return SEMANTIC_PALETTE.priv;
    if (n.id === 'top10') return SEMANTIC_PALETTE.women;
    if (n.id === 'base90') return SEMANTIC_PALETTE.alert;
    if (n.id === 'el') return SEMANTIC_PALETTE.ok;
    return 'rgba(255, 255, 255, 0.52)';
  };

  const linkColor = (l) => {
    if (l.target.id === 'top10' || l.source.id === 'top10') return SEMANTIC_PALETTE.women;
    if (l.target.id === 'base90' || l.source.id === 'base90') return SEMANTIC_PALETTE.alert;
    return '#FFFFFF';
  };

  const linkSel = svg.append('g')
    .attr('fill', 'none')
    .selectAll('path')
    .data(graph.links)
    .join('path')
    .attr('d', sankeyLinkHorizontal())
    .attr('stroke', (d) => linkColor(d))
    .attr('stroke-opacity', 0.42)
    .attr('stroke-width', (d) => Math.max(1.5, d.width))
    .style('cursor', 'pointer');

  linkSel.each(function (d) {
    const shareOfSource = d.source.value > 0 ? (d.value / d.source.value) * 100 : 0;
    const isTop = d.source.id === 'top10' || d.target.id === 'top10';
    bindTooltipEvents(
      this,
      tipCtrl,
      () => buildTooltipCard({
        title: `${d.source.name} → ${d.target.name}`,
        badge: `${fmtPct(d.value)} do recorte`,
        badgeTone: isTop ? 'above' : 'below',
        rows: [
          { label: 'Parcela do fluxo exibido', value: fmtPct(d.value), focus: true },
          { label: 'Fatia na origem', value: fmtPct(shareOfSource) },
          { label: 'Volume (referência)', value: fmtCompactBrl(d.brl) },
        ],
      }),
      {
        onEnter: () => linkSel.attr('stroke-opacity', (l) => (l === d ? 0.92 : 0.14)),
        onLeave: () => linkSel.attr('stroke-opacity', 0.42),
      },
    );
  });

  const nodeG = svg.append('g')
    .selectAll('g')
    .data(graph.nodes.filter((n) => n.value > 0))
    .join('g');

  const nodeRects = nodeG.append('rect')
    .attr('x', (d) => d.x0)
    .attr('y', (d) => d.y0)
    .attr('height', (d) => Math.max(3, d.y1 - d.y0))
    .attr('width', (d) => d.x1 - d.x0)
    .attr('fill', (d) => nodeColor(d))
    .style('cursor', 'pointer');

  nodeRects.each(function (d) {
    const nodeBrl = (d.value / 100) * h4Data.activeTotalRev;
    const extraCand = d.candsCount ? `${fmtInt(d.candsCount)} candidatas` : '';
    bindTooltipEvents(this, tipCtrl, () => buildTooltipCard({
      title: d.name,
      badge: `${fmtPct(d.value)} do fluxo`,
      badgeTone: d.id === 'el' || d.id === 'top10' ? 'above' : (d.id === 'base90' ? 'below' : 'neutral'),
      rows: [
        { label: 'Participação percentual', value: fmtPct(d.value), sub: extraCand, focus: true },
        { label: 'Volume equivalente', value: fmtCompactBrl(nodeBrl) },
      ],
    }));
  });

  const lblSel = nodeG.append('text')
    .attr('x', (d) => (d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6))
    .attr('y', (d) => {
      const hasSub = h4Data.profile === 'all' && (d.id === 'top10' || d.id === 'base90') && (d.y1 - d.y0) >= 34;
      return (d.y0 + d.y1) / 2 - (hasSub ? 5 : 0);
    })
    .attr('dy', '0.35em')
    .attr('text-anchor', (d) => (d.x0 < width / 2 ? 'start' : 'end'))
    .attr('font-size', isCompact ? 9.5 : 11)
    .attr('font-weight', 700)
    .attr('fill', '#FFFFFF')
    .attr('stroke', SEMANTIC_PALETTE.surface)
    .attr('stroke-width', 3.5)
    .attr('stroke-linejoin', 'round')
    .attr('paint-order', 'stroke')
    .style('pointer-events', 'none');

  lblSel.each(function (d) {
    const t = d3.select(this);
    const shortName = isCompact && d.name.startsWith('Competitivas')
      ? 'Competitivas'
      : d.name;
    t.text(`${shortName} · ${fmtPct(d.value)}`);
    if (h4Data.profile === 'all' && (d.id === 'top10' || d.id === 'base90') && (d.y1 - d.y0) >= 34) {
      const elShare = d.id === 'top10'
        ? (isCompact
            ? `Top 10%: ${fmtPct(h4Data.top10ShareElected * 100)} eleitas`
            : `Concentram ${fmtPct(h4Data.top10ShareElected * 100)} das eleitas`)
        : (isCompact
            ? `Só ${fmtPct((1 - h4Data.top10ShareElected) * 100)} das eleitas`
            : `Apenas ${fmtPct((1 - h4Data.top10ShareElected) * 100)} das eleitas`);
      t.append('tspan')
        .attr('x', d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
        .attr('dy', '1.35em')
        .attr('font-size', isCompact ? 8.5 : 9.8)
        .attr('font-weight', 600)
        .attr('fill', d.id === 'top10' ? SEMANTIC_PALETTE.women : '#FFD1C2')
        .text(elShare);
    }
  });
}
