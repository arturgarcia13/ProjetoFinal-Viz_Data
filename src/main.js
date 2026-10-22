import * as d3 from 'd3';
import { loadDashboard, UF_NAMES } from './data.js';
import {
  makeState, applyFilters, computeStats, computeH9, partyRows, verdicts, pct, ratioTxt, qeByDistrict, ufDiagnostics
} from './state.js';
import { renderStageStrip } from './charts/stageStrip.js';
import { renderHistogram } from './charts/histogram.js';
import { renderMap } from './charts/map.js';
import { renderDumbbell } from './charts/dumbbell.js';
import { renderSources } from './charts/sources.js';
import { renderFefcScatter } from './charts/fefcScatter.js';
import { renderMoneySankey } from './charts/moneySankey.js';
import { renderNetwork } from './charts/network.js';
import { renderFunnel } from './charts/funnel.js';
import { renderConversion } from './charts/conversion.js';
import { renderVoteScatter } from './charts/voteScatter.js';
import { renderFundingLine } from './charts/fundingLine.js';
import { renderGapBars } from './charts/gapBars.js';
import { renderRace } from './charts/race.js';
import { renderSignals } from './charts/signals.js';
import { renderBox } from './charts/box.js';
import { renderH9 } from './charts/h9.js';
import { renderParallel } from './charts/parallel.js';

const state = makeState();
let DATA = null;
let raf = 0;

const CARGO_LABEL = {
  dep: 'Federal + Estadual',
  federal: 'Federal',
  estadual: 'Estadual',
  distrital: 'Distrital'
};

const on = {
  toggleParty(leg) {
    if (!leg) return;
    if (state.parties.has(leg)) state.parties.delete(leg);
    else state.parties.add(leg);
    schedule();
  },
  toggleUF(uf) {
    state.uf = state.uf === uf ? null : uf;
    schedule();
  },
  setBrush(b) {
    state.brush = b;
    schedule();
  },
  clearBrush() {
    state.brush = null;
    schedule();
  },
  setSlate(range) {
    state.slate = range;
    schedule();
  },
  clearSlate() {
    state.slate = null;
    schedule();
  },
  setPCRanges(ranges, allowed) {
    state.pcRanges = ranges;
    state.pcParties = allowed;
    schedule();
  },
  clearPC() {
    state.pcRanges = {};
    state.pcParties = new Set();
    schedule();
  },
  setYear(y) {
    state.year = y;
    schedule();
  },
  setCargo(c) {
    state.cargo = c;
    schedule();
  },
  setThreshold(t) {
    state.threshold = t;
    schedule();
  },
  reset() {
    state.uf = null;
    state.parties = new Set();
    state.pcParties = new Set();
    state.pcRanges = {};
    state.brush = null;
    state.slate = null;
    state.threshold = 10;
    state.histMode = 'pct';
    const th = document.getElementById('threshold');
    if (th) th.value = 10;
    const out = document.getElementById('threshold-out');
    if (out) out.textContent = '10';
    schedule();
  }
};

function schedule() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(renderAll);
}

function buildContext() {
  const all = DATA.candidates;
  const filtered = applyFilters(all, state);
  const contextRows = applyFilters(all, state, 'slate');
  const scatterRows = applyFilters(all, state, 'brush');
  const mapRows = applyFilters(all, { ...state, uf: null });
  const partyCtxRows = applyFilters(all, { ...state, parties: new Set(), pcParties: new Set() });
  const partyContext = partyRows(partyCtxRows, state.threshold);
  const qeMap = qeByDistrict(all, state.year, state.cargo);
  const stats = computeStats(filtered, contextRows, state, qeMap);
  const h9 = computeH9(all, state);
  const ufStages = ufStageCounts(mapRows, state.threshold, qeMap);
  const verdict = verdicts(stats, state, ufStages);
  return {
    data: DATA, geo: DATA.geo, suppliers: DATA.suppliers, hubNetwork: DATA.hubNetwork,
    state, on, rows: filtered, filtered, contextRows, scatterRows, mapRows,
    partyContext, stats, h9, verdict, ufStages, qeMap
  };
}

