import * as Plot from '@observablehq/plot';
import {
  bindTooltipEvents,
  buildTooltipCard,
  createChartTooltip,
  fmtBrl,
  fmtInt,
  fmtPct,
  fmtRatio,
  fmtSignedPP,
} from './tooltip.js';

/**
 * H2 — Dumbbell por partido (mediana F vs. M) e barras empilhadas por fonte (Público vs. Privado).
 */
export function renderH2Dumbbell(container, h2Data, { width = 700, onSelectParty = null } = {}) {
  container.innerHTML = '';
  const parties = h2Data.byParty.slice(0, 12);

  if (parties.length === 0) {
    container.innerHTML = '<p class="chart-empty">Sem partidos com pelo menos 5 candidatas e 5 candidatos para comparar medianas.</p>';
    return;
  }

  const partyByCode = new Map(parties.map((p) => [p.party, p]));
  const dumbbellRows = [];
  for (const p of parties) {
    dumbbellRows.push({ party: p.party, g: 'Mulheres', med: p.medF / 1000, ratio: p.ratio });
    dumbbellRows.push({ party: p.party, g: 'Homens', med: p.medM / 1000, ratio: p.ratio });
  }

  const dumbbell = Plot.plot({
    width,
    height: 340,
    marginTop: 22,
    marginRight: 24,
    marginBottom: 42,
    marginLeft: 95,
    style: { background: 'transparent', color: '#FFFFFF', fontFamily: 'Barlow, Inter, system-ui, sans-serif', fontSize: '12px' },
    x: { label: 'Receita mediana (R$ mil) →', grid: true },
    y: { label: null, domain: parties.map((p) => p.party) },
    color: { domain: ['Mulheres', 'Homens'], range: ['#FCE34D', '#FF7AE5'], legend: true },
    marks: [
      Plot.link(parties, {
        x1: (d) => d.medF / 1000,
        x2: (d) => d.medM / 1000,
        y1: 'party',
        y2: 'party',
        stroke: 'rgba(255, 255, 255, 0.55)',
        strokeWidth: 2,
      }),
      Plot.dot(dumbbellRows, {
        x: 'med',
        y: 'party',
        fill: 'g',
        r: 5.5,
      }),
    ],
  });

  const dumbbellTip = createChartTooltip(container);
  dumbbellTip.wrap.appendChild(dumbbell);

  dumbbell.querySelectorAll('g[aria-label="dot"] circle').forEach((el) => {
    const datum = dumbbellRows[el.__data__];
    if (!datum) return;
    const partyInfo = partyByCode.get(datum.party);
    if (onSelectParty) {
      el.style.cursor = 'pointer';
      el.dataset.party = datum.party;
      el.addEventListener('click', () => onSelectParty(datum.party));
    }

    bindTooltipEvents(el, dumbbellTip, () => {
      if (!partyInfo) return '';
      const badgeTone = partyInfo.ratio < 0.85 ? 'below' : (partyInfo.ratio < 0.95 ? 'floor' : 'above');
      const badgeText = partyInfo.ratio < 0.85 ? 'Abaixo da paridade' : (partyInfo.ratio < 0.95 ? 'Leve defasagem' : 'Próximo à paridade');
      const clsF = datum.g === 'Mulheres' ? 'is-focus' : '';
      const clsM = datum.g === 'Homens' ? 'is-focus' : '';
      return buildTooltipCard({
        title: `Partido ${partyInfo.party}`,
        badge: badgeText,
        badgeTone,
        columns: [
          'Receita mediana',
          { text: 'Mulheres', cls: clsF },
          { text: 'Homens', cls: clsM },
          'Razão F/M',
        ],
        rows: [
          {
            cells: [
              'Mediana total',
              { text: fmtBrl(partyInfo.medF), cls: clsF },
              { text: fmtBrl(partyInfo.medM), cls: clsM },
              fmtRatio(partyInfo.ratio),
            ],
          },
          {
            cells: [
              'Candidaturas',
              { text: fmtInt(partyInfo.nF), cls: clsF },
              { text: fmtInt(partyInfo.nM), cls: clsM },
              fmtInt(partyInfo.total),
            ],
          },
        ],
        hint: onSelectParty ? 'Clique no ponto para filtrar o partido' : '',
      });
    });
  });

  // Barras empilhadas por fonte (F vs M)
  const sourceRows = [];
  for (const s of h2Data.sources) {
    const label = s.g === 'F' ? 'Mulheres' : 'Homens';
    sourceRows.push(
      { genero: label, fonte: 'FEFC', pct: s.pctFefc * 100 },
      { genero: label, fonte: 'Fundo Partidário', pct: s.pctFp * 100 },
      { genero: label, fonte: 'Recursos Próprios', pct: s.pctProp * 100 },
      { genero: label, fonte: 'Doações Privadas/Outros', pct: s.pctPriv * 100 },
    );
  }

  const byFonte = new Map();
  for (const row of sourceRows) {
    const entry = byFonte.get(row.fonte) || {};
    entry[row.genero] = row.pct;
    byFonte.set(row.fonte, entry);
  }

  const stacked = Plot.plot({
    width,
    height: 170,
    marginTop: 22,
    marginRight: 24,
    marginBottom: 38,
    marginLeft: 95,
    style: { background: 'transparent', color: '#FFFFFF', fontFamily: 'Barlow, Inter, system-ui, sans-serif', fontSize: '12px' },
    x: { label: 'Composição do financiamento (%) →', domain: [0, 100], tickFormat: (d) => `${d}%` },
    y: { label: null },
    color: {
      domain: ['FEFC', 'Fundo Partidário', 'Recursos Próprios', 'Doações Privadas/Outros'],
      range: ['#FCE34D', '#FF7AE5', '#FF5E2B', '#FFFFFF'],
      legend: true,
    },
    marks: [
      Plot.barX(sourceRows, {
        x: 'pct',
        y: 'genero',
        fill: 'fonte',
      }),
    ],
  });

  const stackedTip = createChartTooltip(container);
  stackedTip.wrap.appendChild(stacked);

  stacked.querySelectorAll('g[aria-label="bar"] rect').forEach((el) => {
    const datum = sourceRows[el.__data__];
    if (!datum) return;
    el.style.cursor = 'pointer';
    bindTooltipEvents(el, stackedTip, () => {
      const pair = byFonte.get(datum.fonte) || {};
      const fPct = pair.Mulheres ?? 0;
      const mPct = pair.Homens ?? 0;
      const clsF = datum.genero === 'Mulheres' ? 'is-focus' : '';
      const clsM = datum.genero === 'Homens' ? 'is-focus' : '';
      return buildTooltipCard({
        title: datum.fonte,
        badge: datum.genero,
        badgeTone: datum.genero === 'Mulheres' ? 'below' : 'neutral',
        columns: [
          'Composição',
          { text: 'Mulheres', cls: clsF },
          { text: 'Homens', cls: clsM },
          'Δ F−M',
        ],
        rows: [
          {
            cells: [
              'Fatia da receita',
              { text: fmtPct(fPct), cls: clsF },
              { text: fmtPct(mPct), cls: clsM },
              fmtSignedPP(fPct - mPct),
            ],
          },
        ],
      });
    });
  });
}
