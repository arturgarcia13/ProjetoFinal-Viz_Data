import { loadAppData, filterCandidates, UF_NAMES, CARGO_LABEL } from './data.js';
import {
  computeH1, computeH2, computeH3, computeH4, computeH5,
  computeH6, computeH7, computeH8, computeH9AndParallel,
} from './indicators.js';
import { renderH1Histogram } from './charts/h1Histogram.js';
import { renderH2Dumbbell } from './charts/h2Dumbbell.js';
import { renderH3Scatter } from './charts/h3Scatter.js';
import { renderH4Sankey, renderH4Network } from './charts/h4SankeyNetwork.js';
import { renderH5Conversion } from './charts/h5Conversion.js';
import { renderH6Signals } from './charts/h6Signals.js';
import { renderH7Boxplot } from './charts/h7Boxplot.js';
import { renderH8Temporal } from './charts/h8Temporal.js';
import { renderUFMap, renderParallelCoordinates } from './charts/h9MapAndParallel.js';

const state = {
  year: 2022,
  cargo: 'all',
  uf: '',
  party: '',
  threshold: 10,
  h1Mode: 'reg',
  mapMode: 'h9',
  pcAllowedParties: null,
};

let APP_DATA = null;

function fmtPct(v) {
  return `${(v * 100).toFixed(1).replace('.', ',')}%`;
}