function renderAll() {
  if (!DATA) return;
  const c = buildContext();
  updateFilterBar(c);

  const jobs = [
    ['chart-stage', el => renderStageStrip(el, c)],
    ['chart-hist', el => renderHistogram(el, c)],
    ['chart-map-women', el => renderMap(el, c, 'women')],
    ['chart-dumbbell', el => renderDumbbell(el, c)],
    ['chart-sources', el => renderSources(el, c)],
    ['chart-fefc', el => renderFefcScatter(el, c)],
    ['chart-money-sankey', el => renderMoneySankey(el, c)],
    ['chart-network', el => renderNetwork(el, c)],
    ['chart-funnel', el => renderFunnel(el, c)],
    ['chart-conversion', el => renderConversion(el, c)],
    ['chart-vote-scatter', el => renderVoteScatter(el, c)],
    ['chart-funding-line', el => renderFundingLine(el, c)],
    ['chart-gap', el => renderGapBars(el, c)],
    ['chart-race', el => renderRace(el, c)],
    ['chart-signals', el => renderSignals(el, c)],
    ['chart-map-signal', el => renderMap(el, c, 'signal')],
    ['chart-box', el => renderBox(el, c)],
    ['chart-h9', el => renderH9(el, c)],
    ['chart-map-stage', el => renderMap(el, c, 'stage')],
    ['chart-parallel', el => renderParallel(el, c)]
  ];

  for (const [id, fn] of jobs) {
    const el = document.getElementById(id);
    if (!el) continue;
    try { fn(el); }
    catch (err) {
      console.error(`[${id}]`, err);
      el.innerHTML = '<p class="empty">Não foi possível desenhar este gráfico neste recorte.</p>';
    }
  }

  renderVerdicts(c);
  renderScorecard(c);
  observeReveals();
}

