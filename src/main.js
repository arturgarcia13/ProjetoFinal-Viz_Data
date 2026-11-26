import 'd3-transition';
import { loadAppData, filterCandidates, UF_NAMES, CARGO_LABEL } from './data.js';
import {
  computeAto5Geography,
  computeH1,
  computeH2,
  computeH2GapEvolution,
  computeH2PublicVsPrivate,
  computeH3,
  computeH5,
  computeH6Series,
  computeH7Comparison,
  computeH8,
  computeThresholdBandComparison,
  countSignals,
} from './indicators.js';
import { renderHeroFunnel } from './charts/heroFunnel.js';
import { tweenPctText } from './charts/motion.js';
import { computeH1EightBins, renderH1Histogram } from './charts/h1Histogram.js';
import { renderH2Dumbbell } from './charts/h2Dumbbell.js';
import { renderH3Scatter } from './charts/h3Scatter.js';
import { computeH4FlowStats, renderH4Sankey } from './charts/h4SankeyNetwork.js';
import { renderH4Hubs } from './charts/h4Hubs.js';
import { renderH5Conversion } from './charts/h5Conversion.js';
import { renderH6Signals } from './charts/h6Signals.js';
import { renderThresholdCompare } from './charts/h6ThresholdCompare.js';
import { renderH7Boxplot } from './charts/h7Boxplot.js';
import { renderH8Temporal } from './charts/h8Temporal.js';
import {
  ATO5_STEPS,
  highlightAto5UF,
  renderAto5MapStage,
  renderAto5StepCards,
} from './charts/h9MapAndParallel.js';
import { initScrolly, isStaticMode, stepOf } from './components/scrolly.js';

const state = {
  year: 2022,
  cargo: 'all',
  uf: '',
  party: '',
  threshold: 10,
  h1Mode: 'reg',
  h1PrevMode: 'reg',
  h1UserLocked: false,
  h1BinFilter: null,
  h3Cargo: 'all',
  h3CargoLocked: false,
  h4Cohort: 'all',
  h5View: 'bars',
  h6Year: 2022,
  limiarUnit: 'chapa',
  limiarYear: 2022,
  h7Show2018: false,
  ato5Year: 2022,
  ato5Cargo: 'all',
  ato5HoveredUf: null,
  ato5SelectedUf: '',
};

let h1AutoTimer = null;

const R = {};
let APP_DATA = null;

function fmtPct(v, digits = 1) {
  return `${(v * 100).toFixed(digits).replace('.', ',')}%`;
}

function fmtPctDirect(v, digits = 1) {
  return `${Number(v || 0).toFixed(digits).replace('.', ',')}%`;
}

function fmtCompactBrl(v) {
  const abs = Math.abs(v || 0);
  if (abs >= 1e6) return `R$ ${(abs / 1e6).toFixed(1).replace('.', ',')}M`;
  if (abs >= 1e3) return `R$ ${Math.round(abs / 1e3).toLocaleString('pt-BR')} mil`;
  return `R$ ${Math.round(abs).toLocaleString('pt-BR')}`;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function renderVerdictPill(id, verdict) {
  const slot = document.getElementById(id);
  if (!slot || !verdict) return;
  const cls = verdict.status === 'funcionou'
    ? 'diag-funciona'
    : (verdict.status === 'inconclusivo' ? 'diag-inconclusivo' : 'diag-vaza');
  slot.innerHTML = `<span class="diag-pill ${cls}" title="${verdict.reason || ''}">Diagnóstico: ${verdict.label}</span>`;
}

function getCanvasWidth(el, fallback = 700) {
  return Math.min(760, Math.max(290, el?.clientWidth || fallback));
}

function syncBarHeightVar() {
  const bar = document.querySelector('.top-editorial-bar');
  if (bar) {
    document.documentElement.style.setProperty('--bar-h', `${bar.offsetHeight}px`);
  }
}

function getScopedRows({
  year = state.year,
  cargo = state.cargo,
  ignoreUF = false,
  ignoreParty = false,
  ignoreH1Bin = false,
} = {}) {
  const binParties = !ignoreH1Bin && state.h1BinFilter?.parties?.size > 0
    ? state.h1BinFilter.parties
    : null;
  return filterCandidates(APP_DATA.candidates, {
    year,
    cargo,
    uf: ignoreUF ? null : (state.uf || null),
    party: ignoreParty ? null : (state.party || null),
    parties: binParties,
  });
}

function toggleParty(p) {
  state.party = state.party === p ? '' : p;
  const sel = document.getElementById('filter-party');
  if (sel) sel.value = state.party;
  update();
}

function clearParty() {
  if (!state.party) return;
  state.party = '';
  const sel = document.getElementById('filter-party');
  if (sel) sel.value = '';
  update();
}

function toggleUF(uf) {
  state.uf = state.uf === uf ? '' : uf;
  const sel = document.getElementById('filter-uf');
  if (sel) sel.value = state.uf;
  update();
}

function clearUF() {
  if (!state.uf) return;
  state.uf = '';
  const sel = document.getElementById('filter-uf');
  if (sel) sel.value = '';
  update();
}

function buildSegmentedControls(containerId, groups) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  if (!groups || groups.length === 0) return;
  const list = Array.isArray(groups[0]) ? groups : [groups];
  for (const grpItems of list) {
    const grp = document.createElement('div');
    grp.className = 'segmented-group';
    for (const item of grpItems) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `segmented-btn${item.active ? ' active' : ''}`;
      btn.setAttribute('aria-pressed', item.active ? 'true' : 'false');
      btn.textContent = item.label;
      btn.addEventListener('click', item.onClick);
      grp.appendChild(btn);
    }
    el.appendChild(grp);
  }
}

