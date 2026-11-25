import { loadAppData, filterCandidates, UF_NAMES, CARGO_LABEL } from './data.js';
import {
  computeH1, computeH1Comparison, computeH2, computeH3, computeH4, computeH5,
  computeH6, computeH7, computeH8, computeH9AndParallel,
  computeScaleMosaic, computeDivergentDisparity,
} from './indicators.js';
import { createScrollyContainer } from './components/scrollyContainer.js';
import { createChapterNav } from './components/chapterNav.js';
import { renderReactiveStage } from './components/reactiveStage.js';
import { renderEvidenceSlot } from './components/evidenceCard.js';
import { initScrollMotion } from './components/scrollReveal.js';

const state = {
  year: 2022,
  cargo: 'all',
  uf: '',
  party: '',
  threshold: 10,
  activeStep: 'escala-macro',
  h1Mode: 'reg',
  h2Year: 2022,
  h2DivMode: 'priv',
  h3Scale: 'linear',
  h3Zoom: 'focus',
  h4Tab: 'sankey',
  pcUnit: 'party',
  mapMode: 'h9',
  pcRanges: new Map(),
  pcAllowedParties: null,
  pcAllowedUFs: null,
};

let APP_DATA = null;
let scrollyCtrl = null;
let chapterNavCtrl = null;

function fmtPct(v) {
  return `${(v * 100).toFixed(1).replace('.', ',')}%`;
}

function fmtBrl(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function renderVerdict(id, verdict) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `verdict-slot verdict-${verdict.status}`;
  el.innerHTML = `<span class="verdict-tag" title="${verdict.reason}">${verdict.label}</span>`;
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

function clearBrushState() {
  state.pcRanges.clear();
  state.pcAllowedParties = null;
  state.pcAllowedUFs = null;
}

function getScopedRows({ ignoreUF = false, year = state.year } = {}) {
  let rows = filterCandidates(APP_DATA.candidates, {
    year,
    cargo: state.cargo,
    uf: ignoreUF ? null : (state.uf || null),
    party: state.party || null,
    parties: state.pcAllowedParties,
  });
  if (!ignoreUF && state.pcAllowedUFs && state.pcAllowedUFs.size > 0) {
    rows = rows.filter((c) => state.pcAllowedUFs.has(c.uf));
  }
  return rows;
}

function syncFilterHeightVar() {
  const fb = document.getElementById('filter-bar');
  if (fb) {
    document.documentElement.style.setProperty('--filter-h', `${Math.ceil(fb.getBoundingClientRect().height) + 12}px`);
  }
}

function renderChips() {
  const chips = document.getElementById('active-chips');
  chips.innerHTML = '';
  const items = [];
  if (state.uf) items.push([`UF: ${state.uf}`, () => toggleUF(state.uf)]);
  if (state.party) items.push([`Partido: ${state.party}`, () => toggleParty(state.party)]);
  if (state.pcAllowedParties && state.pcAllowedParties.size > 0) {
    items.push([`Brush: ${state.pcAllowedParties.size} partidos`, () => {
      clearBrushState();
      update();
    }]);
  }
  if (state.pcAllowedUFs && state.pcAllowedUFs.size > 0) {
    items.push([`Brush: ${state.pcAllowedUFs.size} UFs`, () => {
      clearBrushState();
      update();
    }]);
  }
  for (const [label, handler] of items) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.textContent = `${label} ×`;
    btn.addEventListener('click', handler);
    chips.appendChild(btn);
  }
  syncFilterHeightVar();
}