function fmtBrl(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function renderVerdictBadge(el, verdict) {
  el.className = `verdict-badge verdict-${verdict.status}`;
  el.innerHTML = `<span class="verdict-tag">${verdict.label}</span><span class="verdict-reason">${verdict.reason}</span>`;
}

function toggleParty(p) {
  state.party = state.party === p ? '' : p;
  document.getElementById('filter-party').value = state.party;
  update();
}

function toggleUF(uf) {
  state.uf = state.uf === uf ? '' : uf;
  document.getElementById('filter-uf').value = state.uf;
  update();
}

function update() {
  if (!APP_DATA) return;
  const rows = filterCandidates(APP_DATA.candidates, {
    year: state.year,
    cargo: state.cargo,
    uf: state.uf || null,
    party: state.party || null,
    parties: state.pcAllowedParties,
  });

  const covYear = APP_DATA.coverage?.years?.[String(state.year)] || null;
  const h1 = computeH1(rows);
  const h2 = computeH2(rows, covYear);
  const h3 = computeH3(rows, covYear);
  const h4 = computeH4(rows);
  const h5 = computeH5(rows);
  const h6 = computeH6(rows, { voteThreshold: state.threshold, coverageYear: covYear });
  const h7 = computeH7(rows, { voteThreshold: state.threshold, coverageYear: covYear });
  const h8 = computeH8(APP_DATA.candidates, {
    cargo: state.cargo,
    uf: state.uf || null,
    party: state.party || null,
    voteThreshold: state.threshold,
  });
  const h9 = computeH9AndParallel(rows, { voteThreshold: state.threshold });

  document.getElementById('scope-summary').textContent =
    `${state.year} · ${CARGO_LABEL[state.cargo]} · ${state.uf ? UF_NAMES[state.uf] : 'Brasil (27 UFs)'}` +
    `${state.party ? ` · ${state.party}` : ''} — ${rows.length.toLocaleString('pt-BR')} candidaturas registradas`;

  // KPIs H1–H9
  document.getElementById('kpi-h1').textContent = `${fmtPct(h1.pctCompliant)} chapas ≥30%`;
  document.getElementById('kpi-h1-sub').textContent = `${fmtPct(h1.pctFloorBand)} em 30%–33,3% · ${h1.droppedByInapto} caíram pós-inaptidão`;
  renderVerdictBadge(document.getElementById('verdict-h1'), h1.verdict);

  document.getElementById('kpi-h2').textContent = `${fmtBrl(h2.medF)} vs ${fmtBrl(h2.medM)}`;
  document.getElementById('kpi-h2-sub').textContent = `Privado: ${fmtBrl(h2.medPrivF)} (F) vs ${fmtBrl(h2.medPrivM)} (M)`;
  renderVerdictBadge(document.getElementById('verdict-h2'), h2.verdict);

  document.getElementById('kpi-h3').textContent = `${h3.equityRatio.toFixed(2).replace('.', ',')}×`;
  document.getElementById('kpi-h3-sub').textContent = `${fmtPct(h3.pctCandF)} candidatas → ${fmtPct(h3.pctPubF)} Fundo Público`;
  renderVerdictBadge(document.getElementById('verdict-h3'), h3.verdict);

  document.getElementById('kpi-h4').textContent = `${fmtPct(h4.diversionShareF)} F vs ${fmtPct(h4.diversionShareM)} M`;
  document.getElementById('kpi-h4-sub').textContent = `Fornecedores compartilhados: ${fmtPct(h4.sharedShareF)} (F) vs ${fmtPct(h4.sharedShareM)} (M)`;
  renderVerdictBadge(document.getElementById('verdict-h4'), h4.verdict);

  document.getElementById('kpi-h5').textContent = `${fmtPct(h5.pctCandF)} → ${fmtPct(h5.pctVotosF)} → ${fmtPct(h5.pctEleitasF)}`;
  document.getElementById('kpi-h5-sub').textContent = `${h5.elF} eleitas de ${h5.elF + h5.elM} cadeiras`;
  renderVerdictBadge(document.getElementById('verdict-h5'), h5.verdict);

  document.getElementById('kpi-h6').textContent = `${fmtPct(h6.pct2PlusF)} F vs ${fmtPct(h6.pct2PlusM)} M`;
  document.getElementById('kpi-h6-sub').textContent = `≥2 sinais (limiar A ≤ ${state.threshold} votos)`;
  renderVerdictBadge(document.getElementById('verdict-h6'), h6.verdict);

  const bFloor = h7.bandStats.find((b) => b.band === '30%–33,3%');
  const bHigh = h7.bandStats.find((b) => b.band === '> 40%');
  document.getElementById('kpi-h7').textContent = `${fmtPct(bFloor?.aggRate || 0)} vs ${fmtPct(bHigh?.aggRate || 0)}`;
  document.getElementById('kpi-h7-sub').textContent = 'Taxa ≥2 sinais: piso 30%–33% vs. >40%';
  renderVerdictBadge(document.getElementById('verdict-h7'), h7.verdict);

  document.getElementById('kpi-h8').textContent = `${fmtPct(h8.byYear[2022].pctStd)} → ${fmtPct(h8.byYear[2026].pctStd)}`;
  document.getElementById('kpi-h8-sub').textContent = `Zeradas: ${fmtPct(h8.byYear[2022].pctZero)} → ${fmtPct(h8.byYear[2026].pctZero)}`;
  renderVerdictBadge(document.getElementById('verdict-h8'), h8.verdict);

  document.getElementById('kpi-h9').textContent = `${h9.ufRows.filter((u) => !u.inconclusive).length} UFs válidas`;
  document.getElementById('kpi-h9-sub').textContent = `${h9.ufRows.filter((u) => u.inconclusive).length} UFs inconclusivas neste filtro`;
  renderVerdictBadge(document.getElementById('verdict-h9'), h9.verdict);

  // Gráficos
  const wFull = Math.min(920, Math.max(320, document.getElementById('chart-h1').clientWidth || 760));
  const wHalf = Math.min(520, Math.max(300, document.getElementById('chart-h4-sankey').clientWidth || 460));

  renderH1Histogram(document.getElementById('chart-h1'), h1, { width: wFull, mode: state.h1Mode });
  document.getElementById('note-h1').textContent =
    `Exibindo ${h1.totalSlates.toLocaleString('pt-BR')} chapas (n ≥ 4). ${h1.microSlatesReg} micro-chapas (1–3 cand., ${h1.microCandsReg} pessoas) ficam fora do % por chapa e preservadas nos totais individuais.`;

  renderH2Dumbbell(document.getElementById('chart-h2'), h2, { width: wFull, onSelectParty: toggleParty });
  renderH3Scatter(document.getElementById('chart-h3'), h3, { width: wFull, onSelectParty: toggleParty });
  renderH4Sankey(document.getElementById('chart-h4-sankey'), h4, { width: wHalf });
  renderH4Network(document.getElementById('chart-h4-network'), APP_DATA.networkHubs?.years?.[String(state.year)], {
    uf: state.uf || null,
    party: state.party || null,
    cargo: state.cargo,
  }, { width: wHalf, onSelectParty: toggleParty });
  renderH5Conversion(document.getElementById('chart-h5'), h5, { width: wFull, onSelectParty: toggleParty });
  renderH6Signals(document.getElementById('chart-h6'), h6, { width: wFull });
  renderH7Boxplot(document.getElementById('chart-h7'), h7, { width: wHalf });
  renderH8Temporal(document.getElementById('chart-h8'), h8, { width: wHalf });

  // Mapa H9 usa UFs não filtradas por UF único para manter contexto geográfico
  const mapRows = filterCandidates(APP_DATA.candidates, {
    year: state.year,
    cargo: state.cargo,
    party: state.party || null,
    parties: state.pcAllowedParties,
  });
  const h9MapData = computeH9AndParallel(mapRows, { voteThreshold: state.threshold });
  const h7MapData = computeH7(mapRows, { voteThreshold: state.threshold, coverageYear: covYear });

  renderUFMap(document.getElementById('chart-map'), APP_DATA.brUf, h9MapData, h7MapData, {
    width: wHalf,
    mode: state.mapMode,
    selectedUF: state.uf,
    onSelectUF: toggleUF,
  });

  renderParallelCoordinates(document.getElementById('chart-parallel'), h9, {
    width: wHalf,
    unit: 'party',
    selectedParty: state.party,
    onSelectEntity: (key) => toggleParty(key),
    onBrushFilter: (allowedSet) => {
      state.pcAllowedParties = allowedSet;
      // Atualiza apenas o mapa e o resumo sem destruir o brush ativo
      const brushedRows = filterCandidates(APP_DATA.candidates, {
        year: state.year,
        cargo: state.cargo,
        party: state.party || null,
        parties: allowedSet,
      });
      renderUFMap(
        document.getElementById('chart-map'),
        APP_DATA.brUf,
        computeH9AndParallel(brushedRows, { voteThreshold: state.threshold }),
        computeH7(brushedRows, { voteThreshold: state.threshold, coverageYear: covYear }),
        { width: wHalf, mode: state.mapMode, selectedUF: state.uf, onSelectUF: toggleUF },
      );
    },
  });
}

function populateSelects() {
  const ufSel = document.getElementById('filter-uf');
  Object.keys(UF_NAMES).sort().forEach((uf) => {
    const opt = document.createElement('option');
    opt.value = uf;
    opt.textContent = `${uf} — ${UF_NAMES[uf]}`;
    ufSel.appendChild(opt);
  });

  const partyCounts = new Map();
  for (const c of APP_DATA.candidates) {
    if (c.y === 2022) partyCounts.set(c.p, (partyCounts.get(c.p) || 0) + 1);
  }
  const partySel = document.getElementById('filter-party');
  [...partyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([p]) => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      partySel.appendChild(opt);
    });
}

