import * as d3 from 'd3';
import gsap from 'gsap';
import { IBGE_TO_UF, UF_NAMES } from '../data.js';
import { selectTopWithTies } from '../indicators.js';
import { SEMANTIC_PALETTE } from './palette.js';
import { shouldAnimate } from './motion.js';
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
    badge: 'Concentração no Top 10%',
    shortPill: '3. Concentração',
    title: 'Onde o fundo feminino concentra nas 10% mais financiadas',
    desc: 'Concentração mede qual porcentagem de todo o FEFC destinado às mulheres vai para apenas as 10% candidatas mais financiadas da UF (frente aos 90% restantes). Os estados iluminados concentram maior fatia no topo.',
    podiumHeader: 'Top 5 · Fatia do FEFC no Top 10% (F)',
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
  const eligible = rows.filter((r) => (
    r.validSample
    && (stepMeta.metricKey !== 'eleitasPct' || r.elTot > 0)
    && (stepMeta.metricKey !== 'tetoTrapped' || r.slatesCount >= 2)
  ));
  const ranked = selectTopWithTies(eligible, stepMeta.metricKey, stepMeta.higherIsBetter, 5);
  return {
    rows: ranked.map((x) => x.item),
    rankMap: new Map(ranked.map((x) => [x.item.uf, x.rank])),
  };
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

function revealedStarsAt(d, stepIdx) {
  if (!d) return 0;
  return d.pillars.slice(0, Math.min(4, stepIdx + 1)).filter(Boolean).length;
}

/**
 * Renderiza os 5 cards narrativos do Ato 5 com pódio Top 5 clicável, síntese e entrada GSAP escalonada.
 */