function renderInlineEvidenceCards(computed, covYear) {
  const { h1, h2, h5, h8 } = computed;
  const dtCand = covYear?.dt_geracao?.consulta_cand || 'extrato oficial';
  const dtRec = covYear?.dt_geracao?.receitas || 'extrato oficial';
  const dtVote = covYear?.dt_geracao?.votacao || 'extrato oficial';

  renderEvidenceSlot('ev-h1', {
    meta: `TSE ${state.year} · consulta_cand · ${dtCand}`,
    linkLabel: 'Fonte TSE ↗︎',
    linkHref: `https://dadosabertos.tse.jus.br/dataset/candidatos-${state.year}`,
    htmlText: `<mark class="ev-highlight">${fmtPct(h1.pctFloorBand)}</mark> das chapas ficam entre 30% e 33,3%, e <mark class="ev-highlight">${h1.droppedByInapto}</mark> caíram abaixo do piso após inaptidões.`,
    tag: 'Registro vs. APTO',
    tagTone: h1.verdict.status === 'vaza' ? 'below' : 'above',
  });

  renderEvidenceSlot('ev-h2', {
    meta: `TSE ${state.year} · receitas_candidatos · ${dtRec}`,
    linkLabel: 'Contas TSE ↗︎',
    linkHref: 'https://divulgacandcontas.tse.jus.br/',
    htmlText: `No recurso privado/próprio, a mediana feminina é <mark class="ev-highlight">${fmtBrl(h2.medPrivF)}</mark> frente a <mark class="ev-highlight">${fmtBrl(h2.medPrivM)}</mark> entre homens.`,
    tag: 'Assimetria Privada',
    tagTone: h2.verdict.status === 'vaza' ? 'below' : 'above',
  });

  renderEvidenceSlot('ev-h5', {
    meta: `TSE ${state.year} · votacao_munzona · ${dtVote}`,
    linkLabel: 'Resultados TSE ↗︎',
    linkHref: `https://dadosabertos.tse.jus.br/dataset/resultados-${state.year}`,
    htmlText: `Conversão eleitoral: <mark class="ev-highlight">${fmtPct(h5.pctCandF)}</mark> candidatas viram <mark class="ev-highlight">${fmtPct(h5.pctVotosF)}</mark> dos votos e <mark class="ev-highlight">${fmtPct(h5.pctEleitasF)}</mark> das cadeiras.`,
    tag: 'Funil Eleitoral',
    tagTone: h5.verdict.status === 'vaza' ? 'below' : 'above',
  });

  renderEvidenceSlot('ev-h8', {
    meta: 'Série TSE 2022→2026 · Súmula 73',
    linkLabel: 'Súmula 73 TSE ↗︎',
    linkHref: 'https://www.tse.jus.br/legislacao/compilada/sumula-tse',
    htmlText: `Contas zeradas passaram de <mark class="ev-highlight">${fmtPct(h8.byYear[2022].pctZero)}</mark> para <mark class="ev-highlight">${fmtPct(h8.byYear[2026].pctZero)}</mark>, enquanto lotes padronizados variaram de <mark class="ev-highlight">${fmtPct(h8.byYear[2022].pctStd)}</mark> para <mark class="ev-highlight">${fmtPct(h8.byYear[2026].pctStd)}</mark>.`,
    tag: 'Evolução Tática',
    tagTone: h8.verdict.status === 'vaza' ? 'floor' : 'above',
  });
}

function renderSynthesisSection(computed) {
  const { h1, h2, h3, h4, h5, h6, h7, h8, h9 } = computed;
  const cardsEl = document.getElementById('synthesis-cards');
  if (cardsEl) {
    cardsEl.innerHTML = `
      <article class="synthesis-card">
        <span class="synthesis-kicker">1. Entrada e Dinheiro Público</span>
        <h4>Cota formal e FEFC funcionam como piso, não como impulso</h4>
        <p><strong>${fmtPct(h1.pctCompliant)}</strong> das chapas cumprem ≥30% no registro e mulheres recebem <strong>${fmtPct(h3.pctPubF)}</strong> do Fundo Público (razão <strong>${h3.equityRatio.toFixed(2).replace('.', ',')}×</strong>).</p>
      </article>
      <article class="synthesis-card">
        <span class="synthesis-kicker">2. Onde o sistema vaza</span>
        <h4>Recurso privado, urnas e chapas no limite</h4>
        <p>A mediana privada feminina (<strong>${fmtBrl(h2.medPrivF)}</strong>) fica atrás da masculina (<strong>${fmtBrl(h2.medPrivM)}</strong>), e na urna <strong>${fmtPct(h5.pctCandF)}</strong> das candidaturas geram <strong>${fmtPct(h5.pctEleitasF)}</strong> das cadeiras.</p>
      </article>
      <article class="synthesis-card">
        <span class="synthesis-kicker">3. Sinais e Território</span>
        <h4>Deslocamento de contas zeradas e gargalo regional</h4>
        <p>Entre 2022 e 2026, contas zeradas foram de <strong>${fmtPct(h8.byYear[2022].pctZero)}</strong> a <strong>${fmtPct(h8.byYear[2026].pctZero)}</strong> e lotes padronizados de <strong>${fmtPct(h8.byYear[2022].pctStd)}</strong> a <strong>${fmtPct(h8.byYear[2026].pctStd)}</strong>.</p>
      </article>
    `;
  }

  const scorecardEl = document.getElementById('synthesis-scorecard');
  if (scorecardEl) {
    const items = [
      ['h1', 'H1 · Registro', h1.verdict],
      ['h2', 'H2 · Medianas', h2.verdict],
      ['h3', 'H3 · Fundo Público', h3.verdict],
      ['h4', 'H4 · Fluxo & Hubs', h4.verdict],
      ['h5', 'H5 · Urna & Cadeiras', h5.verdict],
      ['h6', 'H6 · Sinais (Gênero)', h6.verdict],
      ['h7', 'H7 · Piso vs. >40%', h7.verdict],
      ['h8', 'H8 · 2022 → 2026', h8.verdict],
      ['h9', 'H9 · Geografia (UFs)', h9.verdict],
    ];
    scorecardEl.innerHTML = '';
    for (const [stepId, title, verdict] of items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `scorecard-item verdict-${verdict.status}`;
      btn.innerHTML = `
        <span class="scorecard-title">${title}</span>
        <span class="verdict-tag">${verdict.label}</span>
      `;
      btn.addEventListener('click', () => setActiveStep(stepId, { scroll: true }));
      scorecardEl.appendChild(btn);
    }
  }
}

