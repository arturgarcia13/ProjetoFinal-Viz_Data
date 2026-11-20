import * as Plot from '@observablehq/plot';

/**
 * H3 — Dispersão por partido: % de candidatas × % do Fundo Público (FEFC + FP),
 * com diagonal de proporcionalidade (Y = X) e corte de 30%.
 */
export function renderH3Scatter(container, h3Data, { width = 700, onSelectParty = null } = {}) {
  container.innerHTML = '';
  const parties = h3Data.parties.map((p) => ({
    ...p,
    xPct: p.pctCandF * 100,
    yPct: p.pctPubF * 100,
    pubMi: p.pubTotal / 1e6,
  }));

  if (parties.length === 0) {
    container.innerHTML = '<p class="chart-empty">Sem partidos com amostra mínima (n ≥ 10) e Fundo Público neste recorte.</p>';
    return;
  }

  const maxVal = Math.max(55, ...parties.map((p) => Math.max(p.xPct, p.yPct))) + 4;
  const minVal = Math.max(0, Math.min(20, ...parties.map((p) => Math.min(p.xPct, p.yPct))) - 3);
  const topLabels = [...parties].sort((a, b) => b.pubTotal - a.pubTotal).slice(0, 10);

  const chart = Plot.plot({
    width,
    height: 360,
    marginTop: 24,
    marginRight: 28,
    marginBottom: 46,
    marginLeft: 54,
    style: { background: 'transparent', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '12px' },
    x: {
      label: '% de candidatas mulheres (APTO) →',
      domain: [minVal, maxVal],
      tickFormat: (d) => `${d}%`,
      grid: true,
    },
    y: {
      label: '↑ % do Fundo Público (FEFC + FP) para mulheres',
      domain: [minVal, maxVal],
      tickFormat: (d) => `${d}%`,
      grid: true,
    },
    r: { range: [4, 22] },
    marks: [
      Plot.line([[minVal, minVal], [maxVal, maxVal]], {
        stroke: '#555',
        strokeDasharray: '5,4',
        strokeWidth: 1.5,
      }),
      Plot.ruleX([30], { stroke: '#b4452f', strokeDasharray: '3,3', strokeOpacity: 0.7 }),
      Plot.ruleY([30], { stroke: '#b4452f', strokeDasharray: '3,3', strokeOpacity: 0.7 }),
      Plot.dot(parties, {
        x: 'xPct',
        y: 'yPct',
        r: 'pubTotal',
        fill: (d) => (d.yPct >= d.xPct ? '#2f6f5e' : '#b4452f'),
        fillOpacity: 0.72,
        stroke: '#1b1a17',
        strokeWidth: 0.8,
        title: (d) =>
          `${d.party} (${d.n} cand.)\n` +
          `Candidatas: ${d.xPct.toFixed(1)}%\n` +
          `Fundo Público F: ${d.yPct.toFixed(1)}% (R$ ${d.pubMi.toFixed(1)}M total)\n` +
          `Razão equidade: ${d.ratio.toFixed(2)}×`,
        tip: true,
      }),
      Plot.text(topLabels, {
        x: 'xPct',
        y: 'yPct',
        text: 'party',
        dy: -10,
        fontSize: 10,
        fontWeight: '600',
        fill: '#1b1a17',
      }),
      Plot.text([{ x: maxVal - 2, y: maxVal - 4, text: 'Y = X (proporcional)' }], {
        x: 'x',
        y: 'y',
        text: 'text',
        textAnchor: 'end',
        fill: '#555',
        fontSize: 11,
      }),
    ],
  });

  if (onSelectParty) {
    chart.querySelectorAll('circle').forEach((el, idx) => {
      const datum = parties[idx];
      if (!datum) return;
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => onSelectParty(datum.party));
    });
  }

  container.appendChild(chart);
}
