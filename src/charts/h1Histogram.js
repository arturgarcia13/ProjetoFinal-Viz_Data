import * as Plot from '@observablehq/plot';

/**
 * H1 — Histograma de % de mulheres por chapa (n >= 4), destacando o piso de 30% e a faixa 30%–33,3%.
 */
export function renderH1Histogram(container, h1Data, { width = 700, mode = 'reg' } = {}) {
  container.innerHTML = '';
  const slates = mode === 'apto'
    ? h1Data.slates.filter((s) => s.nApto >= 4).map((s) => ({ ...s, pct: s.pctApto * 100 }))
    : h1Data.slates.map((s) => ({ ...s, pct: s.pctReg * 100 }));

  if (slates.length === 0) {
    container.innerHTML = '<p class="chart-empty">Sem chapas com pelo menos 4 candidaturas neste recorte.</p>';
    return;
  }

  // Faixas fixas de 3,33 p.p. para alinhar exatamente 30%–33,33%
  const step = 10 / 3;
  const thresholds = Array.from({ length: 24 }, (_, i) => i * step);

  const chart = Plot.plot({
    width,
    height: 320,
    marginTop: 28,
    marginRight: 20,
    marginBottom: 42,
    marginLeft: 48,
    style: { background: 'transparent', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '12px' },
    x: {
      label: '% de candidaturas femininas na chapa →',
      domain: [0, 80],
      tickFormat: (d) => `${d}%`,
    },
    y: {
      label: '↑ Nº de chapas (n ≥ 4)',
      grid: true,
    },
    marks: [
      Plot.rect([{ x1: 30, x2: 33.34 }], {
        x1: 'x1',
        x2: 'x2',
        y1: 0,
        y2: Infinity,
        fill: '#b4452f',
        fillOpacity: 0.09,
      }),
      Plot.rectY(
        slates,
        Plot.binX(
          {
            y: 'count',
            fill: (bin) => {
              const mid = bin.reduce((s, d) => s + d.pct, 0) / bin.length;
              if (mid < 30) return '#8b7e74';
              if (mid <= 33.34) return '#b4452f';
              return '#2f6f5e';
            },
            title: (bin) => {
              const p0 = Math.min(...bin.map((d) => d.pct)).toFixed(1);
              const p1 = Math.max(...bin.map((d) => d.pct)).toFixed(1);
              return `${bin.length} chapas (${p0}%–${p1}%)`;
            },
          },
          { x: 'pct', thresholds, tip: true },
        ),
      ),
      Plot.ruleX([30], { stroke: '#b4452f', strokeWidth: 2, strokeDasharray: '5,4' }),
      Plot.text([{ x: 30.8, text: 'Piso legal: 30%' }], {
        x: 'x',
        text: 'text',
        frameAnchor: 'top',
        dy: -16,
        textAnchor: 'start',
        fill: '#b4452f',
        fontWeight: '600',
      }),
      Plot.ruleY([0]),
    ],
  });

  container.appendChild(chart);
}
