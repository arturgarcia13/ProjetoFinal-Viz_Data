import * as d3 from 'd3';
import { SEMANTIC_PALETTE } from './palette.js';
import { animDelay, animDur, drawPath, MOTION, shouldAnimate } from './motion.js';
import {
  bindTooltipEvents,
  buildTooltipCard,
  createChartTooltip,
  fmtCompactBrl,
  fmtInt,
  fmtPct,
  fmtRatio,
  fmtSignedPP,
} from './tooltip.js';

const DOMAIN_MIN = 15;
const DOMAIN_MAX = 65;

function clampDomain(v) {
  return Math.max(DOMAIN_MIN, Math.min(DOMAIN_MAX, v));
}

function fmtDeficitCompact(deficitBrl) {
  const absVal = Math.abs(deficitBrl);
  const sign = deficitBrl < 0 ? '−' : '+';
  if (absVal >= 1e6) return `${sign}R$ ${(absVal / 1e6).toFixed(1).replace('.', ',')}M`;
  if (absVal >= 1e3) return `${sign}R$ ${Math.round(absVal / 1e3)} mil`;
  return `${sign}R$ ${Math.round(absVal)}`;
}

/**
 * H3 — Dispersão 1:1 (15%–65%, diagonal em 45°) de % Candidatas × % Fundo Público por partido (ADI 5617).
 * - Preserva o mesmo <svg> entre passos e cargos (Geral → Federal) com constância de objeto.
 * - Rotula apenas os 5 piores partidos pela distância negativa abaixo da diagonal (em p.p.).
 * - Ancora outliers (<15% ou >65%) na borda da escala com marcador indicador.
 */