function renderCoverageTable(coverage) {
  const tbody = document.getElementById('coverage-tbody');
  if (!tbody || !coverage?.years) return;
  const roles = { '2018': 'Auxiliar (Coligações)', '2022': 'Baseline (Consolidado)', '2026': 'Comparação' };

  tbody.innerHTML = ['2018', '2022', '2026'].map((yr) => {
    const y = coverage.years[yr];
    if (!y) return '';
    const tot = y.population?.total_cands || 0;
    const apto = y.population?.apto_cands || 0;
    const fem = y.population?.gender_apto?.F || 0;
    const chapas = y.population?.chapas_reg?.total || 0;
    const micro = y.population?.chapas_reg?.micro_lt4 || 0;
    const fin = y.tp_prestacao_apto?.FINAL || 0;
    const hubs = y.hubs_summary?.hubs_count || 0;
    return `<tr>
      <td><strong>${yr}</strong></td>
      <td>${roles[yr] || ''}</td>
      <td>${tot.toLocaleString('pt-BR')}</td>
      <td>${apto.toLocaleString('pt-BR')}</td>
      <td>${fem.toLocaleString('pt-BR')} (${fmtPct(fem / (apto || 1))})</td>
      <td>${chapas.toLocaleString('pt-BR')} (${micro.toLocaleString('pt-BR')})</td>
      <td>${fmtPct(fin / (apto || 1))} (${y.dt_geracao?.receitas || '—'})</td>
      <td>${hubs.toLocaleString('pt-BR')}</td>
    </tr>`;
  }).join('');
}

function populateSelects() {
  const ufSel = document.getElementById('filter-uf');
  const curUf = ufSel.value;
  ufSel.innerHTML = '<option value="">Brasil (27 UFs)</option>';
  Object.keys(UF_NAMES).sort().forEach((uf) => {
    const opt = document.createElement('option');
    opt.value = uf;
    opt.textContent = `${UF_NAMES[uf]} (${uf})`;
    ufSel.appendChild(opt);
  });
  ufSel.value = UF_NAMES[curUf] ? curUf : '';

  const pSel = document.getElementById('filter-party');
  const curParty = pSel.value;
  const partyCounts = new Map();
  for (const c of APP_DATA.candidates) {
    if (c.y === state.year || c.y === 2022 || c.y === 2026) {
      partyCounts.set(c.p, (partyCounts.get(c.p) || 0) + 1);
    }
  }
  const parties = [...partyCounts.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);
  pSel.innerHTML = '<option value="">Todos os Partidos</option>';
  parties.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    pSel.appendChild(opt);
  });
  pSel.value = parties.includes(curParty) ? curParty : '';
}

function syncStepControlsVisibility(chartKey, idx) {
  if (chartKey === 'h1') {
    document.getElementById('controls-h1')?.classList.toggle('is-hidden', idx < 2);
  }
  if (chartKey === 'h3') {
    const cargoGroup = document.getElementById('cargo-h3-group');
    if (cargoGroup) cargoGroup.classList.toggle('is-hidden', idx < 2);
    if (!state.h3CargoLocked) {
      state.h3Cargo = idx === 2 ? '6' : state.cargo;
      document.querySelectorAll('[data-h3-cargo]').forEach((b) => {
        b.classList.toggle('active', b.dataset.h3Cargo === state.h3Cargo);
      });
    }
  }
}

function syncRecorteChip(label) {
  const isDefault = state.year === 2022
    && state.cargo === 'all'
    && !state.uf
    && !state.party
    && !state.h1BinFilter;
  const chip = document.getElementById('btn-recorte-chip');
  if (!chip) return;
  chip.hidden = isDefault;
  chip.textContent = `Recorte: ${label} · voltar ao padrão`;
}

