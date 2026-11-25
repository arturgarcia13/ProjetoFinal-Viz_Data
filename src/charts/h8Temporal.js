import * as d3 from 'd3';
import { SEMANTIC_PALETTE } from './palette.js';
import {
  bindTooltipEvents,
  buildTooltipCard,
  createChartTooltip,
  fmtInt,
  fmtPct,
  fmtSignedPP,
} from './tooltip.js';

/**
 * H8 — Adaptação Tática 2018 → 2022 → 2026 em 2 painéis de linhas conectadas:
 * Painel 1: Contas zeradas (Sinal B, ↓) vs. Movimentações padronizadas em lote (Sinal C, ↑)
 * Painel 2: Combinação com baixa votação (A+B vs. A+C) em escala própria legível
 */
export function renderH8Temporal(container, h8Data, { width = 700 } = {}) {
  container.innerHTML = '';
  const byYear = h8Data?.byYear || {};
  const years = [2018, 2022, 2026].filter((yr) => byYear[yr] && byYear[yr].n > 0);
  if (years.length === 0) {
    container.innerHTML = '<p class="chart-empty">Sem dados comparativos entre 2018, 2022 e 2026 neste recorte.</p>';
    return;
  }

  const isStacked = width < 560;
  const panelGap = 28;
  const panelW = isStacked ? width : (width - panelGap) / 2;
  const panelH = 260;

  const panels = [
    {
      title: '1. Contas Zeradas (↓) vs. Lote Padronizado (↑)',
      shortTitle: '1. Zeradas (↓) vs. Lote (↑)',
      series: [
        {
          key: 'pctZero',
          countKey: 'zeroCount',
          label: 'Conta zerada (B)',
          shortLabel: 'Zerada (B)',
          color: SEMANTIC_PALETTE.alert,
        },
        {
          key: 'pctStd',
          countKey: 'stdCount',
          label: 'Lote padronizado (C)',
          shortLabel: 'Lote (C)',
          color: SEMANTIC_PALETTE.y2026,
        },
      ],
    },
    {
      title: '2. Combinados com Voto Baixo (≤ limiar)',
      shortTitle: '2. Combinados com Voto Baixo',
      series: [
        {
          key: 'pctClassic',
          countKey: 'classicCount',
          label: 'Zerada + ≤N votos (A+B)',
          shortLabel: 'Zerada + ≤N (A+B)',
          color: SEMANTIC_PALETTE.alert,
        },
        {
          key: 'pctAdapted',
          countKey: 'adaptedCount',
          label: 'Padronizada + ≤N votos (A+C)',
          shortLabel: 'Padron. + ≤N (A+C)',
          color: SEMANTIC_PALETTE.y2026,
        },
      ],
    },
  ];

  const gridWrap = document.createElement('div');
  gridWrap.className = isStacked ? 'h8-panels-grid is-stacked' : 'h8-panels-grid';
  container.appendChild(gridWrap);

  const isNarrowPanel = panelW < 380;

  panels.forEach((panel) => {
    const slot = document.createElement('div');
    slot.className = 'h8-panel-slot';
    gridWrap.appendChild(slot);

    const tipCtrl = createChartTooltip(slot);
    const margin = { top: 54, right: 20, bottom: 32, left: 42 };
    const plotW = Math.max(140, panelW - margin.left - margin.right);
    const plotH = panelH - margin.top - margin.bottom;

    const allVals = panel.series.flatMap((s) => years.map((yr) => (byYear[yr]?.[s.key] || 0) * 100));
    const maxVal = Math.max(2, d3.max(allVals) || 2);

    const x = d3.scalePoint().domain(years).range([margin.left + 12, margin.left + plotW - 12]).padding(0.15);
    const y = d3.scaleLinear().domain([0, maxVal * 1.24]).nice().range([margin.top + plotH, margin.top]);

    const svg = d3.select(tipCtrl.wrap).append('svg')
      .attr('class', 'h8-panel-svg')
      .attr('viewBox', `0 0 ${panelW} ${panelH}`)
      .attr('width', panelW)
      .attr('height', panelH)
      .attr('role', 'img')
      .attr('aria-label', panel.title)
      .style('font-family', 'Barlow, Inter, system-ui, sans-serif');

    svg.append('text')
      .attr('x', isNarrowPanel ? 10 : margin.left)
      .attr('y', 14)
      .attr('font-size', isNarrowPanel ? 10.2 : 11)
      .attr('font-weight', 700)
      .attr('fill', SEMANTIC_PALETTE.ink)
      .text(isNarrowPanel ? panel.shortTitle : panel.title);

    // Legenda compacta do painel sem corte horizontal
    const legStartX = isNarrowPanel ? 10 : margin.left;
    let lx = legStartX;
    let ly = 31;
    panel.series.forEach((s) => {
      const txt = isNarrowPanel ? s.shortLabel : s.label;
      const iw = txt.length * 5.6 + 22;
      if (lx > legStartX && lx + iw > panelW - 8) {
        lx = legStartX;
        ly += 14;
      }
      const g = svg.append('g').attr('transform', `translate(${lx}, ${ly})`);
      g.append('line').attr('x1', 0).attr('x2', 12).attr('y1', -4).attr('y2', -4).attr('stroke', s.color).attr('stroke-width', 2.8);
      g.append('circle').attr('cx', 6).attr('cy', -4).attr('r', 3.5).attr('fill', s.color);
      g.append('text').attr('x', 16).attr('y', 0).attr('font-size', isNarrowPanel ? 9.2 : 9.8).attr('font-weight', 600).attr('fill', s.color).text(txt);
      lx += iw + 10;
    });

    // Grade Y
    const yTicks = y.ticks(4);
    for (const t of yTicks) {
      const ty = y(t);
      svg.append('line')
        .attr('x1', margin.left).attr('x2', margin.left + plotW)
        .attr('y1', ty).attr('y2', ty)
        .attr('stroke', t === 0 ? SEMANTIC_PALETTE.subtle : SEMANTIC_PALETTE.grid);
      svg.append('text')
        .attr('x', margin.left - 6)
        .attr('y', ty + 3.5)
        .attr('text-anchor', 'end')
        .attr('font-size', 9.5)
        .attr('fill', SEMANTIC_PALETTE.muted)
        .text(`${t.toFixed(t % 1 === 0 ? 0 : 1).replace('.', ',')}%`);
    }

    // Eixo X
    for (const yr of years) {
      const tx = x(yr);
      svg.append('line')
        .attr('x1', tx).attr('x2', tx)
        .attr('y1', margin.top).attr('y2', margin.top + plotH)
        .attr('stroke', SEMANTIC_PALETTE.grid)
        .attr('stroke-dasharray', '3,3');
      svg.append('text')
        .attr('x', tx)
        .attr('y', margin.top + plotH + 17)
        .attr('text-anchor', 'middle')
        .attr('font-size', 10.5)
        .attr('font-weight', 700)
        .attr('fill', SEMANTIC_PALETTE.ink)
        .text(String(yr));
    }

    const lineGen = d3.line().x((d) => x(d.year)).y((d) => y(d.pct));

    panel.series.forEach((s, sIdx) => {
      const pts = years.map((yr) => ({
        year: yr,
        pct: (byYear[yr][s.key] || 0) * 100,
        count: byYear[yr][s.countKey] || 0,
        n: byYear[yr].n,
      }));

      svg.append('path')
        .datum(pts)
        .attr('fill', 'none')
        .attr('stroke', s.color)
        .attr('stroke-width', 2.8)
        .attr('d', lineGen);

      pts.forEach((pt) => {
        const cx = x(pt.year);
        const cy = y(pt.pct);
        const dot = svg.append('circle')
          .attr('class', 'h8-dot')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', 5)
          .attr('fill', s.color)
          .attr('stroke', SEMANTIC_PALETTE.surface)
          .attr('stroke-width', 1.4)
          .attr('tabindex', 0)
          .style('cursor', 'pointer');

        const otherS = panel.series[1 - sIdx];
        const otherCy = y((byYear[pt.year][otherS.key] || 0) * 100);
        const isClose = Math.abs(cy - otherCy) < 24;
        const placeBelow = isClose && cy > otherCy;
        const lblY = placeBelow
          ? Math.min(margin.top + plotH - 4, cy + 15)
          : Math.max(margin.top + 10, cy - 10);

        svg.append('text')
          .attr('x', cx)
          .attr('y', lblY)
          .attr('text-anchor', 'middle')
          .attr('font-size', 9.8)
          .attr('font-weight', 700)
          .attr('fill', s.color)
          .attr('stroke', SEMANTIC_PALETTE.surface)
          .attr('stroke-width', 2.8)
          .attr('paint-order', 'stroke')
          .style('pointer-events', 'none')
          .text(fmtPct(pt.pct, 1));

        bindTooltipEvents(dot.node(), tipCtrl, () => {
          const p18 = (byYear[2018]?.[s.key] || 0) * 100;
          const p22 = (byYear[2022]?.[s.key] || 0) * 100;
          const p26 = (byYear[2026]?.[s.key] || 0) * 100;
          return buildTooltipCard({
            title: s.label,
            badge: `Foco ${pt.year}`,
            badgeTone: s.color === SEMANTIC_PALETTE.alert ? 'below' : 'neutral',
            columns: ['Ano', '% APTO', 'Ocorrências', 'Universo'],
            rows: [
              { cells: ['2018', { text: fmtPct(p18, 2), cls: pt.year === 2018 ? 'is-focus' : '' }, fmtInt(byYear[2018]?.[s.countKey] || 0), fmtInt(byYear[2018]?.n || 0)] },
              { cells: ['2022', { text: fmtPct(p22, 2), cls: pt.year === 2022 ? 'is-focus' : '' }, fmtInt(byYear[2022]?.[s.countKey] || 0), fmtInt(byYear[2022]?.n || 0)] },
              { cells: ['2026', { text: fmtPct(p26, 2), cls: pt.year === 2026 ? 'is-focus' : '' }, fmtInt(byYear[2026]?.[s.countKey] || 0), fmtInt(byYear[2026]?.n || 0)] },
              { cells: ['Δ 2018→2026', fmtSignedPP(p26 - p18), '—', '—'] },
            ],
          });
        }, { focusable: true });
      });
    });
  });
}
