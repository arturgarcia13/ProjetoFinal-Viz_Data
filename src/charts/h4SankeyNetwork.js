import * as d3 from 'd3';
import { SEMANTIC_PALETTE } from './palette.js';
import { animDur, MOTION, shouldAnimate } from './motion.js';
import { bindTooltipEvents, buildTooltipCard, createChartTooltip, fmtCompactBrl, fmtInt, fmtPct } from './tooltip.js';

const NODE_COLORS = {
  pub: '#007D5B',
  priv: '#E5A910',
  f_gt: '#FA532E',
  f_le: '#F28B6B',
  m_gt: '#4B636E',
  m_le: '#7F959F',
  shared: '#D946BE',
  direct: '#0284C7',
  cands: '#8B5CF6',
  party: '#64748B',
};

function layoutColumnNodes(items, totalH, gap, minH = 14) {
  const nonZero = items.filter((d) => d.val > 0);
  if (nonZero.length === 0) return [];
  const usableH = Math.max(40, totalH - gap * Math.max(0, nonZero.length - 1));
  const sumVal = d3.sum(nonZero, (d) => d.val) || 1;

  // Garante altura mínima visível para fluxos pequenos (ex.: Direção Partidária) redistribuindo o restante proporcionalmente
  const rawHeights = nonZero.map((d) => (d.val / sumVal) * usableH);
  const locked = rawHeights.map((h) => h < minH);
  const lockedSum = rawHeights.reduce((s, h, i) => s + (locked[i] ? minH : 0), 0);
  const unlockedValSum = nonZero.reduce((s, d, i) => s + (locked[i] ? 0 : d.val), 0);
  const remH = Math.max(10, usableH - lockedSum);

  let curY = 0;
  return nonZero.map((d, i) => {
    const h = locked[i] ? minH : (unlockedValSum > 0 ? (d.val / unlockedValSum) * remH : remH / nonZero.length);
    const node = { ...d, y: curY, h, color: NODE_COLORS[d.id] || '#64748B' };
    curY += h + gap;
    return node;
  });
}

function ribbonPath(x0, y0, h0, x1, y1, h1) {
  const xi = d3.interpolateNumber(x0, x1);
  return `M${x0},${y0} C${xi(0.45)},${y0} ${xi(0.55)},${y1} ${x1},${y1} L${x1},${y1 + h1} C${xi(0.55)},${y1 + h1} ${xi(0.45)},${y0 + h0} ${x0},${y0 + h0} Z`;
}

/**
 * H4 — Sankey Interativo em 3 Colunas (Apenas APTO, corte de 1.000 votos):
 * Coluna 1: Origem (Fundo Público vs. Recursos Privados)
 * Coluna 2: Perfil (Mulheres >1000, Mulheres <=1000, Homens >1000, Homens <=1000)
 * Coluna 3: Destino (Fornecedores Compartilhados, Campanha Direta, Repasses a Candidaturas, Direção Partidária)
 */
