import { loadAppData, filterCandidates, UF_NAMES, CARGO_LABEL } from './data.js';
import { computeH1, computeH2, computeH3, computeH4, computeH5 } from './indicators.js';
import { renderH1Histogram } from './charts/h1Histogram.js';
import { renderH3Scatter } from './charts/h3Scatter.js';
import { renderH5Conversion } from './charts/h5Conversion.js';

const state = {
  year: 2022,
  cargo: 'all',
  uf: '',
  party: '',
  h1Mode: 'reg',
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

function update() {
  if (!APP_DATA) return;
  const rows = filterCandidates(APP_DATA.candidates, {
    year: state.year,
    cargo: state.cargo,
    uf: state.uf || null,
    party: state.party || null,
  });

  const covYear = APP_DATA.coverage?.years?.[String(state.year)] || null;
  const h1 = computeH1(rows);
  const h2 = computeH2(rows, covYear);
  const h3 = computeH3(rows, covYear);
  const h4 = computeH4(rows);
  const h5 = computeH5(rows);

  document.getElementById('scope-summary').textContent =
    `${state.year} · ${CARGO_LABEL[state.cargo]} · ${state.uf ? UF_NAMES[state.uf] : 'Brasil (27 UFs)'}` +
    `${state.party ? ` · ${state.party}` : ''} — ${rows.length.toLocaleString('pt-BR')} candidaturas registradas`;

  // KPIs H1–H5
  document.getElementById('kpi-h1').textContent = `${fmtPct(h1.pctCompliant)} chapas ≥30%`;
  document.getElementById('kpi-h1-sub').textContent = `${fmtPct(h1.pctFloorBand)} na faixa 30%–33,3% · ${h1.droppedByInapto} caíram pós-inaptidão`;
  renderVerdictBadge(document.getElementById('verdict-h1'), h1.verdict);

  document.getElementById('kpi-h2').textContent = `${fmtBrl(h2.medF)} vs ${fmtBrl(h2.medM)}`;
  document.getElementById('kpi-h2-sub').textContent = `Mediana privada: ${fmtBrl(h2.medPrivF)} (F) vs ${fmtBrl(h2.medPrivM)} (M)`;
  renderVerdictBadge(document.getElementById('verdict-h2'), h2.verdict);

  document.getElementById('kpi-h3').textContent = `${h3.equityRatio.toFixed(2).replace('.', ',')}×`;
  document.getElementById('kpi-h3-sub').textContent = `${fmtPct(h3.pctCandF)} candidatas → ${fmtPct(h3.pctPubF)} Fundo Público`;
  renderVerdictBadge(document.getElementById('verdict-h3'), h3.verdict);

  document.getElementById('kpi-h4').textContent = `${fmtPct(h4.diversionShareF)} F vs ${fmtPct(h4.diversionShareM)} M`;
  document.getElementById('kpi-h4-sub').textContent = `Fornecedores compartilhados: ${fmtPct(h4.sharedShareF)} (F) vs ${fmtPct(h4.sharedShareM)} (M)`;
  renderVerdictBadge(document.getElementById('verdict-h4'), h4.verdict);

  document.getElementById('kpi-h5').textContent = `${fmtPct(h5.pctCandF)} → ${fmtPct(h5.pctVotosF)} → ${fmtPct(h5.pctEleitasF)}`;
  document.getElementById('kpi-h5-sub').textContent = `${h5.elF} eleitas de ${h5.elF + h5.elM} cadeiras · queda urna ${(h5.dropUrna * 100).toFixed(1)} p.p.`;
  renderVerdictBadge(document.getElementById('verdict-h5'), h5.verdict);

  // Gráficos básicos (F06)
  const w = Math.min(760, Math.max(320, document.getElementById('chart-h1').clientWidth || 700));
  renderH1Histogram(document.getElementById('chart-h1'), h1, { width: w, mode: state.h1Mode });
  document.getElementById('note-h1').textContent =
    `Exibindo ${h1.totalSlates.toLocaleString('pt-BR')} chapas (n ≥ 4). ${h1.microSlatesReg} micro-chapas (1–3 cand., ${h1.microCandsReg} pessoas) ficam fora do % por chapa e preservadas nos totais individuais.`;

  renderH3Scatter(document.getElementById('chart-h3'), h3, {
    width: w,
    onSelectParty: (p) => {
      state.party = state.party === p ? '' : p;
      document.getElementById('filter-party').value = state.party;
      update();
    },
  });

  renderH5Conversion(document.getElementById('chart-h5'), h5, {
    width: w,
    onSelectParty: (p) => {
      state.party = state.party === p ? '' : p;
      document.getElementById('filter-party').value = state.party;
      update();
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

  document.getElementById('filter-uf').addEventListener('change', (e) => {
    state.uf = e.target.value;
    update();
  });

  document.getElementById('filter-party').addEventListener('change', (e) => {
    state.party = e.target.value;
    update();
  });

  document.getElementById('reset-filters').addEventListener('click', () => {
    state.year = 2022;
    state.cargo = 'all';
    state.uf = '';
    state.party = '';
    document.getElementById('filter-uf').value = '';
    document.getElementById('filter-party').value = '';
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
