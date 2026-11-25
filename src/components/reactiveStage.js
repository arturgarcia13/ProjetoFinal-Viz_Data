import { renderScaleMosaic } from '../charts/scaleMosaic.js';
import { renderDivergentChart } from '../charts/divergentChart.js';
import { renderH1Histogram } from '../charts/h1Histogram.js';
import { renderH2Dumbbell } from '../charts/h2Dumbbell.js';
import { renderH3Scatter } from '../charts/h3Scatter.js';
import { renderH4Sankey, renderH4Network } from '../charts/h4SankeyNetwork.js';
import { renderH5Conversion } from '../charts/h5Conversion.js';
import { renderH6Signals } from '../charts/h6Signals.js';
import { renderH7Boxplot } from '../charts/h7Boxplot.js';
import { renderH8Temporal } from '../charts/h8Temporal.js';
import { renderUFMap, renderParallelCoordinates } from '../charts/h9MapAndParallel.js';
import {
  computeH1, computeH2, computeH3, computeH4, computeH5, computeH6, computeH7, computeH8,
  computeH9AndParallel, computeScaleMosaic, computeDivergentDisparity,
} from '../indicators.js';

const STEP_CONTEXT = {
  'escala-macro': { modality: 'NO REGISTRO', source: 'consulta_cand · 2022/2026', universe: 'Chapas n ≥ 4' },
  'escala-micro': { modality: 'NO REGISTRO (PULL-OUT)', source: 'consulta_cand + Sinais', universe: '4 Chapas Reais' },
  h1: { modality: 'NO REGISTRO', source: 'consulta_cand · 2022 vs. 2026', universe: 'Registradas vs. APTO' },
  h2: { modality: 'NAS CONTAS', source: 'receitas_candidatos · TSE', universe: 'Candidaturas APTO' },
  'h2-div': { modality: 'NAS CONTAS (DIVERGENTE)', source: 'receitas_candidatos · TSE', universe: 'Razão F vs. M (APTO)' },
  h3: { modality: 'NAS CONTAS (FEFC + FP)', source: 'receitas_candidatos · ADI 5617', universe: 'Partidos n ≥ 10 APTO' },
  h4: { modality: 'NAS DESPESAS', source: 'despesas_contratadas · TSE', universe: 'Parcela Pública (APTO)' },
  h5: { modality: 'NAS URNAS', source: 'votacao_munzona + consulta_cand', universe: 'Candidaturas APTO' },
  h6: { modality: 'CRUZAMENTO DE SINAIS', source: 'Votos × Receitas × Despesas', universe: 'Súmula 73 (APTO)' },
  h7: { modality: 'CHAPAS × TERRITÓRIO', source: 'Chapas n ≥ 4 × 27 UFs', universe: 'Candidaturas APTO' },
  h8: { modality: 'EVOLUÇÃO 2022 → 2026', source: 'Série Comparada TSE', universe: 'Candidatas F (APTO)' },
  h9: { modality: 'SÍNTESE MULTI-EIXO', source: '5 Eixos × 27 UFs & Partidos', universe: 'Recorte Ativo' },
};

let lastModality = null;

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

function updateContextSwitchBar(stepId) {
  const ctx = STEP_CONTEXT[stepId] || STEP_CONTEXT.h1;
  const bar = document.getElementById('stage-context-bar');
  const modEl = document.getElementById('stage-context-modality');
  const srcEl = document.getElementById('stage-context-source');
  const uniEl = document.getElementById('stage-context-universe');
  if (modEl) modEl.textContent = ctx.modality;
  if (srcEl) srcEl.textContent = ctx.source;
  if (uniEl) uniEl.textContent = ctx.universe;

  if (bar && lastModality && lastModality !== ctx.modality) {
    bar.classList.remove('context-switched');
    // Força reflow leve para re-disparar pulso visual de troca de contexto quando motion está ativo
    void bar.offsetWidth;
    bar.classList.add('context-switched');
  }
  lastModality = ctx.modality;
}

function setSecondaryKicker(text) {
  const el = document.getElementById('stage-secondary-kicker');
  if (!el) return;
  if (text) {
    el.textContent = text;
    el.hidden = false;
  } else {
    el.textContent = '';
    el.hidden = true;
  }
}

