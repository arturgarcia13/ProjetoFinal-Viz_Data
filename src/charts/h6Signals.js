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
 * H6 — Barras agrupadas por gênero × volume de sinais acumulados (0, 1, 2)
 */
export function renderH6Signals(container, h6Data, { width = 700 } = {}) {
  container.innerHTML = '';
  const { summary } = h6Data;
  if (summary.F.n === 0 && summary.M.n === 0) {
    container.innerHTML = '<p class="chart-empty">Sem candidaturas APTO neste recorte.</p>';
    return;
  }

  const rows = [];
  for (const [gKey, label] of [['F', 'Mulheres'], ['M', 'Homens']]) {
    const s = summary[gKey];
    for (let k = 0; k <= 2; k += 1) {
      const count = k === 2 ? s.twoPlus : s.bins[k];
      const pct = s.n > 0 ? (count / s.n) * 100 : 0;
      rows.push({
        sinais: k === 2 ? '2 sinais (A+B/C)' : `${k} sinal${k === 1 ? '' : 'is'}`,
        genero: label,
        pct,
        count,
        n: s.n,
      });
    }
  }

  const byBin = new Map();
  for (const r of rows) {
    const entry = byBin.get(r.sinais) || {};
    entry[r.genero] = r;
    byBin.set(r.sinais, entry);
  }

  const chart = Plot.plot({
    width,
    height: 300,
    marginTop: 24,
    marginRight: 32,
    marginBottom: 44,
    marginLeft: 50,
    style: { background: 'transparent', color: '#FFFFFF', fontFamily: 'Barlow, Inter, system-ui, sans-serif', fontSize: '12px' },
    fx: { label: 'Volume de sinais observáveis (máximo = 2)', domain: ['0 sinais', '1 sinal', '2 sinais (A+B/C)'], padding: 0.2 },
    x: { domain: ['Mulheres', 'Homens'], axis: null },
    y: { label: '↑ % das candidaturas APTO', tickFormat: (d) => `${d}%`, grid: true },
    color: { domain: ['Mulheres', 'Homens'], range: ['#FCE34D', '#FF7AE5'], legend: true },
    marks: [
      Plot.barY(rows, {
        fx: 'sinais',
        x: 'genero',
        y: 'pct',
        fill: 'genero',
      }),
      Plot.ruleY([0], { stroke: 'rgba(255, 255, 255, 0.45)' }),
    ],
  });

  const tipCtrl = createChartTooltip(container);
  tipCtrl.wrap.appendChild(chart);

  chart.querySelectorAll('g[aria-label="bar"] rect').forEach((el) => {
    const datum = rows[el.__data__];
    if (!datum) return;
    el.style.cursor = 'pointer';
    bindTooltipEvents(el, tipCtrl, () => {
      const pair = byBin.get(datum.sinais) || {};
      const fRow = pair.Mulheres || { pct: 0, count: 0, n: 0 };
      const mRow = pair.Homens || { pct: 0, count: 0, n: 0 };
      const clsF = datum.genero === 'Mulheres' ? 'is-focus' : '';
      const clsM = datum.genero === 'Homens' ? 'is-focus' : '';
      const badgeTone = datum.sinais.startsWith('2') ? 'below' : (datum.sinais.startsWith('1') ? 'floor' : 'above');
      return buildTooltipCard({
        title: datum.sinais,
        badge: datum.sinais.startsWith('2') ? 'Alerta máximo' : (datum.sinais.startsWith('1') ? 'Alerta parcial' : 'Sem sinais'),
        badgeTone,
        columns: [
          'Candidaturas APTO',
          { text: 'Mulheres', cls: clsF },
          { text: 'Homens', cls: clsM },
          'Δ F−M',
        ],
        rows: [
          {
            cells: [
              'Proporção',
              { text: fmtPct(fRow.pct, 2), cls: clsF },
              { text: fmtPct(mRow.pct, 2), cls: clsM },
              fmtSignedPP(fRow.pct - mRow.pct),
            ],
          },
          {
            cells: [
              'Contagem',
              { text: fmtInt(fRow.count), cls: clsF },
              { text: fmtInt(mRow.count), cls: clsM },
              `${fmtInt(fRow.count + mRow.count)} tot.`,
            ],
          },
        ],
      });
    });
  });
}