function renderCoverageTable(coverage) {
  const el = document.getElementById('methods-coverage-table');
  if (!el || !coverage?.years) return;
  const y22 = coverage.years['2022'];
  const y26 = coverage.years['2026'];
  if (!y22 || !y26) return;

  const pctFinal = (y) => {
    const fin = y.tp_prestacao_apto?.FINAL || 0;
    const tot = y.population?.apto_cands || 1;
    return fmtPct(fin / tot);
  };

  el.innerHTML = `
    <table class="coverage-table">
      <thead>
        <tr>
          <th>Métrica de Cobertura</th>
          <th>2022 (Baseline)</th>
          <th>2026 (Comparativo)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Candidaturas registradas (Fed + Est)</td>
          <td>${y22.population.total_cands.toLocaleString('pt-BR')}</td>
          <td>${y26.population.total_cands.toLocaleString('pt-BR')}</td>
        </tr>
        <tr>
          <td>Candidaturas APTO</td>
          <td>${y22.population.apto_cands.toLocaleString('pt-BR')}</td>
          <td>${y26.population.apto_cands.toLocaleString('pt-BR')}</td>
        </tr>
        <tr>
          <td>Prestações FINAL entre APTO</td>
          <td>${pctFinal(y22)} (${y22.dt_geracao.receitas})</td>
          <td>${pctFinal(y26)} (${y26.dt_geracao.receitas})</td>
        </tr>
        <tr>
          <td>Chapas n ≥ 4 / Micro-chapas (&lt;4)</td>
          <td>${(y22.population.chapas_reg.total - y22.population.chapas_reg.micro_lt4).toLocaleString('pt-BR')} / ${y22.population.chapas_reg.micro_lt4}</td>
          <td>${(y26.population.chapas_reg.total - y26.population.chapas_reg.micro_lt4).toLocaleString('pt-BR')} / ${y26.population.chapas_reg.micro_lt4}</td>
        </tr>
        <tr>
          <td>Fornecedores-Hub mapeados (H4)</td>
          <td>${y22.hubs_summary.hubs_count} hubs (${y22.hubs_summary.links_count} elos)</td>
          <td>${y26.hubs_summary.hubs_count} hubs (${y26.hubs_summary.links_count} elos)</td>
        </tr>
      </tbody>
    </table>
  `;
}

