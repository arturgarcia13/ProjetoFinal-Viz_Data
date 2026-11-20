import * as Plot from '@observablehq/plot';

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
        title: (d) => `${d.year} · ${d.metric}: ${d.pct.toFixed(1)}% (${d.count.toLocaleString('pt-BR')} de ${d.n.toLocaleString('pt-BR')})`,
        tip: true,
      }),
      Plot.ruleY([0]),
    ],
  });

  container.appendChild(chart);
}
