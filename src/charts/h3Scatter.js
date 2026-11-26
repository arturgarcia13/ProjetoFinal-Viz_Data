import * as d3 from 'd3';
import { SEMANTIC_PALETTE } from './palette.js';
import { addDirectAnnotation } from './annotate.js';
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

function fmtDeficitCompact(deficitBrl) {
  const absVal = Math.abs(deficitBrl);
  const sign = deficitBrl < 0 ? '−' : '+';
  if (absVal >= 1e6) return `${sign}R$ ${(absVal / 1e6).toFixed(1).replace('.', ',')}M`;
  if (absVal >= 1e3) return `${sign}R$ ${Math.round(absVal / 1e3)} mil`;
  return `${sign}R$ ${Math.round(absVal)}`;
}

/**
 * H3 — Dispersão % Candidatas × % Fundo Público por partido (ADI 5617)
 * Com desenho da diagonal Y=X no passo 0 e entrada coreografada das bolhas no passo 1.
 */
export function renderH3Scatter(
  container,
  h3Data,
  {
    step = 2,
    prevStep = 2,
    width = 720,
    zoomMode = 'majority',
    selectedParty = '',
    onSelectParty = null,
    onClearParty = null,
  } = {},
) {
  container.innerHTML = '';
  const allParties = (h3Data?.parties || []).map((p) => ({
    ...p,
    xPct: p.pctCandF * 100,
    yPct: p.pctPubF * 100,
  }));

  if (allParties.length === 0) {
    container.innerHTML = '<p class="chart-empty">Sem partidos com amostra mínima (n ≥ 10 APTO e Fundo Público > 0) neste recorte.</p>';
    return;
  }

  const isCompact = width < 480;
  const margin = { top: 28, right: isCompact ? 16 : 26, bottom: 48, left: isCompact ? 46 : 54 };
  const svgW = width;
  const svgH = isCompact ? 320 : 395;
  const W = svgW - margin.left - margin.right;
  const H = svgH - margin.top - margin.bottom;

  const maxDataVal = d3.max(allParties, (d) => Math.max(d.xPct, d.yPct)) || 55;
  const domainMin = zoomMode === 'majority' ? 15 : 0;
  const domainMax = zoomMode === 'majority' ? 48 : Math.min(100, Math.ceil(Math.max(60, maxDataVal + 4) / 5) * 5);

  const visibleParties = zoomMode === 'majority'
    ? allParties.filter((d) => d.xPct <= 48 && d.yPct <= 48 && d.xPct >= 15 && d.yPct >= 15)
    : allParties;

  const x = d3.scaleLinear().domain([domainMin, domainMax]).range([0, W]);
  const y = d3.scaleLinear().domain([domainMin, domainMax]).range([H, 0]);
  const rScale = d3.scaleSqrt()
    .domain([0, d3.max(allParties, (d) => d.pubTotal) || 1])
    .range([isCompact ? 4.5 : 5, isCompact ? 13 : 16]);

  const tipCtrl = createChartTooltip(container, { wrapClass: 'h3-wrap', tooltipClass: 'h3-tooltip' });
  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('class', 'h3-scatter-svg')
    .attr('viewBox', `0 0 ${svgW} ${svgH}`)
    .attr('width', svgW)
    .attr('height', svgH)
    .attr('role', 'img')
    .attr('aria-label', 'Relação entre percentual de candidatas mulheres e percentual do Fundo Público por partido')
    .style('font-family', 'Inter, system-ui, sans-serif');

  if (onClearParty) {
    svg.on('click', (evt) => {
      if (selectedParty && !evt.target.closest('.party-bubble')) onClearParty();
    });
  }

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const zonesG = g.append('g').attr('aria-label', 'h3-quadrants');
  zonesG.append('polygon').attr('points', `0,0 ${W},0 0,${H}`).attr('fill', 'rgba(0, 125, 91, 0.08)');
  zonesG.append('polygon').attr('points', `${W},0 ${W},${H} 0,${H}`).attr('fill', 'rgba(250, 83, 46, 0.08)');

  zonesG.append('text')
    .attr('x', 12)
    .attr('y', 20)
    .attr('fill', SEMANTIC_PALETTE.emerald)
    .style('font-size', isCompact ? '9.5px' : '11px')
    .style('font-weight', '700')
    .text(isCompact ? '↑ Proporcional (≥ Y=X)' : '↑ ZONA DE PROPORCIONALIDADE (Repasse ≥ Peso feminino)');

  zonesG.append('text')
    .attr('x', W - 12)
    .attr('y', H - 12)
    .attr('text-anchor', 'end')
    .attr('fill', '#D93814')
    .style('font-size', isCompact ? '9.5px' : '11px')
    .style('font-weight', '700')
    .text(isCompact ? '↓ Subfinanciamento (< Y=X)' : '↓ ZONA DE SUBFINANCIAMENTO (Repasse menor que o peso na chapa)');

  const diagLine = g.append('path')
    .attr('d', `M 0,${H} L ${W},0`)
    .attr('fill', 'none')
    .attr('stroke', SEMANTIC_PALETTE.highlightInk)
    .attr('stroke-width', 2.4);
  if (step === 0 && shouldAnimate()) {
    drawPath(diagLine, { duration: 640 });
  }

  if (domainMin <= 30 && domainMax >= 30) {
    const x30 = x(30);
    g.append('line')
      .attr('x1', x30)
      .attr('x2', x30)
      .attr('y1', 0)
      .attr('y2', H)
      .attr('stroke', '#647A71')
      .attr('stroke-width', 1.4)
      .attr('stroke-dasharray', '4,4');
  }

  g.append('g')
    .attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat((d) => `${d}%`))
    .call((a) => a.select('.domain').attr('stroke', '#CBD5E1'))
    .call((a) => a.selectAll('.tick text').attr('fill', SEMANTIC_PALETTE.muted).style('font-size', '10.5px'));

  g.append('g')
    .call(d3.axisLeft(y).ticks(6).tickFormat((d) => `${d}%`))
    .call((a) => a.select('.domain').attr('stroke', '#CBD5E1'))
    .call((a) => a.selectAll('.tick text').attr('fill', SEMANTIC_PALETTE.muted).style('font-size', '10.5px'));

  g.append('text')
    .attr('x', W / 2)
    .attr('y', H + 38)
    .attr('text-anchor', 'middle')
    .attr('fill', SEMANTIC_PALETTE.ink)
    .style('font-size', isCompact ? '10.5px' : '11.5px')
    .style('font-weight', '600')
    .text('% de Candidatas Mulheres na Chapa');

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -H / 2)
    .attr('y', isCompact ? -35 : -40)
    .attr('text-anchor', 'middle')
    .attr('fill', SEMANTIC_PALETTE.ink)
    .style('font-size', isCompact ? '10.5px' : '11.5px')
    .style('font-weight', '600')
    .text('% do Fundo Público Destinado às Mulheres');

  const crosshairG = g.append('g').style('pointer-events', 'none');
  const bubblesG = g.append('g').attr('aria-label', 'dot');
  const labelsG = g.append('g').attr('aria-label', 'text').style('pointer-events', 'none');
  const annotG = g.append('g');

  if (step >= 1) {
    const animateEnter = shouldAnimate() && prevStep === 0;
    const ordered = [...visibleParties].sort((a, b) => b.pubTotal - a.pubTotal);
    const placedBoxes = [];

    const nodes = bubblesG.selectAll('.party-bubble')
      .data(ordered, (d) => d.party)
      .enter()
      .append('g')
      .attr('class', 'party-bubble')
      .style('cursor', onSelectParty ? 'pointer' : 'default');

    const circles = nodes.append('circle')
      .attr('data-party', (d) => d.party)
      .attr('cx', (d) => x(d.xPct))
      .attr('cy', (d) => y(d.yPct))
      .attr('r', (d) => (animateEnter ? 0 : rScale(d.pubTotal)))
      .attr('fill', (d) => (d.yPct < d.xPct ? SEMANTIC_PALETTE.female : SEMANTIC_PALETTE.emerald))
      .attr('fill-opacity', (d) => (selectedParty ? (selectedParty === d.party ? 0.95 : 0.22) : 0.82))
      .attr('stroke', (d) => (selectedParty === d.party ? SEMANTIC_PALETTE.ink : '#FFFFFF'))
      .attr('stroke-width', (d) => (selectedParty === d.party ? 2.4 : 1.6));

    if (animateEnter) {
      circles.transition()
        .duration(animDur(480))
        .delay((_, i) => animDelay(Math.min(280, i * 16)))
        .ease(MOTION.easeOut)
        .attr('r', (d) => rScale(d.pubTotal));
    }

    ordered.forEach((d) => {
      const px = x(d.xPct);
      const py = y(d.yPct);
      const pr = rScale(d.pubTotal);
      const w = d.party.length * 6.4 + 6;
      const h = 13;
      const tries = [
        [px - w / 2, py - pr - 4 - h],
        [px - w / 2, py + pr + 4],
        [px + pr + 4, py - h / 2],
        [px - pr - 4 - w, py - h / 2],
      ];
      for (const [lx, ly] of tries) {
        if (lx < 4 || lx + w > W - 4 || ly < 24 || ly + h > H - 24) continue;
        const hitsBox = placedBoxes.some((b) => lx < b.x + b.w && lx + w > b.x && ly < b.y + b.h && ly + h > b.y);
        if (hitsBox) continue;
        const hitsCircle = ordered.some((other) => {
          const cx = x(other.xPct);
          const cy = y(other.yPct);
          const cr = rScale(other.pubTotal) + 2;
          const nearX = Math.max(lx, Math.min(lx + w, cx));
          const nearY = Math.max(ly, Math.min(ly + h, cy));
          return Math.hypot(cx - nearX, cy - nearY) < cr;
        });
        if (hitsCircle) continue;
        placedBoxes.push({ x: lx, y: ly, w, h });
        const txt = labelsG.append('text')
          .attr('data-party', d.party)
          .attr('x', lx + w / 2)
          .attr('y', ly + h - 2)
          .attr('text-anchor', 'middle')
          .attr('fill', SEMANTIC_PALETTE.ink)
          .style('font-size', isCompact ? '9px' : '10px')
          .style('font-weight', '700')
          .attr('paint-order', 'stroke')
          .attr('stroke', '#FFFFFF')
          .attr('stroke-width', 3)
          .style('opacity', animateEnter ? 0 : (selectedParty && selectedParty !== d.party ? 0.25 : 1))
          .text(d.party);
        if (animateEnter) {
          txt.transition().duration(260).delay(240).style('opacity', selectedParty && selectedParty !== d.party ? 0.25 : 1);
        }
        break;
      }
    });

    nodes.each(function (d) {
      const node = this;
      node.setAttribute('tabindex', '0');
      node.setAttribute('role', 'button');
      node.setAttribute('aria-label', `${d.party}: ${fmtPct(d.xPct)} candidatas, ${fmtPct(d.yPct)} Fundo Público`);

      const gapPp = d.yPct - d.xPct;
      const isDeficit = gapPp < 0;
      bindTooltipEvents(node, tipCtrl, () => buildTooltipCard({
        title: `${d.party} · ${fmtInt(d.n)} APTO`,
        badge: isDeficit ? 'Subfinanciamento' : 'Proporcional',
        badgeTone: isDeficit ? 'below' : 'above',
        rows: [
          { label: 'Candidatas na chapa', value: fmtPct(d.xPct), sub: `${fmtInt(d.nF)} mulheres` },
          { label: 'Fatia do Fundo Público', value: fmtPct(d.yPct), sub: `${fmtCompactBrl(d.pubF)} de ${fmtCompactBrl(d.pubTotal)}` },
          { label: isDeficit ? 'Déficit em R$' : 'Superávit em R$', value: fmtDeficitCompact(d.deficitBrl), sub: `${fmtRatio(d.ratio)} · ${fmtSignedPP(gapPp)}`, focus: true },
        ],
        hint: onSelectParty ? 'Clique na bolha para destacar/limpar este partido' : '',
      }), {
        focusable: true,
        onEnter: () => {
          const cx = x(d.xPct);
          const cy = y(d.yPct);
          crosshairG.selectAll('*').remove();
          crosshairG.append('line').attr('x1', cx).attr('x2', cx).attr('y1', cy).attr('y2', H).attr('stroke', SEMANTIC_PALETTE.female).attr('stroke-dasharray', '3,3');
          crosshairG.append('line').attr('x1', 0).attr('x2', cx).attr('y1', cy).attr('y2', cy).attr('stroke', SEMANTIC_PALETTE.female).attr('stroke-dasharray', '3,3');
          circles.attr('fill-opacity', (item) => (item.party === d.party ? 0.96 : 0.22));
        },
        onLeave: () => {
          crosshairG.selectAll('*').remove();
          circles.attr('fill-opacity', (item) => (selectedParty ? (selectedParty === item.party ? 0.95 : 0.22) : 0.82));
        },
      });

      if (onSelectParty) {
        d3.select(node).on('click', (evt) => {
          evt.stopPropagation();
          onSelectParty(d.party);
        });
        d3.select(node).on('keydown', (evt) => {
          if (evt.key === 'Enter' || evt.key === ' ') {
            evt.preventDefault();
            onSelectParty(d.party);
          }
        });
      }
    });

    const worstGap = visibleParties.filter((d) => d.yPct < d.xPct).sort((a, b) => a.deficitBrl - b.deficitBrl)[0];
    if (worstGap && !isCompact) {
      const cx = x(worstGap.xPct);
      const cy = y(worstGap.yPct);
      addDirectAnnotation(annotG, {
        x1: Math.max(20, Math.min(W - 180, cx - 130)),
        y1: Math.min(H - 52, cy + 48),
        x2: cx,
        y2: cy + rScale(worstGap.pubTotal) * 0.5,
        title: `${worstGap.party} (${fmtPct(worstGap.yPct)} verba)`,
        subtitle: `Déficit de ${fmtDeficitCompact(worstGap.deficitBrl)}`,
        color: '#D93814',
        animate: animateEnter,
      });
    }
  }

  const omittedCount = allParties.length - visibleParties.length;
  if (omittedCount > 0 && zoomMode === 'majority') {
    const note = document.createElement('p');
    note.className = 'chart-note';
    note.textContent = `${omittedCount} legenda(s) fora do zoom (15%–48%); clique em "Ver Todos" para exibir a escala completa.`;
    container.appendChild(note);
  }
}
