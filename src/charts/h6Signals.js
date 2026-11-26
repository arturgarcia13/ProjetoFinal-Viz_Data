import * as d3 from 'd3';
import * as Plot from '@observablehq/plot';
import { SEMANTIC_PALETTE } from './palette.js';
import { addDirectAnnotation } from './annotate.js';
import { bindTooltipEvents, buildTooltipCard, createChartTooltip, fmtInt, fmtPct, fmtRatio } from './tooltip.js';

/**
 * H6 — Série Histórica 2018 → 2022 → 2026 (Observable Plot + D3):
 * % de candidaturas APTO com ≥2 sinais (Sinal A ≤ limiar + Sinal B ou C) por gênero.
 */
export function renderH6Signals(container, h6Series, { step = 2, width = 720 } = {}) {
  container.innerHTML = '';
  const years = h6Series?.years || [2018, 2022, 2026];
  const byYear = h6Series?.byYear || {};

  const hasData = years.some((yr) => (byYear[yr]?.summary?.F?.n || 0) > 0);
  if (!hasData) {
    container.innerHTML = '<p class="chart-empty">Sem candidaturas APTO suficientes neste recorte.</p>';
    return;
  }

  const pts = [];
  for (const yr of years) {
    const yObj = byYear[yr];
    if (!yObj) continue;
    pts.push(
      {
        year: yr,
        yearLabel: yr === 2018 ? '2018 (colig.)' : String(yr),
        g: 'F',
        gender: 'Mulheres',
        pct: yObj.pct2PlusF * 100,
        count: yObj.summary.F.twoPlus,
        n: yObj.summary.F.n,
        otherPct: yObj.pct2PlusM * 100,
        otherCount: yObj.summary.M.twoPlus,
        otherN: yObj.summary.M.n,
        ratio: yObj.ratio2Plus,
      },
      {
        year: yr,
        yearLabel: yr === 2018 ? '2018 (colig.)' : String(yr),
        g: 'M',
        gender: 'Homens',
        pct: yObj.pct2PlusM * 100,
        count: yObj.summary.M.twoPlus,
        n: yObj.summary.M.n,
        otherPct: yObj.pct2PlusF * 100,
        otherCount: yObj.summary.F.twoPlus,
        otherN: yObj.summary.F.n,
        ratio: yObj.ratio2Plus,
      },
    );
  }

  const isCompact = width < 460;
  const height = isCompact ? 290 : 340;
  const maxY = Math.max(3.5, (d3.max(pts, (d) => d.pct) || 3.5) * 1.42);
  const showSeries = step >= 1;

  const tipCtrl = createChartTooltip(container, { wrapClass: 'h6-wrap' });
  const plotSvg = Plot.plot({
    width,
    height,
    marginTop: 48,
    marginRight: isCompact ? 28 : 42,
    marginBottom: 42,
    marginLeft: isCompact ? 42 : 52,
    style: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: isCompact ? '10px' : '11px',
      background: 'transparent',
      color: SEMANTIC_PALETTE.ink,
      overflow: 'visible',
    },
    x: {
      type: 'point',
      domain: years,
      padding: 0.25,
      tickFormat: (yr) => (yr === 2018 ? (isCompact ? '2018' : '2018 (coligações)') : String(yr)),
      label: null,
    },
    y: {
      domain: [0, maxY],
      grid: true,
      tickFormat: (d) => `${Number(d).toFixed(d % 1 === 0 ? 0 : 1).replace('.', ',')}%`,
      label: '% APTO com ≥2 sinais',
    },
    color: {
      domain: ['Mulheres', 'Homens'],
      range: [SEMANTIC_PALETTE.female, SEMANTIC_PALETTE.male],
    },
    marks: [
      Plot.ruleY([0], { stroke: SEMANTIC_PALETTE.subtle }),
      ...(showSeries
        ? [
            Plot.line(pts, { x: 'year', y: 'pct', stroke: 'gender', strokeWidth: 3 }),
            Plot.dot(pts, { x: 'year', y: 'pct', fill: 'gender', stroke: '#FFFFFF', strokeWidth: 1.8, r: 6 }),
          ]
        : []),
    ],
  });

  plotSvg.classList.add('h6-series-svg');
  tipCtrl.wrap.appendChild(plotSvg);

  const svg = d3.select(plotSvg);
  // Posições X reais a partir das linhas de eixo ou escala compatível
  const xPos = d3.scalePoint()
    .domain(years)
    .range([isCompact ? 42 : 52, width - (isCompact ? 28 : 42)])
    .padding(0.25);
  const yPos = d3.scaleLinear()
    .domain([0, maxY])
    .range([height - 42, 48]);

  // Marco institucional entre 2018 e 2022
  const mx = (xPos(2018) + xPos(2022)) / 2;
  svg.append('line')
    .attr('x1', mx)
    .attr('x2', mx)
    .attr('y1', 42)
    .attr('y2', height - 42)
    .attr('stroke', SEMANTIC_PALETTE.emerald)
    .attr('stroke-dasharray', '4,4')
    .attr('stroke-width', 1.5);
  svg.append('text')
    .attr('x', mx)
    .attr('y', 34)
    .attr('text-anchor', 'middle')
    .attr('fill', SEMANTIC_PALETTE.emerald)
    .style('font-size', isCompact ? '9px' : '10.5px')
    .style('font-weight', '700')
    .text(isCompact ? 'ADI 5617 / Súm. 73' : 'ADI 5617 + Súmula 73');

  if (showSeries) {
    // Adiciona classe e tooltip nos círculos gerados pelo Observable Plot
    const dots = svg.selectAll('g[aria-label="dot"] circle');
    dots.each(function (d, idx) {
      const pt = pts[idx];
      if (!pt) return;
      d3.select(this)
        .attr('class', `h6-dot h6-dot-${pt.g}`)
        .attr('tabindex', 0)
        .style('cursor', 'pointer');

      const cx = Number(d3.select(this).attr('cx'));
      const cy = Number(d3.select(this).attr('cy'));
      const otherCy = yPos(pt.otherPct);
      const isUpper = Math.abs(cy - otherCy) < 2 ? pt.g === 'F' : cy <= otherCy;
      const lblY = isUpper ? Math.max(54, cy - 11) : Math.min(height - 48, cy + 16);

      svg.append('text')
        .attr('x', cx)
        .attr('y', lblY)
        .attr('text-anchor', 'middle')
        .attr('font-size', isCompact ? 9 : 10)
        .attr('font-weight', 700)
        .attr('fill', pt.g === 'F' ? '#D93814' : SEMANTIC_PALETTE.male)
        .attr('paint-order', 'stroke')
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', 3)
        .style('pointer-events', 'none')
        .text(fmtPct(pt.pct, 2));

      bindTooltipEvents(this, tipCtrl, () => buildTooltipCard({
        title: `${pt.year} · ≥2 sinais (Limiar ≤ ${h6Series.voteThreshold}v)`,
        badge: `Razão ${fmtRatio(pt.ratio)}`,
        badgeTone: pt.ratio >= 2 ? 'below' : 'above',
        columns: ['Indicador', { text: 'Mulheres', cls: pt.g === 'F' ? 'is-focus' : '' }, { text: 'Homens', cls: pt.g === 'M' ? 'is-focus' : '' }],
        rows: [
          {
            cells: [
              '% ≥ 2 sinais',
              { text: fmtPct(pt.g === 'F' ? pt.pct : pt.otherPct, 2), cls: pt.g === 'F' ? 'is-focus' : '' },
              { text: fmtPct(pt.g === 'M' ? pt.pct : pt.otherPct, 2), cls: pt.g === 'M' ? 'is-focus' : '' },
            ],
          },
          {
            cells: [
              'Candidaturas ≥2',
              fmtInt(pt.g === 'F' ? pt.count : pt.otherCount),
              fmtInt(pt.g === 'M' ? pt.count : pt.otherCount),
            ],
          },
          {
            cells: ['Universo APTO', fmtInt(byYear[pt.year].summary.F.n), fmtInt(byYear[pt.year].summary.M.n)],
          },
        ],
      }), { focusable: true });
    });

    // Pílulas de razão F/M
    years.forEach((yr) => {
      const y2 = byYear[yr];
      if (!y2) return;
      const tx = xPos(yr);
      const yf = yPos(y2.pct2PlusF * 100);
      const ym = yPos(y2.pct2PlusM * 100);
      const pillY = Math.max(54, Math.min(yf, ym) - 34);
      const pw = 56;

      svg.append('rect')
        .attr('x', tx - pw / 2)
        .attr('y', pillY)
        .attr('width', pw)
        .attr('height', 17)
        .attr('rx', 8.5)
        .attr('fill', y2.ratio2Plus >= 2 ? SEMANTIC_PALETTE.highlight : '#E2ECE7')
        .attr('stroke', y2.ratio2Plus >= 2 ? SEMANTIC_PALETTE.highlightInk : SEMANTIC_PALETTE.male)
        .attr('stroke-width', 1);

      svg.append('text')
        .attr('x', tx)
        .attr('y', pillY + 12)
        .attr('text-anchor', 'middle')
        .attr('font-size', 9.5)
        .attr('font-weight', 700)
        .attr('fill', y2.ratio2Plus >= 2 ? '#7A5200' : SEMANTIC_PALETTE.ink)
        .text(`${y2.ratio2Plus.toFixed(1).replace('.', ',')}× F/M`);
    });
  }

  if (step >= 2 && !isCompact) {
    const y26 = byYear[2026];
    const y18 = byYear[2018];
    if (y26 && y18) {
      addDirectAnnotation(svg.append('g'), {
        x1: xPos(2026) - 18,
        y1: Math.max(52, yPos(y26.pct2PlusF * 100) - 56),
        x2: xPos(2026) - 3,
        y2: yPos(y26.pct2PlusF * 100) - 6,
        anchor: 'end',
        title: `Queda de ${y18.ratio2Plus.toFixed(1).replace('.', ',')}× para ${y26.ratio2Plus.toFixed(1).replace('.', ',')}×`,
        subtitle: 'Sinal B e C são excludentes no TSE',
        color: SEMANTIC_PALETTE.emerald,
      });
    }
  }
}
