import * as d3 from 'd3';
import { IBGE_TO_UF, UF_NAMES } from '../data.js';
import { SEMANTIC_PALETTE } from './palette.js';
import { bindTooltipEvents, buildTooltipCard, createChartTooltip, fmtCompactBrl, fmtPct } from './tooltip.js';

const UF_REGIONS = {
  AC: 'Norte', AP: 'Norte', AM: 'Norte', PA: 'Norte', RO: 'Norte', RR: 'Norte', TO: 'Norte',
  AL: 'Nordeste', BA: 'Nordeste', CE: 'Nordeste', MA: 'Nordeste', PB: 'Nordeste', PE: 'Nordeste', PI: 'Nordeste', RN: 'Nordeste', SE: 'Nordeste',
  DF: 'Centro-Oeste', GO: 'Centro-Oeste', MT: 'Centro-Oeste', MS: 'Centro-Oeste',
  ES: 'Sudeste', MG: 'Sudeste', RJ: 'Sudeste', SP: 'Sudeste',
  PR: 'Sul', RS: 'Sul', SC: 'Sul',
};

export const COMPACT_UFS = ['RN', 'PB', 'PE', 'AL', 'SE', 'DF', 'ES', 'RJ'];
const COMPACT_SET = new Set(COMPACT_UFS);