export function renderH4Sankey(container, sankeyData, { step = 1, prevStep = 1, width = 740 } = {}) {
  container.innerHTML = '';
  if (!sankeyData || sankeyData.totRec <= 0 || sankeyData.totExp <= 0) {
    container.innerHTML = '<p class="chart-empty">Sem dados financeiros suficientes de candidaturas aptas neste recorte.</p>';
    return;
  }

  const isCompact = width < 480;
  const margin = {
    top: 38,
    right: isCompact ? 118 : 186,
    bottom: 20,
    left: isCompact ? 94 : 162,
  };
  const svgW = width;
  const svgH = isCompact ? 345 : 395;
  const W = Math.max(110, svgW - margin.left - margin.right);
  const H = svgH - margin.top - margin.bottom;

  const tipCtrl = createChartTooltip(container, { wrapClass: 'h4-wrap', tooltipClass: 'h4-tooltip' });
  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('class', 'h4-sankey-svg')
    .attr('viewBox', `0 0 ${svgW} ${svgH}`)
    .attr('width', svgW)
    .attr('height', svgH)
    .attr('role', 'img')
    .attr('aria-label', 'Sankey interativo de origem dos recursos, perfil por corte de 1.000 votos e destino dos gastos entre candidaturas aptas')
    .style('font-family', 'Inter, system-ui, sans-serif');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const nodeW = isCompact ? 13 : 16;
  const col0X = 0;
  const col1X = W * 0.44 - nodeW / 2;
  const col2X = W - nodeW;
  const showCol3 = step >= 1;
  const animateCol3 = shouldAnimate() && showCol3 && prevStep === 0;

  // Cabeçalhos das colunas sem sobreposição em desktop e mobile
  g.append('text')
    .attr('x', col0X + nodeW)
    .attr('y', -16)
    .attr('text-anchor', 'end')
    .attr('fill', SEMANTIC_PALETTE.muted)
    .style('font-size', isCompact ? '9.2px' : '10.5px')
    .style('font-weight', '700')
    .text(isCompact ? '1. Origem' : '1. Origem do Recurso');

  g.append('text')
    .attr('x', col1X + nodeW / 2)
    .attr('y', -16)
    .attr('text-anchor', 'middle')
    .attr('fill', SEMANTIC_PALETTE.muted)
    .style('font-size', isCompact ? '9.2px' : '10.5px')
    .style('font-weight', '700')
    .text(isCompact ? '2. Corte 1.000v' : '2. Perfil (Corte 1.000 votos)');

  if (showCol3) {
    g.append('text')
      .attr('x', col2X)
      .attr('y', -16)
      .attr('text-anchor', 'start')
      .attr('fill', SEMANTIC_PALETTE.muted)
      .style('font-size', isCompact ? '9.2px' : '10.5px')
      .style('font-weight', '700')
      .text(isCompact ? '3. Destino' : '3. Destino do Gasto');
  }

  const col0Nodes = layoutColumnNodes(sankeyData.sources, H, 18, 20);
  const col1Nodes = layoutColumnNodes(
    sankeyData.profiles.map((p) => ({ ...p, val: p.weight })),
    H,
    14,
    22,
  );
  const col2Nodes = layoutColumnNodes(sankeyData.destinations, H, 18, 16);

  const nodeById = new Map([...col0Nodes, ...col1Nodes, ...col2Nodes].map((n) => [n.id, n]));

  // Calcula posições empilhadas das faixas (ribbons) nas entradas e saídas de cada nó
  const outCursor = new Map();
  const inCursor = new Map();
  nodeById.forEach((n, id) => {
    outCursor.set(id, n.y);
    inCursor.set(id, n.y);
  });

  const linksG = g.append('g').attr('class', 'h4-links-layer');
  const col3LinksG = g.append('g').attr('class', 'h4-col3-links')
    .style('opacity', animateCol3 ? 0 : 1)
    .attr('transform', animateCol3 ? 'translate(-12, 0)' : 'translate(0, 0)');
  const nodesG = g.append('g').attr('class', 'h4-nodes-layer');
  const col3NodesG = g.append('g').attr('class', 'h4-col3-nodes')
    .style('opacity', animateCol3 ? 0 : 1)
    .attr('transform', animateCol3 ? 'translate(-12, 0)' : 'translate(0, 0)');

  const allLinkEls = [];
  const allNodeEls = [];

  function setHighlight({ nodeId = null, linkObj = null } = {}) {
    if (!nodeId && !linkObj) {
      allLinkEls.forEach((l) => l.sel.attr('fill-opacity', l.baseOp));
      allNodeEls.forEach((n) => n.sel.attr('fill-opacity', 1));
      return;
    }
    if (linkObj) {
      allLinkEls.forEach((l) => {
        l.sel.attr('fill-opacity', l === linkObj ? 0.86 : 0.1);
      });
      allNodeEls.forEach((n) => {
        const hit = n.id === linkObj.source || n.id === linkObj.target;
        n.sel.attr('fill-opacity', hit ? 1 : 0.35);
      });
      return;
    }
    if (nodeId) {
      const connectedNodes = new Set([nodeId]);
      allLinkEls.forEach((l) => {
        const isConn = l.source === nodeId || l.target === nodeId;
        l.sel.attr('fill-opacity', isConn ? 0.8 : 0.08);
        if (isConn) {
          connectedNodes.add(l.source);
          connectedNodes.add(l.target);
        }
      });
      allNodeEls.forEach((n) => {
        n.sel.attr('fill-opacity', connectedNodes.has(n.id) ? 1 : 0.35);
      });
    }
  }

  // Ribbons Coluna 0 -> Coluna 1
  const outSum0 = new Map(col0Nodes.map((n) => [n.id, d3.sum(sankeyData.links01.filter((l) => l.source === n.id), (l) => l.val) || 1]));
  const inSum1 = new Map(col1Nodes.map((n) => [n.id, d3.sum(sankeyData.links01.filter((l) => l.target === n.id), (l) => l.val) || 1]));

  sankeyData.links01.forEach((l) => {
    const src = nodeById.get(l.source);
    const dst = nodeById.get(l.target);
    if (!src || !dst) return;

    const h0 = Math.max(1.8, (l.val / outSum0.get(l.source)) * src.h);
    const h1 = Math.max(1.8, (l.val / inSum1.get(l.target)) * dst.h);
    const y0 = outCursor.get(l.source);
    const y1 = inCursor.get(l.target);
    outCursor.set(l.source, y0 + h0);
    inCursor.set(l.target, y1 + h1);

    const baseOp = dst.gender === 'F' ? 0.42 : 0.28;
    const pSel = linksG.append('path')
      .attr('class', 'h4-link h4-link-01')
      .attr('data-source', l.source)
      .attr('data-target', l.target)
      .attr('d', ribbonPath(col0X + nodeW, y0, h0, col1X, y1, h1))
      .attr('fill', dst.color)
      .attr('fill-opacity', baseOp)
      .attr('tabindex', 0)
      .style('cursor', 'pointer');

    const linkRec = { sel: pSel, source: l.source, target: l.target, baseOp };
    allLinkEls.push(linkRec);

    const pctSrc = src.val > 0 ? (l.val / src.val) * 100 : 0;
    const pctDst = dst.recTotal > 0 ? (l.val / dst.recTotal) * 100 : 0;
    bindTooltipEvents(pSel.node(), tipCtrl, () => buildTooltipCard({
      title: `${l.sourceLabel} → ${l.targetLabel}`,
      badge: fmtCompactBrl(l.val),
      badgeTone: dst.gender === 'F' ? 'below' : 'neutral',
      rows: [
        { label: 'Valor do fluxo', value: fmtCompactBrl(l.val), focus: true },
        { label: `% de ${src.short}`, value: fmtPct(pctSrc, 1) },
        { label: `% da receita de ${dst.short}`, value: fmtPct(pctDst, 1) },
        { label: 'Candidaturas aptas', value: fmtInt(dst.n) },
      ],
    }), {
      focusable: true,
      onEnter: () => setHighlight({ linkObj: linkRec }),
      onLeave: () => setHighlight(),
    });
  });

  // Reset cursor para saídas da Coluna 1 -> Coluna 2
  col1Nodes.forEach((n) => outCursor.set(n.id, n.y));

  if (showCol3) {
    const outSum1 = new Map(col1Nodes.map((n) => [n.id, d3.sum(sankeyData.links12.filter((l) => l.source === n.id), (l) => l.val) || 1]));
    const inSum2 = new Map(col2Nodes.map((n) => [n.id, d3.sum(sankeyData.links12.filter((l) => l.target === n.id), (l) => l.val) || 1]));

    sankeyData.links12.forEach((l) => {
      const src = nodeById.get(l.source);
      const dst = nodeById.get(l.target);
      if (!src || !dst) return;

      const h0 = Math.max(1.8, (l.val / outSum1.get(l.source)) * src.h);
      const h1 = Math.max(1.8, (l.val / inSum2.get(l.target)) * dst.h);
      const y0 = outCursor.get(l.source);
      const y1 = inCursor.get(l.target);
      outCursor.set(l.source, y0 + h0);
      inCursor.set(l.target, y1 + h1);

      const baseOp = l.target === 'shared' ? 0.52 : (l.target === 'direct' ? 0.36 : 0.48);
      const pSel = col3LinksG.append('path')
        .attr('class', 'h4-link h4-link-12')
        .attr('data-source', l.source)
        .attr('data-target', l.target)
        .attr('d', ribbonPath(col1X + nodeW, y0, h0, col2X, y1, h1))
        .attr('fill', dst.color)
        .attr('fill-opacity', baseOp)
        .attr('tabindex', 0)
        .style('cursor', 'pointer');

      const linkRec = { sel: pSel, source: l.source, target: l.target, baseOp };
      allLinkEls.push(linkRec);

      const pctSrc = src.expTotal > 0 ? (l.val / src.expTotal) * 100 : 0;
      const pctDst = dst.val > 0 ? (l.val / dst.val) * 100 : 0;
      bindTooltipEvents(pSel.node(), tipCtrl, () => buildTooltipCard({
        title: `${l.sourceLabel} → ${l.targetLabel}`,
        badge: fmtCompactBrl(l.val),
        badgeTone: l.target === 'shared' ? 'floor' : 'neutral',
        rows: [
          { label: 'Gasto neste destino', value: fmtCompactBrl(l.val), focus: true },
          { label: `% do gasto de ${src.short}`, value: fmtPct(pctSrc, 1) },
          { label: `% do total em ${dst.short}`, value: fmtPct(pctDst, 1) },
          { label: 'Candidaturas no perfil', value: `${fmtInt(src.n)} (${fmtInt(src.elCount)} eleitas)` },
        ],
      }), {
        focusable: true,
        onEnter: () => setHighlight({ linkObj: linkRec }),
        onLeave: () => setHighlight(),
      });
    });

    if (animateCol3) {
      col3LinksG.transition().duration(animDur(520)).ease(MOTION.easeOut)
        .style('opacity', 1)
        .attr('transform', 'translate(0, 0)');
    }
  }

  const drawNode = (targetG, n, colIdx, xPos) => {
    const rect = targetG.append('rect')
      .attr('class', 'h4-node')
      .attr('data-node-id', n.id)
      .attr('x', xPos)
      .attr('y', n.y)
      .attr('width', nodeW)
      .attr('height', n.h)
      .attr('rx', 3)
      .attr('fill', n.color)
      .attr('tabindex', 0)
      .style('cursor', 'pointer');

    allNodeEls.push({ id: n.id, sel: rect });

    const labelText = isCompact ? n.short : n.label;
    let subText = '';
    if (colIdx === 0) {
      const pct = sankeyData.totRec > 0 ? (n.val / sankeyData.totRec) * 100 : 0;
      subText = `${fmtCompactBrl(n.val)} (${fmtPct(pct, 1)})`;
    } else if (colIdx === 1) {
      subText = `${fmtInt(n.n)} aptas · ${fmtCompactBrl(n.recTotal)}`;
    } else {
      const pct = sankeyData.totExp > 0 ? (n.val / sankeyData.totExp) * 100 : 0;
      subText = `${fmtCompactBrl(n.val)} (${fmtPct(pct, 1)})`;
    }

    const tx = colIdx === 0 ? xPos - 8 : (colIdx === 2 ? xPos + nodeW + 8 : xPos + nodeW + 8);
    const anchor = colIdx === 0 ? 'end' : 'start';
    const cy = n.y + n.h / 2;

    targetG.append('text')
      .attr('x', tx)
      .attr('y', cy - 2)
      .attr('text-anchor', anchor)
      .attr('fill', SEMANTIC_PALETTE.ink)
      .style('font-size', isCompact ? '9.2px' : '10.8px')
      .style('font-weight', '700')
      .attr('paint-order', 'stroke')
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 3.5)
      .style('pointer-events', 'none')
      .text(labelText);

    targetG.append('text')
      .attr('x', tx)
      .attr('y', cy + 10)
      .attr('text-anchor', anchor)
      .attr('fill', SEMANTIC_PALETTE.muted)
      .style('font-size', isCompact ? '8.4px' : '9.5px')
      .style('font-weight', '600')
      .attr('paint-order', 'stroke')
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 3.5)
      .style('pointer-events', 'none')
      .text(subText);

    bindTooltipEvents(rect.node(), tipCtrl, () => {
      if (colIdx === 0) {
        const pct = sankeyData.totRec > 0 ? (n.val / sankeyData.totRec) * 100 : 0;
        return buildTooltipCard({
          title: n.label,
          badge: fmtPct(pct, 1),
          badgeTone: n.id === 'pub' ? 'above' : 'floor',
          rows: [
            { label: 'Total recebido (APTO)', value: fmtCompactBrl(n.val), focus: true },
            { label: 'Universo', value: `${fmtInt(sankeyData.nApto)} candidaturas aptas` },
          ],
        });
      }
      if (colIdx === 1) {
        return buildTooltipCard({
          title: n.label,
          badge: `${fmtInt(n.n)} aptas`,
          badgeTone: n.gender === 'F' ? 'below' : 'neutral',
          rows: [
            { label: 'Fundo Público (FEFC + FP)', value: fmtCompactBrl(n.pub), focus: true },
            { label: 'Recursos Privados', value: fmtCompactBrl(n.priv) },
            { label: 'Fornec. Compartilhados', value: fmtCompactBrl(n.shared) },
            { label: 'Campanha Direta', value: fmtCompactBrl(n.direct) },
            { label: 'Eleitas(os) no perfil', value: fmtInt(n.elCount) },
          ],
        });
      }
      const pct = sankeyData.totExp > 0 ? (n.val / sankeyData.totExp) * 100 : 0;
      return buildTooltipCard({
        title: n.label,
        badge: fmtPct(pct, 1),
        badgeTone: n.id === 'shared' ? 'floor' : 'neutral',
        rows: [
          { label: 'Total gasto neste destino', value: fmtCompactBrl(n.val), focus: true },
          { label: '% da despesa total (APTO)', value: fmtPct(pct, 1) },
        ],
      });
    }, {
      focusable: true,
      onEnter: () => setHighlight({ nodeId: n.id }),
      onLeave: () => setHighlight(),
    });
  };

  col0Nodes.forEach((n) => drawNode(nodesG, n, 0, col0X));
  col1Nodes.forEach((n) => drawNode(nodesG, n, 1, col1X));
  if (showCol3) {
    col2Nodes.forEach((n) => drawNode(col3NodesG, n, 2, col2X));
    if (animateCol3) {
      col3NodesG.transition().duration(animDur(520)).ease(MOTION.easeOut)
        .style('opacity', 1)
        .attr('transform', 'translate(0, 0)');
    }
  }
}
