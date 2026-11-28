import * as d3 from 'd3';
import { SEMANTIC_PALETTE } from './palette.js';
import { animDelay, animDur, drawPath, MOTION, shouldAnimate } from './motion.js';
import { bindTooltipEvents, buildTooltipCard, createChartTooltip, fmtCompactBrl, fmtInt, fmtPct, fmtSignedPP } from './tooltip.js';

/**
 * Gráfico 6 (Ato 3 · #sec-limiar) — Slopegraph Comparativo 30%–33% vs. > 33% (excluindo < 30%) em 4 dimensões:
 * 1. Mediana de Investimento (F)
 * 2. Proporcionalidade Pública (F)
 * 3. Distribuição (Conc. Top 10%)
 * 4. Mulheres Eleitas (%)
 */
export function renderThresholdCompare(container, compData, { step = 2, prevStep = 2, width = 720, year = 2022 } = {}) {
  container.innerHTML = '';
  if (!compData || !compData.floor || !compData.above || (compData.floor.units === 0 && compData.above.units === 0)) {
    container.innerHTML = '<p class="chart-empty">Sem unidades suficientes nas faixas 30%–33% e &gt;33% para este recorte.</p>';
    return;
  }

  const { floor, above, unit, excludedBelow30 } = compData;
  const unitLabel = unit === 'party' ? 'Partidos' : 'Chapas (n ≥ 4)';
  const isCompact = width < 520;

  const panels = [
    {
      id: 'mediana',
      title: '1. Mediana de Investimento (F)',
      subtitle: 'Receita mediana feminina em R$',
      floorVal: floor.medF,
      aboveVal: above.medF,
      fmt: (v) => fmtCompactBrl(v),
      deltaText: floor.medF > 0 ? `${(((above.medF - floor.medF) / floor.medF) * 100 >= 0 ? '+' : '')}${(((above.medF - floor.medF) / floor.medF) * 100).toFixed(0)}%` : '—',
      minStep: 0,
      rows: [
        { label: 'Mediana F', f: fmtCompactBrl(floor.medF), a: fmtCompactBrl(above.medF) },
        { label: 'Mediana M', f: fmtCompactBrl(floor.medM), a: fmtCompactBrl(above.medM) },
        { label: 'Mediana geral', f: fmtCompactBrl(floor.medAll), a: fmtCompactBrl(above.medAll) },
      ],
    },
    {
      id: 'proporcionalidade',
      title: '2. Proporcionalidade Pública (F)',
      subtitle: '% do Fundo Público (FEFC+FP) para mulheres',
      floorVal: floor.pctPubF,
      aboveVal: above.pctPubF,
      fmt: (v) => fmtPct(v, 1),
      deltaText: fmtSignedPP(above.pctPubF - floor.pctPubF),
      minStep: 0,
      rows: [
        { label: '% Fundo Público F', f: fmtPct(floor.pctPubF, 1), a: fmtPct(above.pctPubF, 1) },
        { label: '% Candidatas F', f: fmtPct(floor.pctCandF, 1), a: fmtPct(above.pctCandF, 1) },
        { label: 'Saldo (Verba − Cand.)', f: fmtSignedPP(floor.propSaldoPP), a: fmtSignedPP(above.propSaldoPP) },
      ],
    },
    {
      id: 'distribuicao',
      title: '3. Distribuição (Conc. Top 10%)',
      subtitle: '% do fundo feminino nas 10% mais financiadas',
      floorVal: floor.concTop10Pct,
      aboveVal: above.concTop10Pct,
      fmt: (v) => fmtPct(v, 1),
      deltaText: fmtSignedPP(above.concTop10Pct - floor.concTop10Pct),
      minStep: 1,
      rows: [
        { label: 'Top 10% (concentrado)', f: fmtPct(floor.concTop10Pct, 1), a: fmtPct(above.concTop10Pct, 1) },
        { label: 'Base 90% (pulverizado)', f: fmtPct(floor.base90Pct, 1), a: fmtPct(above.base90Pct, 1) },
      ],
    },
    {
      id: 'eleitas',
      title: '4. Mulheres Eleitas (%)',
      subtitle: 'Participação feminina entre eleitos(as)',
      floorVal: floor.pctEleitasF,
      aboveVal: above.pctEleitasF,
      fmt: (v) => fmtPct(v, 1),
      deltaText: fmtSignedPP(above.pctEleitasF - floor.pctEleitasF),
      minStep: 2,
      rows: [
        { label: '% Eleitas F', f: fmtPct(floor.pctEleitasF, 1), a: fmtPct(above.pctEleitasF, 1) },
        { label: 'Eleitas / Total', f: `${fmtInt(floor.elF)}/${fmtInt(floor.elTot)}`, a: `${fmtInt(above.elF)}/${fmtInt(above.elTot)}` },
      ],
    },
  ];

  const tipCtrl = createChartTooltip(container, { wrapClass: 'limiar-wrap' });
  const cols = isCompact ? 1 : 2;
  const cardW = isCompact ? width : Math.floor((width - 14) / 2);
  const cardH = 172;
  const gap = 14;
  const svgW = width;
  const svgH = cols === 1 ? (cardH + gap) * 4 - gap + 28 : (cardH + gap) * 2 - gap + 28;

  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('class', 'limiar-compare-svg limiar-slope-svg')
    .attr('viewBox', `0 0 ${svgW} ${svgH}`)
    .attr('width', svgW)
    .attr('height', svgH)
    .attr('role', 'img')
    .attr('aria-label', `Slopegraph comparativo 30%–33% versus acima de 33% (${unitLabel}) em ${year}`)
    .style('font-family', 'Inter, system-ui, sans-serif');

  const animate = shouldAnimate();
  const dur = animDur(480);

  const firstNewIdx = Math.max(0, panels.findIndex((p) => step >= p.minStep && prevStep < p.minStep));

  panels.forEach((p, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const gx = col * (cardW + gap);
    const gy = row * (cardH + gap);
    const isLoaded = step >= p.minStep;
    const wasLoaded = prevStep >= p.minStep;
    const enteringNow = animate && isLoaded && !wasLoaded;
    const staggerMs = Math.max(0, idx - firstNewIdx) * 90;

    const card = svg.append('g')
      .attr('class', 'limiar-panel')
      .attr('data-panel-id', p.id)
      .attr('data-loaded', isLoaded ? 'true' : 'false')
      .attr('transform', `translate(${gx},${gy})`)
      .style('opacity', isLoaded ? 1 : 0.58)
      .style('cursor', isLoaded ? 'pointer' : 'default');

    card.append('rect')
      .attr('x', 0.5)
      .attr('y', 0.5)
      .attr('width', cardW - 1)
      .attr('height', cardH - 1)
      .attr('rx', 8)
      .attr('fill', SEMANTIC_PALETTE.surfaceAlt)
      .attr('stroke', '#D8E6DF')
      .attr('stroke-dasharray', isLoaded ? 'none' : '4 3');

    card.append('text')
      .attr('x', 12)
      .attr('y', 21)
      .attr('fill', isLoaded ? SEMANTIC_PALETTE.ink : SEMANTIC_PALETTE.muted)
      .style('font-size', '11.5px')
      .style('font-weight', '700')
      .text(p.title);

    card.append('text')
      .attr('x', 12)
      .attr('y', 36)
      .attr('fill', SEMANTIC_PALETTE.muted)
      .style('font-size', '10px')
      .text(p.subtitle);

    // Coordenadas dos trilhos dentro do card
    const sidePad = isCompact ? 82 : 84;
    const xL = sidePad;
    const xR = cardW - sidePad;
    const yTop = 58;
    const yBot = cardH - 28;

    // Trilhos verticais sutis (30%–33% | > 33%) sempre visíveis como moldura
    [
      { x: xL, lbl: '30%–33%', color: isLoaded ? '#7A5200' : SEMANTIC_PALETTE.muted },
      { x: xR, lbl: '> 33%', color: isLoaded ? SEMANTIC_PALETTE.emerald : SEMANTIC_PALETTE.muted },
    ].forEach((axis) => {
      card.append('line')
        .attr('x1', axis.x)
        .attr('x2', axis.x)
        .attr('y1', yTop - 6)
        .attr('y2', yBot + 4)
        .attr('stroke', '#D1DFD8')
        .attr('stroke-width', 1.4);

      card.append('text')
        .attr('x', axis.x)
        .attr('y', cardH - 9)
        .attr('text-anchor', 'middle')
        .attr('fill', axis.color)
        .style('font-size', '9.8px')
        .style('font-weight', '700')
        .text(axis.lbl);
    });

    if (!isLoaded) {
      card.append('text')
        .attr('class', 'limiar-pending-label')
        .attr('x', cardW / 2)
        .attr('y', (yTop + yBot) / 2 + 2)
        .attr('text-anchor', 'middle')
        .attr('fill', SEMANTIC_PALETTE.muted)
        .style('font-size', '10.2px')
        .style('font-weight', '600')
        .text(`Carrega no Passo ${p.minStep + 1}`);
      return;
    }

    const isUp = p.aboveVal >= p.floorVal;
    const slopeColor = isUp ? SEMANTIC_PALETTE.emerald : SEMANTIC_PALETTE.female;
    const badgeW = Math.min(72, p.deltaText.length * 6.5 + 14);
    const badgeG = card.append('g').style('opacity', enteringNow ? 0 : 1);
    badgeG.append('rect')
      .attr('x', cardW - badgeW - 10)
      .attr('y', 10)
      .attr('width', badgeW)
      .attr('height', 18)
      .attr('rx', 9)
      .attr('fill', isUp ? 'rgba(0, 125, 91, 0.12)' : 'rgba(250, 83, 46, 0.14)');
    badgeG.append('text')
      .attr('x', cardW - 10 - badgeW / 2)
      .attr('y', 22)
      .attr('text-anchor', 'middle')
      .attr('fill', slopeColor)
      .style('font-size', '9.5px')
      .style('font-weight', '700')
      .text(p.deltaText);
    if (enteringNow) {
      badgeG.transition().duration(dur).delay(animDelay(staggerMs + 340)).ease(MOTION.easeOut).style('opacity', 1);
    }

    const minV = Math.min(p.floorVal, p.aboveVal);
    const maxV = Math.max(p.floorVal, p.aboveVal);
    const span = Math.max(1e-6, maxV - minV);
    const domLo = Math.max(0, minV - span * 0.45);
    const domHi = Math.max(domLo + 1e-6, maxV + span * 0.45);
    const yScale = d3.scaleLinear().domain([domLo, domHi]).range([yBot, yTop]);

    const yL = yScale(p.floorVal);
    const yR = yScale(p.aboveVal);

    // Linha conectora do Slopegraph
    const slopeLine = card.append('path')
      .attr('class', 'limiar-slope-line')
      .attr('d', `M ${xL},${yL} L ${xR},${yR}`)
      .attr('fill', 'none')
      .attr('stroke', slopeColor)
      .attr('stroke-width', 2.8)
      .attr('stroke-linecap', 'round');

    if (enteringNow) {
      drawPath(slopeLine, { duration: 480, delay: animDelay(staggerMs + 110) });
    }

    // Ponto e rótulo da esquerda (30%–33%)
    const dotL = card.append('circle')
      .attr('class', 'limiar-slope-dot')
      .attr('cx', xL)
      .attr('cy', yL)
      .attr('r', enteringNow ? 0 : 5.2)
      .attr('fill', SEMANTIC_PALETTE.highlight)
      .attr('stroke', SEMANTIC_PALETTE.highlightInk)
      .attr('stroke-width', 1.8);

    if (enteringNow) {
      dotL.transition().duration(240).delay(animDelay(staggerMs)).ease(MOTION.easeOut).attr('r', 5.2);
    }

    const leftLbl = card.append('text')
      .attr('x', xL - 9)
      .attr('y', yL + 4)
      .attr('text-anchor', 'end')
      .attr('fill', '#7A5200')
      .style('font-size', '10.8px')
      .style('font-weight', '700')
      .style('opacity', enteringNow ? 0 : 1)
      .text(p.fmt(p.floorVal));

    if (enteringNow) {
      leftLbl.transition().duration(240).delay(animDelay(staggerMs + 60)).ease(MOTION.easeOut).style('opacity', 1);
    }

    // Ponto e rótulo da direita (> 33%)
    const dotR = card.append('circle')
      .attr('class', 'limiar-slope-dot')
      .attr('cx', xR)
      .attr('cy', yR)
      .attr('r', enteringNow ? 0 : 5.6)
      .attr('fill', slopeColor)
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 1.6);

    if (enteringNow) {
      dotR.transition().duration(280).delay(animDelay(staggerMs + 340)).ease(MOTION.easeOut).attr('r', 5.6);
    }

    const rightLbl = card.append('text')
      .attr('x', xR + 9)
      .attr('y', yR + 4)
      .attr('text-anchor', 'start')
      .attr('fill', slopeColor)
      .style('font-size', '10.8px')
      .style('font-weight', '700')
      .style('opacity', enteringNow ? 0 : 1)
      .text(p.fmt(p.aboveVal));

    if (enteringNow) {
      rightLbl.transition().duration(240).delay(animDelay(staggerMs + 380)).ease(MOTION.easeOut).style('opacity', 1);
    }

    bindTooltipEvents(card.node(), tipCtrl, () => buildTooltipCard({
      title: `${p.title} (${year} · ${unitLabel})`,
      badge: `Δ >33% vs 30–33%: ${p.deltaText}`,
      badgeTone: isUp ? 'above' : 'below',
      columns: ['Indicador', '30%–33%', '> 33%'],
      rows: [
        ...p.rows.map((rr) => ({ cells: [rr.label, rr.f, { text: rr.a, cls: 'is-focus' }] })),
        { cells: [unitLabel, fmtInt(floor.units), fmtInt(above.units)] },
        { cells: ['Candidaturas APTO', fmtInt(floor.nApto), fmtInt(above.nApto)] },
      ],
      hint: `Excluídos < 30%: ${fmtInt(excludedBelow30)} ${unit === 'party' ? 'partidos' : 'chapas'}.`,
    }), { focusable: true });
  });

  svg.append('text')
    .attr('x', 2)
    .attr('y', svgH - 6)
    .attr('fill', SEMANTIC_PALETTE.muted)
    .style('font-size', '10px')
    .text(`Recorte ${unitLabel} (${year}): ${fmtInt(floor.units)} em 30%–33% vs. ${fmtInt(above.units)} em >33% (${fmtInt(excludedBelow30)} abaixo de 30% excluídas).`);
}
