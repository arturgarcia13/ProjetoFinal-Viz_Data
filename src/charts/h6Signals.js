import * as Plot from '@observablehq/plot';

/**
 * H6 — Barras agrupadas por gênero × volume de sinais acumulados (0, 1, 2, 3)
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

  const chart = Plot.plot({
    width,
    height: 300,
    marginTop: 24,
    marginRight: 32,
    marginBottom: 44,
    marginLeft: 50,
    style: { background: 'transparent', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '12px' },
    fx: { label: 'Volume de sinais observáveis (máximo = 2)', domain: ['0 sinais', '1 sinal', '2 sinais (A+B/C)'], padding: 0.2 },
    x: { domain: ['Mulheres', 'Homens'], axis: null },
    y: { label: '↑ % das candidaturas APTO', tickFormat: (d) => `${d}%`, grid: true },
    color: { domain: ['Mulheres', 'Homens'], range: ['#b4452f', '#3d5a80'], legend: true },
    marks: [
      Plot.barY(rows, {
        fx: 'sinais',
        x: 'genero',
        y: 'pct',
        fill: 'genero',
        title: (d) => `${d.genero} · ${d.sinais}: ${d.pct.toFixed(2)}% (${d.count.toLocaleString('pt-BR')} de ${d.n.toLocaleString('pt-BR')})`,
        tip: true,
      }),
      Plot.ruleY([0]),
    ],
  });

  container.appendChild(chart);
}
