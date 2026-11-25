import * as d3 from 'd3';
import { SEMANTIC_PALETTE } from './palette.js';
import {
  bindTooltipEvents,
  buildTooltipCard,
  createChartTooltip,
  fmtInt,
  fmtPct,
} from './tooltip.js';

/**
 * H7 — Lollipop Comparativo por Faixa de Chapa (2022 vs. 2026, com opção 2018):
 * Substitui o Boxplot achatado no zero e elimina o mapa duplicado.
 */
export function renderH7Boxplot(
  container,
  h7Comp,
  { width = 700, show2018 = false } = {},
) {
  container.innerHTML = '';
  const rows = h7Comp?.rows || [];
  if (rows.length === 0) {
    container.innerHTML = '<p class="chart-empty">Sem chapas com pelo menos 4 candidaturas neste recorte.</p>';
    return;
  }

  const activeYears = show2018 ? [2018, 2022, 2026] : [2022, 2026];
  const isCompact = width < 460;
  const margin = { top: 52, right: isCompact ? 16 : 24, bottom: 44, left: isCompact ? 44 : 56 };
  const height = 310;
  const plotW = Math.max(180, width - margin.left - margin.right);
  const plotH = height - margin.top - margin.bottom;

  const maxY = Math.max(
    6,
    d3.max(rows.flatMap((r) => activeYears.map((yr) => r[`y${yr}`]?.aggRatePct || 0))) || 6,
  );

  const x = d3.scaleBand().domain(rows.map((r) => r.band)).range([margin.left, margin.left + plotW]).padding(0.18);
  const y = d3.scaleLinear().domain([0, maxY * 1.28]).nice().range([margin.top + plotH, margin.top]);

  const step = show2018
    ? Math.min(26, Math.max(17, x.bandwidth() * 0.3))
    : Math.min(18, Math.max(13, x.bandwidth() * 0.22));
  const yearMeta = {
    2018: { label: '2018', color: SEMANTIC_PALETTE.y2018, hollow: false, offset: -step },
    2022: { label: '2022', color: SEMANTIC_PALETTE.y2022, hollow: true, offset: show2018 ? 0 : -step },
    2026: { label: '2026', color: SEMANTIC_PALETTE.y2026, hollow: false, offset: step },
  };

  const tipCtrl = createChartTooltip(container);
  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('class', 'h7-lollipop-svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', width)
    .attr('height', height)
    .attr('role', 'img')
    .attr('aria-label', 'Taxa agregada de candidatas com 2 ou mais sinais por faixa de percentual feminino na chapa')
    .style('font-family', 'Barlow, Inter, system-ui, sans-serif');

  // Legenda de anos
  let lx = margin.left;
  for (const yr of activeYears) {
    const ym = yearMeta[yr];
    const g = svg.append('g').attr('transform', `translate(${lx}, 16)`);
    g.append('circle')
      .attr('cx', 5).attr('cy', -4).attr('r', 4.5)
      .attr('fill', ym.hollow ? SEMANTIC_PALETTE.surface : ym.color)
      .attr('stroke', ym.color)
      .attr('stroke-width', ym.hollow ? 2 : 1);
    g.append('text').attr('x', 14).attr('y', 0).attr('font-size', 10.5).attr('font-weight', 700).attr('fill', ym.color).text(ym.label);
    lx += 68;
  }

  // Destaque de zona para < 30% e 30%–33,3%
  rows.forEach((r) => {
    if (r.band === '30%–33,3%' || r.band === '< 30%') {
      svg.append('rect')
        .attr('x', x(r.band))
        .attr('y', margin.top)
        .attr('width', x.bandwidth())
        .attr('height', plotH)
        .attr('rx', 6)
        .attr('fill', r.band === '< 30%' ? 'rgba(255, 94, 43, 0.12)' : 'rgba(255, 176, 32, 0.12)');
      svg.append('text')
        .attr('x', x(r.band) + x.bandwidth() / 2)
        .attr('y', margin.top + 13)
        .attr('text-anchor', 'middle')
        .attr('font-size', 9)
        .attr('font-weight', 700)
        .attr('fill', r.band === '< 30%' ? SEMANTIC_PALETTE.alert : SEMANTIC_PALETTE.floor)
        .text(r.band === '< 30%' ? 'Irregular' : 'Piso legal');
    }
  });

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

  // Lollipops por faixa
  const baseY = y(0);
  rows.forEach((r) => {
    const cxCenter = x(r.band) + x.bandwidth() / 2;

    svg.append('text')
      .attr('x', cxCenter)
      .attr('y', baseY + 18)
      .attr('text-anchor', 'middle')
      .attr('font-size', isCompact ? 10 : 11.5)
      .attr('font-weight', (r.band === '30%–33,3%' || r.band === '< 30%') ? 700 : 600)
      .attr('fill', r.band === '< 30%' ? SEMANTIC_PALETTE.alert : (r.band === '30%–33,3%' ? SEMANTIC_PALETTE.floor : SEMANTIC_PALETTE.ink))
      .text(r.band);

    const bandLabels = [];
    activeYears.forEach((yr) => {
      const ym = yearMeta[yr];
      const st = r[`y${yr}`];
      const cx = cxCenter + ym.offset;
      const cy = y(st.aggRatePct);

      svg.append('line')
        .attr('x1', cx).attr('x2', cx)
        .attr('y1', baseY).attr('y2', cy)
        .attr('stroke', ym.color)
        .attr('stroke-opacity', 0.72)
        .attr('stroke-width', 2.4);

      const dot = svg.append('circle')
        .attr('class', 'h7-agg-dot')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', 5.6)
        .attr('fill', ym.hollow ? SEMANTIC_PALETTE.surface : ym.color)
        .attr('stroke', ym.color)
        .attr('stroke-width', ym.hollow ? 2.2 : 1.2)
        .attr('tabindex', 0)
        .style('cursor', 'pointer');

      bandLabels.push({
        yr,
        cx,
        cy,
        ly: cy - 10,
        color: ym.color,
        text: fmtPct(st.aggRatePct, 1),
      });

      bindTooltipEvents(dot.node(), tipCtrl, () => {
        const badgeTone = r.band === '< 30%' ? 'below' : (r.band === '30%–33,3%' ? 'floor' : 'above');
        const tipRows = activeYears.map((yItem) => {
          const dItem = r[`y${yItem}`];
          return {
            cells: [
              String(yItem),
              { text: fmtPct(dItem.aggRatePct, 2), cls: yItem === yr ? 'is-focus' : '' },
              `${fmtInt(dItem.twoPlusCount)}/${fmtInt(dItem.nF)}`,
              `${fmtInt(dItem.slatesCount)} chapas`,
            ],
          };
        });
        return buildTooltipCard({
          title: `Faixa ${r.band} (${yr})`,
          badge: `${fmtInt(st.slatesCount)} chapas n ≥ 4`,
          badgeTone,
          columns: ['Ano', 'Taxa ≥2 sinais', 'Mulheres', 'Chapas'],
          rows: tipRows,
        });
      }, { focusable: true });
    });

    // Separação vertical determinística entre rótulos próximos da mesma faixa (0 colisões com 2018 ativo)
    const minDx = isCompact ? 26 : 30;
    for (let pass = 0; pass < 4; pass += 1) {
      for (let i = 0; i < bandLabels.length; i += 1) {
        for (let j = i + 1; j < bandLabels.length; j += 1) {
          const a = bandLabels[i];
          const b = bandLabels[j];
          if (Math.abs(a.cx - b.cx) < minDx && Math.abs(a.ly - b.ly) < 13) {
            if (a.ly <= b.ly) {
              a.ly = Math.max(margin.top + 10, b.ly - 13);
            } else {
              b.ly = Math.max(margin.top + 10, a.ly - 13);
            }
          }
        }
      }
    }

    for (const lbl of bandLabels) {
      if (lbl.cy - lbl.ly > 14) {
        svg.append('line')
          .attr('x1', lbl.cx).attr('x2', lbl.cx)
          .attr('y1', lbl.cy - 6).attr('y2', lbl.ly + 3)
          .attr('stroke', lbl.color)
          .attr('stroke-opacity', 0.45)
          .attr('stroke-width', 0.9);
      }
      svg.append('text')
        .attr('x', lbl.cx)
        .attr('y', lbl.ly)
        .attr('text-anchor', 'middle')
        .attr('font-size', isCompact ? 9 : 9.5)
        .attr('font-weight', 700)
        .attr('fill', lbl.color)
        .attr('stroke', SEMANTIC_PALETTE.surface)
        .attr('stroke-width', 2.8)
        .attr('paint-order', 'stroke')
        .style('pointer-events', 'none')
        .text(lbl.text);
    }
  });

  svg.append('text')
    .attr('x', isCompact ? width / 2 : margin.left + plotW / 2)
    .attr('y', height - 5)
    .attr('text-anchor', 'middle')
    .attr('font-size', isCompact ? 9.2 : 10.5)
    .attr('fill', SEMANTIC_PALETTE.muted)
    .text(
      isCompact
        ? `Taxa ≥2 sinais por faixa (Limiar ≤ ${h7Comp.voteThreshold}v)`
        : `Taxa agregada de candidatas APTO com ≥2 sinais por faixa da chapa (Limiar ≤ ${h7Comp.voteThreshold} votos)`,
    );
}