export function renderReactiveStage({
  state,
  appData,
  computed,
  getScopedRows,
  actions,
}) {
  const canvas = document.getElementById('stage-canvas');
  const secondary = document.getElementById('stage-secondary');
  const kicker = document.getElementById('stage-kicker');
  const title = document.getElementById('stage-title');
  const subtitle = document.getElementById('stage-subtitle');
  const caption = document.getElementById('stage-caption');

  secondary.innerHTML = '';
  setSecondaryKicker('');
  if (subtitle) {
    subtitle.textContent = '';
    subtitle.hidden = true;
  }

  updateContextSwitchBar(state.activeStep);

  const w = Math.min(720, Math.max(300, canvas.clientWidth || 640));
  const {
    scaleMosaic,
    h1Comparison,
    h2Stage,
    divergentStage,
    h3,
    h4,
    h5,
    h6,
    h7,
    h8,
    h9,
    mapH9,
    mapH7,
  } = computed;

  const covYear = appData.coverage?.years?.[String(state.year)] || null;

  switch (state.activeStep) {
    case 'escala-macro':
    case 'escala-micro': {
      const isMicro = state.activeStep === 'escala-micro';
      kicker.textContent = isMicro
        ? 'Evidência em Escala · Pull-Out (4 Chapas)'
        : 'Evidência em Escala · Mosaico de Chapas';
      title.textContent = isMicro
        ? 'Da Escala ao Caso Real: 4 Chapas Extraídas do Mosaico'
        : `Mosaico Proporcional das ${scaleMosaic.totalSlates.toLocaleString('pt-BR')} Chapas (${state.year})`;
      if (subtitle) {
        subtitle.textContent = isMicro
          ? 'Os 4 casos destacados permanecem acesos enquanto o restante do mosaico recua para 15% de opacidade.'
          : 'Cada bloco representa chapas reais (n ≥ 4) agrupadas pela faixa de participação feminina no registro.';
        subtitle.hidden = false;
      }
      buildStageControls([
        { label: 'Visão Macro (48)', active: !isMicro, onClick: () => actions.setActiveStep('escala-macro') },
        { label: 'Pull-Out (4 casos)', active: isMicro, onClick: () => actions.setActiveStep('escala-micro') },
      ]);
      if (isMicro) {
        setSecondaryKicker('Pull-Out · 4 Chapas Reais Extraídas com Metadados');
      }
      renderScaleMosaic(canvas, secondary, scaleMosaic, {
        width: w,
        year: state.year,
        focusMode: isMicro ? 'micro' : 'macro',
        coverageYear: covYear,
        onSelectUF: actions.toggleUF,
      });
      caption.textContent = isMicro
        ? 'Cada cartão abaixo traz metadados reais da extração do TSE e permite filtrar o estado correspondente.'
        : 'Passe o cursor em qualquer bloco para inspecionar a chapa real ou clique para filtrar pela UF.';
      break;
    }

    case 'h1': {
      kicker.textContent = 'Ato 01 · No Papel (H1)';
      title.textContent = 'Histograma Espelhado: % de Mulheres por Chapa (2022 vs. 2026)';
      buildStageControls([
        { label: 'Registradas', active: state.h1Mode === 'reg', onClick: () => { state.h1Mode = 'reg'; actions.update(); } },
        { label: 'Aptas', active: state.h1Mode === 'apto', onClick: () => { state.h1Mode = 'apto'; actions.update(); } },
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
      title.textContent = `Mediana de Receitas por Partido (F vs. M) e Fontes · ${state.h2Year}`;
      buildStageControls([
        { label: '2022', active: state.h2Year === 2022, onClick: () => { state.h2Year = 2022; actions.update(); } },
        { label: '2026', active: state.h2Year === 2026, onClick: () => { state.h2Year = 2026; actions.update(); } },
      ]);
      setSecondaryKicker('Composição por Fonte · Público vs. Privado (%)');
      renderH2Dumbbell(canvas, h2Stage, { width: w, onSelectParty: actions.toggleParty });
      caption.textContent = `Exibindo ${state.h2Year} no gráfico (seletor independente do filtro global). Clique em qualquer círculo para filtrar o partido; barras inferiores comparam composição Pública (FEFC+FP) vs. Privada/Própria.`;
      break;

    case 'h2-div':
      kicker.textContent = 'Ato 02 · No Dinheiro (H2 Divergente)';
      title.textContent = `Assimetria Relativa (Mulheres vs. Homens) · ${state.year}`;
      if (subtitle) {
        subtitle.textContent = 'Eixo central ancorado na paridade (Igual = 1×). Barras à esquerda indicam vantagem mediana masculina; à direita, feminina.';
        subtitle.hidden = false;
      }
      buildStageControls([
        { label: 'Privado/Próprio', active: state.h2DivMode === 'priv', onClick: () => { state.h2DivMode = 'priv'; actions.update(); } },
        { label: 'Fundo Público', active: state.h2DivMode === 'pub', onClick: () => { state.h2DivMode = 'pub'; actions.update(); } },
        { label: 'Total', active: state.h2DivMode === 'total', onClick: () => { state.h2DivMode = 'total'; actions.update(); } },
      ]);
      renderDivergentChart(canvas, divergentStage, { width: w, onSelectParty: actions.toggleParty });
      caption.textContent = `Top 12 partidos em ${state.year}. No recurso privado, mulheres têm mediana menor na maioria das legendas; alterne para "Fundo Público" para ver o contraste gerado pela cota de 30%.`;
      break;

    case 'h3':
      kicker.textContent = 'Ato 02 · No Dinheiro (H3)';
      title.textContent = '% de Candidatas × % do Fundo Público (FEFC + FP)';
      if (subtitle) {
        subtitle.textContent = 'Partidos acima da linha diagonal destinaram proporcionalmente mais recursos às mulheres do que o peso delas nas candidaturas.';
        subtitle.hidden = false;
      }
      buildStageControls([
        [
          {
            label: 'Foco (≤46%)',
            active: state.h3Zoom === 'focus',
            onClick: () => {
              state.h3Zoom = 'focus';
              state.h3Scale = 'linear';
              actions.update();
            },
          },
          {
            label: 'Todos',
            active: state.h3Zoom === 'all',
            onClick: () => {
              state.h3Zoom = 'all';
              actions.update();
            },
          },
        ],
        [
          {
            label: 'Escala Linear',
            active: state.h3Zoom === 'focus' || state.h3Scale === 'linear',
            onClick: () => {
              state.h3Scale = 'linear';
              actions.update();
            },
          },
          {
            label: 'Escala Log (Todos)',
            active: state.h3Zoom === 'all' && state.h3Scale === 'log',
            onClick: () => {
              state.h3Zoom = 'all';
              state.h3Scale = 'log';
              actions.update();
            },
          },
        ],
      ]);
      renderH3Scatter(canvas, h3, {
        width: w,
        scale: state.h3Zoom === 'focus' ? 'linear' : state.h3Scale,
        zoom: state.h3Zoom,
        onSelectParty: actions.toggleParty,
      });
      caption.textContent = state.h3Zoom === 'all' && state.h3Scale === 'log'
        ? 'Partidos com n ≥ 10 APTO na visão "Todos" em escala log₁₀. Passe o cursor sobre qualquer bolha para destacar o partido ou clique para filtrar.'
        : 'Partidos com n ≥ 10 APTO em escala linear (padrão). Passe o cursor sobre qualquer bolha para destacar o partido e ver detalhes, ou clique para filtrar.';
      break;

    case 'h4':
      kicker.textContent = 'Ato 02 · Fluxo e Rede (H4)';
      title.textContent = state.h4Tab === 'sankey'
        ? 'Fluxo Proporcional do Fundo Público por Destino'
        : 'Rede Bipartida: Candidaturas Anônimas × Fornecedores-Hub';
      buildStageControls([
        { label: 'Sankey', active: state.h4Tab === 'sankey', onClick: () => { state.h4Tab = 'sankey'; actions.update(); } },
        { label: 'Rede de Hubs', active: state.h4Tab === 'network', onClick: () => { state.h4Tab = 'network'; actions.update(); } },
      ]);
      if (state.h4Tab === 'sankey') {
        renderH4Sankey(canvas, h4, { width: w });
        caption.textContent = 'Alocação proporcional pela parcela pública da receita. Passe o cursor nas faixas para ver os montantes em R$ milhões.';
      } else {
        renderH4Network(canvas, appData.networkHubs?.years?.[String(state.year)], {
          uf: state.uf || null,
          party: state.party || null,
          cargo: state.cargo,
        }, { width: w, onSelectParty: actions.toggleParty });
        caption.textContent = 'Quadrados: fornecedores-hub (≥2 candidaturas no partido/UF e >15% da despesa de candidatura <20 votos). Círculos: candidaturas anônimas.';
      }
      break;

    case 'h5':
      kicker.textContent = 'Ato 03 · Na Urna (H5)';
      title.textContent = 'Funil em 3 Etapas (% Candidatas → % Votos → % Eleitas)';
      buildStageControls([]);
      renderH5Conversion(canvas, h5, { width: w, onSelectParty: actions.toggleParty });
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
      setSecondaryKicker('No Território · Taxa de Sinais (≥2) por UF');
      renderH7Boxplot(canvas, h7, { width: w });
      renderUFMap(secondary, appData.brUf, mapH9, mapH7, {
        width: w,
        mode: 'h7',
        selectedUF: state.uf,
        allowedUFs: state.pcAllowedUFs,
        onSelectUF: actions.toggleUF,
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
        { label: 'Mapa H9 (Etapa)', active: state.mapMode === 'h9', onClick: () => { state.mapMode = 'h9'; actions.update(); } },
        { label: 'Mapa H7 (Sinais)', active: state.mapMode === 'h7', onClick: () => { state.mapMode = 'h7'; actions.update(); } },
        { label: 'Eixos: Partidos', active: state.pcUnit === 'party', onClick: () => { state.pcUnit = 'party'; actions.clearBrushState(); actions.update(); } },
        { label: 'Eixos: UFs', active: state.pcUnit === 'uf', onClick: () => { state.pcUnit = 'uf'; actions.clearBrushState(); actions.update(); } },
      ]);
      setSecondaryKicker('Perfil Multi-Eixo · Coordenadas Paralelas (Arraste nos Eixos para Filtrar)');
      renderUFMap(canvas, appData.brUf, mapH9, mapH7, {
        width: w,
        mode: state.mapMode,
        selectedUF: state.uf,
        allowedUFs: state.pcAllowedUFs,
        onSelectUF: actions.toggleUF,
      });
      renderParallelCoordinates(secondary, state.pcUnit === 'uf' ? mapH9 : h9, {
        width: w,
        unit: state.pcUnit,
        selectedEntity: state.pcUnit === 'uf' ? state.uf : state.party,
        initialRanges: state.pcRanges,
        onSelectEntity: (key, unit) => (unit === 'uf' ? actions.toggleUF(key) : actions.toggleParty(key)),
        onBrushFilter: (allowedSet, rangesMap) => {
          state.pcRanges = rangesMap;
          if (state.pcUnit === 'party') {
            state.pcAllowedParties = allowedSet;
            state.pcAllowedUFs = null;
          } else {
            state.pcAllowedUFs = allowedSet;
            state.pcAllowedParties = null;
          }
          actions.renderChips();
          const brushedRows = getScopedRows();
          const brushedMapRows = getScopedRows({ ignoreUF: true });
          const brushedH1 = computeH1(brushedRows);
          const brushedH2 = computeH2(brushedRows);
          const nextComputed = {
            h1: brushedH1,
            scaleMosaic: computeScaleMosaic(brushedRows, brushedH1, { voteThreshold: state.threshold, maxTiles: 48 }),
            h2: brushedH2,
            divergent: computeDivergentDisparity(brushedH2, { mode: 'priv', limit: 12, cap: 15 }),
            h3: computeH3(brushedRows),
            h4: computeH4(brushedRows),
            h5: computeH5(brushedRows),
            h6: computeH6(brushedRows, { voteThreshold: state.threshold }),
            h7: computeH7(brushedRows, { voteThreshold: state.threshold }),
            h8: computeH8(appData.candidates, {
              cargo: state.cargo,
              uf: state.uf || null,
              party: state.party || null,
              parties: state.pcAllowedParties,
              ufs: state.pcAllowedUFs,
              voteThreshold: state.threshold,
            }),
            h9: computeH9AndParallel(brushedRows, { voteThreshold: state.threshold }),
          };
          actions.updateSummaryAndNarrative(brushedRows, nextComputed);
          renderUFMap(
            canvas,
            appData.brUf,
            computeH9AndParallel(brushedMapRows, { voteThreshold: state.threshold }),
            computeH7(brushedMapRows, { voteThreshold: state.threshold }),
            {
              width: w,
              mode: state.mapMode,
              selectedUF: state.uf,
              allowedUFs: state.pcAllowedUFs,
              onSelectUF: actions.toggleUF,
            },
          );
        },
      });
      caption.textContent = 'Clique em uma UF para filtrar o painel; alterne os eixos entre Partidos e UFs ou arraste verticalmente nos eixos para filtrar.';
      break;
  }
}
