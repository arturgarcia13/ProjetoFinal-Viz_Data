import * as d3 from 'd3';
import { SEMANTIC_PALETTE } from './palette.js';
import { animDelay, animDur, drawPath, MOTION, shouldAnimate } from './motion.js';
import { bindTooltipEvents, buildTooltipCard, createChartTooltip, fmtInt, fmtPct, fmtSignedPP } from './tooltip.js';

/**
 * H8 (Hipótese 8) — Adaptação Tática 2018 → 2022 → 2026 (Contas Zeradas vs. Pacotes Padronizados em Lote).
 * - Passo 0: 2018 em cena (2022 e 2026 na base 0).
 * - Passo 1: Transição animada 2018 → 2022 → 2026 (barras de 2022 e 2026 crescem em sequência).
 * - Passo 2: Desenho contínuo da curva de soma combinada (B + C) de 2018 a 2026.
 */
export function renderH8Temporal(container, h8Data, { step = 2, prevStep = 2, width = 720 } = {}) {
  const byYear = h8Data?.byYear || {};
  const years = ['2018', '2022', '2026'].filter((yr) => byYear[yr] && byYear[yr].n > 0);
  if (years.length === 0) {
    container.__h8State = null;
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
  const maxVal = Math.max(42, (d3.max(series, (d) => d.combined) || 40) + 10);
  const y = d3.scaleLinear().domain([0, maxVal]).range([H, 0]);

  const sig = `${svgW}|${svgH}|${years.join(',')}|${maxVal.toFixed(2)}`;
  let st = container.__h8State;
  const isFreshMount = !st || st.sig !== sig || !container.querySelector('svg.h8-temporal-svg');

  if (isFreshMount) {
    container.innerHTML = '';
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

    const barsG = g.append('g');
    const lineG = g.append('g').attr('class', 'h8-combined-layer');
    const yearEls = new Map();

    st = {
      sig,
      svg,
      tipCtrl,
      barsG,
      lineG,
      yearEls,
      seriesByYr: new Map(),
      s18: null,
      renderedVisible: new Map(),
      lastStep: step,
    };
    container.__h8State = st;

    const itemDefs = [
      { key: 'zeroPct', label: 'Receita Zerada (Sinal B)', badge: 'Sinal B', tone: 'below', color: SEMANTIC_PALETTE.female },
      { key: 'minStdPct', label: 'Lote Padronizado (Sinal C)', badge: 'Sinal C', tone: 'floor', color: SEMANTIC_PALETTE.pinkDeep },
    ];

    series.forEach((d) => {
      const rowG = barsG.append('g')
        .attr('class', 'yr-g')
        .attr('data-year', d.yr)
        .attr('transform', `translate(${x0(d.yr)},0)`);

      const bars = {};
      const lbls = {};
      itemDefs.forEach((it) => {
        const rect = rowG.append('rect')
          .attr('class', 'h8-dot')
          .attr('data-metric', it.key)
          .attr('x', x1(it.key))
          .attr('width', x1.bandwidth())
          .attr('rx', 4)
          .attr('fill', it.color)
          .attr('y', H)
          .attr('height', 0)
          .attr('opacity', 0)
          .attr('tabindex', 0)
          .style('cursor', 'pointer');

        const lbl = rowG.append('text')
          .attr('x', x1(it.key) + x1.bandwidth() / 2)
          .attr('y', H - 5)
          .attr('text-anchor', 'middle')
          .attr('font-size', isCompact ? 9 : 10)
          .attr('font-weight', 700)
          .attr('fill', it.color)
          .style('pointer-events', 'none')
          .style('opacity', 0);

        bindTooltipEvents(rect.node(), tipCtrl, () => {
          const cur = st.seriesByYr.get(d.yr);
          const cur18 = st.s18;
          if (!cur) return '';
          const val = cur[it.key];
          const count = it.key === 'zeroPct' ? cur.zeroCount : cur.stdCount;
          return buildTooltipCard({
            title: `Eleições ${cur.yr} · Mulheres APTO`,
            badge: it.badge,
            badgeTone: it.tone,
            rows: [
              { label: it.label, value: fmtPct(val, 1), sub: `${fmtInt(count)} de ${fmtInt(cur.n)}`, focus: true },
              { label: 'Soma combinada (B + C)', value: fmtPct(cur.combined, 1) },
              ...(cur18 && cur.yr !== '2018'
                ? [{ label: 'Δ vs. 2018', value: fmtSignedPP(val - cur18[it.key]) }]
                : []),
            ],
          });
        }, { focusable: true });

        bars[it.key] = rect;
        lbls[it.key] = lbl;
      });

      yearEls.set(d.yr, { rowG, bars, lbls });
      st.renderedVisible.set(d.yr, false);
    });
  }

  st.seriesByYr = new Map(series.map((s) => [s.yr, s]));
  st.s18 = series[0];

  const animate = shouldAnimate();
  const dur = animDur(560);
  const showCombined = step >= 2;
  const wasCombined = !isFreshMount && st.lastStep >= 2 && prevStep >= 2;

  series.forEach((d, yIdx) => {
    const els = st.yearEls.get(d.yr);
    if (!els) return;
    const isVisible = d.yr === '2018' || step >= 1;
    const wasVisible = Boolean(st.renderedVisible.get(d.yr));

    ['zeroPct', 'minStdPct'].forEach((k, mIdx) => {
      const val = d[k];
      const rect = els.bars[k];
      const lbl = els.lbls[k];
      const targetY = isVisible ? y(val) : H;
      const targetH = isVisible ? Math.max(0, H - y(val)) : 0;
      const delay = animDelay((d.yr === '2018' ? 0 : yIdx * 130) + mIdx * 65);

      rect.interrupt();
      lbl.interrupt();
      rect.attr('tabindex', isVisible ? 0 : -1);

      if (animate && (isVisible !== wasVisible || isFreshMount)) {
        rect.transition().duration(dur).delay(delay).ease(MOTION.easeOut)
          .attr('opacity', isVisible ? 1 : 0)
          .attr('y', targetY)
          .attr('height', targetH);

        if (isVisible) {
          lbl
            .attr('y', targetY - 5)
            .text(fmtPct(val, 1))
            .transition().duration(280).delay(delay + 200)
            .style('opacity', 1);
        } else {
          lbl.transition().duration(180).style('opacity', 0);
        }
      } else {
        rect
          .attr('opacity', isVisible ? 1 : 0)
          .attr('y', targetY)
          .attr('height', targetH);
        lbl
          .attr('y', targetY - 5)
          .style('opacity', isVisible ? 1 : 0)
          .text(isVisible ? fmtPct(val, 1) : '');
      }
    });

    st.renderedVisible.set(d.yr, isVisible);
  });

  // Curva da soma combinada (B + C) desenhada progressivamente de 2018 a 2026 no Passo 3
  st.lineG.selectAll('*').remove();
  if (showCombined) {
    const animateLine = animate && !wasCombined;
    const lineGen = d3.line()
      .x((d) => x0(d.yr) + x0.bandwidth() / 2)
      .y((d) => y(d.combined));

    const combPath = st.lineG.append('path')
      .datum(series)
      .attr('d', lineGen)
      .attr('fill', 'none')
      .attr('stroke', SEMANTIC_PALETTE.male)
      .attr('stroke-width', 2.4)
      .attr('stroke-dasharray', '5,4');
    if (animateLine) drawPath(combPath, { duration: 680, preserveDash: '5,4' });

    series.forEach((d, idx) => {
      const delay = animDelay(idx * 160);
      const dot = st.lineG.append('circle')
        .attr('cx', x0(d.yr) + x0.bandwidth() / 2)
        .attr('cy', y(d.combined))
        .attr('r', animateLine ? 0 : 4.5)
        .attr('fill', SEMANTIC_PALETTE.male);
      const txt = st.lineG.append('text')
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

  st.lastStep = step;
}