export const ATO5_STEPS = [
  {
    index: 0,
    kicker: 'Passo 1 de 5 · Pilar 1',
    badge: 'Mediana por Gênero',
    shortPill: '1. Mediana',
    title: 'Onde as candidatas largam com maior caixa mediano',
    desc: 'Comparamos a receita mediana das mulheres frente à dos homens em cada estado. Os 5 líderes recebem o primeiro anel dourado de memória estrutural (★1/4), que permanece visível nos passos seguintes.',
    podiumHeader: 'Top 5 · Gap Mediano (F − M)',
    metricKey: 'medDiffK',
    higherIsBetter: true,
    formatVal: (v) => `${v >= 0 ? '+' : '−'}R$ ${Math.abs(v).toFixed(1).replace('.', ',')} mil`,
    shortVal: (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(0)}k`,
    isSynthesis: false,
  },
  {
    index: 1,
    kicker: 'Passo 2 de 5 · Pilar 2',
    badge: 'Proporcionalidade Pública',
    shortPill: '2. Fundo Púb.',
    title: 'Onde o Fundo Eleitoral supera o peso feminino na chapa',
    desc: 'Medimos o saldo entre a fatia do FEFC destinada às mulheres e sua proporção de candidaturas. Os 5 líderes ganham ou ampliam seus anéis dourados (até ★2/4), acumulando condições de financiamento.',
    podiumHeader: 'Top 5 · Saldo do FEFC (p.p.)',
    metricKey: 'fefcSaldo',
    higherIsBetter: true,
    formatVal: (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1).replace('.', ',')} p.p.`,
    shortVal: (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1).replace('.', ',')}pp`,
    isSynthesis: false,
  },
  {
    index: 2,
    kicker: 'Passo 3 de 5 · Pilar 3',
    badge: 'Concentração vs. Suavidade',
    shortPill: '3. Concentração',
    title: 'Investir com densidade ou diluir em kits mínimos?',
    desc: 'Uma distribuição excessivamente pulverizada dilui o fundo em candidaturas sem viabilidade eleitoral. Os 5 estados iluminados concentram maior fatia do FEFC feminino nas 10% candidatas mais financiadas.',
    podiumHeader: 'Top 5 · Concentração Top 10%',
    metricKey: 'concTop10',
    higherIsBetter: true,
    formatVal: (v) => `${v.toFixed(1).replace('.', ',')}% do FEFC`,
    shortVal: (v) => `${v.toFixed(0)}%`,
    isSynthesis: false,
  },
  {
    index: 3,
    kicker: 'Passo 4 de 5 · Pilar 4',
    badge: 'Teto Burocrático',
    shortPill: '4. Teto 30–33%',
    title: 'Onde os partidos vão além do limite de 30%–33%',
    desc: 'Em boa parte do país, a cota mínima opera como teto burocrático. Os 5 estados destacados registram a menor proporção de chapas presas entre 30% e 33%, indicando abertura além do mínimo legal.',
    podiumHeader: 'Top 5 · Menor acúmulo em 30%–33%',
    metricKey: 'tetoTrapped',
    higherIsBetter: false,
    formatVal: (v) => `${v.toFixed(1).replace('.', ',')}% no limite`,
    shortVal: (v) => `${v.toFixed(0)}%`,
    isSynthesis: false,
  },
  {
    index: 4,
    kicker: 'Passo 5 de 5 · Consequência na Urna',
    badge: 'Mulheres Eleitas',
    shortPill: '5. Urnas',
    title: 'Onde condições estruturais coincidem com mais cadeiras',
    desc: 'Destacamos os 5 estados com maior % de mulheres eleitas sobre os anéis dourados acumulados (★1/4–4/4). Onde o destaque encontra o anel dourado, fatores estruturais tendem a se traduzir em cadeiras.',
    podiumHeader: 'Top 5 · % de Mulheres Eleitas',
    metricKey: 'eleitasPct',
    higherIsBetter: true,
    formatVal: (v) => `${v.toFixed(1).replace('.', ',')}% eleitas`,
    shortVal: (v) => `${v.toFixed(1).replace('.', ',')}%`,
    isSynthesis: true,
  },
];

function rankTop5(rows, stepMeta) {
  const eligible = rows.filter((r) => r.validSample && (stepMeta.metricKey !== 'eleitasPct' || r.elTot > 0));
  const sorted = [...eligible].sort((a, b) => (
    stepMeta.higherIsBetter
      ? b[stepMeta.metricKey] - a[stepMeta.metricKey]
      : a[stepMeta.metricKey] - b[stepMeta.metricKey]
  ) || a.uf.localeCompare(b.uf));
  return sorted.slice(0, 5);
}

function buildStateTooltipCard(d, stepIdx) {
  const name = UF_NAMES[d.uf] || d.uf;
  const region = UF_REGIONS[d.uf] || '';
  const totalStars = d.pillars.filter(Boolean).length;
  const revealedStars = d.pillars.slice(0, Math.min(4, stepIdx + 1)).filter(Boolean).length;

  const pRows = [
    { idx: 0, label: '1. Mediana (F − M)', val: `${d.medDiffK >= 0 ? '+' : '−'}R$ ${Math.abs(d.medDiffK).toFixed(1).replace('.', ',')}k`, sub: `F ${fmtCompactBrl(d.medF)}` },
    { idx: 1, label: '2. Saldo FEFC', val: `${d.fefcSaldo >= 0 ? '+' : '−'}${Math.abs(d.fefcSaldo).toFixed(1).replace('.', ',')} p.p.` },
    { idx: 2, label: '3. Conc. Top 10%', val: fmtPct(d.concTop10) },
    { idx: 3, label: '4. Teto 30%–33%', val: fmtPct(d.tetoTrapped) },
    { idx: 4, label: '5. Mulheres Eleitas', val: fmtPct(d.eleitasPct), sub: `${d.elF}/${d.elTot}`, focus: stepIdx === 4 },
  ];

  return buildTooltipCard({
    title: `${name} (${d.uf}) · ${region}`,
    badge: revealedStars > 0 ? `★${revealedStars}/4 (total ★${totalStars}/4)` : 'Sem pilar no Top 5',
    badgeTone: totalStars >= 2 ? 'floor' : (d.eleitasRank ? 'above' : 'neutral'),
    rows: pRows.map((r) => {
      const rank = r.idx < 4 ? d.pillarRanks[r.idx] : d.eleitasRank;
      return {
        label: r.label,
        value: rank ? `${r.val} (★ #${rank})` : r.val,
        sub: r.sub,
        focus: r.idx === stepIdx || Boolean(rank),
      };
    }),
    hint: 'Clique no estado ou no mini-card para fixar o destaque',
  });
}

