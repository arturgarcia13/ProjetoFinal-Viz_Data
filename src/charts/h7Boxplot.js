import * as d3 from 'd3';
import * as Plot from '@observablehq/plot';
import { SEMANTIC_PALETTE } from './palette.js';
import { addDirectAnnotation } from './annotate.js';
import { bindTooltipEvents, buildTooltipCard, createChartTooltip, fmtInt, fmtPct } from './tooltip.js';

/**
 * H7 — Lollipop Comparativo por Faixa de Cota na Chapa (Observable Plot + D3):
 * Taxa agregada de mulheres APTO com ≥2 sinais por faixa (< 30%, 30%–33,3%, 33,3%–40%, > 40%).
 */
export function renderH7Boxplot(
  container,
  h7Comp,
  { step = 2, width = 720, show2018 = false } = {},
) {
  container.innerHTML = '';
  const rows = h7Comp?.rows || [];
  if (rows.length === 0) {
    container.innerHTML = '<p class="chart-empty">Sem chapas com pelo menos 4 candidaturas neste recorte.</p>';
    return;
  }

  const activeYears = show2018 ? [2018, 2022, 2026] : [2022, 2026];
  const isCompact = width < 460;
  const height = isCompact ? 290 : 340;
  const margin = { top: 44, right: isCompact ? 14 : 24, bottom: 44, left: isCompact ? 42 : 52 };

  const maxY = Math.max(
    4,
    (d3.max(rows.flatMap((r) => activeYears.map((yr) => r[`y${yr}`]?.aggRatePct || 0))) || 4) * 1.28,
  );

  // Estrutura de pontos para Observable Plot (grade, eixos e escala)
  const bandOrder = rows.map((r) => r.band);
  const tipCtrl = createChartTooltip(container, { wrapClass: 'h7-wrap' });

  const plotSvg = Plot.plot({
    width,
    height,
    marginTop: margin.top,
    marginRight: margin.right,
    marginBottom: margin.bottom,
    marginLeft: margin.left,
    style: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: isCompact ? '10px' : '11px',
      background: 'transparent',
      color: SEMANTIC_PALETTE.ink,
      overflow: 'visible',
    },
    x: {
      type: 'band',
      domain: bandOrder,
      padding: 0.2,
      label: 'Faixa de % de mulheres na chapa (n ≥ 4)',
    },
    y: {
      domain: [0, maxY],
      grid: true,
      tickFormat: (d) => `${Number(d).toFixed(d % 1 === 0 ? 0 : 1).replace('.', ',')}%`,
      label: '% mulheres com ≥2 sinais',
    },
    marks: [
      Plot.ruleY([0], { stroke: SEMANTIC_PALETTE.subtle }),
    ],
  });

  plotSvg.classList.add('h7-lollipop-svg');
  tipCtrl.wrap.appendChild(plotSvg);

  const svg = d3.select(plotSvg);
  const x = d3.scaleBand().domain(bandOrder).range([margin.left, width - margin.right]).padding(0.2);
  const y = d3.scaleLinear().domain([0, maxY]).range([height - margin.bottom, margin.top]);

  // Zonas de destaque para < 30% e 30%–33,3%
  rows.forEach((r) => {
    if (r.band === '30%–33,3%' || r.band === '< 30%') {
      svg.insert('rect', ':first-child')
        .attr('x', x(r.band))
        .attr('y', margin.top)
        .attr('width', x.bandwidth())
        .attr('height', height - margin.top - margin.bottom)
        .attr('rx', 6)
        .attr('fill', r.band === '< 30%' ? 'rgba(250, 83, 46, 0.09)' : 'rgba(248, 223, 79, 0.28)');

      svg.append('text')
        .attr('x', x(r.band) + x.bandwidth() / 2)
        .attr('y', margin.top - 10)
        .attr('text-anchor', 'middle')
        .attr('font-size', isCompact ? 9 : 10)
        .attr('font-weight', 700)
        .attr('fill', r.band === '< 30%' ? '#D93814' : '#7A5200')
        .text(r.band === '< 30%' ? 'Irregular (<30%)' : 'Piso legal (30%–33%)');
    }
  });

  if (step >= 1) {
    const offsetStep = show2018
      ? Math.min(24, Math.max(15, x.bandwidth() * 0.26))
      : Math.min(18, Math.max(12, x.bandwidth() * 0.2));

    const yearMeta = {
      2018: { label: '2018', color: SEMANTIC_PALETTE.y2018, hollow: false, offset: -offsetStep },
      2022: { label: '2022', color: SEMANTIC_PALETTE.ink, hollow: true, offset: show2018 ? 0 : -offsetStep },
      2026: { label: '2026', color: SEMANTIC_PALETTE.female, hollow: false, offset: offsetStep },
    };

    const baseY = y(0);
    rows.forEach((r) => {
      const cxCenter = x(r.band) + x.bandwidth() / 2;
      const bandLabels = [];

      activeYears.forEach((yr) => {
        const ym = yearMeta[yr];
        const st = r[`y${yr}`];
        const cx = cxCenter + ym.offset;
        const cy = y(st.aggRatePct);

        svg.append('line')
          .attr('x1', cx)
          .attr('x2', cx)
          .attr('y1', baseY)
          .attr('y2', cy)
          .attr('stroke', ym.color)
          .attr('stroke-opacity', 0.72)
          .attr('stroke-width', 2.4);

        const dot = svg.append('circle')
          .attr('class', 'h7-agg-dot')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', 5.8)
          .attr('fill', ym.hollow ? '#FFFFFF' : ym.color)
          .attr('stroke', ym.color)
          .attr('stroke-width', ym.hollow ? 2.2 : 1.2)
          .attr('tabindex', 0)
          .style('cursor', 'pointer');

        bandLabels.push({
          cx,
          cy,
          ly: cy - 10,
          color: ym.color,
          text: fmtPct(st.aggRatePct, 1),
        });

        bindTooltipEvents(dot.node(), tipCtrl, () => {
          const badgeTone = r.band === '< 30%' ? 'below' : (r.band === '30%–33,3%' ? 'floor' : 'above');
          return buildTooltipCard({
            title: `Faixa ${r.band} (${yr})`,
            badge: `${fmtInt(st.slatesCount)} chapas n ≥ 4`,
            badgeTone,
            columns: ['Ano', 'Taxa ≥2 sinais', 'Mulheres', 'Chapas'],
            rows: activeYears.map((yItem) => {
              const dItem = r[`y${yItem}`];
              return {
                cells: [
                  String(yItem),
                  { text: fmtPct(dItem.aggRatePct, 2), cls: yItem === yr ? 'is-focus' : '' },
                  `${fmtInt(dItem.twoPlusCount)}/${fmtInt(dItem.nF)}`,
                  `${fmtInt(dItem.slatesCount)}`,
                ],
              };
            }),
          });
        }, { focusable: true });
      });

      // Evita sobreposição entre rótulos da mesma faixa
      const minDx = isCompact ? 24 : 30;
      for (let pass = 0; pass < 4; pass += 1) {
        for (let i = 0; i < bandLabels.length; i += 1) {
          for (let j = i + 1; j < bandLabels.length; j += 1) {
            const a = bandLabels[i];
            const b = bandLabels[j];
            if (Math.abs(a.cx - b.cx) < minDx && Math.abs(a.ly - b.ly) < 13) {
              if (a.ly <= b.ly) a.ly = Math.max(margin.top + 8, b.ly - 13);
              else b.ly = Math.max(margin.top + 8, a.ly - 13);
            }
          }
        }
      }

      bandLabels.forEach((lbl) => {
        svg.append('text')
          .attr('x', lbl.cx)
          .attr('y', lbl.ly)
          .attr('text-anchor', 'middle')
          .attr('font-size', isCompact ? 8.8 : 9.5)
          .attr('font-weight', 700)
          .attr('fill', lbl.color)
          .attr('paint-order', 'stroke')
          .attr('stroke', '#FFFFFF')
          .attr('stroke-width', 2.8)
          .style('pointer-events', 'none')
          .text(lbl.text);
      });
    });

    if (step >= 2 && !isCompact) {
      const floorRow = rows.find((r) => r.band === '30%–33,3%');
      if (floorRow) {
        const tx = x(floorRow.band) + x.bandwidth() / 2 - (show2018 ? 0 : 14);
        const ty = y(floorRow.y2022.aggRatePct);
        addDirectAnnotation(svg.append('g'), {
          x1: Math.min(width - 175, tx + 65),
          y1: Math.max(margin.top + 22, ty - 28),
          x2: tx + 4,
          y2: ty - 4,
          title: `Piso 2022: ${fmtPct(floorRow.y2022.aggRatePct, 1)}`,
          subtitle: `Cai p/ ${fmtPct(floorRow.y2026.aggRatePct, 1)} em 2026`,
          color: '#7A5200',
        });
      }
    }
  }
}