function update() {
  if (!APP_DATA) return;

  const statsRows = getScopedRows({ year: state.year });
  const statsH3 = computeH3(statsRows);
  const statsH5 = computeH5(statsRows);
  const femApto = statsRows.filter((c) => c.apto && c.g === 'F');
  const femAlerts = femApto.filter((c) => countSignals(c, state.threshold).total >= 2).length;
  const pctAlerts = femApto.length > 0 ? femAlerts / femApto.length : 0;

  // Hero & Boca da Taça Readouts (com interpolação tabular suave)
  tweenPctText(document.getElementById('hero-val-cand'), statsH5.pctCandF);
  tweenPctText(document.getElementById('hero-val-verba'), statsH3.pctPubF);
  tweenPctText(document.getElementById('hero-val-eleitas'), statsH5.pctEleitasF);
  renderHeroFunnel(document.getElementById('hero-funnel-holder'), {
    cand: statsH5.pctCandF * 100,
    verba: statsH3.pctPubF * 100,
    eleitas: statsH5.pctEleitasF * 100,
  });

  tweenPctText(document.getElementById('readout-cand'), statsH5.pctCandF);
  tweenPctText(document.getElementById('readout-verba'), statsH3.pctPubF);
  tweenPctText(document.getElementById('readout-votos'), statsH5.pctVotosF);
  tweenPctText(document.getElementById('readout-eleitas'), statsH5.pctEleitasF);
  tweenPctText(document.getElementById('readout-alertas'), pctAlerts);

  const extraBin = state.h1BinFilter ? ` · H1 ${state.h1BinFilter.range}` : '';
  const recorteLabel = `${state.year} · ${CARGO_LABEL[state.cargo]} · ${state.uf ? UF_NAMES[state.uf] : 'Brasil (27 UFs)'}${state.party ? ` · ${state.party}` : ''}${extraBin}`;
  setText('hero-recorte-pill', recorteLabel);
  document.querySelectorAll('.active-recorte-text').forEach((el) => { el.textContent = recorteLabel; });
  setText('scope-summary', `${recorteLabel} — ${statsRows.length.toLocaleString('pt-BR')} candidaturas no recorte selecionado.`);
  syncRecorteChip(recorteLabel);

  const binParties = state.h1BinFilter?.parties?.size > 0 ? state.h1BinFilter.parties : null;

  // H1
  const h1Data = computeH1EightBins(APP_DATA.candidates, {
    cargo: state.cargo,
    uf: state.uf,
    party: state.party,
  });
  const h1Classic = computeH1(getScopedRows({ year: state.year, ignoreH1Bin: true }));
  renderVerdictPill('verdict-h1', h1Classic.verdict);
  const qBin = h1Data.bins.find((b) => b.isQuota);
  const b27 = h1Data.bins.find((b) => b.id === '27-30');
  const lt30Bins = h1Data.bins.filter((b) => b.zone === 'below');
  const isApto = state.h1Mode === 'apto';
  const curStepH1 = stepOf('h1');
  const qVal22 = qBin ? (isApto ? qBin.a22.pct : qBin.r22.pct) : 0;
  const qVal26 = qBin ? (isApto ? qBin.a26.pct : qBin.r26.pct) : 0;
  const bVal22 = b27 ? (isApto ? b27.a22.pct : b27.r22.pct) : 0;
  const bVal26 = b27 ? (isApto ? b27.a26.pct : b27.r26.pct) : 0;
  const lt30Reg22 = lt30Bins.reduce((s, b) => s + b.r22.pct, 0);
  const lt30Reg26 = lt30Bins.reduce((s, b) => s + b.r26.pct, 0);
  const lt30Apto22 = lt30Bins.reduce((s, b) => s + b.a22.pct, 0);
  const showYrH1 = curStepH1 >= 2 ? 2026 : 2022;
  const curQ = curStepH1 >= 2 ? qVal26 : qVal22;
  const curB = curStepH1 >= 2 ? bVal26 : bVal22;
  setText('h1-lead-pct', fmtPctDirect(qBin ? qBin.r22.pct : 0, 1));
  setText('h1-dyn-lt30', `${fmtPctDirect(lt30Reg22, 1)} em 2022 e ${fmtPctDirect(lt30Reg26, 1)} em 2026 abaixo de 30%`);
  setText('h1-dyn-apto-shift', `${fmtPctDirect(lt30Reg22, 1)} → ${fmtPctDirect(lt30Apto22, 1)} abaixo de 30% em 2022`);
  setText('title-h1', `Em ${showYrH1} (${isApto ? 'Aptas' : 'Registradas'}), ${fmtPctDirect(curQ, 0)} das chapas ficam em 30%–33%, contra ${fmtPctDirect(curB, 0)} logo abaixo (27%–30%)`);
  setText('h1-dyn-text', `${fmtPctDirect(qVal22, 1)} das chapas de 2022 ficam entre 30% e 33% (${isApto ? 'Aptas' : 'Registradas'}); abaixo do piso (<30%) são ${fmtPctDirect(lt30Reg22, 1)}. O piso funciona como teto operacional.`);

  const cH1 = document.getElementById('canvas-h1');
  R.h1 = (step = stepOf('h1'), prevStep = stepOf('h1')) => renderH1Histogram(cH1, h1Data, {
    step,
    prevStep,
    width: getCanvasWidth(cH1),
    mode: state.h1Mode,
    prevMode: state.h1PrevMode,
    selectedBinId: state.h1BinFilter?.id || null,
    onSelectBin: (bin) => {
      if (!bin || state.h1BinFilter?.id === bin.id) {
        state.h1BinFilter = null;
      } else {
        const list = state.h1Mode === 'apto' ? bin.partiesApto : bin.partiesReg;
        if (list && list.length > 0) {
          state.h1BinFilter = { id: bin.id, range: bin.range, parties: new Set(list) };
        }
      }
      update();
    },
  });
  R.h1();
  state.h1PrevMode = state.h1Mode;

  // H2
  const h2Gap = computeH2GapEvolution(APP_DATA.candidates, {
    cargo: state.cargo,
    uf: state.uf || null,
    parties: binParties,
    selectedParty: state.party,
    limit: 10,
  });
  const h2bRows = getScopedRows({ year: state.year, ignoreParty: true });
  const h2b = computeH2PublicVsPrivate(computeH2(h2bRows), { selectedParty: state.party });
  renderVerdictPill('verdict-h2', h2Gap.verdict);
  const ratioValid = h2Gap.rows.filter((r) => r.medM2026 > 0 && r.medF2022 !== null);
  const belowParityPct = ratioValid.length > 0
    ? Math.round((ratioValid.filter((r) => r.medF2026 < r.medM2026).length / ratioValid.length) * 100)
    : 0;
  setText('title-h2', `Em ${belowParityPct}% dos ${ratioValid.length} maiores partidos (2026), mulheres têm mediana menor; no total das legendas (${state.year}), ${fmtPct(h2b.pubShareF)} da receita feminina vem do fundo público`);
  setText('h2-dyn-pub', fmtPct(h2b.pubShareF));

  const cH2 = document.getElementById('canvas-h2');
  R.h2 = (step = stepOf('h2'), prevStep = stepOf('h2')) => renderH2Dumbbell(cH2, h2Gap, h2b, {
    step,
    prevStep,
    width: getCanvasWidth(cH2),
    activeYear: state.year,
    selectedParty: state.party,
    onSelectParty: toggleParty,
    onClearParty: clearParty,
  });
  R.h2();

  // H3 (escala fixa sem zoom, rotulando apenas legendas abaixo da meta proporcional)
  const h3Rows = getScopedRows({ year: state.year, cargo: state.h3Cargo, ignoreParty: true });
  const h3 = computeH3(h3Rows);
  renderVerdictPill('verdict-h3', h3.verdict);
  setText('recorte-h3-label', `${state.year} · ${CARGO_LABEL[state.h3Cargo]} · ${state.uf ? UF_NAMES[state.uf] : 'Brasil'}`);
  setText('title-h3', h3.subfinancedCount > 0
    ? `${h3.subfinancedCount} de ${h3.parties.length} legendas repassam às mulheres fatia inferior ao peso na chapa em ${state.year} (déficit de −${fmtCompactBrl(h3.totalDeficitBrl).replace('R$ ', 'R$ ')})`
    : `Todas as ${h3.parties.length} legendas analisadas em ${state.year} alcançam proporcionalidade no Fundo Público (razão ${h3.equityRatio.toFixed(2).replace('.', ',')}×)`);
  setText('h3-dyn-deficit', `−${fmtCompactBrl(h3.totalDeficitBrl)}`);

  const cH3 = document.getElementById('canvas-h3');
  R.h3 = (step = stepOf('h3'), prevStep = stepOf('h3')) => renderH3Scatter(cH3, h3, {
    step,
    prevStep,
    width: getCanvasWidth(cH3),
    zoomMode: 'all',
    selectedParty: state.party,
    onSelectParty: toggleParty,
    onClearParty: clearParty,
  });
  R.h3();

  // H4 (Sankey passo 0-1, Rede de Hubs passo 2)
  const h4Rows = getScopedRows({ year: state.year });
  const flowStats = computeH4FlowStats(h4Rows, { cohort: state.h4Cohort });
  setText('title-h4', stepOf('h4') >= 2
    ? `Principais fornecedores-hub (${state.year}) atendem dezenas de candidaturas simultaneamente, incluindo campanhas de baixa votação`
    : `Cerca de ${Math.round(flowStats.sharedPct)}% dos recursos (${fmtCompactBrl(flowStats.totShared)}) fluem para fornecedores compartilhados e ${fmtPctDirect(flowStats.partyPct, 1)} para partidos/terceiros`);

  const cH4 = document.getElementById('canvas-h4');
  R.h4 = (step = stepOf('h4'), prevStep = stepOf('h4')) => {
    if (step >= 2) {
      const hubYear = APP_DATA.hubs?.years?.[String(state.year)] || APP_DATA.hubs?.years?.['2022'];
      renderH4Hubs(cH4, hubYear, {
        width: getCanvasWidth(cH4),
        year: state.year,
        uf: state.uf,
        party: state.party,
        animate: prevStep < 2,
      });
    } else {
      renderH4Sankey(cH4, flowStats, { step, prevStep, width: getCanvasWidth(cH4) });
    }
  };
  R.h4();

  // H5
  const h5Rows = getScopedRows({ year: state.year, ignoreParty: true });
  const h5 = computeH5(h5Rows, { selectedParty: state.party });
  renderVerdictPill('verdict-h5', h5.verdict);
  const dropVoteCount = h5.byParty.filter((p) => p.pctVotosF < p.pctCandF * 0.78).length;
  setText('title-h5', `Em ${dropVoteCount} dos ${h5.byParty.length} maiores partidos (${state.year}), a participação feminina despenca já nos votos nominais — antes das sobras`);
  setText('h5-dyn-drop', `${(h5.dropUrna * 100).toFixed(1).replace('.', ',')} p.p.`);

  const cH5 = document.getElementById('canvas-h5');
  R.h5 = (step = stepOf('h5'), prevStep = stepOf('h5')) => renderH5Conversion(cH5, h5, {
    step,
    prevStep,
    view: state.h5View,
    width: getCanvasWidth(cH5),
    selectedParty: state.party,
    onSelectParty: toggleParty,
    onClearParty: clearParty,
  });
  R.h5();

  // H6 (Consolidado — Sinais A, B, C e >=2 comparando Mulheres vs. Homens)
  const h6Series = computeH6Series(APP_DATA.candidates, {
    cargo: state.cargo,
    uf: state.uf || null,
    party: state.party || null,
    parties: binParties,
    voteThreshold: state.threshold,
  });
  const h6YearObj = h6Series.byYear[state.h6Year] || h6Series.byYear[2022];
  const fS6 = h6YearObj?.summary?.F || { n: 1, sigA: 0, sigB: 0, sigC: 0, twoPlus: 0 };
  const mS6 = h6YearObj?.summary?.M || { n: 1, sigA: 0, sigB: 0, sigC: 0, twoPlus: 0 };
  const h6InconclusiveVerdict = {
    status: 'inconclusivo',
    label: 'Inconclusivo',
    reason: `Em ${state.h6Year}, sinais individuais são próximos entre mulheres e homens (Sinal A: ${fmtPct(fS6.sigA / (fS6.n || 1))} F vs. ${fmtPct(mS6.sigA / (mS6.n || 1))} M; ≥2 sinais: ${fmtPct(h6YearObj?.pct2PlusF || 0)} F vs. ${fmtPct(h6YearObj?.pct2PlusM || 0)} M). Indicadores isolados são inconclusivos sem prova documental.`,
  };
  renderVerdictPill('verdict-h6', h6InconclusiveVerdict);
  setText('h6-dyn-summary', `Sinal A ${fmtPct(fS6.sigA / (fS6.n || 1))} vs. ${fmtPct(mS6.sigA / (mS6.n || 1))}, Sinal B ${fmtPct(fS6.sigB / (fS6.n || 1))} vs. ${fmtPct(mS6.sigB / (mS6.n || 1))}, Sinal C ${fmtPct(fS6.sigC / (fS6.n || 1))} vs. ${fmtPct(mS6.sigC / (mS6.n || 1))}`);
  setText('title-h6', `Em ${state.h6Year}, sinais A, B e C têm taxas próximas entre mulheres (${fmtPct(h6YearObj?.pct2PlusF || 0)} ≥2) e homens (${fmtPct(h6YearObj?.pct2PlusM || 0)} ≥2) — quadro inconclusivo`);

  const cH6 = document.getElementById('canvas-h6');
  R.h6 = (step = stepOf('h6'), prevStep = stepOf('h6')) => renderH6Signals(cH6, h6Series, {
    step,
    prevStep,
    width: getCanvasWidth(cH6),
    year: state.h6Year,
  });
  R.h6();

  // Comparativo 30%–33% vs. >33% (excluindo <30%; alternável Por Chapa | Por Partido)
  const limiarRows = getScopedRows({ year: state.limiarYear, ignoreParty: state.limiarUnit === 'party' });
  const limiarData = computeThresholdBandComparison(limiarRows, { unit: state.limiarUnit });
  renderVerdictPill('verdict-limiar', limiarData.verdict);
  const unitNameLimiar = state.limiarUnit === 'party' ? 'Por Partido' : 'Por Chapa';
  setText('recorte-limiar-label', `${state.limiarYear} · ${unitNameLimiar} (exclui <30%)`);
  setText('title-limiar', `${unitNameLimiar} (${state.limiarYear}): faixa >33% tem ${fmtPctDirect(limiarData.above.pctEleitasF, 1)} de eleitas e mediana F de ${fmtCompactBrl(limiarData.above.medF)}, contra ${fmtPctDirect(limiarData.floor.pctEleitasF, 1)} e ${fmtCompactBrl(limiarData.floor.medF)} em 30%–33%`);
  setText('limiar-dyn-text', `No recorte ${unitNameLimiar.toLowerCase()} de ${state.limiarYear}, eleitas passam de ${fmtPctDirect(limiarData.floor.pctEleitasF, 1)} (30%–33%) para ${fmtPctDirect(limiarData.above.pctEleitasF, 1)} (>33%)`);

  const cLimiar = document.getElementById('canvas-limiar');
  R.limiar = (step = stepOf('limiar'), prevStep = stepOf('limiar')) => renderThresholdCompare(cLimiar, limiarData, {
    step,
    prevStep,
    width: getCanvasWidth(cLimiar),
    year: state.limiarYear,
  });
  R.limiar();

  // H7 (Sinalizado para remoção na próxima etapa)
  const h7Comp = computeH7Comparison(APP_DATA.candidates, {
    cargo: state.cargo,
    uf: state.uf || null,
    party: state.party || null,
    parties: binParties,
    voteThreshold: state.threshold,
  });
  renderVerdictPill('verdict-h7', h7Comp.verdict2022);
  const fFloor22 = h7Comp.rows.find((r) => r.band === '30%–33,3%')?.y2022?.aggRatePct || 0;
  const fFloor26 = h7Comp.rows.find((r) => r.band === '30%–33,3%')?.y2026?.aggRatePct || 0;
  const fLt30_26 = h7Comp.rows.find((r) => r.band === '< 30%')?.y2026?.aggRatePct || 0;
  setText('title-h7', `Alertas no piso (30%–33,3%) caem de ${fmtPctDirect(fFloor22)} (2022) para ${fmtPctDirect(fFloor26)} (2026), migrando para chapas <30% (${fmtPctDirect(fLt30_26)})`);

  const cH7 = document.getElementById('canvas-h7');
  R.h7 = (step = stepOf('h7'), prevStep = stepOf('h7')) => renderH7Boxplot(cH7, h7Comp, {
    step,
    prevStep,
    width: getCanvasWidth(cH7),
    show2018: state.h7Show2018,
  });
  R.h7();

  // H8 (Sinalizado para remoção na próxima etapa)
  const h8 = computeH8(APP_DATA.candidates, {
    cargo: state.cargo,
    uf: state.uf || null,
    party: state.party || null,
    parties: binParties,
    voteThreshold: state.threshold,
  });
  renderVerdictPill('verdict-h8', h8.verdict);
  setText('title-h8', `De 2018 a 2026, contas zeradas recuam para ${fmtPct(h8.byYear[2026].pctZero)}, enquanto lotes padronizados sobem para ${fmtPct(h8.byYear[2026].pctStd)}`);
  setText('h8-dyn-zero', `${fmtPct(h8.byYear[2018].pctZero)} → ${fmtPct(h8.byYear[2026].pctZero)}`);
  setText('h8-dyn-std', `${fmtPct(h8.byYear[2018].pctStd)} → ${fmtPct(h8.byYear[2026].pctStd)}`);

  const cH8 = document.getElementById('canvas-h8');
  R.h8 = (step = stepOf('h8'), prevStep = stepOf('h8')) => renderH8Temporal(cH8, h8, {
    step,
    prevStep,
    width: getCanvasWidth(cH8),
  });
  R.h8();

  // Ato 5 — Onde a Cota Vira Voto (5 Passos Causa -> Efeito com dados reais TSE e contorno IBGE)
  const ato5Data = computeAto5Geography(APP_DATA.candidates, {
    year: state.ato5Year,
    cargo: state.ato5Cargo,
    party: state.party || '',
    parties: binParties,
    ufList: Object.keys(UF_NAMES).sort(),
  });
  renderVerdictPill('verdict-h9', ato5Data.verdict);

  const cargoTagAto5 = state.ato5Cargo === 'all' ? 'Todos os cargos' : CARGO_LABEL[state.ato5Cargo];
  setText('ato5-context-tag', `${state.ato5Year} · ${cargoTagAto5} · Dados reais TSE`);
  setText('ato5-eligible-note', `${ato5Data.eligibleCount} de 27 UFs com amostra válida · contorno geográfico real (IBGE)`);

  const mapResetBtn = document.getElementById('btn-map-reset-uf');
  if (mapResetBtn) {
    mapResetBtn.hidden = !state.ato5SelectedUf;
    if (state.ato5SelectedUf) mapResetBtn.textContent = `Limpar ${state.ato5SelectedUf} ×`;
  }

  const cAto5Steps = document.getElementById('ato5-steps-col');
  const cAto5Map = document.getElementById('canvas-h9-map');
  const cAto5Callouts = document.getElementById('ato5-compact-callouts');
  const navPillsEl = document.getElementById('ato5-nav-pills');

  const syncAto5StepUI = (stepIdx) => {
    const stepMeta = ATO5_STEPS[Math.max(0, Math.min(ATO5_STEPS.length - 1, stepIdx))];
    setText('ato5-active-pill', `Passo ${stepIdx + 1}/5 · ${stepMeta.badge}`);
    setText('ato5-legend-top5', stepMeta.isSynthesis ? 'Top 5 Mulheres Eleitas' : 'Top 5 neste pilar');
    setText('title-h9', stepMeta.isSynthesis
      ? `Em ${state.ato5Year}, ${ato5Data.twoPlusCount} de 5 líderes em mulheres eleitas acumularam ≥ 2 pilares estruturais`
      : `${stepMeta.title} (${state.ato5Year} · ${cargoTagAto5})`);

    if (navPillsEl) {
      navPillsEl.innerHTML = ATO5_STEPS.map((s, i) => `
        <button
          type="button"
          class="ato5-nav-pill${i === stepIdx ? ' is-active' : ''}${s.isSynthesis ? ' is-synthesis' : ''}"
          data-ato5-jump="${i}"
        >${s.shortPill}</button>
      `).join('');
      navPillsEl.querySelectorAll('[data-ato5-jump]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const targetIdx = Number(btn.dataset.ato5Jump);
          const card = cAto5Steps?.querySelector(`.step-card[data-step="${targetIdx}"]`);
          if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (isStaticMode() && R.h9) R.h9(targetIdx, stepOf('h9'));
        });
      });
    }
  };

  const handleHoverAto5 = (uf) => {
    state.ato5HoveredUf = uf;
    highlightAto5UF(cAto5Map, cAto5Callouts, cAto5Steps, state.ato5HoveredUf || state.ato5SelectedUf);
  };

  const handleSelectAto5 = (uf) => {
    state.ato5SelectedUf = state.ato5SelectedUf === uf ? '' : uf;
    update();
  };

  R.h9 = (step = stepOf('h9'), prevStep = step) => {
    syncAto5StepUI(step);
    renderAto5StepCards(cAto5Steps, ato5Data, {
      activeStep: step,
      prevStep,
      selectedUF: state.ato5SelectedUf,
      onHoverUF: handleHoverAto5,
      onSelectUF: handleSelectAto5,
    });
    renderAto5MapStage(cAto5Map, cAto5Callouts, APP_DATA.brUf, ato5Data, {
      step,
      prevStep,
      width: Math.min(500, Math.max(300, cAto5Map?.clientWidth || 440)),
      hoveredUF: state.ato5HoveredUf,
      selectedUF: state.ato5SelectedUf,
      onHoverUF: handleHoverAto5,
      onSelectUF: handleSelectAto5,
      onClearUF: () => {
        state.ato5SelectedUf = '';
        update();
      },
    });
  };
  R.h9();
}

