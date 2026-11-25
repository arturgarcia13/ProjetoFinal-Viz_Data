import { loadAppData, filterCandidates, UF_NAMES, CARGO_LABEL } from './data.js';
import {
  computeH1,
  computeH1Comparison,
  computeH2,
  computeH2GapEvolution,
  computeH2PublicVsPrivate,
  computeH3,
  computeH4WomenSankey,
  computeH5,
  computeH6Series,
  computeH7Comparison,
  computeH8,
  computeH9MatrixAndMap,
} from './indicators.js';
import { renderH1Histogram } from './charts/h1Histogram.js';
import { renderH2Dumbbell } from './charts/h2Dumbbell.js';
import { renderDivergentChart } from './charts/divergentChart.js';
import { renderH3Scatter } from './charts/h3Scatter.js';
import { renderH4Sankey } from './charts/h4SankeyNetwork.js';
import { renderH5Conversion } from './charts/h5Conversion.js';
import { renderH6Signals } from './charts/h6Signals.js';
import { renderH7Boxplot } from './charts/h7Boxplot.js';
import { renderH8Temporal } from './charts/h8Temporal.js';
import { renderUFMap, renderH9HeatmapMatrix, H9_METRICS } from './charts/h9MapAndParallel.js';
import { createChapterNav } from './components/chapterNav.js';
import { renderEvidenceSlot } from './components/evidenceCard.js';
import { initScrollMotion } from './components/scrollReveal.js';

const state = {
  statsYear: 2022,
  cargo: 'all',
  uf: '',
  party: '',
  threshold: 10,
  h1Mode: 'reg',
  h1BinFilter: null, // { id, label, parties: Set<string> } | null
  h2bYear: 2026,
  h3Year: 2022,
  h4Year: 2022,
  h4Profile: 'all',
  h5Year: 2022,
  h7Show2018: false,
  h9Year: 2022,
  h9Metric: 'pctEleitasF',
  h9MatrixUnit: 'uf',
  h9SortBy: 'pctEleitasF',
  h9SortDir: 'desc',
};

let APP_DATA = null;
let chapterNavCtrl = null;

function fmtPct(v) {
  return `${(v * 100).toFixed(1).replace('.', ',')}%`;
}

function fmtBrl(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function fmtSignedK(v) {
  const k = Math.round(v / 1000);
  if (k === 0) return 'R$ 0';
  return `${k > 0 ? '+' : '−'}R$ ${Math.abs(k).toLocaleString('pt-BR')} mil`;
}

function renderVerdict(id, verdict) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `verdict-slot verdict-${verdict.status}`;
  el.innerHTML = `<span class="verdict-tag" title="${verdict.reason}">${verdict.label}</span>`;
}

function syncFilterHeightVar() {
  const fb = document.getElementById('filter-bar');
  if (fb) {
    document.documentElement.style.setProperty('--filter-h', `${Math.ceil(fb.getBoundingClientRect().height) + 12}px`);
  }
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
    grp.className = 'filter-group';
    for (const item of grpItems) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `seg${item.active ? ' active' : ''}`;
      btn.setAttribute('aria-pressed', item.active ? 'true' : 'false');
      btn.textContent = item.label;
      btn.addEventListener('click', item.onClick);
      grp.appendChild(btn);
    }
    el.appendChild(grp);
  }
}

function getScopedRows({
  year = 2022,
  ignoreUF = false,
  ignoreParty = false,
  ignoreH1Bin = false,
} = {}) {
  const binParties = !ignoreH1Bin && state.h1BinFilter?.parties?.size > 0
    ? state.h1BinFilter.parties
    : null;
  return filterCandidates(APP_DATA.candidates, {
    year,
    cargo: state.cargo,
    uf: ignoreUF ? null : (state.uf || null),
    party: ignoreParty ? null : (state.party || null),
    parties: binParties,
  });
}

