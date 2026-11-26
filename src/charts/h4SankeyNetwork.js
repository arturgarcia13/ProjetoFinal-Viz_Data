import * as d3 from 'd3';
import { SEMANTIC_PALETTE } from './palette.js';
import { animDur, MOTION, shouldAnimate } from './motion.js';
import { bindTooltipEvents, buildTooltipCard, createChartTooltip, fmtCompactBrl, fmtInt, fmtPct } from './tooltip.js';

export function computeH4FlowStats(candidates, { cohort = 'all' } = {}) {
  let recs = candidates.filter((c) => c.apto && (c.g === 'F' || c.g === 'M') && c.r > 0);
  if (cohort === 'noTop10' && recs.length > 20) {
    const sortedR = recs.map((d) => d.r).sort(d3.ascending);
    const p90 = d3.quantile(sortedR, 0.9);
    recs = recs.filter((d) => d.r <= p90);
  }

  const fem = recs.filter((d) => d.g === 'F');
  const masc = recs.filter((d) => d.g === 'M');
  const totPubF = d3.sum(fem, (d) => d.fefc + d.fp);
  const totPubM = d3.sum(masc, (d) => d.fefc + d.fp);
  const totPub = totPubF + totPubM;

  const expF = d3.sum(fem, (d) => (d.e > 0 ? d.e : d.r));
  const expM = d3.sum(masc, (d) => (d.e > 0 ? d.e : d.r));

  const fShared = d3.sum(fem, (d) => d.toShared);
  const mShared = d3.sum(masc, (d) => d.toShared);
  const fParty = d3.sum(fem, (d) => d.toParty + d.toCandF + d.toCandM + d.toCandU);
  const mParty = d3.sum(masc, (d) => d.toParty + d.toCandF + d.toCandM + d.toCandU);

  const fDirect = Math.max(0, expF - fShared - fParty);
  const mDirect = Math.max(0, expM - mShared - mParty);
  const totExp = expF + expM;

  return {
    n: recs.length,
    nF: fem.length,
    nM: masc.length,
    totPub,
    totPubF,
    totPubM,
    shareF: totPub > 0 ? totPubF / totPub : 0,
    shareM: totPub > 0 ? totPubM / totPub : 0,
    totExp,
    expF,
    expM,
    fShared,
    mShared,
    totShared: fShared + mShared,
    fParty,
    mParty,
    totParty: fParty + mParty,
    fDirect,
    mDirect,
    totDirect: fDirect + mDirect,
    sharedPct: totExp > 0 ? ((fShared + mShared) / totExp) * 100 : 0,
    partyPct: totExp > 0 ? ((fParty + mParty) / totExp) * 100 : 0,
    directPct: totExp > 0 ? ((fDirect + mDirect) / totExp) * 100 : 0,
    fRatioShared: (fShared + mShared) > 0 ? (fShared / (fShared + mShared)) * 100 : 0,
    fShareOfF: expF > 0 ? (fShared / expF) * 100 : 0,
    mShareOfM: expM > 0 ? (mShared / expM) * 100 : 0,
  };
}

/**
 * H4 (Passos 0 e 1) — Sankey de Rastreamento de Receitas e Despesas TSE com revelação progressiva da 3ª coluna.
 */