/**
 * Renderiza os 5 cards narrativos do Ato 5 com pódio Top 5 clicável e card de síntese no Passo 5.
 */
export function renderAto5StepCards(container, geoData, {
  activeStep = 0,
  selectedUF = '',
  onHoverUF = null,
  onSelectUF = null,
} = {}) {
  if (!container || !geoData) return;
  const rows = geoData.rows || [];

  ATO5_STEPS.forEach((step, sIdx) => {
    const card = container.querySelector(`.step-card[data-step="${sIdx}"]`);
    if (!card) return;
    const top5 = rankTop5(rows, step);

    let synthesisHtml = '';
    if (step.isSynthesis) {
      const twoPlus = top5.filter((d) => d.pillars.filter(Boolean).length >= 2).length;
      const anyPillar = top5.filter((d) => d.pillars.filter(Boolean).length >= 1).length;
      const zeroPillar = top5.filter((d) => d.pillars.filter(Boolean).length === 0).map((d) => d.uf);
      const outlierNote = zeroPillar.length > 0
        ? ` Exceções fora dos 4 pilares (${zeroPillar.join(', ')}) mostram que outros fatores regionais também influenciam a urna.`
        : '';
      synthesisHtml = `
        <div class="ato5-synthesis-box">
          <strong>Síntese Causa → Efeito (${geoData.year}):</strong>
          <strong>${twoPlus} de 5</strong> líderes em mulheres eleitas acumularam <strong>≥ 2 pilares estruturais</strong> (★2/4–4/4), e <strong>${anyPillar} de 5</strong> pontuaram em ao menos um pilar.${outlierNote}
        </div>
      `;
    }

    const miniCardsHtml = top5.map((d, rankIdx) => {
      const revealedStars = d.pillars.slice(0, Math.min(4, sIdx + 1)).filter(Boolean).length;
      const isSelected = selectedUF === d.uf;
      return `
        <button
          type="button"
          class="ato5-podium-card${isSelected ? ' is-selected' : ''}"
          data-podium-uf="${d.uf}"
          aria-pressed="${isSelected ? 'true' : 'false'}"
        >
          <span class="ato5-podium-rank${rankIdx === 0 ? ' is-first' : ''}">#${rankIdx + 1}</span>
          <span class="ato5-podium-meta">
            <strong>${UF_NAMES[d.uf] || d.uf} <small>(${d.uf})</small></strong>
            <small>${UF_REGIONS[d.uf] || ''}</small>
          </span>
          <span class="ato5-podium-vals tabular">
            ${revealedStars > 0 ? `<span class="ato5-star-pill">★${revealedStars}/4</span>` : ''}
            <span class="ato5-val-pill">${step.formatVal(d[step.metricKey])}</span>
          </span>
        </button>
      `;
    }).join('');

    let slot = card.querySelector('.ato5-card-dynamic');
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'ato5-card-dynamic';
      card.appendChild(slot);
    }
    slot.innerHTML = `
      ${synthesisHtml}
      <div class="ato5-podium-wrap">
        <div class="ato5-podium-head">${step.podiumHeader}</div>
        <div class="ato5-podium-list">${miniCardsHtml}</div>
      </div>
    `;

    slot.querySelectorAll('.ato5-podium-card').forEach((btn) => {
      const uf = btn.dataset.podiumUf;
      if (onHoverUF) {
        btn.addEventListener('mouseenter', () => onHoverUF(uf));
        btn.addEventListener('mouseleave', () => onHoverUF(null));
      }
      if (onSelectUF) {
        btn.addEventListener('click', (evt) => {
          evt.stopPropagation();
          onSelectUF(uf);
        });
      }
    });
  });

  // Atualiza destaque visual se hoveredUF/selectedUF mudar sem precisar refazer tudo
  if (activeStep !== null) {
    container.querySelectorAll('.ato5-podium-card').forEach((btn) => {
      btn.classList.toggle('is-selected', selectedUF === btn.dataset.podiumUf);
    });
  }
}