function syncH1ModeButtons() {
  document.querySelectorAll('[data-h1-mode]').forEach((b) => {
    b.classList.toggle('active', b.dataset.h1Mode === state.h1Mode);
  });
}

function bindEvents() {
  // Controles locais dos gráficos
  document.querySelectorAll('[data-h1-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      clearTimeout(h1AutoTimer);
      state.h1UserLocked = true;
      state.h1PrevMode = state.h1Mode;
      state.h1Mode = btn.dataset.h1Mode;
      syncH1ModeButtons();
      update();
    });
  });

  document.querySelectorAll('[data-h3-cargo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.h3Cargo = btn.dataset.h3Cargo;
      state.h3CargoLocked = true;
      document.querySelectorAll('[data-h3-cargo]').forEach((b) => b.classList.toggle('active', b === btn));
      update();
    });
  });

  document.querySelectorAll('[data-h4-cohort]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.h4Cohort = btn.dataset.h4Cohort;
      document.querySelectorAll('[data-h4-cohort]').forEach((b) => b.classList.toggle('active', b === btn));
      update();
    });
  });

  document.querySelectorAll('[data-h5-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.h5View = btn.dataset.h5View;
      document.querySelectorAll('[data-h5-view]').forEach((b) => b.classList.toggle('active', b === btn));
      update();
    });
  });

  document.querySelectorAll('[data-h6-year]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.h6Year = Number(btn.dataset.h6Year);
      document.querySelectorAll('[data-h6-year]').forEach((b) => b.classList.toggle('active', b === btn));
      update();
    });
  });

  document.querySelectorAll('[data-limiar-unit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.limiarUnit = btn.dataset.limiarUnit;
      document.querySelectorAll('[data-limiar-unit]').forEach((b) => b.classList.toggle('active', b === btn));
      update();
    });
  });

  document.querySelectorAll('[data-limiar-year]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.limiarYear = Number(btn.dataset.limiarYear);
      document.querySelectorAll('[data-limiar-year]').forEach((b) => b.classList.toggle('active', b === btn));
      update();
    });
  });

  document.querySelectorAll('[data-ato5-cargo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.ato5Cargo = btn.dataset.ato5Cargo;
      document.querySelectorAll('[data-ato5-cargo]').forEach((b) => b.classList.toggle('active', b === btn));
      update();
    });
  });

  document.querySelectorAll('[data-ato5-year]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.ato5Year = Number(btn.dataset.ato5Year);
      document.querySelectorAll('[data-ato5-year]').forEach((b) => b.classList.toggle('active', b === btn));
      update();
    });
  });

  document.getElementById('btn-h7-2018')?.addEventListener('click', (e) => {
    state.h7Show2018 = !state.h7Show2018;
    e.currentTarget.classList.toggle('active', state.h7Show2018);
    e.currentTarget.textContent = state.h7Show2018 ? 'Ocultar 2018' : 'Mostrar 2018';
    update();
  });

  document.getElementById('filter-threshold')?.addEventListener('input', (e) => {
    state.threshold = Number(e.target.value);
    setText('threshold-out', String(state.threshold));
    update();
  });

  // Filtros da Boca da Taça
  document.getElementById('filter-year')?.addEventListener('change', (e) => {
    state.year = Number(e.target.value);
    state.ato5Year = state.year;
    document.querySelectorAll('[data-ato5-year]').forEach((b) => b.classList.toggle('active', Number(b.dataset.ato5Year) === state.ato5Year));
    populateSelects();
    update();
  });

  document.getElementById('filter-cargo')?.addEventListener('change', (e) => {
    state.cargo = e.target.value;
    if (!state.h3CargoLocked) state.h3Cargo = state.cargo;
    state.ato5Cargo = state.cargo;
    document.querySelectorAll('[data-ato5-cargo]').forEach((b) => b.classList.toggle('active', b.dataset.ato5Cargo === state.ato5Cargo));
    update();
  });

  document.getElementById('filter-uf')?.addEventListener('change', (e) => {
    state.uf = e.target.value;
    update();
  });

  document.getElementById('filter-party')?.addEventListener('change', (e) => {
    state.party = e.target.value;
    update();
  });

  const resetAll = () => {
    clearTimeout(h1AutoTimer);
    state.year = 2022;
    state.cargo = 'all';
    state.uf = '';
    state.party = '';
    state.threshold = 10;
    state.h1Mode = 'reg';
    state.h1PrevMode = 'reg';
    state.h1UserLocked = false;
    state.h1BinFilter = null;
    state.h3Cargo = 'all';
    state.h3CargoLocked = false;
    state.h6Year = 2022;
    state.limiarUnit = 'chapa';
    state.limiarYear = 2022;
    state.ato5Year = 2022;
    state.ato5Cargo = 'all';
    state.ato5SelectedUf = '';
    document.getElementById('filter-year').value = '2022';
    document.getElementById('filter-cargo').value = 'all';
    document.getElementById('filter-uf').value = '';
    document.getElementById('filter-party').value = '';
    const thr = document.getElementById('filter-threshold');
    if (thr) thr.value = '10';
    setText('threshold-out', '10');
    syncH1ModeButtons();
    document.querySelectorAll('[data-h3-cargo]').forEach((b) => b.classList.toggle('active', b.dataset.h3Cargo === 'all'));
    document.querySelectorAll('[data-h6-year]').forEach((b) => b.classList.toggle('active', Number(b.dataset.h6Year) === 2022));
    document.querySelectorAll('[data-limiar-unit]').forEach((b) => b.classList.toggle('active', b.dataset.limiarUnit === 'chapa'));
    document.querySelectorAll('[data-limiar-year]').forEach((b) => b.classList.toggle('active', Number(b.dataset.limiarYear) === 2022));
    document.querySelectorAll('[data-ato5-cargo]').forEach((b) => b.classList.toggle('active', b.dataset.ato5Cargo === 'all'));
    document.querySelectorAll('[data-ato5-year]').forEach((b) => b.classList.toggle('active', Number(b.dataset.ato5Year) === 2022));
    populateSelects();
    update();
  };

  document.getElementById('btn-reset-filters')?.addEventListener('click', resetAll);
  document.getElementById('btn-recorte-chip')?.addEventListener('click', resetAll);
  document.getElementById('btn-map-reset-uf')?.addEventListener('click', () => {
    state.ato5SelectedUf = '';
    update();
  });

  // Scrollspy & barra de progresso da haste da taça
  const sectionIds = ['topo', 'ato-01', 'ato-02', 'ato-03', 'ato-04', 'ato-05', 'sintese', 'boca-da-taca'];
  const secs = sectionIds.map((id) => document.getElementById(id)).filter(Boolean);
  const ACT_LABELS = [
    'Introdução', 'Ato 1 de 5 · No papel', 'Ato 2 de 5 · No dinheiro',
    'Ato 3 de 5 · Na urna', 'Ato 4 de 5 · Sinais e limiar', 'Ato 5 de 5 · Onde a Cota Vira Voto',
    'Síntese', 'Sua vez: explore',
  ];
  const actNow = document.getElementById('act-now');
  const progressEl = document.getElementById('story-progress-bar');
  const jumpBtn = document.querySelector('.btn-jump-filters');
  let ticking = false;

  const onScroll = () => {
    ticking = false;
    const y = window.scrollY;
    const vh = window.innerHeight;
    let cur = 0;
    secs.forEach((el, i) => {
      if (el.getBoundingClientRect().top <= vh * 0.35) cur = i;
    });
    if (actNow) actNow.textContent = ACT_LABELS[cur] || '';
    const curId = secs[cur]?.id;
    document.querySelectorAll('.act-pill').forEach((p) => {
      const isAct = p.dataset.act === curId;
      p.classList.toggle('active', isAct);
      p.setAttribute('aria-current', isAct ? 'true' : 'false');
    });
    const sinteseEl = document.getElementById('sintese');
    if (progressEl && sinteseEl) {
      const end = y + sinteseEl.getBoundingClientRect().bottom - vh;
      const ratio = Math.max(0, Math.min(1, y / Math.max(1, end)));
      progressEl.style.transform = `scaleX(${ratio})`;
    }
    if (jumpBtn) jumpBtn.classList.toggle('is-ready', cur >= 6);
  };

  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(onScroll);
    }
  }, { passive: true });
  onScroll();

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    syncBarHeightVar();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => update(), 120);
  });
}

