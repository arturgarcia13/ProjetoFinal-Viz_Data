import * as d3 from 'd3';
import { SEMANTIC_PALETTE } from './palette.js';
import { addDirectAnnotation } from './annotate.js';
import { animDelay, animDur, MOTION, shouldAnimate } from './motion.js';
import { bindTooltipEvents, buildTooltipCard, createChartTooltip, fmtCompactBrl, fmtPct, fmtRatio } from './tooltip.js';

const SHORT = { REPUBLICANOS: 'REPUBL.', SOLIDARIEDADE: 'SOLID.', CIDADANIA: 'CIDAD.' };

/**
 * H2 — Dumbbell da Razão da Mediana (Mulheres ÷ Homens, 2022 → 2026)
 * + Painel inferior de Composição da Receita (Fundo Público FEFC/FP vs. Recursos Privados).
 */
export function renderH2Dumbbell(
  container,
  gapData,
  h2bData,
  {
    step = 2,
    prevStep = 2,
    width = 720,
    activeYear = 2022,
    selectedParty = '',
    onSelectParty = null,
    onClearParty = null,
  } = {},
) {
  container.innerHTML = '';
  const rows = (gapData?.rows || [])
    .filter((r) => r.medM2022 > 0 && r.medM2026 > 0 && r.medF2022 !== null)
    .map((r) => ({
      ...r,
      r22: r.medF2022 / r.medM2022,
      r26: r.medF2026 / r.medM2026,
    }))
    .sort((a, b) => a.r26 - b.r26);

  if (rows.length === 0) {
    container.innerHTML = '<p class="chart-empty">Sem partidos com amostra mínima (≥5 candidatas e ≥5 candidatos em 2022 e 2026) neste recorte.</p>';
    return;
  }

  const isCompact = width < 480;
  const margin = { top: 34, right: isCompact ? 38 : 54, bottom: 26, left: isCompact ? 86 : 114 };
  const rowH = isCompact ? 22 : 24;
  const dbH = Math.max(210, rows.length * rowH);
  const srcTop = margin.top + dbH + 74;
  const svgW = width;
  const svgH = srcTop + 88;
  const W = svgW - margin.left - margin.right;

  const maxRatio = Math.max(1.45, d3.max(rows, (r) => Math.max(r.r22, r.r26)) * 1.12);
  const x = d3.scaleLinear().domain([0, maxRatio]).range([0, W]);
  const y = d3.scalePoint().domain(rows.map((r) => r.party)).range([10, dbH - 10]).padding(0.4);

  const tipCtrl = createChartTooltip(container, { wrapClass: 'h2-wrap', tooltipClass: 'h2-tooltip' });
  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('class', 'h2-gap-svg')
    .attr('viewBox', `0 0 ${svgW} ${svgH}`)
    .attr('width', svgW)
    .attr('height', svgH)
    .attr('role', 'img')
    .attr('aria-label', 'Razão da mediana de financiamento Mulheres ÷ Homens por partido (2022 para 2026) e composição das fontes')
    .style('font-family', 'Inter, system-ui, sans-serif');

  if (onClearParty) {
    svg.on('click', (evt) => {
      if (selectedParty && !evt.target.closest('.h2-row')) onClearParty();
    });
  }

  const defs = svg.append('defs');
  [
    { id: 'h2-arr-female', color: SEMANTIC_PALETTE.female },
    { id: 'h2-arr-emerald', color: SEMANTIC_PALETTE.emerald },
    { id: 'h2-arr-male', color: SEMANTIC_PALETTE.male },
  ].forEach((m) => {
    defs.append('marker')
      .attr('id', m.id)
      .attr('viewBox', '0 -4 8 8')
      .attr('refX', 7)
      .attr('refY', 0)
      .attr('markerUnits', 'userSpaceOnUse')
      .attr('markerWidth', 9)
      .attr('markerHeight', 9)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L8,0L0,4')
      .attr('fill', m.color);
  });

  const getRowStyle = (d) => {
    if (d.r26 >= 1.0) return { color: SEMANTIC_PALETTE.emerald, marker: 'url(#h2-arr-emerald)', status: 'Paridade ≥ 1,0×', tone: 'above' };
    if (d.r26 < d.r22) return { color: SEMANTIC_PALETTE.female, marker: 'url(#h2-arr-female)', status: 'Recuou em 2026', tone: 'below' };
    return { color: SEMANTIC_PALETTE.male, marker: 'url(#h2-arr-male)', status: 'Avançou (< 1,0×)', tone: 'neutral' };
  };

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  g.append('g')
    .attr('transform', `translate(0,${dbH})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat((d) => `${d.toFixed(1).replace('.', ',')}×`))
    .call((a) => a.select('.domain').attr('stroke', '#CBD5E1'))
    .call((a) => a.selectAll('.tick text').attr('fill', SEMANTIC_PALETTE.muted).style('font-size', '11px'));

  g.append('text')
    .attr('x', W / 2)
    .attr('y', dbH + 34)
    .attr('text-anchor', 'middle')
    .attr('fill', SEMANTIC_PALETTE.muted)
    .style('font-size', '10.5px')
    .style('font-weight', '600')
    .text('Razão da Receita Mediana (Mulheres ÷ Homens)');

  g.append('g')
    .call(d3.axisLeft(y).tickSize(-W).tickFormat((d) => (isCompact && SHORT[d] ? SHORT[d] : d)))
    .call((a) => a.select('.domain').remove())
    .call((a) => a.selectAll('.tick line').attr('stroke', SEMANTIC_PALETTE.grid).attr('stroke-dasharray', '2,2'))
    .call((a) => a.selectAll('.tick text').attr('fill', SEMANTIC_PALETTE.ink).style('font-size', isCompact ? '10px' : '11px').style('font-weight', '700'));

  const parityX = x(1.0);
  g.append('line')
    .attr('x1', parityX)
    .attr('x2', parityX)
    .attr('y1', -8)
    .attr('y2', dbH)
    .attr('stroke', SEMANTIC_PALETTE.emerald)
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '4,3');

  g.append('text')
    .attr('x', parityX)
    .attr('y', -14)
    .attr('text-anchor', 'middle')
    .attr('fill', SEMANTIC_PALETTE.emerald)
    .style('font-size', '11px')
    .style('font-weight', '700')
    .text('Paridade (1,0×)');

  const show26 = step >= 1;
  const prevShow26 = prevStep >= 1;
  const animate = shouldAnimate();
  const dur = animDur(580);
  const tracksG = g.append('g');

  rows.forEach((d, idx) => {
    const st = getRowStyle(d);
    const cy = y(d.party);
    const dimmed = Boolean(selectedParty && selectedParty !== d.party);
    const delay = animDelay(idx * 24);
    const row = tracksG.append('g')
      .attr('class', 'h2-row')
      .attr('data-party', d.party)
      .style('cursor', onSelectParty ? 'pointer' : 'default')
      .style('opacity', dimmed ? 0.28 : 1);

    row.append('rect')
      .attr('x', -margin.left)
      .attr('y', cy - rowH / 2)
      .attr('width', svgW)
      .attr('height', rowH)
      .attr('fill', 'transparent');

    const startX = animate && prevShow26 ? x(d.r26) : x(d.r22);
    const endX = show26 ? x(d.r26) : x(d.r22);
    const line = row.append('line')
      .attr('y1', cy)
      .attr('y2', cy)
      .attr('x1', x(d.r22))
      .attr('x2', animate ? startX : endX)
      .attr('stroke', st.color)
      .attr('stroke-width', 2.8)
      .attr('marker-end', show26 ? st.marker : null);

    if (animate && startX !== endX) {
      line.transition().duration(dur).delay(delay).ease(MOTION.easeOut).attr('x2', endX);
    }

    row.append('circle')
      .attr('cx', x(d.r22))
      .attr('cy', cy)
      .attr('r', 5.2)
      .attr('fill', SEMANTIC_PALETTE.male);

    const dot26 = row.append('circle')
      .attr('cx', animate ? startX : endX)
      .attr('cy', cy)
      .attr('r', animate ? (prevShow26 ? 6 : 0) : (show26 ? 6 : 0))
      .attr('fill', st.color);

    if (animate) {
      dot26.transition().duration(dur).delay(delay).ease(MOTION.easeOut)
        .attr('cx', endX)
        .attr('r', show26 ? 6 : 0);
    }

    if (show26) {
      const goLeft = d.r26 < d.r22;
      const canPlaceLeft = goLeft && x(d.r26) >= 42;
      const lblX = canPlaceLeft ? x(d.r26) - 10 : (goLeft ? Math.max(x(d.r22), x(d.r26)) + 10 : x(d.r26) + 10);
      const valTxt = row.append('text')
        .attr('x', Math.min(W + 34, lblX))
        .attr('y', cy + 4)
        .attr('text-anchor', canPlaceLeft ? 'end' : 'start')
        .style('font-size', '10.5px')
        .style('font-weight', '700')
        .style('opacity', animate && !prevShow26 ? 0 : 1)
        .attr('fill', st.color)
        .text(fmtRatio(d.r26));
      if (animate && !prevShow26) {
        valTxt.transition().duration(260).delay(delay + 280).style('opacity', 1);
      }
    }

    const node = row.node();
    node.setAttribute('tabindex', '0');
    node.setAttribute('role', 'button');
    node.setAttribute('aria-label', `${d.party}: razão 2022 ${fmtRatio(d.r22)}, 2026 ${fmtRatio(d.r26)}`);
    bindTooltipEvents(node, tipCtrl, () => buildTooltipCard({
      title: d.party,
      badge: st.status,
      badgeTone: st.tone,
      rows: [
        { label: 'Razão 2022 (F ÷ M)', value: fmtRatio(d.r22) },
        { label: 'Razão 2026 (F ÷ M)', value: fmtRatio(d.r26), focus: true },
        { label: 'Mediana F (2026)', value: fmtCompactBrl(d.medF2026) },
        { label: 'Mediana M (2026)', value: fmtCompactBrl(d.medM2026) },
      ],
      hint: onSelectParty ? 'Clique para destacar este partido nos demais gráficos' : '',
    }), { focusable: true });

    if (onSelectParty) {
      row.on('click', (evt) => {
        evt.stopPropagation();
        onSelectParty(d.party);
      });
      row.on('keydown', (evt) => {
        if (evt.key === 'Enter' || evt.key === ' ') {
          evt.preventDefault();
          onSelectParty(d.party);
        }
      });
    }
  });

  if (show26 && !isCompact && rows.length >= 2) {
    const annG = g.append('g');
    const worst = rows[0];
    const best = rows[rows.length - 1];
    const worstAnchorX = Math.max(parityX + 14, Math.max(x(worst.r22), x(worst.r26)) + 52);
    if (worstAnchorX + 150 <= W + 24) {
      addDirectAnnotation(annG, {
        x1: worstAnchorX,
        y1: y(worst.party) + 4,
        x2: Math.max(x(worst.r22), x(worst.r26)) + 10,
        y2: y(worst.party) + 2,
        title: `${worst.party}: menor razão (${fmtRatio(worst.r26)})`,
        color: '#D93814',
        animate: !prevShow26,
      });
    }
    if (best.r26 >= 1.0) {
      addDirectAnnotation(annG, {
        x1: Math.max(10, x(best.r26) - 185),
        y1: y(best.party) + 20,
        x2: x(best.r26) - 4,
        y2: y(best.party) + 6,
        title: `${best.party} supera paridade (${fmtRatio(best.r26)})`,
        color: SEMANTIC_PALETTE.emerald,
        animate: !prevShow26,
      });
    }
  }

  // Painel inferior: Composição 100% da Receita (Fundo Público FEFC/FP vs. Recursos Privados)
  const pubShareF = (h2bData?.pubShareF ?? 0) * 100;
  const pubShareM = (h2bData?.pubShareM ?? 0) * 100;
  const sources = [
    { label: 'Mulheres', publico: pubShareF, privado: Math.max(0, 100 - pubShareF) },
    { label: 'Homens', publico: pubShareM, privado: Math.max(0, 100 - pubShareM) },
  ];

  const showSrc = step >= 2;
  const prevShowSrc = prevStep >= 2;
  const sourceG = svg.append('g')
    .attr('class', 'h2b-src-group')
    .attr('transform', `translate(${margin.left}, ${srcTop})`)
    .style('opacity', animate ? (prevShowSrc ? 1 : 0.16) : (showSrc ? 1 : 0.16));

  if (animate) {
    sourceG.transition().duration(420).ease(MOTION.easeOut).style('opacity', showSrc ? 1 : 0.16);
  }

  sourceG.append('text')
    .attr('x', 0)
    .attr('y', -22)
    .attr('fill', SEMANTIC_PALETTE.ink)
    .style('font-size', isCompact ? '9.8px' : '11px')
    .style('font-weight', '700')
    .text(isCompact
      ? `Composição (${activeYear} · Todos os partidos)`
      : `Composição da Receita — Todos os Partidos (${activeYear}): Fundo Público vs. Recursos Privados`);

  // Mini-legenda explícita diferenciando Fundo Público vs. Recursos Privados
  const srcLeg = sourceG.append('g').attr('transform', 'translate(0, -14)');
  srcLeg.append('rect').attr('x', 0).attr('y', 0).attr('width', 9).attr('height', 9).attr('rx', 2).attr('fill', SEMANTIC_PALETTE.emerald);
  srcLeg.append('text').attr('x', 13).attr('y', 8).attr('fill', SEMANTIC_PALETTE.ink).style('font-size', '9.8px').style('font-weight', '600').text('Fundo Público (FEFC/FP)');
  const privLegX = isCompact ? 132 : 162;
  srcLeg.append('rect').attr('x', privLegX).attr('y', 0).attr('width', 9).attr('height', 9).attr('rx', 2).attr('fill', SEMANTIC_PALETTE.highlight).attr('stroke', SEMANTIC_PALETTE.highlightInk).attr('stroke-width', 0.8);
  srcLeg.append('text').attr('x', privLegX + 13).attr('y', 8).attr('fill', SEMANTIC_PALETTE.ink).style('font-size', '9.8px').style('font-weight', '600').text('Recursos Privados / Próprios');

  const xSrc = d3.scaleLinear().domain([0, 100]).range([0, W]);
  sources.forEach((row, idx) => {
    const yPos = 6 + idx * 28;
    const barRow = sourceG.append('g').attr('class', 'h2b-src-bar').style('cursor', 'pointer');

    barRow.append('text')
      .attr('x', -10)
      .attr('y', yPos + 14)
      .attr('text-anchor', 'end')
      .attr('fill', idx === 0 ? '#D93814' : SEMANTIC_PALETTE.male)
      .style('font-size', '10.5px')
      .style('font-weight', '700')
      .text(row.label);

    const targetW = Math.max(0, xSrc(row.publico));
    const pubBar = barRow.append('rect')
      .attr('x', 0)
      .attr('y', yPos)
      .attr('width', animate && showSrc && !prevShowSrc ? 0 : targetW)
      .attr('height', 19)
      .attr('rx', 3)
      .attr('fill', SEMANTIC_PALETTE.emerald);

    if (animate && showSrc && !prevShowSrc) {
      pubBar.transition().duration(dur).delay(idx * 90).ease(MOTION.easeOut).attr('width', targetW);
    }

    if (targetW > 46) {
      barRow.append('text')
        .attr('x', 8)
        .attr('y', yPos + 13)
        .attr('fill', '#FFFFFF')
        .style('font-size', isCompact ? '9.2px' : '10px')
        .style('font-weight', '700')
        .text(targetW > 130 ? `Fundo Público: ${fmtPct(row.publico)}` : fmtPct(row.publico));
    }

    const privW = Math.max(0, xSrc(row.privado) - 2);
    const privBar = barRow.append('rect')
      .attr('x', xSrc(row.publico) + 2)
      .attr('y', yPos)
      .attr('width', animate && showSrc && !prevShowSrc ? 0 : privW)
      .attr('height', 19)
      .attr('rx', 3)
      .attr('fill', SEMANTIC_PALETTE.highlight)
      .attr('stroke', SEMANTIC_PALETTE.highlightInk)
      .attr('stroke-width', 0.8);

    if (animate && showSrc && !prevShowSrc) {
      privBar.transition().duration(400).delay(180 + idx * 90).ease(MOTION.easeOut).attr('width', privW);
    }

    if (privW > 34) {
      barRow.append('text')
        .attr('x', xSrc(row.publico) + 6)
        .attr('y', yPos + 13)
        .attr('fill', '#142620')
        .style('font-size', isCompact ? '9.2px' : '10px')
        .style('font-weight', '700')
        .text(privW > 105 ? `Privado: ${fmtPct(row.privado)}` : fmtPct(row.privado));
    }

    bindTooltipEvents(barRow.node(), tipCtrl, () => buildTooltipCard({
      title: `${row.label} (${activeYear})`,
      badge: 'Todos os partidos',
      badgeTone: idx === 0 ? 'below' : 'neutral',
      rows: [
        { label: 'Fundo Público (FEFC + FP)', value: fmtPct(row.publico), focus: true },
        { label: 'Recursos Privados / Próprios', value: fmtPct(row.privado) },
      ],
    }));
  });
}