async function init() {
  APP_DATA = await loadAppData();
  populateSelects();

  document.querySelectorAll('[data-year]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.year = Number(btn.dataset.year);
      document.querySelectorAll('[data-year]').forEach((b) => b.classList.toggle('active', b === btn));
      update();
    });
  });

  document.querySelectorAll('[data-cargo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.cargo = btn.dataset.cargo;
      document.querySelectorAll('[data-cargo]').forEach((b) => b.classList.toggle('active', b === btn));
      update();
    });
  });

  document.querySelectorAll('[data-h1-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.h1Mode = btn.dataset.h1Mode;
      document.querySelectorAll('[data-h1-mode]').forEach((b) => b.classList.toggle('active', b === btn));
      update();
    });
  });

  document.querySelectorAll('[data-map-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.mapMode = btn.dataset.mapMode;
      document.querySelectorAll('[data-map-mode]').forEach((b) => b.classList.toggle('active', b === btn));
      update();
    });
  });

  document.getElementById('filter-uf').addEventListener('change', (e) => {
    state.uf = e.target.value;
    update();
  });

  document.getElementById('filter-party').addEventListener('change', (e) => {
    state.party = e.target.value;
    update();
  });

  document.getElementById('filter-threshold').addEventListener('input', (e) => {
    state.threshold = Number(e.target.value);
    document.getElementById('threshold-out').textContent = String(state.threshold);
    update();
  });

  document.getElementById('reset-filters').addEventListener('click', () => {
    state.year = 2022;
    state.cargo = 'all';
    state.uf = '';
    state.party = '';
    state.threshold = 10;
    state.pcAllowedParties = null;
    document.getElementById('filter-uf').value = '';
    document.getElementById('filter-party').value = '';
    document.getElementById('filter-threshold').value = '10';
    document.getElementById('threshold-out').textContent = '10';
    document.querySelectorAll('[data-year]').forEach((b) => b.classList.toggle('active', Number(b.dataset.year) === 2022));
    document.querySelectorAll('[data-cargo]').forEach((b) => b.classList.toggle('active', b.dataset.cargo === 'all'));
    update();
  });

  window.addEventListener('resize', () => update());
  update();
}

init().catch((err) => {
  document.getElementById('scope-summary').textContent = `Erro ao carregar dados: ${err.message}`;
  console.error(err);
});