function updateSummaryAndNarrative(rows, computed) {
  const { scaleMosaic, h1, h2, divergent, h3, h4, h5, h6, h7, h8, h9 } = computed;
  const covYear = APP_DATA.coverage?.years?.[String(state.year)] || null;

  const extraBrush = state.pcAllowedParties
    ? ` · Brush (${state.pcAllowedParties.size} partidos)`
    : (state.pcAllowedUFs ? ` · Brush (${state.pcAllowedUFs.size} UFs)` : '');

  document.getElementById('scope-summary').textContent =
    `${state.year} · ${CARGO_LABEL[state.cargo]} · ${state.uf ? UF_NAMES[state.uf] : 'Brasil (27 UFs)'}` +
    `${state.party ? ` · ${state.party}` : ''}${extraBrush} — ${rows.length.toLocaleString('pt-BR')} candidaturas registradas`;

  const statsKicker = document.getElementById('hero-stats-kicker');
  if (statsKicker) {
    statsKicker.textContent =
      `Panorama do recorte · ${state.year} · ${CARGO_LABEL[state.cargo]} · ${state.uf ? UF_NAMES[state.uf] : 'Brasil (27 UFs)'}` +
      `${state.party ? ` · ${state.party}` : ''}${extraBrush}`;
  }
  const bigCand = document.getElementById('big-stat-cand');
  const bigPub = document.getElementById('big-stat-pub');
  const bigSeats = document.getElementById('big-stat-seats');
  const bigSeatsLbl = document.getElementById('big-stat-seats-label');
  if (bigCand) bigCand.textContent = fmtPct(h5.pctCandF);
  if (bigPub) bigPub.textContent = fmtPct(h3.pctPubF);
  if (bigSeats) bigSeats.textContent = fmtPct(h5.pctEleitasF);
  if (bigSeatsLbl) {
    bigSeatsLbl.textContent = `das cadeiras eleitas (${h5.elF.toLocaleString('pt-BR')} de ${(h5.elF + h5.elM).toLocaleString('pt-BR')}) foram ocupadas por mulheres na urna.`;
  }

  if (scaleMosaic) {
    const statMacro = document.getElementById('stat-escala-macro');
    const statMicro = document.getElementById('stat-escala-micro');
    if (statMacro) {
      const floorPct = scaleMosaic.totalSlates > 0
        ? scaleMosaic.bandCounts.floor / scaleMosaic.totalSlates
        : 0;
      statMacro.textContent =
        `${scaleMosaic.tiles.length} blocos representam ${scaleMosaic.totalSlates.toLocaleString('pt-BR')} chapas (n ≥ 4) em ${state.year}: ${fmtPct(floorPct)} estão espremidas no piso 30%–33,3%.`;
    }
    if (statMicro) {
      statMicro.textContent =
        `${scaleMosaic.pullOuts.length} casos reais em destaque (incluindo ${h1.droppedByInapto} chapas derrubadas por inaptidões no recorte).`;
    }
  }

  renderVerdict('verdict-h1', h1.verdict);
  document.getElementById('stat-h1').textContent =
    `${fmtPct(h1.pctCompliant)} cumprem ≥30% no registro (${fmtPct(h1.pctFloorBand)} na faixa 30%–33,3%; ${fmtPct(h1.pctAbove40)} >40%). ${h1.droppedByInapto} chapas caíram abaixo de 30% após inaptidões.`;

  renderVerdict('verdict-h2', h2.verdict);
  document.getElementById('stat-h2').textContent =
    `Mediana total: ${fmtBrl(h2.medF)} (F) vs. ${fmtBrl(h2.medM)} (M) · Privado/próprio: ${fmtBrl(h2.medPrivF)} (F) vs. ${fmtBrl(h2.medPrivM)} (M).`;

  if (divergent) {
    const divStatEl = document.getElementById('stat-h2-div');
    const divVerdict = divergent.summary.favoringM >= Math.ceil(divergent.rows.length * 0.6)
      ? { status: 'vaza', label: 'Vaza no Privado', reason: `${divergent.summary.favoringM} de ${divergent.rows.length} partidos favorecem homens na mediana privada.` }
      : { status: 'funcionou', label: 'Próximo à Paridade', reason: 'Distribuição equilibrada entre legendas.' };
    renderVerdict('verdict-h2-div', divVerdict);
    if (divStatEl) {
      divStatEl.textContent =
        `No recurso privado/próprio (${state.year}), ${divergent.summary.favoringM} de ${divergent.rows.length} maiores partidos têm mediana maior para homens (global: ${fmtBrl(divergent.summary.globalMedF)} F vs. ${fmtBrl(divergent.summary.globalMedM)} M).`;
    }
  }

  renderVerdict('verdict-h3', h3.verdict);
  document.getElementById('stat-h3').textContent =
    `Mulheres são ${fmtPct(h3.pctCandF)} das candidaturas APTO e recebem ${fmtPct(h3.pctPubF)} do Fundo Público (razão ${h3.equityRatio.toFixed(2).replace('.', ',')}×).`;

  renderVerdict('verdict-h4', h4.verdict);
  document.getElementById('stat-h4').textContent =
    `Repasses a partido/candidatos homens: ${fmtPct(h4.diversionShareF)} (F) vs. ${fmtPct(h4.diversionShareM)} (M) · Fornecedores compartilhados: ${fmtPct(h4.sharedShareF)} (F) vs. ${fmtPct(h4.sharedShareM)} (M).`;

  renderVerdict('verdict-h5', h5.verdict);
  document.getElementById('stat-h5').textContent =
    `Conversão global: ${fmtPct(h5.pctCandF)} candidatas → ${fmtPct(h5.pctVotosF)} votos → ${fmtPct(h5.pctEleitasF)} eleitas (${h5.elF} de ${h5.elF + h5.elM} cadeiras).`;

  renderVerdict('verdict-h6', h6.verdict);
  document.getElementById('stat-h6').textContent =
    `≥2 sinais: ${fmtPct(h6.pct2PlusF)} das mulheres (${h6.summary.F.twoPlus}) vs. ${fmtPct(h6.pct2PlusM)} dos homens (${h6.summary.M.twoPlus}).`;

  const bFloor = h7.bandStats.find((b) => b.band === '30%–33,3%');
  const bHigh = h7.bandStats.find((b) => b.band === '> 40%');
  renderVerdict('verdict-h7', h7.verdict);
  document.getElementById('stat-h7').textContent =
    `Taxa de ≥2 sinais: ${fmtPct(bFloor?.aggRate || 0)} nas chapas 30%–33,3% vs. ${fmtPct(bHigh?.aggRate || 0)} nas chapas >40%.`;

  renderVerdict('verdict-h8', h8.verdict);
  document.getElementById('stat-h8').textContent =
    `Contas zeradas: ${fmtPct(h8.byYear[2022].pctZero)} (2022) → ${fmtPct(h8.byYear[2026].pctZero)} (2026) · Pacote padronizado: ${fmtPct(h8.byYear[2022].pctStd)} → ${fmtPct(h8.byYear[2026].pctStd)}.`;

  renderVerdict('verdict-h9', h9.verdict);
  document.getElementById('stat-h9').textContent = h9.verdict.reason;

  renderInlineEvidenceCards(computed, covYear);
  renderSynthesisSection(computed);

  if (covYear) {
    const fin = covYear.tp_prestacao_apto?.FINAL || 0;
    const tot = covYear.population?.apto_cands || 1;
    document.getElementById('footer-coverage').textContent =
      `${state.year}: ${tot.toLocaleString('pt-BR')} candidaturas APTO (${((fin / tot) * 100).toFixed(1).replace('.', ',')}% com prestação FINAL; extração ${covYear.dt_geracao?.receitas || '—'}).`;
  }
}

