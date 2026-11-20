import * as Plot from '@observablehq/plot';

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
    height: 300,
    marginTop: 24,
    marginRight: 24,
    marginBottom: 42,
    marginLeft: 52,
    style: { background: 'transparent', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '12px' },
    x: { label: 'Faixa de % de mulheres na chapa →', domain: h7Data.bandOrder },
    y: { label: '↑ % de candidatas com ≥2 sinais na chapa', domain: [0, 100], tickFormat: (d) => `${d}%`, grid: true },
    marks: [
      Plot.boxY(pts, {
        x: 'band',
        y: 'ratePct',
        fill: (d) => (d.band === '30%–33,3%' ? '#b4452f' : '#9c8f7d'),
        fillOpacity: 0.4,
        stroke: '#1b1a17',
      }),
      Plot.dot(h7Data.bandStats, {
        x: 'band',
        y: (d) => d.aggRate * 100,
        r: 6,
        fill: '#b4452f',
        stroke: '#fffdf9',
        strokeWidth: 1.5,
        title: (d) => `Faixa ${d.band} (${d.slatesCount} chapas): taxa agregada ${(d.aggRate * 100).toFixed(1)}% (${d.twoPlusCount}/${d.nF} mulheres)`,
        tip: true,
      }),
      Plot.ruleY([0]),
    ],
  });

  container.appendChild(chart);
}
