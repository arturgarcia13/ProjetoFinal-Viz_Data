import * as d3 from 'd3';
import { SEMANTIC_PALETTE } from './palette.js';
import { animDelay, animDur, MOTION, shouldAnimate } from './motion.js';
import { bindTooltipEvents, buildTooltipCard, createChartTooltip, fmtCompactBrl, fmtInt, fmtPct, fmtSignedPP } from './tooltip.js';

/**
 * Ato 4B — Comparativo 30%–33% vs. > 33% (excluindo < 30%) em 4 dimensões:
 * 1. Investimento Mediano (F)
 * 2. Proporcionalidade do Fundo Público (F)
 * 3. Distribuição do Investimento (Concentração Top 10%)
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
  const cardH = 148;
  const gap = 14;
  const svgW = width;
  const svgH = cols === 1 ? (cardH + gap) * 4 - gap + 28 : (cardH + gap) * 2 - gap + 28;

  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('class', 'limiar-compare-svg')
    .attr('viewBox', `0 0 ${svgW} ${svgH}`)
    .attr('width', svgW)
    .attr('height', svgH)
    .attr('role', 'img')
    .attr('aria-label', `Comparativo 30%–33% versus acima de 33% (${unitLabel}) em ${year}`)
    .style('font-family', 'Inter, system-ui, sans-serif');

  const animate = shouldAnimate();
  const dur = animDur(460);

  panels.forEach((p, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const gx = col * (cardW + gap);
    const gy = row * (cardH + gap);
    const isDimmed = step < p.minStep;
    const wasDimmed = prevStep < p.minStep;

    const card = svg.append('g')
      .attr('class', 'limiar-panel')
      .attr('transform', `translate(${gx},${gy})`)
      .style('opacity', animate ? (wasDimmed ? 0.28 : 1) : (isDimmed ? 0.28 : 1))
      .style('cursor', 'pointer');

    if (animate && wasDimmed !== isDimmed) {
      card.transition().duration(dur).ease(MOTION.easeOut).style('opacity', isDimmed ? 0.28 : 1);
    }

    card.append('rect')
      .attr('x', 0.5)
      .attr('y', 0.5)
      .attr('width', cardW - 1)
      .attr('height', cardH - 1)
      .attr('rx', 8)
      .attr('fill', SEMANTIC_PALETTE.surfaceAlt)
      .attr('stroke', '#D8E6DF');

    card.append('text')
      .attr('x', 12)
      .attr('y', 21)
      .attr('fill', SEMANTIC_PALETTE.ink)
      .style('font-size', '11.5px')
      .style('font-weight', '700')
      .text(p.title);

    card.append('text')
      .attr('x', 12)
      .attr('y', 36)
      .attr('fill', SEMANTIC_PALETTE.muted)
      .style('font-size', '10px')
      .text(p.subtitle);

    // Badge delta no canto superior direito
    const badgeW = Math.min(72, p.deltaText.length * 6.5 + 14);
    card.append('rect')
      .attr('x', cardW - badgeW - 10)
      .attr('y', 10)
      .attr('width', badgeW)
      .attr('height', 18)
      .attr('rx', 9)
      .attr('fill', 'rgba(0, 125, 91, 0.12)');
    card.append('text')
      .attr('x', cardW - 10 - badgeW / 2)
      .attr('y', 22)
      .attr('text-anchor', 'middle')
      .attr('fill', SEMANTIC_PALETTE.emerald)
      .style('font-size', '9.5px')
      .style('font-weight', '700')
      .text(p.deltaText);

    const barMax = Math.max(1e-6, Math.max(p.floorVal, p.aboveVal) * 1.18);
    const labelW = 68;
    const valSpace = 66;
    const trackW = Math.max(60, cardW - labelW - valSpace - 24);
    const xScale = d3.scaleLinear().domain([0, barMax]).range([0, trackW]);

    const rowsData = [
      { label: '30%–33%', val: p.floorVal, color: SEMANTIC_PALETTE.highlightInk, bg: SEMANTIC_PALETTE.highlight },
      { label: '> 33%', val: p.aboveVal, color: SEMANTIC_PALETTE.emerald, bg: SEMANTIC_PALETTE.emerald },
    ];

    rowsData.forEach((r, rIdx) => {
      const ry = 58 + rIdx * 38;
      card.append('text')
        .attr('x', 12)
        .attr('y', ry + 15)
        .attr('fill', SEMANTIC_PALETTE.ink)
        .style('font-size', '10.5px')
        .style('font-weight', '700')
        .text(r.label);

      card.append('rect')
        .attr('x', labelW)
        .attr('y', ry + 2)
        .attr('width', trackW)
        .attr('height', 18)
        .attr('rx', 4)
        .attr('fill', '#E6EEEA');

      const bw = Math.max(3, xScale(r.val));
      const bar = card.append('rect')
        .attr('x', labelW)
        .attr('y', ry + 2)
        .attr('width', animate && !isDimmed && wasDimmed ? 0 : bw)
        .attr('height', 18)
        .attr('rx', 4)
        .attr('fill', r.bg)
        .attr('stroke', r.color)
        .attr('stroke-width', 0.8);

      if (animate && !isDimmed && wasDimmed) {
        bar.transition().duration(dur).delay(animDelay(rIdx * 70)).ease(MOTION.easeOut).attr('width', bw);
      }

      card.append('text')
        .attr('x', labelW + trackW + 8)
        .attr('y', ry + 15)
        .attr('fill', r.color === SEMANTIC_PALETTE.highlightInk ? '#7A5200' : SEMANTIC_PALETTE.emerald)
        .style('font-size', '11px')
        .style('font-weight', '700')
        .text(p.fmt(r.val));
    });

    bindTooltipEvents(card.node(), tipCtrl, () => buildTooltipCard({
      title: `${p.title} (${year} · ${unitLabel})`,
      badge: `Δ >33% vs 30–33%: ${p.deltaText}`,
      badgeTone: 'above',
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
