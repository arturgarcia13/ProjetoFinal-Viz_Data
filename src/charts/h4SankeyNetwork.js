import * as d3 from 'd3';
import { SEMANTIC_PALETTE } from './palette.js';
import { animDelay, animDur, MOTION, shouldAnimate } from './motion.js';
import { bindTooltipEvents, buildTooltipCard, createChartTooltip, fmtCompactBrl, fmtInt, fmtPct } from './tooltip.js';

let h4ClipUid = 0;

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

function buildSankeySig(sankeyData, svgW, svgH) {
  const s0 = sankeyData.sources.map((d) => `${d.id}:${d.val.toFixed(1)}`).join(',');
  const s1 = sankeyData.profiles.map((d) => `${d.id}:${d.weight.toFixed(1)}:${d.n}`).join(',');
  const s2 = sankeyData.destinations.map((d) => `${d.id}:${d.val.toFixed(1)}`).join(',');
  return `${svgW}|${svgH}|${s0}|${s1}|${s2}`;
}

/**
 * H4 — Sankey Interativo em 3 Colunas (Apenas APTO, corte de 1.000 votos):
 * Coluna 1: Origem (Fundo Público vs. Recursos Privados)
 * Coluna 2: Perfil (Mulheres >1000, Mulheres <=1000, Homens >1000, Homens <=1000)
 * Coluna 3: Destino (Fornecedores Compartilhados, Campanha Direta, Repasses a Candidaturas, Direção Partidária)
 */