export function renderH4Sankey(container, flowStats, { step = 1, prevStep = 1, width = 740 } = {}) {
  container.innerHTML = '';
  if (!flowStats || flowStats.totPub <= 0 || flowStats.totExp <= 0) {
    container.innerHTML = '<p class="chart-empty">Sem dados financeiros suficientes neste recorte.</p>';
    return;
  }

  const isCompact = width < 480;
  const margin = { top: 28, right: isCompact ? 132 : 228, bottom: 20, left: 16 };
  const svgW = width;
  const svgH = isCompact ? 320 : 370;
  const W = svgW - margin.left - margin.right;
  const H = svgH - margin.top - margin.bottom;

  const tipCtrl = createChartTooltip(container, { wrapClass: 'h4-wrap', tooltipClass: 'h4-tooltip' });
  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('class', 'h4-sankey-svg')
    .attr('viewBox', `0 0 ${svgW} ${svgH}`)
    .attr('width', svgW)
    .attr('height', svgH)
    .attr('role', 'img')
    .attr('aria-label', 'Sankey de fluxo do Fundo Público entre candidatas, candidatos e fornecedores compartilhados')
    .style('font-family', 'Inter, system-ui, sans-serif');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const col0X = 0;
  const col1X = W * 0.48;
  const col2X = W;
  const nodeW = isCompact ? 14 : 18;
  const showCol3 = step >= 1;
  const animateCol3 = shouldAnimate() && showCol3 && prevStep === 0;

  const nTotal = {
    x: col0X,
    y: 22,
    h: H - 38,
    label: isCompact ? 'Fundo Público' : 'Fundo Público (FEFC/FP)',
    sub: fmtCompactBrl(flowStats.totPub),
    color: SEMANTIC_PALETTE.emerald,
  };

  const gap1 = 22;
  const avail1 = nTotal.h - gap1;
  const hF = Math.max(12, avail1 * flowStats.shareF);
  const hM = Math.max(12, avail1 - hF);
  const nF = {
    x: col1X,
    y: 22,
    h: hF,
    label: 'Candidatas (F)',
    sub: `${fmtPct(flowStats.shareF * 100)} (${fmtInt(flowStats.nF)})`,
    color: SEMANTIC_PALETTE.female,
  };
  const nM = {
    x: col1X,
    y: 22 + hF + gap1,
    h: hM,
    label: 'Candidatos (M)',
    sub: `${fmtPct(flowStats.shareM * 100)} (${fmtInt(flowStats.nM)})`,
    color: SEMANTIC_PALETTE.male,
  };

  const gap2 = 12;
  const avail2 = nTotal.h - gap2 * 2;
  const sharedShare = flowStats.totShared / flowStats.totExp;
  const partyShare = flowStats.totParty / flowStats.totExp;

  const hPartyNode = Math.max(10, avail2 * partyShare);
  const hSharedNode = Math.max(18, avail2 * sharedShare);
  const hDirectNode = Math.max(18, avail2 - hSharedNode - hPartyNode);

  const nShared = {
    x: col2X,
    y: 22,
    h: hSharedNode,
    label: isCompact ? 'Forn. Compartilhado' : 'Fornecedor Compartilhado',
    sub: `${fmtPct(flowStats.sharedPct, 1)} do gasto · ${Math.round(flowStats.fRatioShared)}% F`,
    color: SEMANTIC_PALETTE.pinkDeep,
  };
  const nDirect = {
    x: col2X,
    y: 22 + hSharedNode + gap2,
    h: hDirectNode,
    label: isCompact ? 'Campanha Própria' : 'Campanha Própria / Mídia',
    sub: `${fmtPct(flowStats.directPct, 1)} do gasto`,
    color: '#94A3B8',
  };
  const nTransfer = {
    x: col2X,
    y: 22 + hSharedNode + gap2 + hDirectNode + gap2,
    h: hPartyNode,
    label: isCompact ? 'Partidos / Outros' : 'Direção Partidária / Outros',
    sub: `${fmtPct(flowStats.partyPct, 1)} do gasto`,
    color: '#CBD5E1',
  };

  const ribbonPath = (x0, y0, h0, x1, y1, h1) => {
    const xi = d3.interpolateNumber(x0, x1);
    return `M${x0},${y0} C${xi(0.45)},${y0} ${xi(0.55)},${y1} ${x1},${y1} L${x1},${y1 + h1} C${xi(0.55)},${y1 + h1} ${xi(0.45)},${y0 + h0} ${x0},${y0 + h0} Z`;
  };

  const rF = g.append('path')
    .attr('d', ribbonPath(nTotal.x + nodeW, nTotal.y, nTotal.h * flowStats.shareF, nF.x, nF.y, nF.h))
    .attr('fill', SEMANTIC_PALETTE.female)
    .attr('fill-opacity', 0.36)
    .style('cursor', 'pointer');
  bindTooltipEvents(rF.node(), tipCtrl, () => buildTooltipCard({
    title: 'Fundo Público → Candidatas (F)',
    badge: fmtPct(flowStats.shareF * 100),
    badgeTone: 'below',
    rows: [
      { label: 'Volume FEFC + FP', value: fmtCompactBrl(flowStats.totPubF), focus: true },
      { label: 'Candidatas com receita', value: fmtInt(flowStats.nF) },
    ],
  }));

  const rM = g.append('path')
    .attr('d', ribbonPath(nTotal.x + nodeW, nTotal.y + nTotal.h * flowStats.shareF, nTotal.h * flowStats.shareM, nM.x, nM.y, nM.h))
    .attr('fill', SEMANTIC_PALETTE.male)
    .attr('fill-opacity', 0.25)
    .style('cursor', 'pointer');
  bindTooltipEvents(rM.node(), tipCtrl, () => buildTooltipCard({
    title: 'Fundo Público → Candidatos (M)',
    badge: fmtPct(flowStats.shareM * 100),
    badgeTone: 'neutral',
    rows: [
      { label: 'Volume FEFC + FP', value: fmtCompactBrl(flowStats.totPubM), focus: true },
      { label: 'Candidatos com receita', value: fmtInt(flowStats.nM) },
    ],
  }));

  const col3G = g.append('g')
    .style('opacity', animateCol3 ? 0 : 1)
    .attr('transform', animateCol3 ? 'translate(-14, 0)' : 'translate(0, 0)');

  if (showCol3) {
    const fToSharedH = Math.min(nShared.h - 3, Math.max(3, nShared.h * (flowStats.fRatioShared / 100)));
    const mToSharedH = Math.max(3, nShared.h - fToSharedH);

    const pFS = col3G.append('path')
      .attr('d', ribbonPath(nF.x + nodeW, nF.y, Math.min(nF.h * 0.65, fToSharedH), nShared.x, nShared.y, fToSharedH))
      .attr('fill', SEMANTIC_PALETTE.pink)
      .attr('fill-opacity', 0.68)
      .style('cursor', 'pointer');
    bindTooltipEvents(pFS.node(), tipCtrl, () => buildTooltipCard({
      title: 'Candidatas (F) → Fornecedor Compartilhado',
      badge: `${fmtPct(flowStats.fShareOfF)} do gasto F`,
      badgeTone: 'floor',
      rows: [
        { label: 'Pago a fornecedores compartilhados', value: fmtCompactBrl(flowStats.fShared), focus: true },
        { label: 'Parcela feminina neste destino', value: fmtPct(flowStats.fRatioShared) },
      ],
    }));

    const pMS = col3G.append('path')
      .attr('d', ribbonPath(nM.x + nodeW, nM.y, Math.min(nM.h * 0.55, mToSharedH), nShared.x, nShared.y + fToSharedH, mToSharedH))
      .attr('fill', SEMANTIC_PALETTE.pink)
      .attr('fill-opacity', 0.36)
      .style('cursor', 'pointer');
    bindTooltipEvents(pMS.node(), tipCtrl, () => buildTooltipCard({
      title: 'Candidatos (M) → Fornecedor Compartilhado',
      badge: `${fmtPct(flowStats.mShareOfM)} do gasto M`,
      badgeTone: 'neutral',
      rows: [
        { label: 'Pago a fornecedores compartilhados', value: fmtCompactBrl(flowStats.mShared), focus: true },
      ],
    }));

    const fDirectY0 = nF.y + Math.min(nF.h * 0.65, fToSharedH);
    const fDirectH = Math.max(3, nF.h - (fDirectY0 - nF.y) - 3);
    const fToDirectOut = Math.max(3, nDirect.h * (flowStats.fDirect / Math.max(1, flowStats.totDirect)));
    col3G.append('path')
      .attr('d', ribbonPath(nF.x + nodeW, fDirectY0, fDirectH, nDirect.x, nDirect.y, fToDirectOut))
      .attr('fill', SEMANTIC_PALETTE.female)
      .attr('fill-opacity', 0.18);

    const mDirectY0 = nM.y + Math.min(nM.h * 0.55, mToSharedH);
    const mDirectH = Math.max(3, nM.h - (mDirectY0 - nM.y) - 3);
    col3G.append('path')
      .attr('d', ribbonPath(nM.x + nodeW, mDirectY0, mDirectH, nDirect.x, nDirect.y + fToDirectOut, Math.max(3, nDirect.h - fToDirectOut)))
      .attr('fill', SEMANTIC_PALETTE.male)
      .attr('fill-opacity', 0.16);

    col3G.append('path')
      .attr('d', ribbonPath(nF.x + nodeW, nF.y + nF.h - 3, 3, nTransfer.x, nTransfer.y, nTransfer.h * 0.5))
      .attr('fill', SEMANTIC_PALETTE.female)
      .attr('fill-opacity', 0.3);
    col3G.append('path')
      .attr('d', ribbonPath(nM.x + nodeW, nM.y + nM.h - 3, 3, nTransfer.x, nTransfer.y + nTransfer.h * 0.5, nTransfer.h * 0.5))
      .attr('fill', SEMANTIC_PALETTE.male)
      .attr('fill-opacity', 0.25);

    if (animateCol3) {
      col3G.transition().duration(animDur(540)).ease(MOTION.easeOut)
        .style('opacity', 1)
        .attr('transform', 'translate(0, 0)');
    }
  }

  const drawNode = (targetG, n, idx) => {
    const rect = targetG.append('rect')
      .attr('x', n.x)
      .attr('y', n.y)
      .attr('width', nodeW)
      .attr('height', n.h)
      .attr('rx', 3)
      .attr('fill', n.color)
      .style('cursor', 'pointer');

    const isRightCol = n.x === col2X;
    const textX = isRightCol ? n.x + nodeW + 9 : n.x;
    const textY = isRightCol ? n.y + n.h / 2 - 3 : n.y - 7;

    targetG.append('text')
      .attr('x', textX)
      .attr('y', textY)
      .attr('fill', SEMANTIC_PALETTE.ink)
      .style('font-size', isCompact ? '9.8px' : '11px')
      .style('font-weight', '700')
      .attr('paint-order', 'stroke')
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 3)
      .text(n.label);

    targetG.append('text')
      .attr('x', textX)
      .attr('y', textY + (isRightCol ? 13 : -12))
      .attr('fill', idx === 3 ? '#B8299E' : SEMANTIC_PALETTE.muted)
      .style('font-size', isCompact ? '9px' : '10px')
      .style('font-weight', '700')
      .attr('paint-order', 'stroke')
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 3)
      .text(n.sub);

    bindTooltipEvents(rect.node(), tipCtrl, () => buildTooltipCard({
      title: n.label,
      badge: n.sub,
      badgeTone: idx === 3 ? 'floor' : 'neutral',
      rows: [{ label: 'Universo no recorte', value: `${fmtInt(flowStats.n)} candidaturas` }],
    }));
  };

  [nTotal, nF, nM].forEach((n, idx) => drawNode(g, n, idx));
  if (showCol3) {
    [nShared, nDirect, nTransfer].forEach((n, idx) => drawNode(col3G, n, idx + 3));
  }
}
