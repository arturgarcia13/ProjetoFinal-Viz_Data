import * as d3 from 'd3';
import { SEMANTIC_PALETTE } from './palette.js';
import { addDirectAnnotation } from './annotate.js';
import { animDelay, animDur, drawPath, MOTION, shouldAnimate } from './motion.js';
import { bindTooltipEvents, buildTooltipCard, createChartTooltip, fmtInt, fmtPct, fmtSignedPP } from './tooltip.js';

/**
 * H8 — Adaptação Tática 2018 → 2022 → 2026 (Contas Zeradas vs. Pacotes Padronizados em Lote).
 * Passo 0: 2018 e 2022 · Passo 1: iluminação suave de 2026 · Passo 2: desenho da soma combinada.
 */
export function renderH8Temporal(container, h8Data, { step = 2, prevStep = 2, width = 720 } = {}) {
  container.innerHTML = '';
  const byYear = h8Data?.byYear || {};
  const years = ['2018', '2022', '2026'].filter((yr) => byYear[yr] && byYear[yr].n > 0);
  if (years.length === 0) {
    container.innerHTML = '<p class="chart-empty">Sem dados comparativos entre 2018, 2022 e 2026 neste recorte.</p>';
    return;
  }

  const series = years.map((yr) => {
    const d = byYear[yr];
    const zeroPct = (d.pctZero || 0) * 100;
    const minStdPct = (d.pctStd || 0) * 100;
    return {
      yr,
      n: d.n,
      zeroCount: d.zeroCount || 0,
      stdCount: d.stdCount || 0,
      zeroPct,
      minStdPct,
      combined: zeroPct + minStdPct,
    };
  });

  const isCompact = width < 460;
  const margin = { top: 38, right: isCompact ? 16 : 28, bottom: 48, left: 48 };
  const svgW = width;
  const svgH = isCompact ? 305 : 375;
  const W = svgW - margin.left - margin.right;
  const H = svgH - margin.top - margin.bottom;

  const x0 = d3.scaleBand().domain(years).range([0, W]).padding(0.32);
  const x1 = d3.scaleBand().domain(['zeroPct', 'minStdPct']).range([0, x0.bandwidth()]).padding(0.14);
  const maxVal = Math.max(42, (d3.max(series, (d) => d.combined) || 40) + 8);
  const y = d3.scaleLinear().domain([0, maxVal]).range([H, 0]);

  const tipCtrl = createChartTooltip(container, { wrapClass: 'h8-wrap' });
  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('class', 'h8-temporal-svg')
    .attr('viewBox', `0 0 ${svgW} ${svgH}`)
    .attr('width', svgW)
    .attr('height', svgH)
    .attr('role', 'img')
    .attr('aria-label', 'Evolução 2018 a 2026 de contas zeradas e movimentações padronizadas em lote entre mulheres APTO')
    .style('font-family', 'Inter, system-ui, sans-serif');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  g.append('g')
    .call(d3.axisLeft(y).ticks(5).tickSize(-W).tickFormat((d) => `${d}%`))
    .call((a) => a.select('.domain').remove())
    .call((a) => a.selectAll('.tick line').attr('stroke', SEMANTIC_PALETTE.grid))
    .call((a) => a.selectAll('.tick text').attr('fill', SEMANTIC_PALETTE.muted).style('font-size', '10.5px'));

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -H / 2)
    .attr('y', -36)
    .attr('text-anchor', 'middle')
    .attr('fill', SEMANTIC_PALETTE.muted)
    .style('font-size', '10.5px')
    .style('font-weight', '600')
    .text('% das candidatas mulheres APTO');

  g.append('g')
    .attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(x0))
    .call((a) => a.select('.domain').attr('stroke', '#CBD5E1'))
    .call((a) => a.selectAll('.tick text').attr('fill', SEMANTIC_PALETTE.ink).style('font-size', '12px').style('font-weight', '700'));

  const animate = shouldAnimate();
  const dur = animDur(500);
  const barsG = g.append('g');
  const grp = barsG.selectAll('.yr-g')
    .data(series)
    .enter()
    .append('g')
    .attr('transform', (d) => `translate(${x0(d.yr)},0)`);

  grp.each(function (d) {
    const rowG = d3.select(this);
    const items = [
      { key: 'zeroPct', label: 'Receita Zerada (Sinal B)', val: d.zeroPct, count: d.zeroCount, color: SEMANTIC_PALETTE.female },
      { key: 'minStdPct', label: 'Lote Padronizado (Sinal C)', val: d.minStdPct, count: d.stdCount, color: SEMANTIC_PALETTE.pinkDeep },
    ];

    items.forEach((it, idx) => {
      const wasDimmed = prevStep === 0 && d.yr === '2026';
      const isDimmed = step === 0 && d.yr === '2026';
      const rect = rowG.append('rect')
        .attr('class', 'h8-dot')
        .attr('x', x1(it.key))
        .attr('width', x1.bandwidth())
        .attr('rx', 4)
        .attr('fill', it.color)
        .attr('opacity', animate ? (wasDimmed ? 0.2 : 1) : (isDimmed ? 0.2 : 1))
        .attr('y', y(it.val))
        .attr('height', H - y(it.val))
        .attr('tabindex', 0)
        .style('cursor', 'pointer');

      if (animate && wasDimmed !== isDimmed) {
        rect.transition().duration(dur).delay(animDelay(idx * 70)).ease(MOTION.easeOut)
          .attr('opacity', isDimmed ? 0.2 : 1);
      }

      if (!isDimmed) {
        const lbl = rowG.append('text')
          .attr('x', x1(it.key) + x1.bandwidth() / 2)
          .attr('y', y(it.val) - 5)
          .attr('text-anchor', 'middle')
          .attr('font-size', isCompact ? 9 : 10)
          .attr('font-weight', 700)
          .attr('fill', it.color)
          .style('opacity', animate && wasDimmed ? 0 : 1)
          .text(fmtPct(it.val, 1));
        if (animate && wasDimmed) {
          lbl.transition().duration(260).delay(180).style('opacity', 1);
        }
      }

      const s18 = series[0];
      bindTooltipEvents(rect.node(), tipCtrl, () => buildTooltipCard({
        title: `Eleições ${d.yr} · Mulheres APTO`,
        badge: it.key === 'zeroPct' ? 'Sinal B' : 'Sinal C',
        badgeTone: it.key === 'zeroPct' ? 'below' : 'floor',
        rows: [
          { label: it.label, value: fmtPct(it.val, 1), sub: `${fmtInt(it.count)} de ${fmtInt(d.n)}`, focus: true },
          { label: 'Soma combinada (B + C)', value: fmtPct(d.combined, 1) },
          ...(s18 && d.yr !== '2018'
            ? [{ label: 'Δ vs. 2018', value: fmtSignedPP(it.val - s18[it.key]) }]
            : []),
        ],
      }), { focusable: true });
    });
  });

  if (step >= 2) {
    const animateLine = animate && prevStep < 2;
    const lineGen = d3.line()
      .x((d) => x0(d.yr) + x0.bandwidth() / 2)
      .y((d) => y(d.combined));

    const combPath = barsG.append('path')
      .datum(series)
      .attr('d', lineGen)
      .attr('fill', 'none')
      .attr('stroke', SEMANTIC_PALETTE.male)
      .attr('stroke-width', 2.4)
      .attr('stroke-dasharray', '5,4');
    if (animateLine) drawPath(combPath, { duration: 640, preserveDash: '5,4' });

    series.forEach((d, idx) => {
      const delay = animDelay(idx * 150);
      const dot = barsG.append('circle')
        .attr('cx', x0(d.yr) + x0.bandwidth() / 2)
        .attr('cy', y(d.combined))
        .attr('r', animateLine ? 0 : 4.5)
        .attr('fill', SEMANTIC_PALETTE.male);
      const txt = barsG.append('text')
        .attr('x', x0(d.yr) + x0.bandwidth() / 2)
        .attr('y', y(d.combined) - 9)
        .attr('text-anchor', 'middle')
        .attr('fill', SEMANTIC_PALETTE.male)
        .style('font-size', isCompact ? '9.5px' : '10.5px')
        .style('font-weight', '700')
        .attr('paint-order', 'stroke')
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', 3)
        .style('opacity', animateLine ? 0 : 1)
        .text(`Total: ${fmtPct(d.combined, 1)}`);
      if (animateLine) {
        dot.transition().duration(300).delay(delay).ease(MOTION.easeOut).attr('r', 4.5);
        txt.transition().duration(260).delay(delay + 120).style('opacity', 1);
      }
    });
  }

  if (step >= 1 && !isCompact) {
    const s26 = series.find((s) => s.yr === '2026');
    if (s26) {
      const tx = x0('2026') + x1('minStdPct') + x1.bandwidth() / 2;
      const ty = y(s26.minStdPct);
      addDirectAnnotation(g.append('g'), {
        anchor: 'end',
        x1: tx - 20,
        y1: Math.max(26, ty - 28),
        x2: tx - 4,
        y2: ty - 4,
        title: 'Salto nos lotes padronizados',
        subtitle: `2026 atinge ${fmtPct(s26.minStdPct, 1)}`,
        color: '#B8299E',
        animate: prevStep === 0,
      });
    }
  }
}