export function renderH4Sankey(container, sankeyData, { step = 1, prevStep = 1, width = 740 } = {}) {
  if (!sankeyData || sankeyData.totRec <= 0 || sankeyData.totExp <= 0) {
    container.__h4State = null;
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

  const sig = buildSankeySig(sankeyData, svgW, svgH);
  let st = container.__h4State;
  const isFreshMount = !st || st.sig !== sig || !container.querySelector('svg.h4-sankey-svg');

  if (isFreshMount) {
    container.innerHTML = '';
    const uid = ++h4ClipUid;
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
    const defs = svg.append('defs');

    const nodeW = isCompact ? 13 : 16;
    const col0X = 0;
    const col1X = W * 0.44 - nodeW / 2;
    const col2X = W - nodeW;
    const span01 = Math.max(10, col1X - (col0X + nodeW) + 2);
    const span12 = Math.max(10, col2X - (col1X + nodeW) + 2);

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

    const col3Header = g.append('text')
      .attr('class', 'h4-col3-header')
      .attr('x', col2X)
      .attr('y', -16)
      .attr('text-anchor', 'start')
      .attr('fill', SEMANTIC_PALETTE.muted)
      .style('font-size', isCompact ? '9.2px' : '10.5px')
      .style('font-weight', '700')
      .text(isCompact ? '3. Destino' : '3. Destino do Gasto');

    const col0Nodes = layoutColumnNodes(sankeyData.sources, H, 18, 20);
    const col1Nodes = layoutColumnNodes(
      sankeyData.profiles.map((p) => ({ ...p, val: p.weight })),
      H,
      14,
      22,
    );
    const col2Nodes = layoutColumnNodes(sankeyData.destinations, H, 18, 16);

    const nodeById = new Map([...col0Nodes, ...col1Nodes, ...col2Nodes].map((n) => [n.id, n]));

    // ClipPaths horizontais para animar cada fluxo escorrendo da esquerda para a direita
    const clip01Rects = new Map();
    col0Nodes.forEach((n) => {
      const clip = defs.append('clipPath').attr('id', `h4-clip-${uid}-01-${n.id}`);
      const r = clip.append('rect')
        .attr('x', col0X + nodeW - 1)
        .attr('y', -margin.top)
        .attr('width', span01)
        .attr('height', svgH + margin.top);
      clip01Rects.set(n.id, r);
    });

    const clip12Rects = new Map();
    col1Nodes.forEach((n) => {
      const clip = defs.append('clipPath').attr('id', `h4-clip-${uid}-12-${n.id}`);
      const r = clip.append('rect')
        .attr('x', col1X + nodeW - 1)
        .attr('y', -margin.top)
        .attr('width', span12)
        .attr('height', svgH + margin.top);
      clip12Rects.set(n.id, r);
    });

    const outCursor = new Map();
    const inCursor = new Map();
    nodeById.forEach((n, id) => {
      outCursor.set(id, n.y);
      inCursor.set(id, n.y);
    });

    const linksG = g.append('g').attr('class', 'h4-links-layer');
    const col3LinksG = g.append('g').attr('class', 'h4-col3-links');
    const nodesG = g.append('g').attr('class', 'h4-nodes-layer');
    const col3NodesG = g.append('g').attr('class', 'h4-col3-nodes');

    const allLinkEls = [];
    const allNodeEls = [];
    const col0Recs = [];
    const col1Recs = [];
    const col2Recs = [];

    st = {
      sig,
      tipCtrl,
      col3Header,
      col3LinksG,
      col3NodesG,
      clip01Rects,
      clip12Rects,
      col0Nodes,
      col1Nodes,
      col2Nodes,
      col0Recs,
      col1Recs,
      col2Recs,
      allLinkEls,
      allNodeEls,
      span01,
      span12,
      showCol3: step >= 1,
    };
    container.__h4State = st;

    function setHighlight({ nodeId = null, linkObj = null } = {}) {
      const activeLinks = allLinkEls.filter((l) => l.colIdx === 0 || st.showCol3);
      const activeNodes = allNodeEls.filter((n) => n.colIdx < 2 || st.showCol3);

      if (!nodeId && !linkObj) {
        activeLinks.forEach((l) => l.sel.attr('fill-opacity', l.baseOp));
        activeNodes.forEach((n) => n.sel.attr('fill-opacity', 1));
        return;
      }
      if (linkObj) {
        activeLinks.forEach((l) => {
          l.sel.attr('fill-opacity', l === linkObj ? 0.86 : 0.1);
        });
        activeNodes.forEach((n) => {
          const hit = n.id === linkObj.source || n.id === linkObj.target;
          n.sel.attr('fill-opacity', hit ? 1 : 0.35);
        });
        return;
      }
      if (nodeId) {
        const connectedNodes = new Set([nodeId]);
        activeLinks.forEach((l) => {
          const isConn = l.source === nodeId || l.target === nodeId;
          l.sel.attr('fill-opacity', isConn ? 0.8 : 0.08);
          if (isConn) {
            connectedNodes.add(l.source);
            connectedNodes.add(l.target);
          }
        });
        activeNodes.forEach((n) => {
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
        .attr('clip-path', `url(#h4-clip-${uid}-01-${l.source})`)
        .attr('fill', dst.color)
        .attr('fill-opacity', baseOp)
        .attr('tabindex', 0)
        .style('cursor', 'pointer');

      const linkRec = { sel: pSel, source: l.source, target: l.target, baseOp, colIdx: 0 };
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

    // Ribbons Coluna 1 -> Coluna 2 (montados no mesmo SVG para manter constância de objeto)
    col1Nodes.forEach((n) => outCursor.set(n.id, n.y));
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
        .attr('clip-path', `url(#h4-clip-${uid}-12-${l.source})`)
        .attr('fill', dst.color)
        .attr('fill-opacity', baseOp)
        .attr('tabindex', 0)
        .style('cursor', 'pointer');

      const linkRec = { sel: pSel, source: l.source, target: l.target, baseOp, colIdx: 1 };
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

    const drawNode = (targetG, n, colIdx, xPos, bucket) => {
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

      allNodeEls.push({ id: n.id, sel: rect, colIdx });

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

      const tx = colIdx === 0 ? xPos - 8 : xPos + nodeW + 8;
      const anchor = colIdx === 0 ? 'end' : 'start';
      const cy = n.y + n.h / 2;

      const labelGroup = targetG.append('g')
        .attr('class', 'h4-node-label')
        .style('pointer-events', 'none');

      labelGroup.append('text')
        .attr('x', tx)
        .attr('y', cy - 2)
        .attr('text-anchor', anchor)
        .attr('fill', SEMANTIC_PALETTE.ink)
        .style('font-size', isCompact ? '9.2px' : '10.8px')
        .style('font-weight', '700')
        .attr('paint-order', 'stroke')
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', 3.5)
        .text(labelText);

      labelGroup.append('text')
        .attr('x', tx)
        .attr('y', cy + 10)
        .attr('text-anchor', anchor)
        .attr('fill', SEMANTIC_PALETTE.muted)
        .style('font-size', isCompact ? '8.4px' : '9.5px')
        .style('font-weight', '600')
        .attr('paint-order', 'stroke')
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', 3.5)
        .text(subText);

      bucket.push({ n, rect, labelGroup, colIdx });

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

    col0Nodes.forEach((n) => drawNode(nodesG, n, 0, col0X, col0Recs));
    col1Nodes.forEach((n) => drawNode(nodesG, n, 1, col1X, col1Recs));
    col2Nodes.forEach((n) => drawNode(col3NodesG, n, 2, col2X, col2Recs));
  }

  // Atualiza estado visual e coreografia sem recriar o <svg>
  const animate = shouldAnimate();
  const showCol3 = step >= 1;
  const wasCol3 = st.showCol3;
  st.showCol3 = showCol3;

  const animateBaseFlow = animate && prevStep < 0;
  if (animateBaseFlow) {
    st.col0Recs.forEach(({ n, rect, labelGroup }, idx) => {
      rect.interrupt()
        .attr('y', n.y + n.h / 2)
        .attr('height', 0)
        .style('opacity', 0)
        .transition()
        .duration(animDur(340))
        .delay(animDelay(idx * 80))
        .ease(MOTION.easeOut)
        .attr('y', n.y)
        .attr('height', n.h)
        .style('opacity', 1);

      labelGroup.interrupt()
        .style('opacity', 0)
        .attr('transform', 'translate(-6, 0)')
        .transition()
        .duration(animDur(300))
        .delay(animDelay(50 + idx * 80))
        .ease(MOTION.easeOut)
        .style('opacity', 1)
        .attr('transform', 'translate(0, 0)');
    });

    st.col0Nodes.forEach((n, idx) => {
      const clipRect = st.clip01Rects.get(n.id);
      if (!clipRect) return;
      clipRect.interrupt()
        .attr('width', 0)
        .transition()
        .duration(animDur(580))
        .delay(animDelay(90 + idx * 120))
        .ease(MOTION.easeInOut)
        .attr('width', st.span01);
    });

    st.col1Recs.forEach(({ n, rect, labelGroup }, idx) => {
      rect.interrupt()
        .attr('y', n.y + n.h / 2)
        .attr('height', 0)
        .style('opacity', 0)
        .transition()
        .duration(animDur(380))
        .delay(animDelay(350 + idx * 55))
        .ease(MOTION.easeOut)
        .attr('y', n.y)
        .attr('height', n.h)
        .style('opacity', 1);

      labelGroup.interrupt()
        .style('opacity', 0)
        .attr('transform', 'translate(-8, 0)')
        .transition()
        .duration(animDur(320))
        .delay(animDelay(410 + idx * 55))
        .ease(MOTION.easeOut)
        .style('opacity', 1)
        .attr('transform', 'translate(0, 0)');
    });
  } else {
    [...st.col0Recs, ...st.col1Recs].forEach(({ n, rect, labelGroup }) => {
      rect.interrupt().attr('y', n.y).attr('height', n.h).style('opacity', 1);
      labelGroup.interrupt().style('opacity', 1).attr('transform', 'translate(0, 0)');
    });
    st.col0Nodes.forEach((n) => {
      st.clip01Rects.get(n.id)?.interrupt().attr('width', st.span01);
    });
  }

  // Acessibilidade e interação da Coluna 3 conforme passo ativo
  st.col3LinksG
    .style('pointer-events', showCol3 ? 'auto' : 'none')
    .attr('aria-hidden', showCol3 ? null : 'true');
  st.col3NodesG
    .style('pointer-events', showCol3 ? 'auto' : 'none')
    .attr('aria-hidden', showCol3 ? null : 'true');
  st.allLinkEls.filter((l) => l.colIdx === 1).forEach((l) => l.sel.attr('tabindex', showCol3 ? 0 : -1));
  st.allNodeEls.filter((n) => n.colIdx === 2).forEach((n) => n.sel.attr('tabindex', showCol3 ? 0 : -1));

  if (showCol3) {
    const enteringCol3 = animate && (isFreshMount ? prevStep < 0 : !wasCol3);
    if (enteringCol3) {
      st.col3Header.interrupt()
        .style('opacity', 0)
        .transition()
        .duration(animDur(280))
        .ease(MOTION.easeOut)
        .style('opacity', 1);

      st.col1Nodes.forEach((n, idx) => {
        const clipRect = st.clip12Rects.get(n.id);
        if (!clipRect) return;
        clipRect.interrupt()
          .attr('width', 0)
          .transition()
          .duration(animDur(640))
          .delay(animDelay(idx * 65))
          .ease(MOTION.easeInOut)
          .attr('width', st.span12);
      });

      st.col2Recs.forEach(({ n, rect, labelGroup }, idx) => {
        rect.interrupt()
          .attr('y', n.y + n.h / 2)
          .attr('height', 0)
          .style('opacity', 0)
          .transition()
          .duration(animDur(380))
          .delay(animDelay(320 + idx * 60))
          .ease(MOTION.easeOut)
          .attr('y', n.y)
          .attr('height', n.h)
          .style('opacity', 1);

        labelGroup.interrupt()
          .style('opacity', 0)
          .attr('transform', 'translate(-8, 0)')
          .transition()
          .duration(animDur(320))
          .delay(animDelay(390 + idx * 60))
          .ease(MOTION.easeOut)
          .style('opacity', 1)
          .attr('transform', 'translate(0, 0)');
      });
    } else {
      st.col3Header.interrupt().style('opacity', 1);
      st.col1Nodes.forEach((n) => {
        st.clip12Rects.get(n.id)?.interrupt().attr('width', st.span12);
      });
      st.col2Recs.forEach(({ n, rect, labelGroup }) => {
        rect.interrupt().attr('y', n.y).attr('height', n.h).style('opacity', 1);
        labelGroup.interrupt().style('opacity', 1).attr('transform', 'translate(0, 0)');
      });
    }
  } else {
    st.tipCtrl.hide();
    const leavingCol3 = animate && !isFreshMount && wasCol3;
    if (leavingCol3) {
      st.col3Header.interrupt()
        .transition()
        .duration(animDur(220))
        .ease(MOTION.easeOut)
        .style('opacity', 0);

      st.col1Nodes.forEach((n, idx) => {
        const clipRect = st.clip12Rects.get(n.id);
        if (!clipRect) return;
        clipRect.interrupt()
          .transition()
          .duration(animDur(340))
          .delay(animDelay(Math.max(0, st.col1Nodes.length - 1 - idx) * 35))
          .ease(MOTION.easeOut)
          .attr('width', 0);
      });

      st.col2Recs.forEach(({ rect, labelGroup }) => {
        rect.interrupt()
          .transition()
          .duration(animDur(240))
          .ease(MOTION.easeOut)
          .style('opacity', 0);
        labelGroup.interrupt()
          .transition()
          .duration(animDur(200))
          .ease(MOTION.easeOut)
          .style('opacity', 0);
      });
    } else {
      st.col3Header.interrupt().style('opacity', 0);
      st.col1Nodes.forEach((n) => {
        st.clip12Rects.get(n.id)?.interrupt().attr('width', 0);
      });
      st.col2Recs.forEach(({ rect, labelGroup }) => {
        rect.interrupt().style('opacity', 0);
        labelGroup.interrupt().style('opacity', 0);
      });
    }
  }
}