function updateFilterBar(c) {
  document.querySelectorAll('[data-year]').forEach(b => b.classList.toggle('active', +b.dataset.year === state.year));
  document.querySelectorAll('[data-cargo]').forEach(b => b.classList.toggle('active', b.dataset.cargo === state.cargo));
  const out = document.getElementById('threshold-out');
  if (out) out.textContent = state.threshold;

  const parts = [String(state.year), CARGO_LABEL[state.cargo] || state.cargo];
  if (state.uf) parts.push(UF_NAMES[state.uf] || state.uf);
  if (state.parties.size) parts.push(`${state.parties.size} partido${state.parties.size > 1 ? 's' : ''}`);
  if (state.brush) parts.push('faixa de recursos/votos');
  if (state.slate) parts.push('faixa de chapa');
  if (state.pcParties.size) parts.push('coordenadas');
  const summary = document.getElementById('filter-summary');
  if (summary) summary.textContent = parts.join(' · ');

  const h7 = c.stats?.h7, h8 = c.stats?.h8?.bands;
  if (h7) {
    const lead = document.getElementById('ato4-lead');
    if (lead) lead.innerHTML = `Em ${state.year}, ${pct(h7.anyF)} das candidatas e ${pct(h7.anyM)} dos candidatos tinham ao menos um dos três sinais. ${h7.anyF > h7.anyM + 0.02 ? 'Há excesso feminino.' : 'Não há vantagem feminina — pelo contrário.'}`;
    const detail = document.getElementById('ato4-detail');
    if (detail) detail.innerHTML = `O sinal A (votos baixos) atinge ${pct(h7.aF)} das mulheres e ${pct(h7.aM)} dos homens; o B (conta sem receita e sem despesa, entre quem declarou) fica em ${pct(h7.bF)} das mulheres e ${pct(h7.bM)} dos homens; o C (mesmo fornecedor, valor e data em três ou mais candidaturas do partido) é ${h7.cF > h7.cM ? 'mais comum entre mulheres' : 'mais comum entre homens'} (${pct(Math.max(h7.cF, h7.cM))} × ${pct(Math.min(h7.cF, h7.cM))}).`;
    const h8p = document.getElementById('ato4-h8');
    if (h8p && h8) h8p.innerHTML = `As chapas no limiar estrito (30%–33%, Δ≤1) têm ${pct(h8['30–33'].two)} de candidaturas com ≥2 sinais; as chapas com 40% ou mais, ${pct(h8['40+'].two)}. ${h8['30–33'].two > h8['40+'].two + 0.05 ? 'O limiar concentra sinais.' : 'O problema não parece nascer da cota — ou, ao menos, não é possível encontrá-lo assim.'}`;
  }

  const lead5 = document.getElementById('ato5-lead');
  if (lead5 && c.ufStages) {
    const labels = { financiamento: 'financiamento', urna: 'urna', institucional: 'institucional', integridade: 'integridade' };
    const entries = Object.entries(c.ufStages.counts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const total = c.ufStages.total || 1;
    lead5.innerHTML = entries.length
      ? `Em ${state.year}, o gargalo dominante se distribui entre as UFs: ${entries.map(([k, v]) => `<strong>${labels[k] || k}</strong> em ${v} de ${total}`).join(' · ')}. O mapa calcula o <code>argmax(Z)</code> entre financiamento, urna, institucional e integridade.`
      : 'Sem UFs com amostra suficiente para calcular o gargalo dominante.';
  }

  const rn = document.getElementById('repasses-note');
  if (rn && c.stats?.h4) {
    const h4 = c.stats.h4;
    const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    rn.innerHTML = `No recorte, ${brl.format(h4.repF + h4.repM)} em receitas declaradas de outras candidaturas; ${pct(h4.repFefcShareF)} das mulheres e ${pct(h4.repFefcShareM)} dos homens vêm com fonte FEFC declarada.${state.year === 2026 ? ' Contas preliminares.' : ''}`;
  }

  const chips = document.getElementById('chips');
  if (!chips) return;
  const items = [];
  if (state.year === 2026) items.push('<span class="chip warn-chip">2026 · contas preliminares</span>');
  if (state.uf) items.push(chip(UF_NAMES[state.uf] || state.uf, 'uf'));
  for (const p of state.parties) items.push(chip(p, 'party', p));
  if (state.brush) {
    const f = d3.formatLocale({ decimal: ',', thousands: '.' }).format(',');
    items.push(chip(`Receita R$ ${f(Math.round(state.brush.r[0]))}–${f(Math.round(state.brush.r[1]))} · votos ${f(Math.round(state.brush.v[0]))}–${f(Math.round(state.brush.v[1]))}`, 'brush'));
  }
  if (state.slate) items.push(chip(`Chapas ${Math.round(state.slate[0] * 100)}–${Math.round(state.slate[1] * 100)}%`, 'slate'));
  if (state.pcParties.size) items.push(chip(`Filtro de coordenadas (${state.pcParties.size} partidos)`, 'pc'));
  chips.innerHTML = items.join('');
  chips.classList.toggle('has', items.length > 0);
}

function chip(label, type, value = '') {
  return `<span class="chip"><b>${escapeHtml(label)}</b><button data-remove="${type}" data-value="${escapeHtml(value)}" aria-label="Remover filtro">×</button></span>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const STATUS_LABEL = {
  funciona: 'A cota funciona nesta etapa',
  vaza: 'A cota vaza nesta etapa',
  inconclusivo: 'Inconclusivo'
};
const SHORT_LABEL = { funciona: 'FUNCIONA', vaza: 'VAZA', inconclusivo: 'INCONCLUSIVO' };

function verdictHtml(h, v) {
  return `<div class="verdict ${v.status}">
    <div class="verdict-top"><span class="verdict-h">${h}</span><span class="verdict-status">${STATUS_LABEL[v.status]}</span></div>
    <p class="verdict-reason">${escapeHtml(v.reason)}</p>
    ${v.detail ? `<p class="verdict-detail">${escapeHtml(v.detail)}</p>` : ''}
  </div>`;
}

function renderVerdicts(c) {
  const v = c.verdict;
  const one = document.getElementById('verdict-1');
  if (one) one.innerHTML = verdictHtml('H1 · Chapas', v.h1);
  const two = document.getElementById('verdict-2');
  if (two) two.innerHTML = verdictHtml('H2 · Receita', v.h2) + verdictHtml('H3 · FEFC', v.h3) + verdictHtml('H4 · Repasses', v.h4);
  const three = document.getElementById('verdict-3');
  if (three) three.innerHTML = verdictHtml('H5 · Conversão', v.h5) + verdictHtml('H6 · Resíduo', v.h6);
  const four = document.getElementById('verdict-4');
  if (four) four.innerHTML = verdictHtml('H7 · Sinais', v.h7) + verdictHtml('H8 · Chapas limítrofes', v.h8) + verdictHtml('H9 · 2022 × 2026', v.h9);
  const five = document.getElementById('verdict-5');
  if (five) five.innerHTML = verdictHtml('H10 · Heterogeneidade', v.h10);
}

function worstVerdict(vs) {
  if (vs.some(v => v.status === 'vaza')) return 'vaza';
  if (vs.some(v => v.status === 'inconclusivo')) return 'inconclusivo';
  return 'funciona';
}

function renderScorecard(c) {
  const box = document.getElementById('scorecard');
  if (!box) return;
  const { stats, verdict: v, mapRows, state } = c;
  const urna = worstVerdict([v.h5, v.h6]);
  const sombra = worstVerdict([v.h7, v.h8, v.h9]);
  const ufStages = c.ufStages || ufStageCounts(mapRows, state.threshold);
  const entries = Object.entries(ufStages.counts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const topStage = entries[0] || ['nenhum', 0];
  const stageLabels = { financiamento: 'financiamento', urna: 'urna', institucional: 'institucional', integridade: 'integridade' };
  const stageList = entries.map(([k, v]) => `${stageLabels[k] || k} (${v})`).join(' · ');

  const rows = [
    {
      k: 'Papel', v: v.h1.status,
      text: `<b>${pct(stats.h1.compliance)}</b> das chapas cumprem 30%. ${pct(stats.h1.pileup)} ficam entre 30% e 33,3%.`
    },
    {
      k: 'FEFC', v: v.h3.status,
      text: `FEFC em <b>${ratioTxt(stats.h3.ratio)}×</b> a presença feminina. No privado, mediana de <b>${ratioTxt(stats.h2.privateRatio)}×</b>.`
    },
    {
      k: 'Urna', v: urna,
      text: `Conversão de <b>${ratioTxt(stats.h5.convRatio)}×</b>. ${pct(stats.womenShare)} das candidaturas, ${pct(stats.voteShare)} dos votos, ${pct(stats.seatShare)} das cadeiras.`
    },
    {
      k: 'Sombra', v: sombra,
      text: `Sinais: <b>${pct(stats.h7.anyF)}</b> × <b>${pct(stats.h7.anyM)}</b>. 2026 segue inconclusivo: contas preliminares.`
    }
  ];
  box.innerHTML = rows.map(r => `
    <div class="score-row">
      <span class="score-stage">${r.k}</span>
      <span class="score-text">${r.text}</span>
      <span class="score-pill ${r.v}">${SHORT_LABEL[r.v]}</span>
    </div>`).join('')
    + `<p class="chart-note" style="border:0;padding-top:10px">Gargalo dominante nas UFs com amostra: <b>${stageList || 'sem amostra'}</b>. ${state.year === 2022 ? 'Nenhuma etapa concentra a maioria das UFs; a correção precisa ser desenhada por partido e por UF.' : 'Em 2026, as contas preliminares tornam a leitura do dinheiro instável.'}</p>`;
}

function ufStageCounts(rows, threshold, qeMap = null) {
  const recs = ufDiagnostics(rows, threshold, qeMap);
  const counts = { financiamento: 0, urna: 0, institucional: 0, integridade: 0 };
  for (const r of recs) counts[r.dominant]++;
  return { counts, total: recs.length, recs };
}

function setupFilterBar() {
  const bar = document.getElementById('filterbar');
  bar.addEventListener('click', e => {
    const y = e.target.closest('[data-year]');
    if (y) { on.setYear(+y.dataset.year); return; }
    const c = e.target.closest('[data-cargo]');
    if (c) { on.setCargo(c.dataset.cargo); return; }
    if (e.target.closest('#reset')) { on.reset(); }
  });

  const th = document.getElementById('threshold');
  th.addEventListener('input', e => {
    document.getElementById('threshold-out').textContent = e.target.value;
  });
  th.addEventListener('change', e => on.setThreshold(+e.target.value));

  document.getElementById('chips').addEventListener('click', e => {
    const b = e.target.closest('[data-remove]');
    if (!b) return;
    const type = b.dataset.remove;
    if (type === 'uf') on.toggleUF(state.uf);
    else if (type === 'party') on.toggleParty(b.dataset.value);
    else if (type === 'brush') on.clearBrush();
    else if (type === 'slate') on.clearSlate();
    else if (type === 'pc') on.clearPC();
  });
}

function setupNav() {
  const sections = ['intro', 'ato1', 'ato2', 'ato3', 'ato4', 'ato5'];
  const io = new IntersectionObserver(entries => {
    for (const en of entries) {
      if (en.isIntersecting) {
        document.querySelectorAll('.rail a').forEach(a => a.classList.toggle('active', a.dataset.dot === en.target.id));
      }
    }
  }, { rootMargin: '-30% 0px -60% 0px' });
  sections.forEach(id => { const el = document.getElementById(id); if (el) io.observe(el); });

  const bar = document.getElementById('progress-bar');
  const update = () => {
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    bar.style.width = `${max > 0 ? (h.scrollTop / max) * 100 : 0}%`;
  };
  window.addEventListener('scroll', update, { passive: true });
  update();
}

let revealIO = null;
function observeReveals() {
  if (!revealIO) {
    revealIO = new IntersectionObserver(entries => {
      for (const en of entries) {
        if (en.isIntersecting) {
          en.target.classList.add('visible');
          revealIO.unobserve(en.target);
        }
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: .05 });
  }
  document.querySelectorAll('.reveal:not(.visible)').forEach(el => revealIO.observe(el));
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (DATA) schedule(); }, 280);
});

async function init() {
  try {
    DATA = await loadDashboard();
    setupFilterBar();
    setupNav();
    renderAll();
    observeReveals();
    document.getElementById('loading').classList.add('hide');
  } catch (err) {
    console.error(err);
    const l = document.getElementById('loading');
    l.innerHTML = '<span>Não foi possível carregar os dados. Abra o painel por um servidor local (python3 -m http.server).</span>';
  }
}

init();