export function renderAto5StepCards(container, geoData, {
  activeStep = 0,
  prevStep = activeStep,
  selectedUF = '',
  onHoverUF = null,
  onSelectUF = null,
} = {}) {
  if (!container || !geoData) return;
  const rows = geoData.rows || [];
  const dataSig = `${geoData.year}|${geoData.cargo}|${geoData.eligibleCount}`;
  const needsRebuild = container.dataset.ato5Sig !== dataSig;

  if (needsRebuild) {
    container.dataset.ato5Sig = dataSig;
    ATO5_STEPS.forEach((step, sIdx) => {
      const card = container.querySelector(`.step-card[data-step="${sIdx}"]`);
      if (!card) return;
      const { rows: top5, rankMap } = rankTop5(rows, step);

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
            <strong>${twoPlus} de ${top5.length}</strong> líderes em mulheres eleitas acumularam <strong>≥ 2 pilares estruturais</strong> (★2/4–4/4), e <strong>${anyPillar} de ${top5.length}</strong> pontuaram em ao menos um pilar.${outlierNote}
          </div>
        `;
      }

      const miniCardsHtml = top5.map((d, rankIdx) => {
        const rankNum = rankMap.get(d.uf) || (rankIdx + 1);
        const revealedStars = revealedStarsAt(d, sIdx);
        const isSelected = selectedUF === d.uf;
        return `
          <button
            type="button"
            class="ato5-podium-card${isSelected ? ' is-selected' : ''}"
            data-podium-uf="${d.uf}"
            aria-pressed="${isSelected ? 'true' : 'false'}"
          >
            <span class="ato5-podium-rank${rankNum === 1 ? ' is-first' : ''}">#${rankNum}</span>
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
  }

  container.querySelectorAll('.ato5-podium-card').forEach((btn) => {
    const isSel = selectedUF === btn.dataset.podiumUf;
    btn.classList.toggle('is-selected', isSel);
    btn.setAttribute('aria-pressed', isSel ? 'true' : 'false');
  });

  // Coreografia HyperFrames Animation (spring-pop-entrance, power3.out, stagger <= 0.5s) ao trocar de passo
  if (shouldAnimate() && (activeStep !== prevStep || needsRebuild)) {
    const activeCard = container.querySelector(`.step-card[data-step="${activeStep}"]`);
    if (activeCard) {
      if (container.__ato5CardTl) container.__ato5CardTl.kill();
      const tl = gsap.timeline();
      const podiumItems = activeCard.querySelectorAll('.ato5-podium-card');
      if (podiumItems.length > 0) {
        tl.fromTo(
          podiumItems,
          { y: 12, opacity: 0, scale: 0.97 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.38,
            stagger: 0.055,
            ease: 'power3.out',
            clearProps: 'transform,opacity',
          },
          0,
        );
      }
      const synthBox = activeCard.querySelector('.ato5-synthesis-box');
      if (synthBox) {
        tl.fromTo(
          synthBox,
          { y: 8, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.42, ease: 'power2.out', clearProps: 'transform,opacity' },
          0.14,
        );
      }
      container.__ato5CardTl = tl;
    }
  }
}

/**
 * Renderiza e coreografa com GSAP (object constancy + svg-path-draw + spring-pop)
 * o Mapa Geográfico Real do Brasil (data/br_uf.json), Anéis Dourados Cumulativos e Callouts Compactos.
 */
export function renderAto5MapStage(
  mapContainer,
  calloutsContainer,
  brUfGeo,
  geoData,
  {
    step = 0,
    prevStep = step,
    width = 480,
    hoveredUF = null,
    selectedUF = '',
    onHoverUF = null,
    onSelectUF = null,
    onClearUF = null,
  } = {},
) {
  if (!mapContainer || !brUfGeo || !geoData) return;

  const svgW = Math.max(320, width);
  const svgH = Math.round(svgW * 0.9);
  const clampedStep = Math.max(0, Math.min(ATO5_STEPS.length - 1, step));
  const stepMeta = ATO5_STEPS[clampedStep];
  const rows = geoData.rows || [];
  const byUf = new Map(rows.map((r) => [r.uf, r]));
  const { rows: top5, rankMap: top5RankMap } = rankTop5(rows, stepMeta);

  const geoSig = `${svgW}|${geoData.year}|${geoData.cargo}`;
  let st = mapContainer.__ato5State;
  const isFreshMount = !st || st.geoSig !== geoSig || !mapContainer.querySelector('svg.ato5-map-svg');

  if (isFreshMount) {
    if (st?.tl) st.tl.kill();
    mapContainer.innerHTML = '';

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

    const polyLayer = svg.append('g').attr('class', 'ato5-poly-layer');
    const ringLayer = svg.append('g').attr('class', 'ato5-ring-layer').style('pointer-events', 'none');
    const labelLayer = svg.append('g').attr('class', 'ato5-label-layer').style('pointer-events', 'none');

    const polyEls = new Map();
    const ringEls = new Map();
    const ringLens = new Map();
    const labelEls = new Map();
    const centroids = new Map();

    st = {
      geoSig,
      svg,
      tipCtrl,
      polyEls,
      ringEls,
      ringLens,
      labelEls,
      currentStep: clampedStep,
      prevStep: clampedStep,
      currentData: geoData,
      byUf,
      prevTop5Set: new Set(),
      prevStarsMap: new Map(),
      tl: null,
      onHoverUF,
      onSelectUF,
      onClearUF,
    };
    mapContainer.__ato5State = st;

    svg.on('click', (evt) => {
      if (st.selectedUF && !evt.target.closest('.ato5-state-path') && st.onClearUF) {
        st.onClearUF();
      }
    });

    brUfGeo.features.forEach((feat) => {
      const uf = IBGE_TO_UF[String(feat.properties.codarea)];
      if (!uf) return;
      const centroid = pathGen.centroid(feat);
      centroids.set(uf, centroid);

      const p = polyLayer.append('path')
        .datum(feat)
        .attr('d', pathGen)
        .attr('data-uf', uf)
        .attr('class', 'ato5-state-path')
        .attr('fill', '#E6EEEA')
        .attr('stroke', '#B9CAC2')
        .attr('stroke-width', 0.9)
        .attr('stroke-linejoin', 'round')
        .style('cursor', 'pointer');
      polyEls.set(uf, p.node());

      // Anel dourado pré-montado para todas as 27 UFs (comprimento medido uma vez no setup)
      const ring = ringLayer.append('path')
        .datum(feat)
        .attr('d', pathGen)
        .attr('data-uf-ring', uf)
        .attr('fill', 'none')
        .attr('stroke', SEMANTIC_PALETTE.highlightInk)
        .attr('stroke-width', 1.9)
        .attr('stroke-linejoin', 'round')
        .attr('stroke-opacity', 0);
      const ringNode = ring.node();
      const rLen = typeof ringNode.getTotalLength === 'function' ? ringNode.getTotalLength() : 0;
      ringEls.set(uf, ringNode);
      ringLens.set(uf, rLen);

      if (!COMPACT_SET.has(uf) && Number.isFinite(centroid[0]) && Number.isFinite(centroid[1])) {
        const lblG = labelLayer.append('g')
          .attr('transform', `translate(${centroid[0]}, ${centroid[1]})`);
        const ufTxt = lblG.append('text')
          .attr('class', 'ato5-lbl-uf')
          .attr('text-anchor', 'middle')
          .attr('dy', '3')
          .attr('font-size', svgW < 380 ? 8.5 : 9.5)
          .attr('font-weight', 700)
          .attr('fill', SEMANTIC_PALETTE.ink)
          .attr('paint-order', 'stroke')
          .attr('stroke', 'rgba(255,255,255,0.75)')
          .attr('stroke-width', 2)
          .text(uf);
        const subTxt = lblG.append('text')
          .attr('class', 'ato5-lbl-sub')
          .attr('text-anchor', 'middle')
          .attr('dy', '8.5')
          .attr('font-size', 8)
          .attr('font-weight', 700)
          .attr('fill', '#8A5D00')
          .text('');
        labelEls.set(uf, { g: lblG.node(), uf: ufTxt.node(), sub: subTxt.node() });
      }

      const node = p.node();
      node.setAttribute('tabindex', '0');
      node.setAttribute('role', 'button');
      bindTooltipEvents(node, tipCtrl, () => {
        const curD = st.byUf.get(uf);
        return curD ? buildStateTooltipCard(curD, st.currentStep) : '';
      }, {
        focusable: true,
        onEnter: () => { if (st.onHoverUF) st.onHoverUF(uf); },
        onLeave: () => { if (st.onHoverUF) st.onHoverUF(null); },
      });

      p.on('click', (evt) => {
        evt.stopPropagation();
        if (st.onSelectUF) st.onSelectUF(uf);
      });
      p.on('keydown', (evt) => {
        if (evt.key === 'Enter' || evt.key === ' ') {
          evt.preventDefault();
          if (st.onSelectUF) st.onSelectUF(uf);
        }
      });
    });
  }

  // Atualiza referências dinâmicas no estado persistido
  st.currentStep = clampedStep;
  st.prevStep = prevStep;
  st.currentData = geoData;
  st.byUf = byUf;
  st.selectedUF = selectedUF;
  st.onHoverUF = onHoverUF;
  st.onSelectUF = onSelectUF;
  st.onClearUF = onClearUF;
  st.svg.attr('aria-label', `Mapa geográfico das 27 UFs: ${stepMeta.badge}`);

  const animate = shouldAnimate();
  const focusUF = hoveredUF || selectedUF;

  if (clampedStep !== prevStep) st.tipCtrl.hide();
  if (st.tl) st.tl.kill();
  const tl = gsap.timeline();
  st.tl = tl;

  let newRingOrder = 0;

  rows.forEach((d) => {
    const uf = d.uf;
    const polyNode = st.polyEls.get(uf);
    const ringNode = st.ringEls.get(uf);
    if (!polyNode) return;

    const rank = top5RankMap.get(uf);
    const isTop5 = Boolean(rank);
    const stars = revealedStarsAt(d, clampedStep);
    const prevStars = isFreshMount ? 0 : (st.prevStarsMap.get(uf) ?? 0);
    const wasTop5 = !isFreshMount && st.prevTop5Set.has(uf);

    const targetFill = isTop5
      ? (rank === 1 ? '#C22D0C' : SEMANTIC_PALETTE.female)
      : (stars > 0 && stepMeta.isSynthesis ? '#F9EFD4' : '#E6EEEA');
    const isFocused = focusUF && focusUF === uf;
    const isDimmed = Boolean(focusUF && focusUF !== uf);
    const targetOpacity = isDimmed ? 0.45 : 1;
    const targetStroke = isFocused ? SEMANTIC_PALETTE.ink : (isTop5 ? '#FFFFFF' : '#B9CAC2');
    const targetStrokeW = isFocused ? 2.4 : (isTop5 ? 1.5 : 0.9);

    polyNode.setAttribute('aria-label', `${UF_NAMES[uf] || uf}: ${stepMeta.formatVal(d[stepMeta.metricKey])}`);

    if (animate) {
      tl.to(polyNode, {
        attr: { fill: targetFill, stroke: targetStroke, 'stroke-width': targetStrokeW },
        fillOpacity: targetOpacity,
        duration: 0.42,
        ease: 'power2.inOut',
      }, 0);
    } else {
      polyNode.setAttribute('fill', targetFill);
      polyNode.setAttribute('fill-opacity', String(targetOpacity));
      polyNode.setAttribute('stroke', targetStroke);
      polyNode.setAttribute('stroke-width', String(targetStrokeW));
    }

    // Anel dourado cumulativo com svg-path-draw quando o estado entra no Top 5 estrutural
    if (ringNode) {
      const rLen = st.ringLens.get(uf) || 0;
      const targetRingW = stars >= 2 ? 2.8 : 1.9;
      const targetRingOp = stars > 0 ? (isDimmed ? 0.45 : 0.95) : 0;

      if (animate && stars > 0 && prevStars === 0 && rLen > 0) {
        const drawDelay = 0.08 + newRingOrder * 0.055;
        newRingOrder += 1;
        ringNode.style.strokeDasharray = `${rLen}`;
        tl.fromTo(
          ringNode,
          { strokeDashoffset: rLen, strokeOpacity: 0.95, attr: { 'stroke-width': targetRingW } },
          {
            strokeDashoffset: 0,
            strokeOpacity: targetRingOp,
            duration: 0.56,
            ease: 'power2.out',
            onComplete: () => { ringNode.style.strokeDasharray = 'none'; },
          },
          drawDelay,
        );
      } else if (animate) {
        ringNode.style.strokeDasharray = 'none';
        ringNode.style.strokeDashoffset = '0';
        tl.to(ringNode, {
          strokeOpacity: targetRingOp,
          attr: { 'stroke-width': targetRingW },
          duration: stars === 0 ? 0.24 : 0.35,
          ease: 'power1.out',
        }, 0);
      } else {
        ringNode.style.strokeDasharray = 'none';
        ringNode.style.strokeDashoffset = '0';
        ringNode.setAttribute('stroke-opacity', String(targetRingOp));
        ringNode.setAttribute('stroke-width', String(targetRingW));
      }
    }

    // Rótulos internos apenas para os 19 estados amplos
    const lbl = st.labelEls.get(uf);
    if (lbl) {
      const hasSub = isTop5 || stars > 0;
      const subText = isTop5 ? `#${rank}` : (stars > 0 ? `★${stars}` : '');
      lbl.uf.setAttribute('dy', hasSub ? '-2' : '3');
      lbl.uf.setAttribute('fill', isTop5 ? '#FFFFFF' : SEMANTIC_PALETTE.ink);
      lbl.uf.setAttribute('stroke', isTop5 ? 'rgba(194,45,12,0.5)' : 'rgba(255,255,255,0.75)');
      lbl.sub.textContent = subText;
      lbl.sub.setAttribute('fill', isTop5 ? '#F8DF4F' : '#8A5D00');
      if (animate && isTop5 && !wasTop5) {
        tl.fromTo(lbl.g, { opacity: 0.4 }, { opacity: isDimmed ? 0.4 : 1, duration: 0.3, ease: 'power2.out' }, 0.14);
      } else {
        lbl.g.style.opacity = isDimmed ? '0.4' : '1';
      }
    }
  });

  // Atualiza os 8 callouts laterais dos estados compactos
  if (calloutsContainer) {
    calloutsContainer.innerHTML = COMPACT_UFS.map((uf) => {
      const d = byUf.get(uf);
      if (!d) return '';
      const rank = top5RankMap.get(uf);
      const isTop5 = Boolean(rank);
      const stars = revealedStarsAt(d, clampedStep);
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

    const newlyTopCallouts = [];
    calloutsContainer.querySelectorAll('.ato5-callout-pill').forEach((btn) => {
      const uf = btn.dataset.uf;
      const d = byUf.get(uf);
      if (!d) return;
      if (top5RankMap.has(uf) && !st.prevTop5Set.has(uf)) {
        newlyTopCallouts.push(btn);
      }
      bindTooltipEvents(btn, st.tipCtrl, () => buildStateTooltipCard(d, st.currentStep), {
        focusable: true,
        onEnter: () => { if (st.onHoverUF) st.onHoverUF(uf); },
        onLeave: () => { if (st.onHoverUF) st.onHoverUF(null); },
      });
      btn.addEventListener('click', (evt) => {
        evt.stopPropagation();
        if (st.onSelectUF) st.onSelectUF(uf);
      });
    });

    if (animate && newlyTopCallouts.length > 0 && clampedStep !== prevStep) {
      tl.fromTo(
        newlyTopCallouts,
        { y: 5, scale: 0.96, opacity: 0.72 },
        { y: 0, scale: 1, opacity: 1, duration: 0.34, stagger: 0.045, ease: 'power3.out', clearProps: 'transform,opacity' },
        0.12,
      );
    }
  }

  // Salva o snapshot deste passo para animar apenas deltas no próximo passo
  st.prevTop5Set = new Set(top5.map((d) => d.uf));
  st.prevStarsMap = new Map(rows.map((d) => [d.uf, revealedStarsAt(d, clampedStep)]));
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
    mapContainer.querySelectorAll('.ato5-ring-layer path').forEach((el) => {
      const uf = el.dataset.ufRing;
      const curOp = Number(el.getAttribute('stroke-opacity') || 0);
      if (curOp > 0) {
        el.setAttribute('stroke-opacity', !targetUF || uf === targetUF ? '0.95' : '0.38');
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