function update() {
  if (!APP_DATA) return;
  const rows = getScopedRows();
  const h2StageRows = getScopedRows({ year: state.h2Year });
  const mapRows = getScopedRows({ ignoreUF: true });

  const h1 = computeH1(rows);
  const h2 = computeH2(rows);
  const computed = {
    h1,
    scaleMosaic: computeScaleMosaic(rows, h1, { voteThreshold: state.threshold, maxTiles: 48 }),
    h1Comparison: computeH1Comparison(APP_DATA.candidates, {
      cargo: state.cargo,
      uf: state.uf || null,
      party: state.party || null,
      parties: state.pcAllowedParties,
      ufs: state.pcAllowedUFs,
    }),
    h2,
    h2Stage: computeH2(h2StageRows),
    divergent: computeDivergentDisparity(h2, { mode: 'priv', limit: 12, cap: 15 }),
    divergentStage: computeDivergentDisparity(h2, { mode: state.h2DivMode, limit: 12, cap: 15 }),
    h3: computeH3(rows),
    h4: computeH4(rows),
    h5: computeH5(rows),
    h6: computeH6(rows, { voteThreshold: state.threshold }),
    h7: computeH7(rows, { voteThreshold: state.threshold }),
    h8: computeH8(APP_DATA.candidates, {
      cargo: state.cargo,
      uf: state.uf || null,
      party: state.party || null,
      parties: state.pcAllowedParties,
      ufs: state.pcAllowedUFs,
      voteThreshold: state.threshold,
    }),
    h9: computeH9AndParallel(rows, { voteThreshold: state.threshold }),
    mapH9: computeH9AndParallel(mapRows, { voteThreshold: state.threshold }),
    mapH7: computeH7(mapRows, { voteThreshold: state.threshold }),
  };

  updateSummaryAndNarrative(rows, computed);
  renderChips();
  renderReactiveStage({
    state,
    appData: APP_DATA,
    computed,
    getScopedRows,
    actions: {
      update,
      setActiveStep,
      toggleParty,
      toggleUF,
      clearBrushState,
      renderChips,
      updateSummaryAndNarrative,
    },
  });
}

