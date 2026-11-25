import * as Plot from '@observablehq/plot';
import {
  bindTooltipEvents,
  buildTooltipCard,
  createChartTooltip,
  fmtInt,
  fmtPct,
  fmtRatio,
} from './tooltip.js';

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

  const partyByCode = new Map(topParties.map((p) => [p.party, p]));
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
    style: { background: 'transparent', color: '#FFFFFF', fontFamily: 'Barlow, Inter, system-ui, sans-serif', fontSize: '12px' },
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
      range: ['#FCE34D', '#FF7AE5', '#FF5E2B'],
      legend: true,
    },
    marks: [
      Plot.barY(longData, {
        fx: 'party',
        x: 'stage',
        y: 'pct',
        fill: 'stage',
      }),
      Plot.ruleY([30], { stroke: '#FFFFFF', strokeDasharray: '4,3', strokeWidth: 1.5 }),
      Plot.ruleY([0], { stroke: 'rgba(255, 255, 255, 0.45)' }),
    ],
  });

  const tipCtrl = createChartTooltip(container);
  tipCtrl.wrap.appendChild(chart);

  chart.querySelectorAll('g[aria-label="bar"] > g').forEach((facetG, idx) => {
    const party = topParties[idx]?.party;
    if (!party) return;
    if (onSelectParty) facetG.style.cursor = 'pointer';

    facetG.querySelectorAll('rect').forEach((rect) => {
      const datum = longData[rect.__data__];
      const partyInfo = partyByCode.get(datum?.party || party);
      if (onSelectParty) {
        rect.dataset.party = party;
        rect.addEventListener('click', () => onSelectParty(party));
      }
      if (!datum || !partyInfo) return;

      bindTooltipEvents(rect, tipCtrl, () => {
        const conv = partyInfo.pctCandF > 0 ? partyInfo.pctEleitasF / partyInfo.pctCandF : 0;
        const badgeTone = conv < 0.75 ? 'below' : 'above';
        return buildTooltipCard({
          title: `${partyInfo.party} · Funil de conversão`,
          badge: `${fmtInt(partyInfo.elTotal)} cadeiras · ${fmtRatio(conv)}`,
          badgeTone,
          rows: [
            {
              label: '1. Candidatas',
              value: fmtPct(partyInfo.pctCandF * 100),
              sub: `${fmtInt(partyInfo.nF)}/${fmtInt(partyInfo.nTotal)}`,
              focus: datum.stage === stageOrder[0],
            },
            {
              label: '2. Votos nominais',
              value: fmtPct(partyInfo.pctVotosF * 100),
              focus: datum.stage === stageOrder[1],
            },
            {
              label: '3. Eleitas',
              value: fmtPct(partyInfo.pctEleitasF * 100),
              sub: `${fmtInt(partyInfo.elF)}/${fmtInt(partyInfo.elTotal)}`,
              focus: datum.stage === stageOrder[2],
            },
          ],
          hint: onSelectParty ? 'Clique na barra para filtrar o partido' : '',
        });
      });
    });
  });
}
