import { loadAppData, filterCandidates, UF_NAMES, CARGO_LABEL } from './data.js';
import {
  computeH1, computeH1Comparison, computeH2, computeH2Comparison, computeH3, computeH4, computeH5,
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
  activeStep: 'h1',
  h1Mode: 'reg',
  h3Scale: 'log',
  h3Zoom: 'focus',
  h4Tab: 'sankey',
  pcUnit: 'party',
  mapMode: 'h9',
  pcRanges: new Map(),
  pcAllowedParties: null,
  pcAllowedUFs: null,
};

let APP_DATA = null;

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

function getScopedRows({ ignoreUF = false } = {}) {
  let rows = filterCandidates(APP_DATA.candidates, {
    year: state.year,
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
}

function buildStageControls(buttons) {
  const ctrl = document.getElementById('stage-controls');
  ctrl.innerHTML = '';
  if (!buttons || buttons.length === 0) return;
  const groups = Array.isArray(buttons[0]) ? buttons : [buttons];
  for (const groupButtons of groups) {
    const grp = document.createElement('div');
    grp.className = 'filter-group';
    for (const { label, active, onClick } of groupButtons) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `seg${active ? ' active' : ''}`;
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.textContent = label;
      btn.addEventListener('click', onClick);
      grp.appendChild(btn);
    }
    ctrl.appendChild(grp);
  }
}

function updateSummaryAndNarrative(rows, computed) {
  const { h1, h2, h3, h4, h5, h6, h7, h8, h9 } = computed;
  const covYear = APP_DATA.coverage?.years?.[String(state.year)] || null;

  const extraBrush = state.pcAllowedParties
    ? ` · Brush (${state.pcAllowedParties.size} partidos)`
    : (state.pcAllowedUFs ? ` · Brush (${state.pcAllowedUFs.size} UFs)` : '');

  document.getElementById('scope-summary').textContent =
    `${state.year} · ${CARGO_LABEL[state.cargo]} · ${state.uf ? UF_NAMES[state.uf] : 'Brasil (27 UFs)'}` +
    `${state.party ? ` · ${state.party}` : ''}${extraBrush} — ${rows.length.toLocaleString('pt-BR')} candidaturas registradas`;

  renderVerdict('verdict-h1', h1.verdict);
  document.getElementById('stat-h1').textContent =
    `${fmtPct(h1.pctCompliant)} cumprem ≥30% no registro (${fmtPct(h1.pctFloorBand)} na faixa 30%–33,3%; ${fmtPct(h1.pctAbove40)} >40%). ${h1.droppedByInapto} chapas caíram abaixo de 30% após inaptidões.`;

  renderVerdict('verdict-h2', h2.verdict);
  document.getElementById('stat-h2').textContent =
    `Mediana total: ${fmtBrl(h2.medF)} (F) vs. ${fmtBrl(h2.medM)} (M) · Privado/próprio: ${fmtBrl(h2.medPrivF)} (F) vs. ${fmtBrl(h2.medPrivM)} (M).`;

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

  if (covYear) {
    const fin = covYear.tp_prestacao_apto?.FINAL || 0;
    const tot = covYear.population?.apto_cands || 1;
    document.getElementById('footer-coverage').textContent =
      `${state.year}: ${tot.toLocaleString('pt-BR')} candidaturas APTO (${((fin / tot) * 100).toFixed(1).replace('.', ',')}% com prestação FINAL; extração ${covYear.dt_geracao?.receitas || '—'}).`;
  }
}

function renderStage(computed) {
  const canvas = document.getElementById('stage-canvas');
  const secondary = document.getElementById('stage-secondary');
  const kicker = document.getElementById('stage-kicker');
  const title = document.getElementById('stage-title');
  const caption = document.getElementById('stage-caption');

  secondary.innerHTML = '';
  const w = Math.min(720, Math.max(300, canvas.clientWidth || 640));
  const { h1Comparison, h2Comparison, h3, h4, h5, h6, h7, h8, h9, mapH9, mapH7 } = computed;

  switch (state.activeStep) {
    case 'h1': {
      kicker.textContent = 'Ato 01 · No Papel (H1)';
      title.textContent = 'Histograma Espelhado: % de Mulheres por Chapa (2022 vs. 2026)';
      buildStageControls([
        { label: 'Registradas', active: state.h1Mode === 'reg', onClick: () => { state.h1Mode = 'reg'; update(); } },
        { label: 'Aptas', active: state.h1Mode === 'apto', onClick: () => { state.h1Mode = 'apto'; update(); } },
      ]);
      renderH1Histogram(canvas, h1Comparison, {
        width: w,
        mode: state.h1Mode,
        activeYear: state.year,
      });
      const y22 = h1Comparison.byYear[2022];
      const y26 = h1Comparison.byYear[2026];
      caption.textContent = state.h1Mode === 'apto'
        ? `Exibindo apenas chapas aptas (n ≥ 4) com a mesma escala travada de Registradas. Ao retirar inaptidões, ${y22.droppedByInapto} chapas em 2022 e ${y26.droppedByInapto} em 2026 migram de ≥30% para <30%.`
        : `Exibindo chapas registradas (n ≥ 4). Micro-chapas (<4 cand.) fora do percentual: ${y22.microSlatesReg} em 2022 (${y22.microCandsReg} pessoas) e ${y26.microSlatesReg} em 2026 (${y26.microCandsReg} pessoas). Alterne para "Aptas" ou passe o mouse sobre uma faixa para comparar 2022 vs. 2026.`;
      break;
    }

    case 'h2':
      kicker.textContent = 'Ato 02 · No Dinheiro (H2)';
      title.textContent = 'Mediana de Receitas por Partido (2022 vs. 2026) e Fontes';
      buildStageControls([]);
      renderH2Dumbbell(canvas, h2Comparison, {
        width: w,
        activeYear: state.year,
        onSelectParty: toggleParty,
      });
      caption.textContent = 'Dumbbell facetado em escala linear comparando 2022 e 2026 lado a lado (top 12 partidos no recorte). Clique em qualquer círculo para filtrar o partido; barras inferiores comparam fontes Públicas vs. Privadas.';
      break;

    case 'h3':
      kicker.textContent = 'Ato 02 · No Dinheiro (H3)';
      title.textContent = '% de Candidatas × % do Fundo Público (FEFC + FP)';
      buildStageControls([
        { label: 'Escala Log', active: state.h3Scale === 'log', onClick: () => { state.h3Scale = 'log'; update(); } },
        { label: 'Escala Linear', active: state.h3Scale === 'linear', onClick: () => { state.h3Scale = 'linear'; update(); } },
        { label: 'Foco (≤46%)', active: state.h3Zoom === 'focus', onClick: () => { state.h3Zoom = 'focus'; update(); } },
        { label: 'Todos', active: state.h3Zoom === 'all', onClick: () => { state.h3Zoom = 'all'; update(); } },
      ]);
      renderH3Scatter(canvas, h3, {
        width: w,
        scale: state.h3Scale,
        zoom: state.h3Zoom,
        onSelectParty: toggleParty,
      });
      caption.textContent = state.h3Scale === 'log'
        ? 'Partidos com n ≥ 10 APTO em escala log₁₀. Use "Foco (≤46%)" para abrir o miolo dos grandes partidos ou "Todos" para incluir extremos.'
        : 'Partidos com n ≥ 10 candidaturas APTO (escala linear). Pontos abaixo da diagonal Y = X indicam menor fatia de Fundo Público que a presença feminina.';
      break;

    case 'h4':
      kicker.textContent = 'Ato 02 · Fluxo e Rede (H4)';
      title.textContent = state.h4Tab === 'sankey'
        ? 'Fluxo Proporcional do Fundo Público por Destino'
        : 'Rede Bipartida: Candidaturas Anônimas × Fornecedores-Hub';
      buildStageControls([
        { label: 'Sankey', active: state.h4Tab === 'sankey', onClick: () => { state.h4Tab = 'sankey'; update(); } },
        { label: 'Rede de Hubs', active: state.h4Tab === 'network', onClick: () => { state.h4Tab = 'network'; update(); } },
      ]);
      if (state.h4Tab === 'sankey') {
        renderH4Sankey(canvas, h4, { width: w });
        caption.textContent = 'Alocação proporcional pela parcela pública da receita. Passe o cursor nas faixas para ver os montantes em R$ milhões.';
      } else {
        renderH4Network(canvas, APP_DATA.networkHubs?.years?.[String(state.year)], {
          uf: state.uf || null,
          party: state.party || null,
          cargo: state.cargo,
        }, { width: w, onSelectParty: toggleParty });
        caption.textContent = 'Quadrados: fornecedores-hub (≥2 candidaturas no partido/UF e >15% da despesa de candidatura <20 votos). Círculos: candidaturas anônimas.';
      }
      break;

    case 'h5':
      kicker.textContent = 'Ato 03 · Na Urna (H5)';
      title.textContent = 'Funil em 3 Etapas (% Candidatas → % Votos → % Eleitas)';
      buildStageControls([]);
      renderH5Conversion(canvas, h5, { width: w, onSelectParty: toggleParty });
      caption.textContent = 'Top 10 partidos por cadeiras eleitas no recorte. A linha tracejada marca o piso de 30%. Clique nas barras para filtrar o partido.';
      break;

    case 'h6':
      kicker.textContent = 'Ato 04 · A Fraude Oculta (H6)';
      title.textContent = `Volume de Sinais Observáveis por Gênero (Limiar A ≤ ${state.threshold} votos)`;
      buildStageControls([]);
      renderH6Signals(canvas, h6, { width: w });
      caption.textContent = 'Sinais B (zerada) e C (lote positivo) são mutuamente exclusivos; máximo observável simultâneo = 2 sinais (A+B ou A+C).';
      break;

    case 'h7':
      kicker.textContent = 'Ato 04 · A Fraude Oculta (H7)';
      title.textContent = 'Taxa de Sinais (≥2) por Faixa de Chapa e por UF';
      buildStageControls([]);
      renderH7Boxplot(canvas, h7, { width: w });
      renderUFMap(secondary, APP_DATA.brUf, mapH9, mapH7, {
        width: w,
        mode: 'h7',
        selectedUF: state.uf,
        allowedUFs: state.pcAllowedUFs,
        onSelectUF: toggleUF,
      });
      caption.textContent = 'Acima: boxplot das chapas (n ≥ 4). Abaixo: mapa por UF da taxa de candidatas com ≥2 sinais (clique para filtrar).';
      break;

    case 'h8':
      kicker.textContent = 'Ato 04 · Adaptação Tática (H8)';
      title.textContent = 'Comparativo 2022 vs. 2026: Contas Zeradas × Pacotes Padronizados';
      buildStageControls([]);
      renderH8Temporal(canvas, h8, { width: w });
      caption.textContent = 'Compara candidatas APTO de 2022 e 2026 no mesmo recorte de cargo/UF/partido.';
      break;

    case 'h9':
    default:
      kicker.textContent = 'Ato 05 · Geografia da Exclusão (H9)';
      title.textContent = 'Mapa Crítico por UF e Coordenadas Paralelas (5 Eixos)';
      buildStageControls([
        { label: 'Mapa H9 (Etapa)', active: state.mapMode === 'h9', onClick: () => { state.mapMode = 'h9'; update(); } },
        { label: 'Mapa H7 (Sinais)', active: state.mapMode === 'h7', onClick: () => { state.mapMode = 'h7'; update(); } },
        { label: 'Eixos: Partidos', active: state.pcUnit === 'party', onClick: () => { state.pcUnit = 'party'; clearBrushState(); update(); } },
        { label: 'Eixos: UFs', active: state.pcUnit === 'uf', onClick: () => { state.pcUnit = 'uf'; clearBrushState(); update(); } },
      ]);
      renderUFMap(canvas, APP_DATA.brUf, mapH9, mapH7, {
        width: w,
        mode: state.mapMode,
        selectedUF: state.uf,
        allowedUFs: state.pcAllowedUFs,
        onSelectUF: toggleUF,
      });
      renderParallelCoordinates(secondary, state.pcUnit === 'uf' ? mapH9 : h9, {
        width: w,
        unit: state.pcUnit,
        selectedEntity: state.pcUnit === 'uf' ? state.uf : state.party,
        initialRanges: state.pcRanges,
        onSelectEntity: (key, unit) => (unit === 'uf' ? toggleUF(key) : toggleParty(key)),
        onBrushFilter: (allowedSet, rangesMap) => {
          state.pcRanges = rangesMap;
          if (state.pcUnit === 'party') {
            state.pcAllowedParties = allowedSet;
            state.pcAllowedUFs = null;
          } else {
            state.pcAllowedUFs = allowedSet;
            state.pcAllowedParties = null;
          }
          renderChips();
          const brushedRows = getScopedRows();
          const brushedMapRows = getScopedRows({ ignoreUF: true });
          const nextComputed = {
            h1: computeH1(brushedRows),
            h2: computeH2(brushedRows),
            h3: computeH3(brushedRows),
            h4: computeH4(brushedRows),
            h5: computeH5(brushedRows),
            h6: computeH6(brushedRows, { voteThreshold: state.threshold }),
            h7: computeH7(brushedRows, { voteThreshold: state.threshold }),
            h8: computeH8(APP_DATA.candidates, {
              cargo: state.cargo,
              uf: state.uf || null,
              party: state.party || null,
              voteThreshold: state.threshold,
            }),
            h9: computeH9AndParallel(brushedRows, { voteThreshold: state.threshold }),
          };
          updateSummaryAndNarrative(brushedRows, nextComputed);
          renderUFMap(
            canvas,
            APP_DATA.brUf,
            computeH9AndParallel(brushedMapRows, { voteThreshold: state.threshold }),
            computeH7(brushedMapRows, { voteThreshold: state.threshold }),
            {
              width: w,
              mode: state.mapMode,
              selectedUF: state.uf,
              allowedUFs: state.pcAllowedUFs,
              onSelectUF: toggleUF,
            },
          );
        },
      });
      caption.textContent = 'Clique em uma UF para filtrar o painel; alterne os eixos entre Partidos e UFs ou arraste verticalmente nos eixos para filtrar.';
      break;
  }
}

function update() {
  if (!APP_DATA) return;
  const rows = getScopedRows();
  const mapRows = getScopedRows({ ignoreUF: true });

  const computed = {
    h1: computeH1(rows),
    h1Comparison: computeH1Comparison(APP_DATA.candidates, {
      cargo: state.cargo,
      uf: state.uf || null,
      party: state.party || null,
      parties: state.pcAllowedParties,
      ufs: state.pcAllowedUFs,
    }),
    h2: computeH2(rows),
    h2Comparison: computeH2Comparison(APP_DATA.candidates, {
      cargo: state.cargo,
      uf: state.uf || null,
      party: state.party || null,
      parties: state.pcAllowedParties,
      ufs: state.pcAllowedUFs,
    }),
    h3: computeH3(rows),
    h4: computeH4(rows),
    h5: computeH5(rows),
    h6: computeH6(rows, { voteThreshold: state.threshold }),
    h7: computeH7(rows, { voteThreshold: state.threshold }),
    h8: computeH8(APP_DATA.candidates, {
      cargo: state.cargo,
      uf: state.uf || null,
      party: state.party || null,
      voteThreshold: state.threshold,
    }),
    h9: computeH9AndParallel(rows, { voteThreshold: state.threshold }),
    mapH9: computeH9AndParallel(mapRows, { voteThreshold: state.threshold }),
    mapH7: computeH7(mapRows, { voteThreshold: state.threshold }),
  };

  updateSummaryAndNarrative(rows, computed);
  renderChips();
  renderStage(computed);
}

function setActiveStep(stepId, { scroll = false } = {}) {
  const stepEl = document.querySelector(`.story-step[data-step="${stepId}"]`);
  if (!stepEl) return;
  state.activeStep = stepId;
  document.querySelectorAll('.story-step').forEach((el) => el.classList.toggle('active', el === stepEl));
  const act = stepEl.dataset.act;
  document.querySelectorAll('.act-nav a').forEach((a) => {
    if (a.dataset.act === act) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
  if (scroll) stepEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  update();
}

function setupScrollyObserver() {
  const steps = document.querySelectorAll('.story-step');
  let manualLockUntil = 0;

  steps.forEach((step) => {
    step.addEventListener('click', () => {
      manualLockUntil = Date.now() + 500;
      setActiveStep(step.dataset.step);
    });
    step.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        manualLockUntil = Date.now() + 500;
        setActiveStep(step.dataset.step);
      }
    });
  });

  if (typeof IntersectionObserver !== 'undefined') {
    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < manualLockUntil) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          const id = visible[0].target.dataset.step;
          if (id && id !== state.activeStep) {
            setActiveStep(id);
          }
        }
      },
      { rootMargin: '-20% 0px -35% 0px', threshold: [0.15, 0.5, 0.8] },
    );
    steps.forEach((s) => observer.observe(s));
  }
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

function syncFilterHeightVar() {
  const fb = document.getElementById('filter-bar');
  if (fb) {
    document.documentElement.style.setProperty('--filter-h', `${Math.ceil(fb.getBoundingClientRect().height) + 12}px`);
  }
}

async function init() {
  APP_DATA = await loadAppData();
  populateUFSelect();
  syncPartySelect();
  setupScrollyObserver();
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
  setActiveStep('h1');
}

init().catch((err) => {
  document.getElementById('scope-summary').textContent = `Erro ao carregar dados: ${err.message}`;
  console.error(err);
});
