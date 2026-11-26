import * as d3 from 'd3';
import { SEMANTIC_PALETTE } from './palette.js';
import { addDirectAnnotation } from './annotate.js';
import { animDelay, animDur, MOTION, shouldAnimate } from './motion.js';
import { bindTooltipEvents, buildTooltipCard, createChartTooltip, fmtInt, fmtPct, fmtSignedPP } from './tooltip.js';

/**
 * H6 (Consolidado — Gráfico Único de Sinais de Alerta):
 * Compara a porcentagem de cada sinal (Sinal A, Sinal B, Sinal C e ≥2 sinais) entre
 * Mulheres (F) e Homens (M), evidenciando a proximidade/inconclusividade desses indicadores.
 */
export function renderH6Signals(container, h6Series, { step = 2, prevStep = 2, width = 720, year = 2022 } = {}) {
  container.innerHTML = '';
  const yObj = h6Series?.byYear?.[year] || h6Series?.byYear?.[2022];
  if (!yObj || (yObj.summary?.F?.n || 0) === 0) {
    container.innerHTML = '<p class="chart-empty">Sem candidaturas APTO suficientes neste recorte.</p>';
    return;
  }

  const sF = yObj.summary.F;
  const sM = yObj.summary.M;
  const pct = (count, n) => (n > 0 ? (count / n) * 100 : 0);

  const metrics = [
    {
      id: 'sigA',
      label: `Sinal A (≤${h6Series.voteThreshold} votos)`,
      short: `Sinal A (≤${h6Series.voteThreshold}v)`,
      fPct: pct(sF.sigA, sF.n),
      mPct: pct(sM.sigA, sM.n),
      fCount: sF.sigA,
      mCount: sM.sigA,
      minStep: 0,
    },
    {
      id: 'sigB',
      label: 'Sinal B (Receita R$ 0)',
      short: 'Sinal B (R$ 0)',
      fPct: pct(sF.sigB, sF.n),
      mPct: pct(sM.sigB, sM.n),
      fCount: sF.sigB,
      mCount: sM.sigB,
      minStep: 0,
    },
    {
      id: 'sigC',
      label: 'Sinal C (Lote padrão)',
      short: 'Sinal C (Lote)',
      fPct: pct(sF.sigC, sF.n),
      mPct: pct(sM.sigC, sM.n),
      fCount: sF.sigC,
      mCount: sM.sigC,
      minStep: 0,
    },
    {
      id: 'twoPlus',
      label: '≥ 2 Sinais combinados',
      short: '≥ 2 Sinais',
      fPct: yObj.pct2PlusF * 100,
      mPct: yObj.pct2PlusM * 100,
      fCount: sF.twoPlus,
      mCount: sM.twoPlus,
      minStep: 1,
    },
  ];

  const isCompact = width < 460;
  const margin = { top: 44, right: isCompact ? 16 : 26, bottom: 52, left: isCompact ? 42 : 50 };
  const svgW = width;
  const svgH = isCompact ? 300 : 350;
  const W = svgW - margin.left - margin.right;
  const H = svgH - margin.top - margin.bottom;

  const maxY = Math.max(44, (d3.max(metrics, (m) => Math.max(m.fPct, m.mPct)) || 40) * 1.18);
  const x0 = d3.scaleBand().domain(metrics.map((m) => m.id)).range([0, W]).padding(0.28);
  const x1 = d3.scaleBand().domain(['F', 'M']).range([0, x0.bandwidth()]).padding(0.14);
  const y = d3.scaleLinear().domain([0, maxY]).range([H, 0]);

  const tipCtrl = createChartTooltip(container, { wrapClass: 'h6-wrap' });
  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('class', 'h6-series-svg')
    .attr('viewBox', `0 0 ${svgW} ${svgH}`)
    .attr('width', svgW)
    .attr('height', svgH)
    .attr('role', 'img')
    .attr('aria-label', `Comparativo de sinais de alerta entre mulheres e homens em ${year}`)
    .style('font-family', 'Inter, system-ui, sans-serif');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  g.append('g')
    .call(d3.axisLeft(y).ticks(5).tickSize(-W).tickFormat((d) => `${Math.round(d)}%`))
    .call((a) => a.select('.domain').remove())
    .call((a) => a.selectAll('.tick line').attr('stroke', SEMANTIC_PALETTE.grid))
    .call((a) => a.selectAll('.tick text').attr('fill', SEMANTIC_PALETTE.muted).style('font-size', '10.5px'));

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -H / 2)
    .attr('y', isCompact ? -32 : -38)
    .attr('text-anchor', 'middle')
    .attr('fill', SEMANTIC_PALETTE.muted)
    .style('font-size', '10.5px')
    .style('font-weight', '600')
    .text(`% das candidaturas APTO (${year})`);

  g.append('g')
    .attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(x0).tickFormat((id) => {
      const m = metrics.find((item) => item.id === id);
      return isCompact ? (m?.short || id) : (m?.label || id);
    }))
    .call((a) => a.select('.domain').attr('stroke', '#CBD5E1'))
    .call((a) => a.selectAll('.tick text')
      .attr('fill', SEMANTIC_PALETTE.ink)
      .style('font-size', isCompact ? '9.2px' : '10.5px')
      .style('font-weight', '600'));

  const animate = shouldAnimate();
  const dur = animDur(480);

  metrics.forEach((m, idx) => {
    const grp = g.append('g')
      .attr('class', 'h6-signal-group')
      .attr('transform', `translate(${x0(m.id)},0)`);

    const isDimmed = step < m.minStep;
    const wasDimmed = prevStep < m.minStep;

    const pairs = [
      { g: 'F', label: 'Mulheres (F)', pct: m.fPct, count: m.fCount, n: sF.n, color: SEMANTIC_PALETTE.female },
      { g: 'M', label: 'Homens (M)', pct: m.mPct, count: m.mCount, n: sM.n, color: SEMANTIC_PALETTE.male },
    ];

    pairs.forEach((p, pIdx) => {
      const targetY = y(p.pct);
      const targetH = Math.max(2, H - targetY);
      const bar = grp.append('rect')
        .attr('class', `h6-dot h6-dot-${p.g}`)
        .attr('x', x1(p.g))
        .attr('width', x1.bandwidth())
        .attr('rx', 3)
        .attr('fill', p.color)
        .attr('opacity', animate ? (wasDimmed ? 0.2 : 1) : (isDimmed ? 0.2 : 1))
        .attr('y', animate && wasDimmed && !isDimmed ? H : targetY)
        .attr('height', animate && wasDimmed && !isDimmed ? 0 : targetH)
        .attr('tabindex', 0)
        .style('cursor', 'pointer');

      if (animate && wasDimmed !== isDimmed) {
        bar.transition().duration(dur).delay(animDelay(idx * 50 + pIdx * 40)).ease(MOTION.easeOut)
          .attr('opacity', isDimmed ? 0.2 : 1)
          .attr('y', targetY)
          .attr('height', targetH);
      }

      if (!isDimmed) {
        grp.append('text')
          .attr('x', x1(p.g) + x1.bandwidth() / 2)
          .attr('y', targetY - 5)
          .attr('text-anchor', 'middle')
          .attr('font-size', isCompact ? 8.8 : 10)
          .attr('font-weight', 700)
          .attr('fill', p.g === 'F' ? '#D93814' : SEMANTIC_PALETTE.male)
          .text(fmtPct(p.pct, 1));
      }

      const diffPP = m.fPct - m.mPct;
      bindTooltipEvents(bar.node(), tipCtrl, () => buildTooltipCard({
        title: `${year} · ${m.label}`,
        badge: `Δ F−M: ${fmtSignedPP(diffPP)}`,
        badgeTone: Math.abs(diffPP) < 3 ? 'neutral' : 'floor',
        columns: ['Grupo', '% APTO', 'Ocorrências', 'Universo'],
        rows: [
          {
            cells: [
              'Mulheres (F)',
              { text: fmtPct(m.fPct, 2), cls: p.g === 'F' ? 'is-focus' : '' },
              fmtInt(m.fCount),
              fmtInt(sF.n),
            ],
          },
          {
            cells: [
              'Homens (M)',
              { text: fmtPct(m.mPct, 2), cls: p.g === 'M' ? 'is-focus' : '' },
              fmtInt(m.mCount),
              fmtInt(sM.n),
            ],
          },
        ],
        hint: 'Taxas próximas entre gêneros: indicador isolado é inconclusivo.',
      }), { focusable: true });
    });
  });

  if (step >= 1 && !isCompact) {
    const two = metrics.find((m) => m.id === 'twoPlus');
    if (two) {
      const tx = x0('twoPlus') + x0.bandwidth() / 2;
      const ty = y(Math.max(two.fPct, two.mPct));
      addDirectAnnotation(g.append('g'), {
        x1: Math.max(12, tx - 30),
        y1: Math.max(14, ty - 56),
        x2: tx,
        y2: ty - 14,
        anchor: 'end',
        title: `Diferença mínima em ≥2 sinais (${year})`,
        subtitle: `F: ${fmtPct(two.fPct, 1)} vs. M: ${fmtPct(two.mPct, 1)} — inconclusivo`,
        color: '#7A5200',
        animate: prevStep === 0,
      });
    }
  }
}