function renderChips() {
  const chips = document.getElementById('active-chips');
  if (!chips) return;
  chips.innerHTML = '';
  const items = [];
  if (state.uf) items.push([`UF: ${state.uf}`, clearUF]);
  if (state.party) items.push([`Partido: ${state.party}`, clearParty]);
  if (state.h1BinFilter) {
    items.push([
      `H1 (${state.h1BinFilter.label}): ${state.h1BinFilter.parties.size} partidos`,
      () => {
        state.h1BinFilter = null;
        update();
      },
    ]);
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

function renderCoverageTable(coverage) {
  const el = document.getElementById('methods-coverage-table');
  if (!el || !coverage?.years) return;
  const y18 = coverage.years['2018'];
  const y22 = coverage.years['2022'];
  const y26 = coverage.years['2026'];
  if (!y22 || !y26) return;

  const pctFinal = (y) => {
    if (!y) return '—';
    const fin = y.tp_prestacao_apto?.FINAL || 0;
    const tot = y.population?.apto_cands || 1;
    return fmtPct(fin / tot);
  };

  el.innerHTML = `
    <table class="coverage-table">
      <thead>
        <tr>
          <th>Métrica de Cobertura</th>
          <th>2018 (Auxiliar)</th>
          <th>2022 (Baseline)</th>
          <th>2026 (Comparativo)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Candidaturas registradas (Fed + Est)</td>
          <td>${y18 ? y18.population.total_cands.toLocaleString('pt-BR') : '—'}</td>
          <td>${y22.population.total_cands.toLocaleString('pt-BR')}</td>
          <td>${y26.population.total_cands.toLocaleString('pt-BR')}</td>
        </tr>
        <tr>
          <td>Candidaturas APTO</td>
          <td>${y18 ? y18.population.apto_cands.toLocaleString('pt-BR') : '—'}</td>
          <td>${y22.population.apto_cands.toLocaleString('pt-BR')}</td>
          <td>${y26.population.apto_cands.toLocaleString('pt-BR')}</td>
        </tr>
        <tr>
          <td>Prestações FINAL entre APTO</td>
          <td>${y18 ? `${pctFinal(y18)} (${y18.dt_geracao.receitas})` : '—'}</td>
          <td>${pctFinal(y22)} (${y22.dt_geracao.receitas})</td>
          <td>${pctFinal(y26)} (${y26.dt_geracao.receitas})</td>
        </tr>
        <tr>
          <td>Chapas n ≥ 4 / Micro-chapas (&lt;4)</td>
          <td>${y18 ? `${(y18.population.chapas_reg.total - y18.population.chapas_reg.micro_lt4).toLocaleString('pt-BR')} / ${y18.population.chapas_reg.micro_lt4}` : '—'}</td>
          <td>${(y22.population.chapas_reg.total - y22.population.chapas_reg.micro_lt4).toLocaleString('pt-BR')} / ${y22.population.chapas_reg.micro_lt4}</td>
          <td>${(y26.population.chapas_reg.total - y26.population.chapas_reg.micro_lt4).toLocaleString('pt-BR')} / ${y26.population.chapas_reg.micro_lt4}</td>
        </tr>
      </tbody>
    </table>
  `;
}

function syncH1BinParties(h1Comparison) {
  if (!state.h1BinFilter) return;
  const bin = h1Comparison?.bins?.find((b) => b.id === state.h1BinFilter.id);
  const partyArr = state.h1Mode === 'apto' ? bin?.partiesUnion?.apto : bin?.partiesUnion?.reg;
  state.h1BinFilter.parties = new Set(partyArr || []);
}

function renderInlineEvidenceCards(computed) {
  const { h1Comparison, h2Gap, h2b, h5, h8 } = computed;
  const y22Cov = APP_DATA.coverage?.years?.['2022'];
  const y26Cov = APP_DATA.coverage?.years?.['2026'];
  const isLt30Active = state.h1BinFilter?.id === 'lt30';

  renderEvidenceSlot('ev-h1', {
    meta: `TSE 2022 vs. 2026 · consulta_cand · ${y26Cov?.dt_geracao?.consulta_cand || 'oficial'}`,
    linkLabel: 'Fonte TSE ↗︎',
    linkHref: 'https://dadosabertos.tse.jus.br/dataset/candidatos-2022',
    htmlText: `Na faixa <mark class="ev-highlight">&lt; 30%</mark>, <strong>${h1Comparison.lt30Details?.sameSlateRepeats ?? 0}</strong> chapas idênticas repetiram nos dois pleitos, mas <strong>${h1Comparison.lt30Details?.repeatPartiesReg?.length ?? 0} partidos</strong> reincidiram nacionalmente. Microchapas (&lt;4 cand.) ficam fora de H1, mas permanecem em H2–H9.`,
    tag: 'Registradas ↔ Aptas',
    tagTone: 'floor',
    actionLabel: isLt30Active ? 'Limpar filtro < 30%' : 'Filtrar faixa < 30%',
    onAction: () => {
      const bin = h1Comparison.bins.find((b) => b.id === 'lt30');
      const partyArr = state.h1Mode === 'apto' ? bin?.partiesUnion?.apto : bin?.partiesUnion?.reg;
      state.h1BinFilter = isLt30Active || !bin
        ? null
        : { id: bin.id, label: bin.label, parties: new Set(partyArr || []) };
      update();
    },
  });

  const uniaoRow = h2Gap.rows.find((r) => r.party === 'UNIÃO');
  renderEvidenceSlot('ev-h2', {
    meta: `Paradoxo 2026 · UNIÃO · ${(y26Cov?.dt_geracao?.receitas || '20/11/2026')}`,
    linkLabel: 'Contas TSE ↗︎',
    linkHref: 'https://divulgacandcontas.tse.jus.br/',
    htmlText: uniaoRow && uniaoRow.gap2022 !== null && uniaoRow.gap2026 > 50000
      ? `No <mark class="ev-highlight">UNIÃO (2026)</mark>, a mediana F saltou para <mark class="ev-highlight">${fmtSignedK(uniaoRow.gap2026)}</mark> porque 99% das candidatas receberam Fundo Público (vs. 6,6% dos homens sem verba pública), mas homens seguem à frente no topo P90 (<mark class="ev-highlight">R$ 2,70M vs. R$ 1,65M</mark>) e no privado.`
      : `Em ${state.h2bYear}, <mark class="ev-highlight">${(h2b.pubShareF * 100).toFixed(1).replace('.', ',')}%</mark> da receita feminina vem do Fundo Público (vs. <mark class="ev-highlight">${(h2b.pubShareM * 100).toFixed(1).replace('.', ',')}%</mark> nos homens).`,
    tag: state.party === 'UNIÃO' ? 'UNIÃO destacado' : 'Efeito Piso Público',
    tagTone: 'above',
    actionLabel: state.party === 'UNIÃO' ? 'Limpar UNIÃO' : 'Destacar UNIÃO',
    onAction: () => toggleParty('UNIÃO'),
  });

  const dropUrnaPP = (h5.dropUrna * 100).toFixed(1).replace('.', ',');
  const dropCadPP = (h5.dropCadeira * 100).toFixed(1).replace('.', ',');
  renderEvidenceSlot('ev-h5', {
    meta: `TSE ${state.h5Year} · Decomposição da perda`,
    linkLabel: 'Resultados TSE ↗︎',
    linkHref: `https://dadosabertos.tse.jus.br/dataset/resultados-${state.h5Year}`,
    htmlText: `Na urna (${state.h5Year}), mulheres perdem <mark class="ev-highlight">${dropUrnaPP} p.p.</mark> entre chapa e voto nominal, contra <mark class="ev-highlight">${dropCadPP} p.p.</mark> do voto até as cadeiras.`,
    tag: 'Gargalo no Voto',
    tagTone: h5.verdict.status === 'vaza' ? 'below' : 'above',
    actionLabel: state.h5Year === 2022 ? 'Comparar 2026' : 'Voltar p/ 2022',
    onAction: () => {
      state.h5Year = state.h5Year === 2022 ? 2026 : 2022;
      update();
    },
  });

  renderEvidenceSlot('ev-h8', {
    meta: 'Cobertura FINAL ≥ 93% (2018) e ≥ 97% (2022/2026)',
    linkLabel: 'Súmula 73 TSE ↗︎',
    linkHref: 'https://www.tse.jus.br/legislacao/compilada/sumula-tse',
    htmlText: `Prestações <mark class="ev-highlight">FINAL</mark>: 93,4% (2018), 97,1% (2022) e 97,9% (2026). Sinais B e C são mutuamente exclusivos; a variação de A+B vs. A+C mede adaptação tática sob o mesmo critério contábil.`,
    tag: 'Auditoria Contábil',
    tagTone: h8.verdict.status === 'vaza' ? 'floor' : 'above',
  });
}

function renderSynthesisSection(computed) {
  const { h1, h2Gap, h3, h4, h5, h6Series, h7Comp, h8, h9 } = computed;
  const cardsEl = document.getElementById('synthesis-cards');
  if (cardsEl) {
    cardsEl.innerHTML = `
      <article class="synthesis-card">
        <span class="synthesis-kicker">1. Entrada e Dinheiro Público</span>
        <h4>Cota formal e FEFC funcionam como piso, mas não rompem o teto</h4>
        <p><strong>${fmtPct(h1.pctCompliant)}</strong> das chapas cumprem ≥30% no registro e mulheres recebem <strong>${fmtPct(h3.pctPubF)}</strong> do Fundo Público (razão <strong>${h3.equityRatio.toFixed(2).replace('.', ',')}×</strong>), porém <strong>${fmtPct(h4.top10ShareRev)}</strong> da receita feminina concentra-se nas Top 10%.</p>
      </article>
      <article class="synthesis-card">
        <span class="synthesis-kicker">2. Onde o sistema vaza</span>
        <h4>Abismo privado e conversão desigual na urna</h4>
        <p>No recurso privado, homens superam mulheres na maioria das legendas, e na urna <strong>${fmtPct(h5.pctCandF)}</strong> das candidaturas viram <strong>${fmtPct(h5.pctEleitasF)}</strong> das cadeiras (${state.h5Year}).</p>
      </article>
      <article class="synthesis-card">
        <span class="synthesis-kicker">3. Sinais 2018–2026 e Território</span>
        <h4>Queda da disparidade bruta e migração contábil</h4>
        <p>Entre 2018 e 2026, a razão F/M em ≥2 sinais caiu de <strong>${h6Series.byYear[2018].ratio2Plus.toFixed(1).replace('.', ',')}×</strong> para <strong>${h6Series.byYear[2026].ratio2Plus.toFixed(2).replace('.', ',')}×</strong>, enquanto contas zeradas caíram (<strong>${fmtPct(h8.byYear[2018].pctZero)} → ${fmtPct(h8.byYear[2026].pctZero)}</strong>) e lotes padronizados subiram (<strong>${fmtPct(h8.byYear[2018].pctStd)} → ${fmtPct(h8.byYear[2026].pctStd)}</strong>).</p>
      </article>
    `;
  }

  const scorecardEl = document.getElementById('synthesis-scorecard');
  if (scorecardEl) {
    const items = [
      ['sec-h1', 'H1 · Registro (2022–2026)', h1.verdict],
      ['sec-h2', 'H2 · Gap de Medianas', h2Gap.verdict],
      ['sec-h2b', 'H2B · Público vs. Privado', computed.h2b.verdict],
      ['sec-h3', 'H3 · Fundo Público', h3.verdict],
      ['sec-h4', 'H4 · Distribuição (Mulheres)', h4.verdict],
      ['sec-h5', 'H5 · Urna & Cadeiras', h5.verdict],
      ['sec-h6', 'H6 · Sinais (2018–2026)', h6Series.verdict],
      ['sec-h7', 'H7 · Risco por Faixa', h7Comp.verdict2022],
      ['sec-h8', 'H8 · Adaptação Tática', h8.verdict],
      ['sec-h9', 'H9 · Mapa & Matriz', h9.verdict],
    ];
    scorecardEl.innerHTML = '';
    for (const [secId, title, verdict] of items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `scorecard-item verdict-${verdict.status}`;
      btn.innerHTML = `
        <span class="scorecard-title">${title}</span>
        <span class="verdict-tag">${verdict.label}</span>
      `;
      btn.addEventListener('click', () => {
        document.getElementById(secId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      scorecardEl.appendChild(btn);
    }
  }
}

function updateSummaryAndNarrative(statsRows, computed) {
  const { h1, h1Comparison, h2Gap, h2b, h3, h4, h5, h6Series, h7Comp, h8, h9, statsH3, statsH5 } = computed;
  const covYear = APP_DATA.coverage?.years?.[String(state.statsYear)] || null;

  const extraBin = state.h1BinFilter ? ` · H1 ${state.h1BinFilter.label}` : '';
  document.getElementById('scope-summary').textContent =
    `${CARGO_LABEL[state.cargo]} · ${state.uf ? UF_NAMES[state.uf] : 'Brasil (27 UFs)'}` +
    `${state.party ? ` · ${state.party}` : ''}${extraBin} — ${statsRows.length.toLocaleString('pt-BR')} candidaturas (${state.statsYear})`;

  const statsKicker = document.getElementById('hero-stats-kicker');
  if (statsKicker) {
    statsKicker.textContent =
      `Panorama do recorte · ${state.statsYear} · ${CARGO_LABEL[state.cargo]} · ${state.uf ? UF_NAMES[state.uf] : 'Brasil (27 UFs)'}` +
      `${state.party ? ` · ${state.party}` : ''}${extraBin}`;
  }

  document.getElementById('big-stat-cand').textContent = fmtPct(statsH5.pctCandF);
  document.getElementById('big-stat-pub').textContent = fmtPct(statsH3.pctPubF);
  document.getElementById('big-stat-seats').textContent = fmtPct(statsH5.pctEleitasF);
  document.getElementById('big-stat-seats-label').textContent =
    `das cadeiras eleitas (${statsH5.elF.toLocaleString('pt-BR')} de ${(statsH5.elF + statsH5.elM).toLocaleString('pt-BR')}) foram ocupadas por mulheres na urna.`;

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  const candDiffPP = (statsH5.pctCandF - 0.3) * 100;
  setText(
    'big-stat-cand-delta',
    `${candDiffPP >= 0 ? '+' : ''}${candDiffPP.toFixed(1).replace('.', ',')} p.p. vs. piso de 30%`,
  );
  setText(
    'big-stat-pub-delta',
    `Razão ${statsH3.equityRatio.toFixed(2).replace('.', ',')}× (% verba / % mulheres)`,
  );
  const convDropPct = statsH5.pctCandF > 0
    ? ((statsH5.pctEleitasF - statsH5.pctCandF) / statsH5.pctCandF) * 100
    : 0;
  setText(
    'big-stat-seats-delta',
    `Queda de ${Math.abs(convDropPct).toFixed(0)}% do papel à cadeira`,
  );

  // H1 — manchete dinâmica + texto ≥ 40% corrigido
  const y22 = h1Comparison.byYear[2022];
  const y26 = h1Comparison.byYear[2026];
  const isAptoMode = state.h1Mode === 'apto';
  const floor22 = h1Comparison.bins.find((b) => b.id === '30-33')?.y2022[isAptoMode ? 'aptoPct' : 'regPct'] || 0;
  const floor26 = h1Comparison.bins.find((b) => b.id === '30-33')?.y2026[isAptoMode ? 'aptoPct' : 'regPct'] || 0;
  renderVerdict('verdict-h1', h1.verdict);
  setText(
    'title-h1',
    `Avanço acima de 33% nos dois modos, mas ${Math.round(floor26)}% das chapas seguem presas no piso`,
  );
  document.getElementById('stat-h1').textContent =
    `Chapas ≥ 40%: ${(y22.pctGe40 * 100).toFixed(1).replace('.', ',')}% → ${(y26.pctGe40 * 100).toFixed(1).replace('.', ',')}% · Piso 30%–33,3%: ${floor22.toFixed(1).replace('.', ',')}% → ${floor26.toFixed(1).replace('.', ',')}% · Quedas <30% por inaptidão: ${fmtPct(y22.pctDroppedByInapto)} (${y22.droppedByInapto}) → ${fmtPct(y26.pctDroppedByInapto)} (${y26.droppedByInapto}).`;

  // H2 — Gap evolution
  renderVerdict('verdict-h2', h2Gap.verdict);
  const topDef = h2Gap.rows[0];
  const topSur = h2Gap.rows[h2Gap.rows.length - 1];
  if (topDef && topSur) {
    setText(
      'title-h2',
      `${topDef.party} lidera vantagem masculina (${fmtSignedK(topDef.gap2026)}); ${topSur.party} puxa mediana feminina (${fmtSignedK(topSur.gap2026)})`,
    );
  }
  document.getElementById('stat-h2').textContent = topDef && topSur
    ? `Extremos em 2026: ${topDef.party} (${fmtSignedK(topDef.gap2026)}) na ponta favorável a homens vs. ${topSur.party} (${fmtSignedK(topSur.gap2026)}) na ponta favorável a mulheres.`
    : 'Amostra insuficiente para comparar partidos em 2026.';

  // H2B — Público vs Privado
  renderVerdict('verdict-h2b', h2b.verdict);
  setText(
    'title-h2b',
    `Mulheres dependem ${fmtPct(h2b.pubShareF)} do Fundo Público; no privado (${state.h2bYear}), homens lideram em ${h2b.privDeficitCount}/${h2b.rows.length} partidos`,
  );
  document.getElementById('stat-h2b').textContent =
    `Em ${state.h2bYear}, ${(h2b.pubShareF * 100).toFixed(1).replace('.', ',')}% da receita das mulheres vem do Fundo Público (vs. ${(h2b.pubShareM * 100).toFixed(1).replace('.', ',')}% nos homens). No privado, a mediana feminina é ${fmtBrl(h2b.medPrivF)} contra ${fmtBrl(h2b.medPrivM)} dos homens.`;

  // H3 — Fundo Público + Déficit em R$
  renderVerdict('verdict-h3', h3.verdict);
  const absDefMi = (Math.abs(h3.totalDeficitBrl) / 1e6).toFixed(1).replace('.', ',');
  setText(
    'title-h3',
    h3.subfinancedCount > 0
      ? `${h3.subfinancedCount} partidos subfinanciados somam déficit de −R$ ${absDefMi}M em ${state.h3Year} (razão ${h3.equityRatio.toFixed(2).replace('.', ',')}×)`
      : `Partidos acima da linha proporcional em ${state.h3Year} (razão ${h3.equityRatio.toFixed(2).replace('.', ',')}×)`,
  );
  document.getElementById('stat-h3').textContent =
    `Em ${state.h3Year}, mulheres são ${fmtPct(h3.pctCandF)} das candidaturas APTO e recebem ${fmtPct(h3.pctPubF)} do Fundo Público (razão ${h3.equityRatio.toFixed(2).replace('.', ',')}×). Soma do déficit nos ${h3.subfinancedCount} partidos subfinanciados: −R$ ${absDefMi} milhões.`;

  // H4 — Distribuição entre mulheres
  renderVerdict('verdict-h4', h4.verdict);
  setText(
    'title-h4',
    `Top 10% concentram ${fmtPct(h4.top10ShareRev)} da receita feminina e ${fmtPct(h4.top10ShareElected)} das eleitas (${state.h4Year})`,
  );
  document.getElementById('stat-h4').textContent =
    `Em ${state.h4Year}, as Top 10% mais financiadas (${h4.topStats.n} candidatas) concentram ${fmtPct(h4.top10ShareRev)} de toda a receita feminina e ${fmtPct(h4.top10ShareElected)} das eleitas, deixando ${fmtPct(h4.base90ShareRev)} para os outros 90% (${h4.baseStats.n} candidatas).`;

  // H5 — Urna
  renderVerdict('verdict-h5', h5.verdict);
  setText(
    'title-h5',
    `Conversão em ${state.h5Year} cai de ${fmtPct(h5.pctCandF)} nas chapas para ${fmtPct(h5.pctVotosF)} nos votos e ${fmtPct(h5.pctEleitasF)} nas cadeiras`,
  );
  document.getElementById('stat-h5').textContent =
    `Conversão global (${state.h5Year}): ${fmtPct(h5.pctCandF)} candidatas → ${fmtPct(h5.pctVotosF)} votos → ${fmtPct(h5.pctEleitasF)} eleitas (${h5.elF} de ${h5.elF + h5.elM} cadeiras).`;

  // H6 — Série 2018-2026
  renderVerdict('verdict-h6', h6Series.verdict);
  const h6_18 = h6Series.byYear[2018];
  const h6_22 = h6Series.byYear[2022];
  const h6_26 = h6Series.byYear[2026];
  setText(
    'title-h6',
    `Disparidade F/M em ≥ 2 sinais despenca de ${h6_18.ratio2Plus.toFixed(1).replace('.', ',')}× (2018) para ${h6_26.ratio2Plus.toFixed(1).replace('.', ',')}× (2026)`,
  );
  document.getElementById('stat-h6').textContent =
    `≥2 sinais (F vs. M, limiar ≤ ${state.threshold}v): ${fmtPct(h6_18.pct2PlusF)} vs. ${fmtPct(h6_18.pct2PlusM)} em 2018 (${h6_18.ratio2Plus.toFixed(1).replace('.', ',')}×) → ${fmtPct(h6_22.pct2PlusF)} vs. ${fmtPct(h6_22.pct2PlusM)} em 2022 (${h6_22.ratio2Plus.toFixed(2).replace('.', ',')}×) → ${fmtPct(h6_26.pct2PlusF)} vs. ${fmtPct(h6_26.pct2PlusM)} em 2026 (${h6_26.ratio2Plus.toFixed(2).replace('.', ',')}×).`;

  // H7 — Lollipop por faixa
  const bFloor22 = h7Comp.rows.find((r) => r.band === '30%–33,3%')?.y2022;
  const bHigh22 = h7Comp.rows.find((r) => r.band === '> 40%')?.y2022;
  const bLt30_26 = h7Comp.rows.find((r) => r.band === '< 30%')?.y2026;
  renderVerdict('verdict-h7', h7Comp.verdict2022);
  setText(
    'title-h7',
    `Alertas caem no piso (30%–33,3%: ${(bFloor22?.aggRatePct || 0).toFixed(1).replace('.', ',')}% → ${(h7Comp.rows.find((r) => r.band === '30%–33,3%')?.y2026?.aggRatePct || 0).toFixed(1).replace('.', ',')}%) e concentram-se abaixo de 30% (${(bLt30_26?.aggRatePct || 0).toFixed(1).replace('.', ',')}%)`,
  );
  document.getElementById('stat-h7').textContent =
    `2022: ${(bFloor22?.aggRatePct || 0).toFixed(1).replace('.', ',')}% nas chapas 30%–33,3% vs. ${(bHigh22?.aggRatePct || 0).toFixed(1).replace('.', ',')}% nas >40%. Em 2026, o piso cai para ${(h7Comp.rows.find((r) => r.band === '30%–33,3%')?.y2026?.aggRatePct || 0).toFixed(1).replace('.', ',')}% e chapas <30% chegam a ${(bLt30_26?.aggRatePct || 0).toFixed(1).replace('.', ',')}%.`;

  // H8 — 2018-2026 adaptação
  renderVerdict('verdict-h8', h8.verdict);
  setText(
    'title-h8',
    `Contas zeradas caem para ${fmtPct(h8.byYear[2026].pctZero)} enquanto pacotes padronizados chegam a ${fmtPct(h8.byYear[2026].pctStd)} em 2026`,
  );
  document.getElementById('stat-h8').textContent =
    `Contas zeradas (B): ${fmtPct(h8.byYear[2018].pctZero)} (2018) → ${fmtPct(h8.byYear[2022].pctZero)} (2022) → ${fmtPct(h8.byYear[2026].pctZero)} (2026) · Lote padronizado (C): ${fmtPct(h8.byYear[2018].pctStd)} → ${fmtPct(h8.byYear[2022].pctStd)} → ${fmtPct(h8.byYear[2026].pctStd)}.`;

  // H9 — Mapa + Matriz
  renderVerdict('verdict-h9', h9.verdict);
  const validUfsH9 = (computed.h9Map?.ufRows || []).filter((u) => !u.inconclusive && u.pctEleitasF !== null);
  const ufsGe30 = validUfsH9.filter((u) => u.pctEleitasF >= 30).length;
  setText(
    'title-h9',
    ufsGe30 === 0
      ? `Nenhuma UF atinge 30% de eleitas em ${state.h9Year}; gargalo varia entre privado, votos e alertas`
      : `${ufsGe30} de ${validUfsH9.length} UFs atingem ≥ 30% de eleitas em ${state.h9Year}; gargalos seguem desiguais`,
  );
  document.getElementById('stat-h9').textContent = `${state.h9Year}: ${h9.verdict.reason}`;

  renderInlineEvidenceCards(computed);
  renderSynthesisSection(computed);

  if (covYear) {
    const fin = covYear.tp_prestacao_apto?.FINAL || 0;
    const tot = covYear.population?.apto_cands || 1;
    document.getElementById('footer-coverage').textContent =
      `${state.statsYear}: ${tot.toLocaleString('pt-BR')} candidaturas APTO (${((fin / tot) * 100).toFixed(1).replace('.', ',')}% com prestação FINAL; extração ${covYear.dt_geracao?.receitas || '—'}).`;
  }
}

function getCanvasWidth(el, fallback = 620) {
  return Math.min(740, Math.max(290, el?.clientWidth || fallback));
}

function update() {
  if (!APP_DATA) return;

  const statsRows = getScopedRows({ year: state.statsYear });
  const statsH3 = computeH3(statsRows);
  const statsH5 = computeH5(statsRows);

  const h1Comparison = computeH1Comparison(APP_DATA.candidates, {
    cargo: state.cargo,
    uf: state.uf || null,
    party: state.party || null,
  });
  syncH1BinParties(h1Comparison);
  const h1 = computeH1(getScopedRows({ year: state.statsYear, ignoreH1Bin: true }));

  const binParties = state.h1BinFilter?.parties?.size > 0 ? state.h1BinFilter.parties : null;

  const h2Gap = computeH2GapEvolution(APP_DATA.candidates, {
    cargo: state.cargo,
    uf: state.uf || null,
    parties: binParties,
    selectedParty: state.party,
  });

  const h2bRows = getScopedRows({ year: state.h2bYear, ignoreParty: true });
  const h2b = computeH2PublicVsPrivate(computeH2(h2bRows), { selectedParty: state.party });

  const h3Rows = getScopedRows({ year: state.h3Year, ignoreParty: true });
  const h3 = computeH3(h3Rows);

  const h4Rows = getScopedRows({ year: state.h4Year });
  const h4 = computeH4WomenSankey(h4Rows, {
    profile: state.h4Profile,
    coverageYear: APP_DATA.coverage?.years?.[String(state.h4Year)] || null,
  });

  const h5Rows = getScopedRows({ year: state.h5Year, ignoreParty: true });
  const h5 = computeH5(h5Rows, { selectedParty: state.party });

  const h6Series = computeH6Series(APP_DATA.candidates, {
    cargo: state.cargo,
    uf: state.uf || null,
    party: state.party || null,
    parties: binParties,
    voteThreshold: state.threshold,
  });

  const h7Comp = computeH7Comparison(APP_DATA.candidates, {
    cargo: state.cargo,
    uf: state.uf || null,
    party: state.party || null,
    parties: binParties,
    voteThreshold: state.threshold,
  });

  const h8 = computeH8(APP_DATA.candidates, {
    cargo: state.cargo,
    uf: state.uf || null,
    party: state.party || null,
    parties: binParties,
    voteThreshold: state.threshold,
  });

  const h9MapRows = getScopedRows({ year: state.h9Year, ignoreUF: true, ignoreParty: true });
  const h9MatrixRows = getScopedRows({
    year: state.h9Year,
    ignoreUF: state.h9MatrixUnit === 'uf',
    ignoreParty: state.h9MatrixUnit === 'party',
  });
  const h9MapData = computeH9MatrixAndMap(h9MapRows, {
    voteThreshold: state.threshold,
    selectedParty: state.party,
  });
  const h9MatrixData = computeH9MatrixAndMap(h9MatrixRows, {
    voteThreshold: state.threshold,
    selectedParty: state.party,
  });

  const computed = {
    statsH3,
    statsH5,
    h1,
    h1Comparison,
    h2Gap,
    h2b,
    h3,
    h4,
    h5,
    h6Series,
    h7Comp,
    h8,
    h9: h9MatrixData,
    h9Map: h9MapData,
  };

  updateSummaryAndNarrative(statsRows, computed);
  renderChips();

  // Controles e renderização local de cada gráfico
  // H1
  buildSegmentedControls('controls-h1', [
    {
      label: 'Registradas',
      active: state.h1Mode === 'reg',
      onClick: () => {
        state.h1Mode = 'reg';
        syncH1BinParties(h1Comparison);
        update();
      },
    },
    {
      label: 'Aptas',
      active: state.h1Mode === 'apto',
      onClick: () => {
        state.h1Mode = 'apto';
        syncH1BinParties(h1Comparison);
        update();
      },
    },
  ]);
  const cH1 = document.getElementById('canvas-h1');
  renderH1Histogram(cH1, h1Comparison, {
    width: getCanvasWidth(cH1),
    mode: state.h1Mode,
    selectedBinId: state.h1BinFilter?.id || null,
    onSelectParty: toggleParty,
    onSelectBin: (binId) => {
      if (!binId || state.h1BinFilter?.id === binId) {
        state.h1BinFilter = null;
      } else {
        const bin = h1Comparison.bins.find((b) => b.id === binId);
        const partyArr = state.h1Mode === 'apto' ? bin?.partiesUnion?.apto : bin?.partiesUnion?.reg;
        if (bin && partyArr && partyArr.length > 0) {
          state.h1BinFilter = { id: bin.id, label: bin.label, parties: new Set(partyArr) };
        }
      }
      update();
    },
  });
  const y22h1 = h1Comparison.byYear[2022];
  const y26h1 = h1Comparison.byYear[2026];
  document.getElementById('caption-h1').textContent = state.h1Mode === 'apto'
    ? `Aptas (n ≥ 4) na mesma escala travada. Inaptidões derrubaram ${fmtPct(y22h1.pctDroppedByInapto)} (${y22h1.droppedByInapto}) em 2022 e ${fmtPct(y26h1.pctDroppedByInapto)} (${y26h1.droppedByInapto}) em 2026 abaixo de 30%.`
    : `Registradas (n ≥ 4). Microchapas (<4 cand.) fora do percentual: ${y22h1.microSlatesReg} em 2022 (${y22h1.microCandsReg} pessoas) e ${y26h1.microSlatesReg} em 2026 (${y26h1.microCandsReg} pessoas).`;

  // H2
  const cH2 = document.getElementById('canvas-h2');
  renderH2Dumbbell(cH2, h2Gap, {
    width: getCanvasWidth(cH2),
    selectedParty: state.party,
    onSelectParty: toggleParty,
    onClearParty: clearParty,
  });
  document.getElementById('caption-h2').textContent =
    'Diferença Δ = Mediana Mulheres − Mediana Homens (em R$) de 2022 (anel branco) para 2026 (círculo ciano), ordenada pelo gap de 2026. Clique em um partido para destacar em todos os gráficos; clique novamente ou no fundo para limpar.';

  // H2B
  buildSegmentedControls('controls-h2b', [
    { label: '2022', active: state.h2bYear === 2022, onClick: () => { state.h2bYear = 2022; update(); } },
    { label: '2026', active: state.h2bYear === 2026, onClick: () => { state.h2bYear = 2026; update(); } },
  ]);
  const cH2b = document.getElementById('canvas-h2b');
  renderDivergentChart(cH2b, h2b, {
    width: getCanvasWidth(cH2b),
    selectedParty: state.party,
    onSelectParty: toggleParty,
    onClearParty: clearParty,
  });
  document.getElementById('caption-h2b').textContent =
    `Acima (${state.h2bYear}): diferença mediana em R$ no Fundo Público vs. Privado/Próprio. Abaixo: composição 100% das fontes mostrando que mulheres dependem quase exclusivamente do recurso público obrigatório.`;

  // H3 (somente seletor de ano, sem botões de escala/zoom)
  buildSegmentedControls('controls-h3', [
    { label: '2022', active: state.h3Year === 2022, onClick: () => { state.h3Year = 2022; update(); } },
    { label: '2026', active: state.h3Year === 2026, onClick: () => { state.h3Year = 2026; update(); } },
  ]);
  const cH3 = document.getElementById('canvas-h3');
  renderH3Scatter(cH3, h3, {
    width: getCanvasWidth(cH3),
    selectedParty: state.party,
    onSelectParty: toggleParty,
    onClearParty: clearParty,
  });
  document.getElementById('caption-h3').textContent =
    `Partidos com n ≥ 10 APTO em ${state.h3Year} (modo foco em escala linear). Todas as bolhas subfinanciadas estão rotuladas; clique para destacar/limpar.`;

  // H4 (Sankey 100% feminino)
  buildSegmentedControls('controls-h4', [
    [
      { label: 'Todas (100%)', active: state.h4Profile === 'all', onClick: () => { state.h4Profile = 'all'; update(); } },
      { label: 'Competitivas (Top 10%)', active: state.h4Profile === 'top10', onClick: () => { state.h4Profile = 'top10'; update(); } },
      { label: 'Base (90%)', active: state.h4Profile === 'base90', onClick: () => { state.h4Profile = 'base90'; update(); } },
    ],
    [
      { label: '2022', active: state.h4Year === 2022, onClick: () => { state.h4Year = 2022; update(); } },
      { label: '2026', active: state.h4Year === 2026, onClick: () => { state.h4Year = 2026; update(); } },
    ],
  ]);
  const cH4 = document.getElementById('canvas-h4');
  renderH4Sankey(cH4, h4, { width: getCanvasWidth(cH4) });
  document.getElementById('caption-h4').textContent =
    `Fluxo 100% proporcional entre mulheres APTO (${state.h4Year}). Passe o mouse sobre as faixas para ver percentuais e valores equivalentes em reais.`;

  // H5
  buildSegmentedControls('controls-h5', [
    { label: '2022', active: state.h5Year === 2022, onClick: () => { state.h5Year = 2022; update(); } },
    { label: '2026', active: state.h5Year === 2026, onClick: () => { state.h5Year = 2026; update(); } },
  ]);
  const cH5 = document.getElementById('canvas-h5');
  renderH5Conversion(cH5, h5, {
    width: getCanvasWidth(cH5),
    selectedParty: state.party,
    onSelectParty: toggleParty,
    onClearParty: clearParty,
  });
  document.getElementById('caption-h5').textContent =
    `Top 10 partidos por cadeiras em ${state.h5Year}, ordenados pela taxa de Eleitas (%). Linha tracejada marca 30%.`;

  // H6
  const cH6 = document.getElementById('canvas-h6');
  renderH6Signals(cH6, h6Series, { width: getCanvasWidth(cH6) });
  document.getElementById('caption-h6').textContent =
    `Evolução 2018 → 2022 → 2026 da proporção de candidaturas APTO com ≥2 sinais (limiar A ≤ ${state.threshold} votos). Nota: em 2018 vigoravam coligações proporcionais.`;

  // H7
  buildSegmentedControls('controls-h7', [
    {
      label: state.h7Show2018 ? 'Ocultar 2018' : 'Mostrar 2018',
      active: state.h7Show2018,
      onClick: () => { state.h7Show2018 = !state.h7Show2018; update(); },
    },
  ]);
  const cH7 = document.getElementById('canvas-h7');
  renderH7Boxplot(cH7, h7Comp, { width: getCanvasWidth(cH7), show2018: state.h7Show2018 });
  document.getElementById('caption-h7').textContent =
    'Taxa agregada de candidatas com ≥2 sinais em cada faixa de percentual feminino na chapa (n ≥ 4).';

  // H8
  const cH8 = document.getElementById('canvas-h8');
  renderH8Temporal(cH8, h8, { width: getCanvasWidth(cH8) });
  document.getElementById('caption-h8').textContent =
    'Série comparativa 2018 → 2022 → 2026 sobre candidatas mulheres APTO. Escalas verticais independentes em cada painel para destacar ambas as tendências.';

  // H9
  buildSegmentedControls('controls-h9', [
    H9_METRICS.map((m) => ({
      label: m.short,
      active: state.h9Metric === m.key,
      onClick: () => {
        state.h9Metric = m.key;
        state.h9SortBy = m.key;
        state.h9SortDir = 'desc';
        update();
      },
    })),
    [
      { label: '27 UFs', active: state.h9MatrixUnit === 'uf', onClick: () => { state.h9MatrixUnit = 'uf'; update(); } },
      { label: 'Top 15 Partidos', active: state.h9MatrixUnit === 'party', onClick: () => { state.h9MatrixUnit = 'party'; update(); } },
    ],
    [
      { label: '2022', active: state.h9Year === 2022, onClick: () => { state.h9Year = 2022; update(); } },
      { label: '2026', active: state.h9Year === 2026, onClick: () => { state.h9Year = 2026; update(); } },
    ],
  ]);
  const cH9Map = document.getElementById('canvas-h9-map');
  const cH9Mat = document.getElementById('canvas-h9-matrix');
  renderUFMap(cH9Map, APP_DATA.brUf, h9MapData, {
    width: Math.min(540, Math.max(290, cH9Map?.clientWidth || 460)),
    metric: state.h9Metric,
    selectedUF: state.uf,
    onSelectUF: toggleUF,
    onClearUF: clearUF,
  });
  renderH9HeatmapMatrix(cH9Mat, h9MatrixData, {
    unit: state.h9MatrixUnit,
    sortBy: state.h9SortBy,
    sortDir: state.h9SortDir,
    selectedEntity: state.h9MatrixUnit === 'uf' ? state.uf : state.party,
    onSort: (colKey) => {
      if (state.h9SortBy === colKey) {
        state.h9SortDir = state.h9SortDir === 'desc' ? 'asc' : 'desc';
      } else {
        state.h9SortBy = colKey;
        state.h9SortDir = colKey === 'key' ? 'asc' : 'desc';
      }
      update();
    },
    onSelectEntity: (key, unit) => (unit === 'uf' ? toggleUF(key) : toggleParty(key)),
    onClearEntity: () => (state.h9MatrixUnit === 'uf' ? clearUF() : clearParty()),
  });
  document.getElementById('caption-h9').textContent =
    `Mapa por UF colorido pela métrica selecionada (${state.h9Year}) e matriz heatmap ordenável por qualquer coluna. Clique em uma UF no mapa ou em uma linha da matriz para destacar/filtrar.`;
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
    if (c.y === 2022 || c.y === 2026) {
      partyCounts.set(c.p, (partyCounts.get(c.p) || 0) + 1);
    }
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
}

async function init() {
  APP_DATA = await loadAppData();
  populateSelects();
  renderCoverageTable(APP_DATA.coverage);
  chapterNavCtrl = createChapterNav();

  syncFilterHeightVar();
  if (typeof ResizeObserver !== 'undefined') {
    const fb = document.getElementById('filter-bar');
    if (fb) new ResizeObserver(() => syncFilterHeightVar()).observe(fb);
  }

  document.querySelectorAll('[data-stats-year]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.statsYear = Number(btn.dataset.statsYear);
      document.querySelectorAll('[data-stats-year]').forEach((b) => {
        const active = b === btn;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      update();
    });
  });

  document.querySelectorAll('[data-cargo]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.cargo = btn.dataset.cargo;
      document.querySelectorAll('[data-cargo]').forEach((b) => {
        const active = b === btn;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
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
    state.statsYear = 2022;
    state.cargo = 'all';
    state.uf = '';
    state.party = '';
    state.threshold = 10;
    state.h1Mode = 'reg';
    state.h1BinFilter = null;
    state.h2bYear = 2026;
    state.h3Year = 2022;
    state.h4Year = 2022;
    state.h4Profile = 'all';
    state.h5Year = 2022;
    state.h7Show2018 = false;
    state.h9Year = 2022;
    state.h9Metric = 'pctEleitasF';
    state.h9MatrixUnit = 'uf';
    state.h9SortBy = 'pctEleitasF';
    state.h9SortDir = 'desc';
    document.getElementById('filter-uf').value = '';
    document.getElementById('filter-party').value = '';
    document.getElementById('filter-threshold').value = '10';
    document.getElementById('threshold-out').textContent = '10';
    document.querySelectorAll('[data-stats-year]').forEach((b) => {
      const active = Number(b.dataset.statsYear) === 2022;
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

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => update(), 120);
  });

  initScrollMotion();
  update();
  if (chapterNavCtrl) chapterNavCtrl.setCurrentAct('1');
}

init().catch((err) => {
  const scopeEl = document.getElementById('scope-summary');
  if (scopeEl) {
    scopeEl.classList.add('is-error');
    scopeEl.textContent = 'Falha ao carregar os dados. Recarregue a página para tentar novamente.';
  }
  const h1Canvas = document.getElementById('canvas-h1');
  if (h1Canvas) {
    h1Canvas.innerHTML = '<p class="chart-empty is-error" role="alert">Não foi possível carregar os dados da visualização. Recarregue a página para tentar novamente.</p>';
  }
  console.error(err);
});