export function renderH3Scatter(
  container,
  h3Data,
  {
    step = 2,
    prevStep = 2,
    width = 720,
    selectedParty = '',
    onSelectParty = null,
    onClearParty = null,
  } = {},
) {
  const allParties = (h3Data?.parties || []).map((p) => {
    const xPct = p.pctCandF * 100;
    const yPct = p.pctPubF * 100;
    const gapPP = yPct - xPct;
    const isOutlier = xPct < DOMAIN_MIN || xPct > DOMAIN_MAX || yPct < DOMAIN_MIN || yPct > DOMAIN_MAX;
    return {
      ...p,
      xPct,
      yPct,
      gapPP,
      cxVal: clampDomain(xPct),
      cyVal: clampDomain(yPct),
      isOutlier,
    };
  });

  if (allParties.length === 0) {
    container.__h3State = null;
    container.innerHTML = '<p class="chart-empty">Sem partidos com amostra mínima (n ≥ 10 APTO e Fundo Público > 0) neste recorte.</p>';
    return;
  }

  const isCompact = width < 480;
  const margin = { top: 32, right: isCompact ? 18 : 24, bottom: 48, left: isCompact ? 46 : 54 };
  const W = Math.max(220, width - margin.left - margin.right);
  const H = isCompact ? Math.max(240, Math.min(W, 300)) : Math.max(360, Math.min(430, Math.round(W * 0.62)));
  const svgW = width;
  const svgH = H + margin.top + margin.bottom;

  const x = d3.scaleLinear().domain([DOMAIN_MIN, DOMAIN_MAX]).range([0, W]);
  const y = d3.scaleLinear().domain([DOMAIN_MIN, DOMAIN_MAX]).range([H, 0]);
  const maxPub = d3.max(allParties, (d) => d.pubTotal) || 1;
  const rScale = d3.scaleSqrt().domain([0, maxPub]).range([isCompact ? 4.5 : 5, isCompact ? 12.5 : 15.5]);

  const sig = `${svgW}|${svgH}|${W}|${H}`;
  let st = container.__h3State;
  const isFreshMount = !st || st.sig !== sig || !container.querySelector('svg.h3-scatter-svg');

  if (isFreshMount) {
    container.innerHTML = '';
    const tipCtrl = createChartTooltip(container, { wrapClass: 'h3-wrap', tooltipClass: 'h3-tooltip' });
    const svg = d3.select(tipCtrl.wrap).append('svg')
      .attr('class', 'h3-scatter-svg')
      .attr('viewBox', `0 0 ${svgW} ${svgH}`)
      .attr('width', svgW)
      .attr('height', svgH)
      .attr('role', 'img')
      .attr('aria-label', 'Relação 1:1 entre percentual de candidatas mulheres e percentual do Fundo Público por partido (15% a 65%)')
      .style('font-family', 'Inter, system-ui, sans-serif');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const zonesG = g.append('g').attr('aria-label', 'h3-quadrants');
    zonesG.append('polygon').attr('points', `0,0 ${W},0 0,${H}`).attr('fill', 'rgba(0, 125, 91, 0.08)');
    zonesG.append('polygon').attr('points', `${W},0 ${W},${H} 0,${H}`).attr('fill', 'rgba(250, 83, 46, 0.08)');

    zonesG.append('text')
      .attr('x', 10)
      .attr('y', 18)
      .attr('fill', SEMANTIC_PALETTE.emerald)
      .style('font-size', isCompact ? '9.5px' : '11px')
      .style('font-weight', '700')
      .text('↑ Repasse proporcional (ou acima)');

    zonesG.append('text')
      .attr('x', W - 10)
      .attr('y', H - 10)
      .attr('text-anchor', 'end')
      .attr('fill', '#D93814')
      .style('font-size', isCompact ? '9px' : '11px')
      .style('font-weight', '700')
      .text('↓ Repasse menor que o peso na chapa');

    const diagLine = g.append('path')
      .attr('class', 'h3-diag-line')
      .attr('d', `M 0,${H} L ${W},0`)
      .attr('fill', 'none')
      .attr('stroke', SEMANTIC_PALETTE.highlightInk)
      .attr('stroke-width', 2.2);
    if (step === 0 && shouldAnimate()) {
      drawPath(diagLine, { duration: 640 });
    }

    // Linha vertical da cota mínima (30%) com selo discreto no topo
    const x30 = x(30);
    g.append('line')
      .attr('class', 'h3-quota-line')
      .attr('x1', x30)
      .attr('x2', x30)
      .attr('y1', 0)
      .attr('y2', H)
      .attr('stroke', '#647A71')
      .attr('stroke-width', 1.4)
      .attr('stroke-dasharray', '4,4');

    const badgeW = isCompact ? 96 : 114;
    const badgeG = g.append('g').attr('transform', `translate(${x30 - badgeW / 2}, -22)`);
    badgeG.append('rect')
      .attr('width', badgeW)
      .attr('height', 17)
      .attr('rx', 8.5)
      .attr('fill', '#EEF4F1')
      .attr('stroke', '#B9CAC2');
    badgeG.append('text')
      .attr('x', badgeW / 2)
      .attr('y', 12)
      .attr('text-anchor', 'middle')
      .attr('fill', '#334E45')
      .style('font-size', isCompact ? '8.8px' : '9.8px')
      .style('font-weight', '700')
      .text('Cota mínima (30%)');

    const ticks = [15, 25, 35, 45, 55, 65];
    g.append('g')
      .attr('transform', `translate(0,${H})`)
      .call(d3.axisBottom(x).tickValues(ticks).tickFormat((d) => `${d}%`))
      .call((a) => a.select('.domain').attr('stroke', '#CBD5E1'))
      .call((a) => a.selectAll('.tick text').attr('fill', SEMANTIC_PALETTE.muted).style('font-size', '10.5px'));

    g.append('g')
      .call(d3.axisLeft(y).tickValues(ticks).tickFormat((d) => `${d}%`))
      .call((a) => a.select('.domain').attr('stroke', '#CBD5E1'))
      .call((a) => a.selectAll('.tick text').attr('fill', SEMANTIC_PALETTE.muted).style('font-size', '10.5px'));

    g.append('text')
      .attr('x', W / 2)
      .attr('y', H + 36)
      .attr('text-anchor', 'middle')
      .attr('fill', SEMANTIC_PALETTE.ink)
      .style('font-size', isCompact ? '10px' : '11.5px')
      .style('font-weight', '600')
      .text('% de Candidatas Mulheres na Chapa');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -H / 2)
      .attr('y', isCompact ? -34 : -40)
      .attr('text-anchor', 'middle')
      .attr('fill', SEMANTIC_PALETTE.ink)
      .style('font-size', isCompact ? '10px' : '11.5px')
      .style('font-weight', '600')
      .text('% do Fundo Público para Mulheres');

    const crosshairG = g.append('g').style('pointer-events', 'none');
    const bubblesG = g.append('g').attr('aria-label', 'dot');
    const labelsG = g.append('g').attr('aria-label', 'text').style('pointer-events', 'none');

    st = {
      sig,
      svg,
      g,
      tipCtrl,
      crosshairG,
      bubblesG,
      labelsG,
      W,
      H,
      x,
      y,
      selectedParty,
      onSelectParty,
      onClearParty,
      lastStep: step,
    };
    container.__h3State = st;

    svg.on('click', (evt) => {
      if (st.selectedParty && st.onClearParty && !evt.target.closest('.party-bubble')) {
        st.onClearParty();
      }
    });
  }

  st.selectedParty = selectedParty;
  st.onSelectParty = onSelectParty;
  st.onClearParty = onClearParty;

  const { tipCtrl, crosshairG, bubblesG, labelsG } = st;
  const animate = shouldAnimate();
  const dur = animDur(560);
  const showBubbles = step >= 1;
  const enteringBubbles = showBubbles && (prevStep === 0 || st.lastStep === 0);

  crosshairG.selectAll('*').remove();

  if (!showBubbles) {
    bubblesG.selectAll('.party-bubble').remove();
    labelsG.selectAll('text').remove();
    st.lastStep = step;
    return;
  }

  const ordered = [...allParties].sort((a, b) => b.pubTotal - a.pubTotal);

  // 5 piores partidos por distância negativa abaixo da diagonal (yPct - xPct em p.p.)
  const worst5Set = new Set(
    allParties
      .filter((d) => d.gapPP < 0)
      .sort((a, b) => a.gapPP - b.gapPP)
      .slice(0, 5)
      .map((d) => d.party),
  );

  const nodes = bubblesG.selectAll('.party-bubble')
    .data(ordered, (d) => d.party);

  nodes.exit()
    .transition()
    .duration(animate ? 260 : 0)
    .style('opacity', 0)
    .remove();

  const enterNodes = nodes.enter()
    .append('g')
    .attr('class', 'party-bubble')
    .style('cursor', onSelectParty ? 'pointer' : 'default');

  enterNodes.append('circle')
    .attr('class', 'h3-dot')
    .attr('data-party', (d) => d.party)
    .attr('cx', (d) => x(d.cxVal))
    .attr('cy', (d) => y(d.cyVal))
    .attr('r', (d) => (animate && enteringBubbles ? 0 : rScale(d.pubTotal)));

  const merged = enterNodes.merge(nodes);
  merged.style('cursor', onSelectParty ? 'pointer' : 'default');
  merged.order();

  const dots = merged.select('circle.h3-dot');
  dots.attr('data-party', (d) => d.party);

  const targetFill = (d) => (d.yPct < d.xPct ? SEMANTIC_PALETTE.female : SEMANTIC_PALETTE.emerald);
  const targetOp = (d) => (selectedParty ? (selectedParty === d.party ? 0.95 : 0.22) : 0.82);
  const targetStroke = (d) => (selectedParty === d.party ? SEMANTIC_PALETTE.ink : (d.isOutlier ? '#7A5200' : '#FFFFFF'));
  const targetStrokeW = (d) => (selectedParty === d.party ? 2.4 : (d.isOutlier ? 2.2 : 1.5));

  if (animate) {
    dots.transition()
      .duration(dur)
      .delay((_, i) => (enteringBubbles ? animDelay(Math.min(260, i * 14)) : 0))
      .ease(MOTION.easeInOut)
      .attr('cx', (d) => x(d.cxVal))
      .attr('cy', (d) => y(d.cyVal))
      .attr('r', (d) => rScale(d.pubTotal))
      .attr('fill', targetFill)
      .attr('fill-opacity', targetOp)
      .attr('stroke', targetStroke)
      .attr('stroke-width', targetStrokeW)
      .attr('stroke-dasharray', (d) => (d.isOutlier ? '3,2' : null));
  } else {
    dots
      .attr('cx', (d) => x(d.cxVal))
      .attr('cy', (d) => y(d.cyVal))
      .attr('r', (d) => rScale(d.pubTotal))
      .attr('fill', targetFill)
      .attr('fill-opacity', targetOp)
      .attr('stroke', targetStroke)
      .attr('stroke-width', targetStrokeW)
      .attr('stroke-dasharray', (d) => (d.isOutlier ? '3,2' : null));
  }

  merged.each(function (d) {
    const node = this;
    node.__h3Datum = d;
    if (!node.__h3Bound) {
      node.__h3Bound = true;
      node.setAttribute('tabindex', '0');
      node.setAttribute('role', 'button');

      bindTooltipEvents(node, tipCtrl, () => {
        const cur = node.__h3Datum;
        const isDeficit = cur.gapPP < 0;
        return buildTooltipCard({
          title: `${cur.party} · ${fmtInt(cur.n)} APTO${cur.isOutlier ? ' (fora de 15%–65%)' : ''}`,
          badge: isDeficit ? 'Subfinanciamento' : 'Proporcional',
          badgeTone: isDeficit ? 'below' : 'above',
          rows: [
            { label: 'Candidatas na chapa', value: fmtPct(cur.xPct), sub: `${fmtInt(cur.nF)} mulheres` },
            { label: 'Fatia do Fundo Público', value: fmtPct(cur.yPct), sub: `${fmtCompactBrl(cur.pubF)} de ${fmtCompactBrl(cur.pubTotal)}` },
            { label: isDeficit ? 'Distância / Déficit' : 'Distância / Superávit', value: fmtSignedPP(cur.gapPP), sub: `${fmtDeficitCompact(cur.deficitBrl)} · ${fmtRatio(cur.ratio)}`, focus: true },
          ],
          hint: st.onSelectParty ? 'Clique na bolha para destacar/limpar este partido' : '',
        });
      }, {
        focusable: true,
        onEnter: () => {
          const cur = node.__h3Datum;
          const cx = x(cur.cxVal);
          const cy = y(cur.cyVal);
          crosshairG.selectAll('*').remove();
          crosshairG.append('line').attr('x1', cx).attr('x2', cx).attr('y1', cy).attr('y2', H).attr('stroke', SEMANTIC_PALETTE.female).attr('stroke-dasharray', '3,3');
          crosshairG.append('line').attr('x1', 0).attr('x2', cx).attr('y1', cy).attr('y2', cy).attr('stroke', SEMANTIC_PALETTE.female).attr('stroke-dasharray', '3,3');
          bubblesG.selectAll('circle.h3-dot').attr('fill-opacity', (item) => (item.party === cur.party ? 0.96 : 0.22));
        },
        onLeave: () => {
          crosshairG.selectAll('*').remove();
          bubblesG.selectAll('circle.h3-dot').attr('fill-opacity', (item) => (st.selectedParty ? (st.selectedParty === item.party ? 0.95 : 0.22) : 0.82));
        },
      });

      d3.select(node).on('click', (evt) => {
        if (!st.onSelectParty) return;
        evt.stopPropagation();
        st.onSelectParty(node.__h3Datum.party);
      });
      d3.select(node).on('keydown', (evt) => {
        if (!st.onSelectParty) return;
        if (evt.key === 'Enter' || evt.key === ' ') {
          evt.preventDefault();
          st.onSelectParty(node.__h3Datum.party);
        }
      });
    }
    node.setAttribute('aria-label', `${d.party}: ${fmtPct(d.xPct)} candidatas, ${fmtPct(d.yPct)} Fundo Público (${fmtSignedPP(d.gapPP)})`);
  });

  // Rótulos fixos apenas para os 5 piores partidos (por distância negativa) + partido selecionado + outliers
  labelsG.selectAll('text').remove();
  const placedBoxes = [
    { x: 0, y: 0, w: isCompact ? 185 : 230, h: 24 },
    { x: W - (isCompact ? 205 : 250), y: H - 24, w: isCompact ? 205 : 250, h: 24 },
  ];

  const toLabel = ordered
    .filter((d) => worst5Set.has(d.party) || d.isOutlier || (selectedParty && d.party === selectedParty))
    .sort((a, b) => {
      const aPri = worst5Set.has(a.party) ? 0 : (a.party === selectedParty ? 1 : 2);
      const bPri = worst5Set.has(b.party) ? 0 : (b.party === selectedParty ? 1 : 2);
      return aPri - bPri || a.gapPP - b.gapPP;
    });

  toLabel.forEach((d) => {
    const px = x(d.cxVal);
    const py = y(d.cyVal);
    const pr = rScale(d.pubTotal);
    let textStr = d.party;
    if (d.isOutlier) {
      const arrow = d.yPct > DOMAIN_MAX ? '↑' : (d.yPct < DOMAIN_MIN ? '↓' : '→');
      const valPct = d.yPct > DOMAIN_MAX || d.yPct < DOMAIN_MIN ? d.yPct : d.xPct;
      textStr = `${d.party} (${Math.round(valPct)}%) ${arrow}`;
    }

    const w = textStr.length * (isCompact ? 5.6 : 6.2) + 8;
    const h = 13;
    const tries = [
      [px - w / 2, py - pr - 4 - h],
      [px - w / 2, py + pr + 5],
      [px + pr + 5, py - h / 2],
      [px - pr - 5 - w, py - h / 2],
      [px + pr + 5, py - pr - h],
      [px - pr - 5 - w, py - pr - h],
      [px + pr + 5, py + pr + 2],
      [px - pr - 5 - w, py + pr + 2],
    ];

    for (const [rawLx, rawLy] of tries) {
      const lx = Math.max(4, Math.min(W - w - 4, rawLx));
      const ly = Math.max(24, Math.min(H - h - 22, rawLy));
      const hitsBox = placedBoxes.some((b) => lx < b.x + b.w && lx + w > b.x && ly < b.y + b.h && ly + h > b.y);
      if (hitsBox) continue;
      const hitsCircle = ordered.some((other) => {
        const cx = x(other.cxVal);
        const cy = y(other.cyVal);
        const cr = rScale(other.pubTotal) + 2;
        const nearX = Math.max(lx, Math.min(lx + w, cx));
        const nearY = Math.max(ly, Math.min(ly + h, cy));
        return Math.hypot(cx - nearX, cy - nearY) < cr;
      });
      if (hitsCircle) continue;

      placedBoxes.push({ x: lx, y: ly, w, h });
      const txt = labelsG.append('text')
        .attr('data-party', d.party)
        .attr('data-worst5', worst5Set.has(d.party) ? '1' : '0')
        .attr('x', lx + w / 2)
        .attr('y', ly + h - 2)
        .attr('text-anchor', 'middle')
        .attr('fill', d.isOutlier && !worst5Set.has(d.party) ? '#334E45' : SEMANTIC_PALETTE.ink)
        .style('font-size', isCompact ? '8.8px' : '10px')
        .style('font-weight', '700')
        .attr('paint-order', 'stroke')
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', 3)
        .style('opacity', animate && enteringBubbles ? 0 : (selectedParty && selectedParty !== d.party ? 0.25 : 1))
        .text(textStr);
      if (animate && enteringBubbles) {
        txt.transition().duration(260).delay(240).style('opacity', selectedParty && selectedParty !== d.party ? 0.25 : 1);
      }
      break;
    }
  });

  st.lastStep = step;
}