function setActiveStep(stepId, { scroll = false } = {}) {
  const stepEl = document.querySelector(`.story-step[data-step="${stepId}"]`);
  if (!stepEl) return;
  state.activeStep = stepId;
  document.querySelectorAll('.story-step').forEach((el) => el.classList.toggle('active', el === stepEl));
  const act = stepEl.dataset.act;
  if (chapterNavCtrl) {
    chapterNavCtrl.sync({ act, subId: stepId });
  }
  if (scroll && scrollyCtrl) {
    scrollyCtrl.scrollToStep(stepId);
  }
  update();
}

function syncPartySelect() {
  const partyCounts = new Map();
  for (const c of APP_DATA.candidates) {
    if (c.y === state.year) partyCounts.set(c.p, (partyCounts.get(c.p) || 0) + 1);
  }
  const partySel = document.getElementById('filter-party');
  partySel.innerHTML = '<option value="">Todos</option>';
  [...partyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([p]) => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      partySel.appendChild(opt);
    });
  if (state.party && !partyCounts.has(state.party)) {
    state.party = '';
  }
  partySel.value = state.party;
}

function populateUFSelect() {
  const ufSel = document.getElementById('filter-uf');
  Object.keys(UF_NAMES).sort().forEach((uf) => {
    const opt = document.createElement('option');
    opt.value = uf;
    opt.textContent = `${uf} — ${UF_NAMES[uf]}`;
    ufSel.appendChild(opt);
  });
}

async function init() {
  APP_DATA = await loadAppData();
  populateUFSelect();
  syncPartySelect();
  renderCoverageTable(APP_DATA.coverage);

  chapterNavCtrl = createChapterNav({
    onJumpStep: (stepId) => setActiveStep(stepId, { scroll: true }),
    onLayoutChange: () => syncFilterHeightVar(),
  });

  scrollyCtrl = createScrollyContainer({
    stepSelector: '.story-step',
    onStepChange: (id) => setActiveStep(id),
    onStepReenter: (id) => {
      const stepEl = document.querySelector(`.story-step[data-step="${id}"]`);
      if (stepEl && chapterNavCtrl) {
        chapterNavCtrl.sync({ act: stepEl.dataset.act, subId: id });
      }
    },
    getActiveStep: () => state.activeStep,
  });

  syncFilterHeightVar();
  if (typeof ResizeObserver !== 'undefined') {
    const fb = document.getElementById('filter-bar');
    if (fb) new ResizeObserver(() => syncFilterHeightVar()).observe(fb);
  }

  document.querySelectorAll('[data-year]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.year = Number(btn.dataset.year);
      document.querySelectorAll('[data-year]').forEach((b) => {
        const isActive = b === btn;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
      clearBrushState();
      syncPartySelect();
      update();
    });
  });

  document.querySelectorAll('[data-cargo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.cargo = btn.dataset.cargo;
      document.querySelectorAll('[data-cargo]').forEach((b) => {
        const isActive = b === btn;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
      clearBrushState();
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
    state.h2Year = 2022;
    state.h2DivMode = 'priv';
    state.cargo = 'all';
    state.uf = '';
    state.party = '';
    state.threshold = 10;
    clearBrushState();
    syncPartySelect();
    document.getElementById('filter-uf').value = '';
    document.getElementById('filter-party').value = '';
    document.getElementById('filter-threshold').value = '10';
    document.getElementById('threshold-out').textContent = '10';
    document.querySelectorAll('[data-year]').forEach((b) => {
      const active = Number(b.dataset.year) === 2022;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    document.querySelectorAll('[data-cargo]').forEach((b) => {
      const active = b.dataset.cargo === 'all';
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    update();
  });

  window.addEventListener('resize', () => update());
  initScrollMotion();
  setActiveStep('escala-macro');
}

init().catch((err) => {
  const scopeEl = document.getElementById('scope-summary');
  if (scopeEl) {
    scopeEl.classList.add('is-error');
    scopeEl.textContent = 'Falha ao carregar os dados. Recarregue a página para tentar novamente.';
  }
  const canvasEl = document.getElementById('stage-canvas');
  if (canvasEl) {
    canvasEl.innerHTML = '<p class="chart-empty is-error" role="alert">Não foi possível carregar os dados da visualização. Recarregue a página para tentar novamente.</p>';
  }
  console.error(err);
});