async function init() {
  syncBarHeightVar();
  APP_DATA = await loadAppData();

  document.getElementById('data-status-dot')?.classList.add('is-live');
  setText('data-status-label', 'Dados TSE (4/4 JSONs)');

  populateSelects();
  renderCoverageTable(APP_DATA.coverage);

  initScrolly((key, idx, prevIdx) => {
    syncStepControlsVisibility(key, idx);

    // Ato 1 (H1): passo 3 (2022 vs 2026 em Registradas), passo 4 (transição Registradas -> Aptas) e reset de filtro ao sair
    if (key === 'h1') {
      clearTimeout(h1AutoTimer);
      if ((prevIdx === 2 || prevIdx === 3) && idx !== prevIdx) {
        let changed = false;
        if (state.h1BinFilter) {
          state.h1BinFilter = null;
          changed = true;
        }
        if (idx < 3 && state.h1Mode !== 'reg') {
          state.h1PrevMode = state.h1Mode;
          state.h1Mode = 'reg';
          state.h1UserLocked = false;
          syncH1ModeButtons();
          changed = true;
        }
        if (changed) {
          update();
          if (idx !== 3) return;
        }
      }
      if (idx === 3 && !state.h1UserLocked && state.h1Mode === 'reg') {
        h1AutoTimer = setTimeout(() => {
          state.h1PrevMode = state.h1Mode;
          state.h1Mode = 'apto';
          syncH1ModeButtons();
          update();
        }, 650);
      }
    }

    if (R[key]) R[key](idx, prevIdx);
    if (key === 'h1') {
      const yr = idx >= 2 ? 2026 : 2022;
      const h1B = computeH1EightBins(APP_DATA.candidates, { cargo: state.cargo, uf: state.uf, party: state.party });
      const qB = h1B.bins.find((b) => b.isQuota);
      const b27B = h1B.bins.find((b) => b.id === '27-30');
      const isA = state.h1Mode === 'apto';
      if (qB && b27B) {
        const curQ = yr === 2026 ? (isA ? qB.a26.pct : qB.r26.pct) : (isA ? qB.a22.pct : qB.r22.pct);
        const curB = yr === 2026 ? (isA ? b27B.a26.pct : b27B.r26.pct) : (isA ? b27B.a22.pct : b27B.r22.pct);
        setText('title-h1', `Em ${yr} (${isA ? 'Aptas' : 'Registradas'}), ${fmtPctDirect(curQ, 0)} das chapas ficam em 30%–33%, contra ${fmtPctDirect(curB, 0)} logo abaixo (27%–30%)`);
      }
    }
    if (key === 'h4') {
      const fS = computeH4FlowStats(getScopedRows({ year: state.year }), { cohort: state.h4Cohort });
      setText('title-h4', idx >= 2
        ? `Principais fornecedores-hub (${state.year}) atendem dezenas de candidaturas simultaneamente, incluindo campanhas de baixa votação`
        : `Cerca de ${Math.round(fS.sharedPct)}% dos recursos (${fmtCompactBrl(fS.totShared)}) fluem para fornecedores compartilhados e ${fmtPctDirect(fS.partyPct, 1)} para partidos/terceiros`);
    }
  }, {
    onExitBlock: (key) => {
      if (key === 'h1') {
        clearTimeout(h1AutoTimer);
        if (state.h1BinFilter) {
          state.h1BinFilter = null;
          update();
        }
      }
    },
  });

  ['h1', 'h3'].forEach((k) => syncStepControlsVisibility(k, stepOf(k)));
  bindEvents();
  update();
}

init().catch((err) => {
  console.error(err);
  const banner = document.getElementById('error-banner');
  if (banner) banner.hidden = false;
  setText('data-status-label', 'Erro nos dados');
});
