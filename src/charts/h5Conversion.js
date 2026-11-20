import * as Plot from '@observablehq/plot';

/**
 * H5 — Barras agrupadas em 3 etapas (% Candidatas → % Votos Nominais → % Eleitas) por partido.
 */
export function renderH5Conversion(container, h5Data, { width = 700, onSelectParty = null } = {}) {
  container.innerHTML = '';
  const topParties = h5Data.byParty.slice(0, 10);

  if (topParties.length === 0) {
    container.innerHTML = '<p class="chart-empty">Sem partidos com cadeiras eleitas suficientes neste recorte.</p>';
    return;
  }

  const stageOrder = ['1. Candidatas', '2. Votos nominais', '3. Eleitas'];
  const longData = [];
  for (const p of topParties) {
    longData.push({ party: p.party, stage: stageOrder[0], pct: p.pctCandF * 100, elTotal: p.elTotal, nTotal: p.nTotal });
    longData.push({ party: p.party, stage: stageOrder[1], pct: p.pctVotosF * 100, elTotal: p.elTotal, nTotal: p.nTotal });
    longData.push({ party: p.party, stage: stageOrder[2], pct: p.pctEleitasF * 100, elTotal: p.elTotal, nTotal: p.nTotal });
  }

  const chart = Plot.plot({
    width,
    height: 360,
    marginTop: 24,
    marginRight: 18,
    marginBottom: 46,
    marginLeft: 48,
    style: { background: 'transparent', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '12px' },
    fx: { label: null, domain: topParties.map((p) => p.party), padding: 0.16 },
    x: { domain: stageOrder, axis: null },
    y: {
      label: '↑ Participação feminina (%)',
      domain: [0, Math.max(50, ...longData.map((d) => d.pct)) + 5],
      tickFormat: (d) => `${d}%`,
      grid: true,
    },
    color: {
      domain: stageOrder,
      range: ['#c7b8a1', '#d97a4a', '#b4452f'],
      legend: true,
    },
    marks: [
      Plot.barY(longData, {
        fx: 'party',
        x: 'stage',
        y: 'pct',
        fill: 'stage',
        title: (d) => `${d.party} · ${d.stage}: ${d.pct.toFixed(1)}% (${d.elTotal} cadeiras no recorte)`,
        tip: true,
      }),
      Plot.ruleY([30], { stroke: '#2f6f5e', strokeDasharray: '4,3', strokeWidth: 1.5 }),
      Plot.ruleY([0]),
    ],
  });

  if (onSelectParty) {
    chart.querySelectorAll('g[aria-label="bar"] > g').forEach((facetG, idx) => {
      const party = topParties[idx]?.party;
      if (!party) return;
      facetG.style.cursor = 'pointer';
      facetG.querySelectorAll('rect').forEach((rect) => {
        rect.dataset.party = party;
        rect.addEventListener('click', () => onSelectParty(party));
      });
    });
  }

  container.appendChild(chart);
}