/**
 * Renderiza o Mapa Geográfico Real do Brasil (data/br_uf.json) + Anéis Dourados Cumulativos
 * + Linhas-Guia e Callouts Laterais para os 8 Estados Compactos (RN, PB, PE, AL, SE, DF, ES, RJ).
 */
export function renderAto5MapStage(
  mapContainer,
  calloutsContainer,
  brUfGeo,
  geoData,
  {
    step = 0,
    width = 480,
    hoveredUF = null,
    selectedUF = '',
    onHoverUF = null,
    onSelectUF = null,
    onClearUF = null,
  } = {},
) {
  if (!mapContainer || !brUfGeo || !geoData) return;
  mapContainer.innerHTML = '';

  const stepMeta = ATO5_STEPS[Math.max(0, Math.min(ATO5_STEPS.length - 1, step))];
  const rows = geoData.rows || [];
  const byUf = new Map(rows.map((r) => [r.uf, r]));
  const top5 = rankTop5(rows, stepMeta);
  const top5RankMap = new Map(top5.map((d, idx) => [d.uf, idx + 1]));

  const svgW = Math.max(320, width);
  const svgH = Math.round(svgW * 0.9);
  const mapRight = svgW - 18;
  const projection = d3.geoMercator().fitExtent([[10, 10], [mapRight - 14, svgH - 12]], brUfGeo);
  const pathGen = d3.geoPath(projection);

  const tipCtrl = createChartTooltip(mapContainer, { wrapClass: 'ato5-map-wrap' });
  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('class', 'h9-map-svg ato5-map-svg')
    .attr('viewBox', `0 0 ${svgW} ${svgH}`)
    .attr('width', svgW)
    .attr('height', svgH)
    .attr('role', 'img')
    .attr('aria-label', `Mapa geográfico das 27 UFs: ${stepMeta.badge}`)
    .style('font-family', 'Inter, system-ui, sans-serif');

  if (onClearUF) {
    svg.on('click', (evt) => {
      if (selectedUF && !evt.target.closest('.ato5-state-path')) onClearUF();
    });
  }

  const polyLayer = svg.append('g').attr('class', 'ato5-poly-layer');
  const ringLayer = svg.append('g').attr('class', 'ato5-ring-layer').style('pointer-events', 'none');
  const lineLayer = svg.append('g').attr('class', 'ato5-line-layer').style('pointer-events', 'none');
  const labelLayer = svg.append('g').attr('class', 'ato5-label-layer').style('pointer-events', 'none');

  const revealedCount = (d) => d.pillars.slice(0, Math.min(4, step + 1)).filter(Boolean).length;
  const focusUF = hoveredUF || selectedUF;

  const featureCentroids = new Map();
  brUfGeo.features.forEach((feat) => {
    const uf = IBGE_TO_UF[String(feat.properties.codarea)];
    if (!uf) return;
    const d = byUf.get(uf);
    if (!d) return;
    const rank = top5RankMap.get(uf);
    const isTop5 = Boolean(rank);
    const stars = revealedCount(d);
    const centroid = pathGen.centroid(feat);
    featureCentroids.set(uf, centroid);

    const fill = isTop5
      ? (rank === 1 ? '#C22D0C' : SEMANTIC_PALETTE.female)
      : (stars > 0 && stepMeta.isSynthesis ? '#F9EFD4' : '#E6EEEA');

    const isFocused = focusUF && focusUF === uf;
    const isDimmed = Boolean(focusUF && focusUF !== uf);

    const p = polyLayer.append('path')
      .datum(feat)
      .attr('d', pathGen)
      .attr('data-uf', uf)
      .attr('class', 'ato5-state-path')
      .attr('fill', fill)
      .attr('fill-opacity', isDimmed ? 0.45 : 1)
      .attr('stroke', isFocused ? SEMANTIC_PALETTE.ink : (isTop5 ? '#FFFFFF' : '#B9CAC2'))
      .attr('stroke-width', isFocused ? 2.4 : (isTop5 ? 1.5 : 0.9))
      .attr('stroke-linejoin', 'round')
      .style('cursor', 'pointer');

    if (stars > 0) {
      ringLayer.append('path')
        .datum(feat)
        .attr('d', pathGen)
        .attr('data-uf-ring', uf)
        .attr('fill', 'none')
        .attr('stroke', SEMANTIC_PALETTE.highlightInk)
        .attr('stroke-width', stars >= 2 ? 2.8 : 1.9)
        .attr('stroke-linejoin', 'round')
        .attr('stroke-opacity', isDimmed ? 0.45 : 0.95);
    }

    if (!COMPACT_SET.has(uf) && Number.isFinite(centroid[0]) && Number.isFinite(centroid[1])) {
      const hasSub = isTop5 || stars > 0;
      const subText = isTop5 ? `#${rank}` : (stars > 0 ? `★${stars}` : '');
      const lblG = labelLayer.append('g')
        .attr('transform', `translate(${centroid[0]}, ${centroid[1]})`)
        .style('opacity', isDimmed ? 0.4 : 1);

      lblG.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', hasSub ? '-2' : '3')
        .attr('font-size', svgW < 380 ? 8.5 : 9.5)
        .attr('font-weight', 700)
        .attr('fill', isTop5 ? '#FFFFFF' : SEMANTIC_PALETTE.ink)
        .attr('paint-order', 'stroke')
        .attr('stroke', isTop5 ? 'rgba(194,45,12,0.5)' : 'rgba(255,255,255,0.75)')
        .attr('stroke-width', 2)
        .text(uf);

      if (hasSub) {
        lblG.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '8.5')
          .attr('font-size', 8)
          .attr('font-weight', 700)
          .attr('fill', isTop5 ? '#F8DF4F' : '#8A5D00')
          .text(subText);
      }
    }

    const node = p.node();
    node.setAttribute('tabindex', '0');
    node.setAttribute('role', 'button');
    node.setAttribute('aria-label', `${UF_NAMES[uf] || uf}: ${stepMeta.formatVal(d[stepMeta.metricKey])}`);

    bindTooltipEvents(node, tipCtrl, () => buildStateTooltipCard(d, step), {
      focusable: true,
      onEnter: () => { if (onHoverUF) onHoverUF(uf); },
      onLeave: () => { if (onHoverUF) onHoverUF(null); },
    });

    if (onSelectUF) {
      p.on('click', (evt) => {
        evt.stopPropagation();
        onSelectUF(uf);
      });
      p.on('keydown', (evt) => {
        if (evt.key === 'Enter' || evt.key === ' ') {
          evt.preventDefault();
          onSelectUF(uf);
        }
      });
    }
  });

  // Leader lines conectando os 8 estados compactos aos seus callouts laterais (sem vazamento nos polígonos)
  const topPad = 24;
  const botPad = svgH - 22;
  const stepY = (botPad - topPad) / Math.max(1, COMPACT_UFS.length - 1);

  COMPACT_UFS.forEach((uf, idx) => {
    const centroid = featureCentroids.get(uf);
    const d = byUf.get(uf);
    if (!centroid || !d) return;
    const rank = top5RankMap.get(uf);
    const isTop5 = Boolean(rank);
    const stars = revealedCount(d);
    const calloutY = topPad + idx * stepY;
    const lineColor = isTop5
      ? SEMANTIC_PALETTE.female
      : (stars > 0 ? SEMANTIC_PALETTE.highlightInk : '#94A3B8');
    const isDimmed = Boolean(focusUF && focusUF !== uf);

    const lg = lineLayer.append('g').style('opacity', isDimmed ? 0.35 : 0.9);
    lg.append('circle')
      .attr('cx', centroid[0])
      .attr('cy', centroid[1])
      .attr('r', isTop5 ? 3.2 : 2.2)
      .attr('fill', lineColor);

    const elbowX = Math.max(centroid[0] + 18, svgW - 36);
    lg.append('polyline')
      .attr('points', `${centroid[0]},${centroid[1]} ${elbowX},${calloutY} ${svgW},${calloutY}`)
      .attr('fill', 'none')
      .attr('stroke', lineColor)
      .attr('stroke-width', isTop5 || stars > 0 ? 1.6 : 1)
      .attr('stroke-dasharray', isTop5 || stars > 0 ? null : '3,3');
  });

  // Callouts dedicados dos 8 estados compactos
  if (calloutsContainer) {
    calloutsContainer.innerHTML = COMPACT_UFS.map((uf) => {
      const d = byUf.get(uf);
      if (!d) return '';
      const rank = top5RankMap.get(uf);
      const isTop5 = Boolean(rank);
      const stars = revealedCount(d);
      const isFocused = focusUF === uf;

      const cls = [
        'ato5-callout-pill',
        isTop5 ? 'is-top5' : '',
        stars > 0 ? 'has-stars' : '',
        isFocused ? 'is-focused' : '',
      ].filter(Boolean).join(' ');

      return `
        <button
          type="button"
          class="${cls}"
          data-uf="${uf}"
          aria-pressed="${selectedUF === uf ? 'true' : 'false'}"
          aria-label="${UF_NAMES[uf] || uf} (${uf}): ${stepMeta.formatVal(d[stepMeta.metricKey])}"
        >
          <span class="ato5-callout-left">
            <strong>${uf}</strong>
            ${isTop5 ? `<span class="ato5-callout-rank">#${rank}</span>` : ''}
            ${stars > 0 ? `<span class="ato5-callout-stars">★${stars}/4</span>` : ''}
          </span>
          <span class="ato5-callout-val tabular">${stepMeta.shortVal(d[stepMeta.metricKey])}</span>
        </button>
      `;
    }).join('');

    calloutsContainer.querySelectorAll('.ato5-callout-pill').forEach((btn) => {
      const uf = btn.dataset.uf;
      const d = byUf.get(uf);
      if (!d) return;
      bindTooltipEvents(btn, tipCtrl, () => buildStateTooltipCard(d, step), {
        focusable: true,
        onEnter: () => { if (onHoverUF) onHoverUF(uf); },
        onLeave: () => { if (onHoverUF) onHoverUF(null); },
      });
      if (onSelectUF) {
        btn.addEventListener('click', (evt) => {
          evt.stopPropagation();
          onSelectUF(uf);
        });
      }
    });
  }
}

export function highlightAto5UF(mapContainer, calloutsContainer, stepsContainer, targetUF) {
  if (mapContainer) {
    mapContainer.querySelectorAll('.ato5-state-path').forEach((el) => {
      const uf = el.dataset.uf;
      if (!targetUF) {
        el.setAttribute('fill-opacity', '1');
      } else {
        el.setAttribute('fill-opacity', uf === targetUF ? '1' : '0.42');
      }
    });
  }
  if (calloutsContainer) {
    calloutsContainer.querySelectorAll('.ato5-callout-pill').forEach((el) => {
      el.classList.toggle('is-focused', targetUF === el.dataset.uf);
      el.style.opacity = targetUF && targetUF !== el.dataset.uf ? '0.55' : '1';
    });
  }
  if (stepsContainer) {
    stepsContainer.querySelectorAll('.ato5-podium-card').forEach((el) => {
      el.classList.toggle('is-focused', targetUF === el.dataset.podiumUf);
    });
  }
}
