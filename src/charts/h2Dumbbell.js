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

const YEARS = ['2022', '2026'];

function normalizeH2Comparison(h2Data) {
  if (h2Data && Array.isArray(h2Data.parties) && h2Data.byYear) {
    return h2Data;
  }
  const byParty = h2Data?.byParty || [];
  const sources = h2Data?.sources || [];
  return {
    byYear: {
      2022: { byParty, sources },
      2026: { byParty: [], sources: [] },
    },
    parties: byParty.map((p) => ({
      party: p.party,
      totalCombined: p.total,
      y2022: p,
      y2026: null,
    })),
  };
}

/**
 * H2 — Dumbbell facetado lado a lado (2022 vs. 2026) em escala linear por partido (mediana F vs. M)
 * e barras empilhadas por fonte (Público vs. Privado).
 */
export function renderH2Dumbbell(
  container,
  h2Data,
  { width = 700, activeYear = 2022, onSelectParty = null } = {},
) {
  container.innerHTML = '';
  const data = normalizeH2Comparison(h2Data);
  const topParties = data.parties.slice(0, 12);

  if (topParties.length === 0) {
    container.innerHTML = '<p class="chart-empty">Sem partidos com pelo menos 5 candidatas e 5 candidatos para comparar medianas (2022 e 2026).</p>';
    return;
  }

  const isCompact = width < 440;
  const marginLeft = isCompact ? 98 : 102;
  const marginRight = isCompact ? 18 : 20;
  const facetPadding = isCompact ? 0.22 : 0.14;
  const partyOrder = topParties.map((p) => p.party);
  const partyByCode = new Map(topParties.map((p) => [p.party, p]));

  const links = [];
  const dumbbellRows = [];
  for (const entry of topParties) {
    for (const yr of YEARS) {
      const py = entry[`y${yr}`];
      if (!py) continue;
      links.push({
        year: yr,
        party: entry.party,
        medF: py.medF / 1000,
        medM: py.medM / 1000,
        ratio: py.ratio,
      });
      dumbbellRows.push(
        { year: yr, party: entry.party, g: 'Mulheres', med: py.medF / 1000, ratio: py.ratio },
        { year: yr, party: entry.party, g: 'Homens', med: py.medM / 1000, ratio: py.ratio },
      );
    }
  }

  const maxMed = Math.max(10, ...dumbbellRows.map((d) => d.med));
  const xDomainMax = Math.ceil(maxMed * 1.06);
  const dumbbellHeight = Math.max(155, 80 + topParties.length * 21);

  const dumbbell = Plot.plot({
    width,
    height: dumbbellHeight,
    marginTop: 24,
    marginRight,
    marginBottom: 38,
    marginLeft,
    style: { background: 'transparent', fontFamily: 'Inter, system-ui, sans-serif', fontSize: isCompact ? '11px' : '12px' },
    fx: { label: null, domain: YEARS, padding: facetPadding },
    x: {
      type: 'linear',
      label: 'Receita mediana (R$ mil · escala linear) →',
      domain: [0, xDomainMax],
      ticks: isCompact ? 3 : 4,
      grid: true,
    },
    y: { label: null, domain: partyOrder },
    color: { domain: ['Mulheres', 'Homens'], range: ['#b4452f', '#3d5a80'], legend: true },
    marks: [
      Plot.ruleX([0], { stroke: '#bfb4a3', strokeWidth: 1 }),
      Plot.link(links, {
        fx: 'year',
        x1: 'medF',
        x2: 'medM',
        y1: 'party',
        y2: 'party',
        stroke: '#9b9183',
        strokeWidth: 2,
      }),
      Plot.dot(dumbbellRows, {
        fx: 'year',
        x: 'med',
        y: 'party',
        fill: 'g',
        r: isCompact ? 4.5 : 5.5,
        stroke: '#fffdf9',
        strokeWidth: 0.9,
      }),
    ],
  });

  const dumbbellSvg = dumbbell.tagName?.toLowerCase() === 'svg' ? dumbbell : dumbbell.querySelector('svg[viewBox]');
  if (dumbbellSvg) {
    dumbbellSvg.setAttribute('role', 'img');
    dumbbellSvg.setAttribute(
      'aria-label',
      'Gráfico dumbbell facetado comparando receita mediana de mulheres e homens por partido em 2022 e 2026 em escala linear',
    );
    dumbbellSvg.querySelectorAll('g[aria-label="fx-axis tick label"] text').forEach((txt) => {
      const yr = txt.textContent?.trim();
      const isActive = yr === String(activeYear);
      txt.setAttribute('font-weight', isActive ? '700' : '600');
      txt.setAttribute('fill', yr === '2026' ? '#b4452f' : '#1b1a17');
    });
  }
  dumbbell.querySelectorAll('svg:not([viewBox])').forEach((swatch) => {
    swatch.setAttribute('aria-hidden', 'true');
  });

  const dumbbellTip = createChartTooltip(container);
  dumbbellTip.wrap.appendChild(dumbbell);

  dumbbell.querySelectorAll('g[aria-label="dot"] circle').forEach((el) => {
    const datum = dumbbellRows[el.__data__];
    if (!datum) return;
    const entry = partyByCode.get(datum.party);
    const otherYear = datum.year === '2022' ? '2026' : '2022';
    const partyInfo = entry?.[`y${datum.year}`];
    const otherInfo = entry?.[`y${otherYear}`];

    if (onSelectParty) {
      el.style.cursor = 'pointer';
      el.dataset.party = datum.party;
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      el.setAttribute(
        'aria-label',
        `Filtrar partido ${datum.party} (${datum.g} em ${datum.year})`,
      );
      el.addEventListener('click', () => onSelectParty(datum.party));
      el.addEventListener('keydown', (evt) => {
        if (evt.key === 'Enter' || evt.key === ' ') {
          evt.preventDefault();
          onSelectParty(datum.party);
        }
      });
    }

    bindTooltipEvents(el, dumbbellTip, () => {
      if (!partyInfo) return '';
      const badgeTone = partyInfo.ratio < 0.85 ? 'below' : (partyInfo.ratio < 0.95 ? 'floor' : 'above');
      const badgeText = partyInfo.ratio < 0.85 ? 'Abaixo da paridade' : (partyInfo.ratio < 0.95 ? 'Leve defasagem' : 'Próximo à paridade');
      const clsF = datum.g === 'Mulheres' ? 'is-focus' : '';
      const clsM = datum.g === 'Homens' ? 'is-focus' : '';
      const rows = [
        {
          cells: [
            `Mediana (${datum.year})`,
            { text: fmtBrl(partyInfo.medF), cls: clsF },
            { text: fmtBrl(partyInfo.medM), cls: clsM },
            fmtRatio(partyInfo.ratio),
          ],
        },
      ];
      if (otherInfo) {
        rows.push({
          cells: [
            `Mediana (${otherYear})`,
            fmtBrl(otherInfo.medF),
            fmtBrl(otherInfo.medM),
            fmtRatio(otherInfo.ratio),
          ],
        });
      }
      rows.push({
        cells: [
          `Candidaturas (${datum.year})`,
          { text: fmtInt(partyInfo.nF), cls: clsF },
          { text: fmtInt(partyInfo.nM), cls: clsM },
          fmtInt(partyInfo.total),
        ],
      });
      return buildTooltipCard({
        title: `Partido ${partyInfo.party} · ${datum.year}`,
        badge: badgeText,
        badgeTone,
        columns: [
          'Receita mediana',
          { text: 'Mulheres', cls: clsF },
          { text: 'Homens', cls: clsM },
          'Razão F/M',
        ],
        rows,
        hint: onSelectParty ? 'Clique no ponto para filtrar o partido' : '',
      });
    }, { focusable: Boolean(onSelectParty) });
  });

  // Barras empilhadas por fonte (F vs M), também facetadas em 2022 | 2026 para alinhamento vertical
  const sourceRows = [];
  for (const yr of YEARS) {
    const yearSources = data.byYear?.[yr]?.sources || [];
    if (!yearSources.some((s) => s.total > 0)) continue;
    for (const s of yearSources) {
      const label = s.g === 'F' ? 'Mulheres' : 'Homens';
      sourceRows.push(
        { year: yr, genero: label, fonte: 'FEFC', pct: s.pctFefc * 100 },
        { year: yr, genero: label, fonte: 'Fundo Partidário', pct: s.pctFp * 100 },
        { year: yr, genero: label, fonte: 'Recursos Próprios', pct: s.pctProp * 100 },
        { year: yr, genero: label, fonte: 'Doações Privadas/Outros', pct: s.pctPriv * 100 },
      );
    }
  }

  if (sourceRows.length === 0) return;

  const byFonteYear = new Map();
  for (const row of sourceRows) {
    const key = `${row.year}|${row.fonte}`;
    const entry = byFonteYear.get(key) || {};
    entry[row.genero] = row.pct;
    byFonteYear.set(key, entry);
  }

  const stacked = Plot.plot({
    width,
    height: 148,
    marginTop: 22,
    marginRight,
    marginBottom: 36,
    marginLeft,
    style: { background: 'transparent', fontFamily: 'Inter, system-ui, sans-serif', fontSize: isCompact ? '11px' : '12px' },
    fx: { label: null, domain: YEARS, padding: facetPadding },
    x: {
      label: 'Composição do financiamento (%) →',
      domain: [0, 100],
      ticks: isCompact ? [0, 50] : [0, 25, 50, 75, 100],
      tickFormat: (d) => `${d}%`,
    },
    y: { label: null, domain: ['Mulheres', 'Homens'] },
    color: {
      domain: ['FEFC', 'Fundo Partidário', 'Recursos Próprios', 'Doações Privadas/Outros'],
      range: ['#b4452f', '#d97a4a', '#9c8f7d', '#3d5a80'],
      legend: true,
    },
    marks: [
      Plot.barX(sourceRows, {
        fx: 'year',
        x: 'pct',
        y: 'genero',
        fill: 'fonte',
      }),
    ],
  });

  const stackedSvg = stacked.tagName?.toLowerCase() === 'svg' ? stacked : stacked.querySelector('svg[viewBox]');
  if (stackedSvg) {
    stackedSvg.setAttribute('role', 'img');
    stackedSvg.setAttribute(
      'aria-label',
      'Barras empilhadas facetadas da composição do financiamento por fonte em 2022 e 2026',
    );
    stackedSvg.querySelectorAll('g[aria-label="fx-axis tick label"] text').forEach((txt) => {
      const yr = txt.textContent?.trim();
      const isActive = yr === String(activeYear);
      txt.setAttribute('font-weight', isActive ? '700' : '600');
      txt.setAttribute('fill', yr === '2026' ? '#b4452f' : '#1b1a17');
    });
  }
  stacked.querySelectorAll('svg:not([viewBox])').forEach((swatch) => {
    swatch.setAttribute('aria-hidden', 'true');
  });

  const stackedTip = createChartTooltip(container);
  stackedTip.wrap.appendChild(stacked);

  stacked.querySelectorAll('g[aria-label="bar"] rect').forEach((el) => {
    const datum = sourceRows[el.__data__];
    if (!datum) return;
    el.style.cursor = 'pointer';
    bindTooltipEvents(el, stackedTip, () => {
      const pair = byFonteYear.get(`${datum.year}|${datum.fonte}`) || {};
      const otherYear = datum.year === '2022' ? '2026' : '2022';
      const otherPair = byFonteYear.get(`${otherYear}|${datum.fonte}`);
      const fPct = pair.Mulheres ?? 0;
      const mPct = pair.Homens ?? 0;
      const clsF = datum.genero === 'Mulheres' ? 'is-focus' : '';
      const clsM = datum.genero === 'Homens' ? 'is-focus' : '';
      const rows = [
        {
          cells: [
            `Fatia (${datum.year})`,
            { text: fmtPct(fPct), cls: clsF },
            { text: fmtPct(mPct), cls: clsM },
            fmtSignedPP(fPct - mPct),
          ],
        },
      ];
      if (otherPair) {
        const ofPct = otherPair.Mulheres ?? 0;
        const omPct = otherPair.Homens ?? 0;
        rows.push({
          cells: [
            `Fatia (${otherYear})`,
            fmtPct(ofPct),
            fmtPct(omPct),
            fmtSignedPP(ofPct - omPct),
          ],
        });
      }
      return buildTooltipCard({
        title: `${datum.fonte} · ${datum.year}`,
        badge: datum.genero,
        badgeTone: datum.genero === 'Mulheres' ? 'below' : 'neutral',
        columns: [
          'Composição',
          { text: 'Mulheres', cls: clsF },
          { text: 'Homens', cls: clsM },
          'Δ F−M',
        ],
        rows,
      });
    });
  });
}
