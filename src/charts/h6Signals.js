import * as d3 from 'd3';
import { SEMANTIC_PALETTE } from './palette.js';
import {
  bindTooltipEvents,
  buildTooltipCard,
  createChartTooltip,
  fmtInt,
  fmtPct,
  fmtRatio,
} from './tooltip.js';

/**
 * H6 — Série Temporal 2018 → 2022 → 2026:
 * % de candidaturas APTO com ≥2 sinais de alerta (Mulheres Rosa vs. Homens Amarelo)
 * Evidencia a queda da razão F/M de ~9,1× (2018) para ~1,1× (2026), sem barra de 0 sinais.
 */
export function renderH6Signals(container, h6Series, { width = 700 } = {}) {
  container.innerHTML = '';
  const years = h6Series?.years || [2018, 2022, 2026];
  const byYear = h6Series?.byYear || {};

  const hasData = years.some((yr) => (byYear[yr]?.summary?.F?.n || 0) > 0);
  if (!hasData) {
    container.innerHTML = '<p class="chart-empty">Sem candidaturas APTO suficientes neste recorte.</p>';
    return;
  }

  const seriesData = [
    {
      key: 'F',
      label: 'Mulheres',
      color: SEMANTIC_PALETTE.women,
      values: years.map((yr) => ({
        year: yr,
        pct: (byYear[yr]?.pct2PlusF || 0) * 100,
        count: byYear[yr]?.summary?.F?.twoPlus || 0,
        n: byYear[yr]?.summary?.F?.n || 0,
        sigA: byYear[yr]?.summary?.F?.sigA || 0,
        sigB: byYear[yr]?.summary?.F?.sigB || 0,
        sigC: byYear[yr]?.summary?.F?.sigC || 0,
        otherPct: (byYear[yr]?.pct2PlusM || 0) * 100,
        otherCount: byYear[yr]?.summary?.M?.twoPlus || 0,
        otherN: byYear[yr]?.summary?.M?.n || 0,
        ratio: byYear[yr]?.ratio2Plus || 0,
      })),
    },
    {
      key: 'M',
      label: 'Homens',
      color: SEMANTIC_PALETTE.men,
      values: years.map((yr) => ({
        year: yr,
        pct: (byYear[yr]?.pct2PlusM || 0) * 100,
        count: byYear[yr]?.summary?.M?.twoPlus || 0,
        n: byYear[yr]?.summary?.M?.n || 0,
        sigA: byYear[yr]?.summary?.M?.sigA || 0,
        sigB: byYear[yr]?.summary?.M?.sigB || 0,
        sigC: byYear[yr]?.summary?.M?.sigC || 0,
        otherPct: (byYear[yr]?.pct2PlusF || 0) * 100,
        otherCount: byYear[yr]?.summary?.F?.twoPlus || 0,
        otherN: byYear[yr]?.summary?.F?.n || 0,
        ratio: byYear[yr]?.ratio2Plus || 0,
      })),
    },
  ];

  const isCompact = width < 460;
  const margin = { top: 56, right: isCompact ? 34 : 52, bottom: 42, left: isCompact ? 46 : 56 };
  const height = 315;
  const plotW = Math.max(180, width - margin.left - margin.right);
  const plotH = height - margin.top - margin.bottom;

  const maxY = Math.max(3.5, d3.max(seriesData.flatMap((s) => s.values.map((v) => v.pct))) || 3.5);
  const x = d3.scalePoint().domain(years).range([margin.left + 20, margin.left + plotW - 20]).padding(0.15);
  const y = d3.scaleLinear().domain([0, maxY * 1.38]).nice().range([margin.top + plotH, margin.top]);

  const tipCtrl = createChartTooltip(container);
  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('class', 'h6-series-svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', width)
    .attr('height', height)
    .attr('role', 'img')
    .attr('aria-label', 'Evolução de 2018 a 2026 da proporção de mulheres e homens com 2 ou mais sinais')
    .style('font-family', 'Barlow, Inter, system-ui, sans-serif');

  // Legenda no topo
  let lx = margin.left;
  for (const s of seriesData) {
    const g = svg.append('g').attr('transform', `translate(${lx}, 16)`);
    g.append('line').attr('x1', 0).attr('x2', 16).attr('y1', -4).attr('y2', -4).attr('stroke', s.color).attr('stroke-width', 3);
    g.append('circle').attr('cx', 8).attr('cy', -4).attr('r', 4).attr('fill', s.color);
    g.append('text').attr('x', 22).attr('y', 0).attr('font-size', 11).attr('font-weight', 700).attr('fill', s.color).text(s.label);
    lx += 108;
  }

  // Grade Y
  const yTicks = y.ticks(5);
  for (const t of yTicks) {
    const ty = y(t);
    svg.append('line')
      .attr('x1', margin.left).attr('x2', margin.left + plotW)
      .attr('y1', ty).attr('y2', ty)
      .attr('stroke', t === 0 ? SEMANTIC_PALETTE.subtle : SEMANTIC_PALETTE.grid);
    svg.append('text')
      .attr('x', margin.left - 8)
      .attr('y', ty + 4)
      .attr('text-anchor', 'end')
      .attr('font-size', 10)
      .attr('fill', SEMANTIC_PALETTE.muted)
      .text(`${t.toFixed(t % 1 === 0 ? 0 : 1).replace('.', ',')}%`);
  }

  // Eixo X anos
  for (const yr of years) {
    const tx = x(yr);
    svg.append('line')
      .attr('x1', tx).attr('x2', tx)
      .attr('y1', margin.top).attr('y2', margin.top + plotH)
      .attr('stroke', SEMANTIC_PALETTE.grid)
      .attr('stroke-dasharray', '3,3');

    svg.append('text')
      .attr('x', tx)
      .attr('y', margin.top + plotH + 18)
      .attr('text-anchor', 'middle')
      .attr('font-size', isCompact ? 10.5 : 11.5)
      .attr('font-weight', 700)
      .attr('fill', SEMANTIC_PALETTE.ink)
      .text(yr === 2018 ? (isCompact ? '2018 (colig.)' : '2018 (coligações)') : String(yr));
  }

  // Marco institucional entre 2018 e 2022 (ADI 5617 + Súmula 73)
  if (x(2018) !== undefined && x(2022) !== undefined) {
    const mx = (x(2018) + x(2022)) / 2;
    svg.append('line')
      .attr('x1', mx).attr('x2', mx)
      .attr('y1', margin.top + 14).attr('y2', margin.top + plotH)
      .attr('stroke', 'rgba(92, 225, 230, 0.4)')
      .attr('stroke-dasharray', '4,4')
      .attr('stroke-width', 1.2);
    svg.append('text')
      .attr('x', mx)
      .attr('y', margin.top + 10)
      .attr('text-anchor', 'middle')
      .attr('font-size', isCompact ? 8.5 : 9.5)
      .attr('font-weight', 700)
      .attr('fill', SEMANTIC_PALETTE.y2026)
      .text(isCompact ? 'ADI 5617 / Súm. 73' : 'ADI 5617 + Súmula 73');
  }

  // Conector vertical + pílula com razão F/M sem colisão com rótulos percentuais
  for (const yr of years) {
    const y2 = byYear[yr];
    if (!y2) continue;
    const tx = x(yr);
    const yf = y(y2.pct2PlusF * 100);
    const ym = y(y2.pct2PlusM * 100);
    const topDotY = Math.min(yf, ym);
    const botDotY = Math.max(yf, ym);
    svg.append('line')
      .attr('x1', tx).attr('x2', tx)
      .attr('y1', yf).attr('y2', ym)
      .attr('stroke', 'rgba(255, 255, 255, 0.35)')
      .attr('stroke-width', 1.4);

    const ratioTxt = y2.pct2PlusM > 0 ? `${y2.ratio2Plus.toFixed(1).replace('.', ',')}× F/M` : '—';
    const pw = 56;
    const inGap = (botDotY - topDotY) >= 42;
    const pillY = inGap
      ? (topDotY + botDotY) / 2 - 8.5
      : Math.max(margin.top + 2, topDotY - 43);

    if (!inGap) {
      svg.append('line')
        .attr('x1', tx).attr('x2', tx)
        .attr('y1', pillY + 17).attr('y2', Math.max(pillY + 17, topDotY - 23))
        .attr('stroke', 'rgba(255, 255, 255, 0.35)')
        .attr('stroke-width', 1);
    }

    svg.append('rect')
      .attr('x', tx - pw / 2)
      .attr('y', pillY)
      .attr('width', pw)
      .attr('height', 17)
      .attr('rx', 8.5)
      .attr('fill', y2.ratio2Plus >= 2 ? SEMANTIC_PALETTE.alert : SEMANTIC_PALETTE.surfaceAlt)
      .attr('stroke', 'rgba(255, 255, 255, 0.35)')
      .attr('stroke-width', 0.8);
    svg.append('text')
      .attr('x', tx)
      .attr('y', pillY + 12)
      .attr('text-anchor', 'middle')
      .attr('font-size', 9.5)
      .attr('font-weight', 700)
      .attr('fill', y2.ratio2Plus >= 2 ? '#001A12' : '#FFFFFF')
      .text(ratioTxt);
  }

  // Linhas conectadas e pontos
  const lineGen = d3.line()
    .x((d) => x(d.year))
    .y((d) => y(d.pct));

  for (const s of seriesData) {
    svg.append('path')
      .datum(s.values)
      .attr('fill', 'none')
      .attr('stroke', s.color)
      .attr('stroke-width', 3)
      .attr('d', lineGen);

    s.values.forEach((pt) => {
      const cx = x(pt.year);
      const cy = y(pt.pct);
      const isF = s.key === 'F';
      const otherCy = y(pt.otherPct);
      const circle = svg.append('circle')
        .attr('class', `h6-dot h6-dot-${s.key}`)
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', 5.8)
        .attr('fill', s.color)
        .attr('stroke', SEMANTIC_PALETTE.surface)
        .attr('stroke-width', 1.5)
        .attr('tabindex', 0)
        .style('cursor', 'pointer');

      // Evita colisão quando F e M estão próximos e não colide com pílula F/M
      const isUpper = Math.abs(cy - otherCy) < 1 ? isF : cy <= otherCy;
      const labelY = isUpper ? cy - 11 : cy + 17;
      svg.append('text')
        .attr('x', cx)
        .attr('y', Math.min(margin.top + plotH - 4, Math.max(margin.top + 10, labelY)))
        .attr('text-anchor', 'middle')
        .attr('font-size', 10.5)
        .attr('font-weight', 700)
        .attr('fill', s.color)
        .attr('stroke', SEMANTIC_PALETTE.surface)
        .attr('stroke-width', 3)
        .attr('paint-order', 'stroke')
        .style('pointer-events', 'none')
        .text(fmtPct(pt.pct, 2));

      bindTooltipEvents(circle.node(), tipCtrl, () => {
        const fPct = isF ? pt.pct : pt.otherPct;
        const mPct = isF ? pt.otherPct : pt.pct;
        const fCnt = isF ? pt.count : pt.otherCount;
        const mCnt = isF ? pt.otherCount : pt.count;
        return buildTooltipCard({
          title: `${pt.year} · ≥2 sinais (Limiar ≤ ${h6Series.voteThreshold} votos)`,
          badge: `Razão ${fmtRatio(pt.ratio)}`,
          badgeTone: pt.ratio >= 1.5 ? 'below' : 'above',
          columns: ['Indicador', { text: 'Mulheres', cls: isF ? 'is-focus' : '' }, { text: 'Homens', cls: !isF ? 'is-focus' : '' }],
          rows: [
            { cells: ['% ≥ 2 sinais', { text: fmtPct(fPct, 2), cls: isF ? 'is-focus' : '' }, { text: fmtPct(mPct, 2), cls: !isF ? 'is-focus' : '' }] },
            { cells: ['Candidaturas ≥2', { text: fmtInt(fCnt), cls: isF ? 'is-focus' : '' }, { text: fmtInt(mCnt), cls: !isF ? 'is-focus' : '' }] },
            { cells: ['Universo APTO', fmtInt(byYear[pt.year].summary.F.n), fmtInt(byYear[pt.year].summary.M.n)] },
          ],
        });
      }, { focusable: true });
    });
  }

  svg.append('text')
    .attr('x', isCompact ? width / 2 : margin.left + plotW / 2)
    .attr('y', height - 5)
    .attr('text-anchor', 'middle')
    .attr('font-size', isCompact ? 9.2 : 10.5)
    .attr('fill', SEMANTIC_PALETTE.muted)
    .text(
      isCompact
        ? `% APTO ≥2 sinais (A ≤ ${h6Series.voteThreshold}v + B/C)`
        : `% das candidaturas APTO com ≥2 sinais (Sinal A ≤ ${h6Series.voteThreshold} votos + Sinal B ou C)`,
    );
}
