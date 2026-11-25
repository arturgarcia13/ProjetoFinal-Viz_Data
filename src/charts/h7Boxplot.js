import * as Plot from '@observablehq/plot';
import {
  bindTooltipEvents,
  buildTooltipCard,
  createChartTooltip,
  fmtInt,
  fmtPct,
} from './tooltip.js';

/**
 * H7 — Boxplot da taxa de sinais de alerta (≥2 sinais) por faixa de % de mulheres na chapa
 */
export function renderH7Boxplot(container, h7Data, { width = 700 } = {}) {
  container.innerHTML = '';
  const pts = h7Data.slatePoints.map((p) => ({ ...p, ratePct: p.rate * 100 }));

  if (pts.length === 0) {
    container.innerHTML = '<p class="chart-empty">Sem chapas com pelo menos 4 candidaturas neste recorte.</p>';
    return;
  }

  const chart = Plot.plot({
    width,
    height: 235,
    marginTop: 20,
    marginRight: 24,
    marginBottom: 42,
    marginLeft: 52,
    style: { background: 'transparent', color: '#FFFFFF', fontFamily: 'Barlow, Inter, system-ui, sans-serif', fontSize: '12px' },
    x: { label: 'Faixa de % de mulheres na chapa →', domain: h7Data.bandOrder },
    y: { label: '↑ % de candidatas com ≥2 sinais na chapa', domain: [0, 100], tickFormat: (d) => `${d}%`, grid: true },
    marks: [
      Plot.boxY(pts, {
        x: 'band',
        y: 'ratePct',
        fill: (d) => (d.band === '30%–33,3%' ? '#FF5E2B' : '#FF7AE5'),
        fillOpacity: 0.55,
        stroke: '#FFFFFF',
      }),
      Plot.dot(h7Data.bandStats, {
        x: 'band',
        y: (d) => d.aggRate * 100,
        r: 6,
        fill: '#FCE34D',
        stroke: '#003D2B',
        strokeWidth: 1.5,
      }),
      Plot.ruleY([0], { stroke: 'rgba(255, 255, 255, 0.45)' }),
    ],
  });

  const tipCtrl = createChartTooltip(container);
  tipCtrl.wrap.appendChild(chart);

  const buildBandHtml = (datum) => {
    const isFloor = datum.band === '30%–33,3%';
    const isBelow = datum.band === '< 30%';
    const badgeTone = isFloor ? 'floor' : (isBelow ? 'below' : 'above');
    return buildTooltipCard({
      title: `Faixa ${datum.band}`,
      badge: `${fmtInt(datum.slatesCount)} chapas (n ≥ 4)`,
      badgeTone,
      rows: [
        {
          label: 'Taxa agregada (≥2 sinais)',
          value: fmtPct(datum.aggRate * 100),
          sub: `${fmtInt(datum.twoPlusCount)}/${fmtInt(datum.nF)} mulheres`,
          focus: true,
        },
        {
          label: 'Mediana por chapa',
          value: fmtPct(datum.medianRate * 100),
        },
      ],
    });
  };

  // O último grupo "dot" pertence ao Plot.dot(h7Data.bandStats); grupos anteriores são outliers do Plot.boxY
  const dotGroups = [...chart.querySelectorAll('g[aria-label="dot"]')];
  const aggDotGroup = dotGroups[dotGroups.length - 1];
  const dotCenters = [];
  if (aggDotGroup) {
    aggDotGroup.querySelectorAll('circle').forEach((el) => {
      const datum = h7Data.bandStats[el.__data__];
      if (!datum) return;
      el.classList.add('h7-agg-dot');
      el.style.cursor = 'pointer';
      dotCenters.push({ cx: Number(el.getAttribute('cx')) || 0, datum });
      bindTooltipEvents(el, tipCtrl, () => buildBandHtml(datum));
    });
  }

  const nearestBand = (xPos) => {
    if (dotCenters.length === 0) return null;
    let best = dotCenters[0];
    let minDist = Math.abs(xPos - best.cx);
    for (const c of dotCenters) {
      const dist = Math.abs(xPos - c.cx);
      if (dist < minDist) {
        minDist = dist;
        best = c;
      }
    }
    return best.datum;
  };

  // Caixas, medianas, hastes e outliers do boxplot usam o mesmo card padronizado da faixa
  chart.querySelectorAll('g[aria-label="bar"] rect').forEach((rect) => {
    const xCenter = (Number(rect.getAttribute('x')) || 0) + (Number(rect.getAttribute('width')) || 0) / 2;
    const datum = nearestBand(xCenter);
    if (!datum) return;
    rect.style.cursor = 'pointer';
    bindTooltipEvents(rect, tipCtrl, () => buildBandHtml(datum));
  });

  dotGroups.slice(0, -1).forEach((outlierG) => {
    outlierG.querySelectorAll('circle').forEach((circle) => {
      const datum = nearestBand(Number(circle.getAttribute('cx')) || 0);
      if (!datum) return;
      circle.style.cursor = 'pointer';
      bindTooltipEvents(circle, tipCtrl, () => buildBandHtml(datum));
    });
  });
}
