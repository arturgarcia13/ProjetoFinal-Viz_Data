import * as Plot from '@observablehq/plot';
import {
  bindTooltipEvents,
  buildTooltipCard,
  createChartTooltip,
  fmtInt,
  fmtPct,
  fmtSignedPP,
} from './tooltip.js';

/**
 * H8 — Comparativo Temporal 2022 vs. 2026 (Contas zeradas brutas vs. Movimentações padronizadas em lote)
 */
export function renderH8Temporal(container, h8Data, { width = 700 } = {}) {
  container.innerHTML = '';
  const rows = h8Data.rows;
  if (!rows || rows.length === 0) {
    container.innerHTML = '<p class="chart-empty">Sem dados comparativos entre 2022 e 2026 neste recorte.</p>';
    return;
  }

  const labelShort = {
    'Conta zerada (Sinal B)': 'Zerada (B)',
    'Mov. padronizada em lote (Sinal C)': 'Padronizada (C)',
  };
  const compactRows = rows.map((r) => ({
    ...r,
    shortMetric: labelShort[r.metric] || r.metric.replace('Zerada + ', 'Zer.+').replace('Padronizada + ', 'Pad.+'),
  }));
  const metrics = [...new Set(compactRows.map((r) => r.shortMetric))];

  const byMetric = new Map();
  for (const r of compactRows) {
    const entry = byMetric.get(r.metric) || {};
    entry[r.year] = r;
    byMetric.set(r.metric, entry);
  }

  const chart = Plot.plot({
    width,
    height: 310,
    marginTop: 24,
    marginRight: 28,
    marginBottom: 46,
    marginLeft: 52,
    style: { background: 'transparent', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '12px' },
    fx: { label: null, domain: metrics, padding: 0.18 },
    x: { domain: ['2022', '2026'], axis: null },
    y: { label: '↑ % das candidatas APTO', tickFormat: (d) => `${d}%`, grid: true },
    color: { domain: ['2022', '2026'], range: ['#9c8f7d', '#b4452f'], legend: true },
    marks: [
      Plot.barY(compactRows, {
        fx: 'shortMetric',
        x: 'year',
        y: 'pct',
        fill: 'year',
      }),
      Plot.ruleY([0]),
    ],
  });

  const tipCtrl = createChartTooltip(container);
  tipCtrl.wrap.appendChild(chart);

  chart.querySelectorAll('g[aria-label="bar"] rect').forEach((el) => {
    const datum = compactRows[el.__data__];
    if (!datum) return;
    el.style.cursor = 'pointer';
    bindTooltipEvents(el, tipCtrl, () => {
      const pair = byMetric.get(datum.metric) || {};
      const r22 = pair['2022'] || { pct: 0, count: 0, n: 0 };
      const r26 = pair['2026'] || { pct: 0, count: 0, n: 0 };
      const deltaPP = r26.pct - r22.pct;
      const cls22 = datum.year === '2022' ? 'is-focus' : '';
      const cls26 = datum.year === '2026' ? 'is-focus' : '';
      return buildTooltipCard({
        title: datum.metric,
        badge: '2022 vs. 2026',
        badgeTone: deltaPP > 0.05 ? 'below' : (deltaPP < -0.05 ? 'above' : 'neutral'),
        columns: [
          'Candidatas APTO',
          { text: '2022', cls: cls22 },
          { text: '2026', cls: cls26 },
          'Δ 22→26',
        ],
        rows: [
          {
            cells: [
              'Proporção',
              { text: fmtPct(r22.pct), cls: cls22 },
              { text: fmtPct(r26.pct), cls: cls26 },
              fmtSignedPP(deltaPP),
            ],
          },
          {
            cells: [
              'Ocorrências',
              { text: fmtInt(r22.count), cls: cls22 },
              { text: fmtInt(r26.count), cls: cls26 },
              fmtInt(r26.count - r22.count),
            ],
          },
        ],
      });
    });
  });
}
