import * as d3 from 'd3';
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

function selectLabels(parties) {
  // Top 6 maiores partidos por volume do Fundo Público
  const selected = new Map();
  for (const p of parties.slice(0, 6)) {
    selected.set(p.party, p);
  }
  if (parties.length <= 6) return selected;

  // Extremos relevantes no gráfico visível (topo em Y, piso abaixo de 27% em Y, direita em X, e 0% em Y)
  let maxY = parties[0];
  let minY = parties[0];
  let maxX = parties[0];
  for (const p of parties) {
    if (p.yPct > maxY.yPct) maxY = p;
    if (p.yPct < minY.yPct) minY = p;
    if (p.xPct > maxX.xPct) maxX = p;
  }
  if (!selected.has(maxY.party)) selected.set(maxY.party, maxY);
  if (minY.yPct < 27 && !selected.has(minY.party)) selected.set(minY.party, minY);
  if (maxX.xPct >= 42 && !selected.has(maxX.party)) selected.set(maxX.party, maxX);
  for (const p of parties) {
    if (p.yPct === 0 && !selected.has(p.party)) selected.set(p.party, p);
  }
  return selected;
}

function rectCirclePush(lx, ly, hw, hh, cx, cy, rPad) {
  const closestX = Math.max(lx - hw, Math.min(lx + hw, cx));
  const closestY = Math.max(ly - hh, Math.min(ly + hh, cy));
  const dx = lx - cx;
  const dy = ly - cy;
  const gx = closestX - cx;
  const gy = closestY - cy;
  const dist = Math.hypot(gx, gy);
  if (dist >= rPad) return null;
  if (dist > 0.01) {
    const push = rPad - dist;
    return { px: (gx / dist) * push, py: (gy / dist) * push };
  }
  const cDist = Math.hypot(dx, dy) || 1;
  return { px: (dx / cDist) * rPad, py: (dy / cDist) * rPad };
}

function closestPointOnRect(rx, ry, hw, hh, px, py) {
  const clampedX = Math.max(rx - hw, Math.min(rx + hw, px));
  const clampedY = Math.max(ry - hh, Math.min(ry + hh, py));
  // Se o ponto estiver dentro ou quase igual, escolhe a borda superior/inferior
  if (Math.abs(clampedX - px) < 0.5 && Math.abs(clampedY - py) < 0.5) {
    return { x: rx, y: py < ry ? ry - hh : ry + hh };
  }
  return { x: clampedX, y: clampedY };
}

function runLabelForceLayout({
  parties,
  selectedParties,
  bounds,
  diagSeg,
  isCompact = false,
}) {
  const { left, right, top, bottom } = bounds;
  const topQuadRight = left + (isCompact ? 175 : 255);
  const topQuadBottom = top + 22;

  const nodes = [...selectedParties.values()].map((p, idx) => {
    const w = Math.max(30, p.party.length * 6.8 + 12);
    const h = 15;
    const aboveDiag = p.yPct >= p.xPct;
    let ty = aboveDiag ? p.cy - p.r - 12 : p.cy + p.r + 13;
    // Evita colidir com a anotação do quadrante superior esquerdo ou com as bordas
    if (ty < top + 16 || (p.cx - w / 2 < topQuadRight && ty - h / 2 < topQuadBottom + 4)) {
      ty = p.cy + p.r + 13;
    }
    if (ty > bottom - 14) ty = p.cy - p.r - 12;
    const tx = Math.max(left + w / 2 + 4, Math.min(right - w / 2 - 4, p.cx));
    const jitterAngle = idx * 2.1;
    return {
      party: p.party,
      aboveDiag,
      ax: p.cx,
      ay: p.cy,
      r: p.r,
      tx,
      ty,
      x: tx + Math.cos(jitterAngle) * 8,
      y: ty + Math.sin(jitterAngle) * 6,
      w,
      h,
    };
  });

  const separatePass = (pushCircles = true) => {
    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j += 1) {
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const ox = (a.w + b.w) / 2 + 4 - Math.abs(dx);
        const oy = (a.h + b.h) / 2 + 4 - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          if (oy < ox) {
            const s = (oy / 2 + 0.6) * (dy >= 0 ? 1 : -1);
            a.y -= s;
            b.y += s;
          } else {
            const s = (ox / 2 + 0.6) * (dx >= 0 ? 1 : -1);
            a.x -= s;
            b.x += s;
          }
        }
      }
    }

    for (const a of nodes) {
      const hw = a.w / 2;
      const hh = a.h / 2;
      if (pushCircles) {
        for (const p of parties) {
          const push = rectCirclePush(a.x, a.y, hw, hh, p.cx, p.cy, p.r + 5.5);
          if (push) {
            a.x += push.px * 0.72;
            a.y += push.py * 0.72;
          }
        }
      }
      // Mantém distância da anotação do quadrante superior esquerdo
      if (a.x - hw < topQuadRight && a.y - hh < topQuadBottom) {
        a.y = topQuadBottom + hh + 2;
      }
      if (diagSeg) {
        const vx = diagSeg.x2 - diagSeg.x1;
        const vy = diagSeg.y2 - diagSeg.y1;
        const len2 = vx * vx + vy * vy || 1;
        const t = Math.max(0, Math.min(1, ((a.x - diagSeg.x1) * vx + (a.y - diagSeg.y1) * vy) / len2));
        const px = diagSeg.x1 + t * vx;
        const py = diagSeg.y1 + t * vy;
        const dist = Math.hypot(a.x - px, a.y - py);
        if (dist < 13) {
          const len = Math.sqrt(len2);
          const nx = vy / len;
          const ny = -vx / len;
          const sign = a.aboveDiag ? 1 : -1;
          const push = (13 - dist) * 0.55 * sign;
          a.x += nx * push;
          a.y += ny * push;
        }
      }
      a.x = Math.max(left + hw + 4, Math.min(right - hw - 4, a.x));
      a.y = Math.max(top + hh + 3, Math.min(bottom - hh - 3, a.y));
    }
  };

  const sim = d3.forceSimulation(nodes)
    .force('x', d3.forceX((d) => d.tx).strength(0.14))
    .force('y', d3.forceY((d) => d.ty).strength(0.14))
    .force('repel', () => separatePass(true))
    .stop();

  for (let tick = 0; tick < 180; tick += 1) sim.tick();
  // Passe final determinístico sem mola para garantir 0 sobreposições entre rótulos
  for (let iter = 0; iter < 30; iter += 1) separatePass(iter < 20);
  return nodes;
}

/**
 * H3 — Dispersão por partido: % de candidatas × % do Fundo Público (FEFC + FP),
 * com Escala Linear como padrão (e escala log₁₀ reservada ao modo "Todos"),
 * ordenação Z-index (maiores ao fundo, menores à frente), rótulos seletivos com
 * repulsão d3-force + leader lines, micro-legenda, anotações de quadrante e hover focado.
 */
export function renderH3Scatter(
  container,
  h3Data,
  { width = 700, scale = 'linear', zoom = 'focus', onSelectParty = null } = {},
) {
  container.innerHTML = '';
  const allParties = h3Data.parties.map((p) => ({
    ...p,
    xPct: p.pctCandF * 100,
    yPct: p.pctPubF * 100,
    pubMi: p.pubTotal / 1e6,
  }));

  if (allParties.length === 0) {
    container.innerHTML = '<p class="chart-empty">Sem partidos com amostra mínima (n ≥ 10) e Fundo Público neste recorte.</p>';
    return;
  }

  // Modo "focus": concentra na faixa principal (≤46% X, 15%–58% Y), onde está >99% do Fundo.
  const inFocus = allParties.filter((p) => p.xPct <= 46 && p.yPct >= 15 && p.yPct <= 58);
  const useFocus = zoom === 'focus' && inFocus.length >= 8 && inFocus.length < allParties.length;

  // Escala logarítmica reservada apenas para a visão "Todos"
  const isLog = scale === 'log' && !useFocus;
  const baseParties = useFocus ? inFocus : allParties;
  const parties = (isLog ? baseParties.filter((p) => p.xPct > 0 && p.yPct > 0) : [...baseParties])
    // Z-index: desenha bolhas maiores primeiro (fundo) e menores por último (frente)
    .sort((a, b) => b.pubTotal - a.pubTotal);

  if (parties.length === 0) {
    container.innerHTML = '<p class="chart-empty">Sem partidos com valores positivos para escala logarítmica; alterne para Escala Linear.</p>';
    return;
  }

  const omitted = allParties.filter((p) => !parties.includes(p));

  const minXData = d3.min(parties, (p) => p.xPct) || 0;
  const maxXData = d3.max(parties, (p) => p.xPct) || 50;
  const minYData = d3.min(parties, (p) => p.yPct) || 0;
  const maxYData = d3.max(parties, (p) => p.yPct) || 50;

  const xMin = isLog
    ? Math.max(1, Math.min(25, Math.floor(minXData * 0.9)))
    : Math.max(0, Math.min(28, Math.floor(minXData - 1.5)));
  const xMax = isLog
    ? Math.min(100, Math.ceil(maxXData * 1.07))
    : Math.min(100, Math.ceil(maxXData + (useFocus ? 1.8 : 3)));

  const yMin = isLog
    ? Math.max(1, Math.min(15, Math.floor(minYData * 0.85)))
    : (minYData === 0 ? 0 : Math.max(0, Math.min(21, Math.floor(minYData - 2.5))));
  const yMax = isLog
    ? Math.min(105, Math.ceil(maxYData * 1.08))
    : Math.min(102, Math.ceil(maxYData + (useFocus ? 3.5 : 5)));

  const isCompact = width < 460;
  const marginTop = isCompact ? 62 : 52;
  const marginRight = isCompact ? 14 : 24;
  const marginBottom = 46;
  const marginLeft = isCompact ? 46 : 54;
  const height = isCompact ? 405 : 430;

  const plotLeft = marginLeft;
  const plotRight = width - marginRight;
  const plotTop = marginTop;
  const plotBottom = height - marginBottom;

  const xScale = isLog
    ? d3.scaleLog().base(10).domain([xMin, xMax]).range([plotLeft, plotRight])
    : d3.scaleLinear().domain([xMin, xMax]).range([plotLeft, plotRight]);
  const yScale = isLog
    ? d3.scaleLog().base(10).domain([yMin, yMax]).range([plotBottom, plotTop])
    : d3.scaleLinear().domain([yMin, yMax]).range([plotBottom, plotTop]);

  const maxPub = Math.max(1, d3.max(allParties, (d) => d.pubTotal) || 1);
  const rScale = d3.scaleSqrt()
    .domain([0, maxPub])
    .range(isCompact ? [3.5, 13.5] : [4, 16.5]);

  for (const p of parties) {
    p.cx = xScale(p.xPct);
    p.cy = yScale(p.yPct);
    p.r = rScale(p.pubTotal);
  }

  const tipCtrl = createChartTooltip(container);
  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', width)
    .attr('height', height)
    .attr('role', 'img')
    .attr('aria-label', 'Dispersão entre percentual de candidatas mulheres e percentual do Fundo Público por partido')
    .style('font-family', 'Barlow, Inter, system-ui, sans-serif');

  // 1. Grade e eixos
  const xTicks = isLog
    ? [1, 5, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100].filter((t) => t >= xMin && t <= xMax)
    : xScale.ticks(isCompact ? 5 : 7);
  const yTicks = isLog
    ? [1, 5, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100].filter((t) => t >= yMin && t <= yMax)
    : yScale.ticks(isCompact ? 5 : 7);

  const gridG = svg.append('g').attr('aria-label', 'grid');
  for (const t of xTicks) {
    const x = xScale(t);
    gridG.append('line')
      .attr('x1', x).attr('x2', x)
      .attr('y1', plotTop).attr('y2', plotBottom)
      .attr('stroke', 'rgba(255, 255, 255, 0.14)')
      .attr('stroke-width', 1);
  }
  for (const t of yTicks) {
    const y = yScale(t);
    gridG.append('line')
      .attr('x1', plotLeft).attr('x2', plotRight)
      .attr('y1', y).attr('y2', y)
      .attr('stroke', 'rgba(255, 255, 255, 0.14)')
      .attr('stroke-width', 1);
  }

  // Moldura sutil do gráfico
  svg.append('rect')
    .attr('x', plotLeft)
    .attr('y', plotTop)
    .attr('width', plotRight - plotLeft)
    .attr('height', plotBottom - plotTop)
    .attr('fill', 'none')
    .attr('stroke', 'rgba(255, 255, 255, 0.28)')
    .attr('stroke-width', 1);

  const axisG = svg.append('g').attr('aria-label', 'axes').attr('font-size', 11).attr('fill', 'rgba(255, 255, 255, 0.85)');
  for (const t of xTicks) {
    const x = xScale(t);
    axisG.append('line').attr('x1', x).attr('x2', x).attr('y1', plotBottom).attr('y2', plotBottom + 4).attr('stroke', 'rgba(255, 255, 255, 0.45)');
    axisG.append('text')
      .attr('x', x)
      .attr('y', plotBottom + 17)
      .attr('text-anchor', 'middle')
      .text(`${t}%`);
  }
  for (const t of yTicks) {
    const y = yScale(t);
    axisG.append('line').attr('x1', plotLeft - 4).attr('x2', plotLeft).attr('y1', y).attr('y2', y).attr('stroke', 'rgba(255, 255, 255, 0.45)');
    axisG.append('text')
      .attr('x', plotLeft - 8)
      .attr('y', y + 3.5)
      .attr('text-anchor', 'end')
      .text(`${t}%`);
  }

  // Títulos dos eixos
  axisG.append('text')
    .attr('x', (plotLeft + plotRight) / 2)
    .attr('y', height - 6)
    .attr('text-anchor', 'middle')
    .attr('font-size', 11.5)
    .attr('font-weight', 600)
    .attr('fill', '#FFFFFF')
    .text(isLog ? '% de candidatas mulheres (APTO · escala log₁₀) →' : '% de candidatas mulheres (APTO) →');

  axisG.append('text')
    .attr('transform', `translate(13, ${(plotTop + plotBottom) / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle')
    .attr('font-size', 11.5)
    .attr('font-weight', 600)
    .attr('fill', '#FFFFFF')
    .text(isLog ? '% do Fundo Público p/ mulheres (log₁₀)' : '% do Fundo Público (FEFC + FP) p/ mulheres');

  // 2. Linhas de referência: corte legal 30% e diagonal Y = X
  const rulesG = svg.append('g').attr('aria-label', 'reference-rules');
  const hasRuleX30 = xMin <= 30 && xMax >= 30;
  const hasRuleY30 = yMin <= 30 && yMax >= 30;

  if (hasRuleX30) {
    const x30 = xScale(30);
    rulesG.append('line')
      .attr('x1', x30).attr('x2', x30)
      .attr('y1', plotTop).attr('y2', plotBottom)
      .attr('stroke', '#FF7AE5')
      .attr('stroke-dasharray', '3,3')
      .attr('stroke-opacity', 0.78)
      .attr('stroke-width', 1.25);
  }
  if (hasRuleY30) {
    const y30 = yScale(30);
    rulesG.append('line')
      .attr('x1', plotLeft).attr('x2', plotRight)
      .attr('y1', y30).attr('y2', y30)
      .attr('stroke', '#FF7AE5')
      .attr('stroke-dasharray', '3,3')
      .attr('stroke-opacity', 0.78)
      .attr('stroke-width', 1.25);
  }

  const diagLo = Math.max(xMin, yMin);
  const diagHi = Math.min(xMax, yMax);
  let diagSeg = null;
  if (diagHi > diagLo) {
    const px1 = xScale(diagLo);
    const py1 = yScale(diagLo);
    const px2 = xScale(diagHi);
    const py2 = yScale(diagHi);
    diagSeg = { x1: px1, y1: py1, x2: px2, y2: py2 };

    rulesG.append('line')
      .attr('x1', px1).attr('y1', py1)
      .attr('x2', px2).attr('y2', py2)
      .attr('stroke', 'rgba(255, 255, 255, 0.72)')
      .attr('stroke-dasharray', '5,4')
      .attr('stroke-width', 1.5);

    // Texto "Y = X (proporcional)" rotacionado acompanhando exatamente o ângulo da reta
    const dx = px2 - px1;
    const dy = py2 - py1;
    const len = Math.hypot(dx, dy) || 1;
    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    const tPos = 0.88;
    const nx = dy / len;
    const ny = -dx / len;
    const lx = px1 + dx * tPos + nx * 8;
    const ly = py1 + dy * tPos + ny * 8;

    rulesG.append('text')
      .attr('aria-label', 'diagonal-label')
      .attr('transform', `translate(${lx.toFixed(1)}, ${ly.toFixed(1)}) rotate(${angleDeg.toFixed(2)})`)
      .attr('text-anchor', 'end')
      .attr('font-size', 10.5)
      .attr('font-weight', 600)
      .attr('fill', '#FFFFFF')
      .attr('stroke', '#003D2B')
      .attr('stroke-width', 3)
      .attr('paint-order', 'stroke')
      .style('pointer-events', 'none')
      .text('Y = X (proporcional)');
  }

  // 3. Anotações sutis de quadrantes (camada de fundo)
  const quadG = svg.append('g').attr('aria-label', 'h3-quadrants').style('pointer-events', 'none');
  const quadText = (x, y, text, { anchor = 'start', color = 'rgba(255, 255, 255, 0.88)' } = {}) => {
    quadG.append('text')
      .attr('x', x)
      .attr('y', y)
      .attr('text-anchor', anchor)
      .attr('font-size', isCompact ? 9.5 : 10.5)
      .attr('font-weight', 600)
      .attr('fill', color)
      .attr('fill-opacity', 0.92)
      .attr('stroke', '#003D2B')
      .attr('stroke-width', 2.8)
      .attr('paint-order', 'stroke')
      .text(text);
  };

  quadText(
    plotLeft + 10,
    plotTop + 15,
    isCompact ? 'Y ≥ X · Proporcional ou acima' : 'Acima de Y = X · Proporcional ou superior',
    { anchor: 'start', color: '#FCE34D' },
  );

  if (xMax > 35) {
    const subY = hasRuleY30 && yScale(30) - plotTop > 36
      ? yScale(30) - 8
      : plotBottom - 10;
    quadText(
      plotRight - 10,
      subY,
      isCompact ? 'Zona de subfinanciamento (Y < X)' : 'Zona de subfinanciamento (abaixo de Y = X)',
      { anchor: 'end', color: '#FF8A65' },
    );
  }

  if (hasRuleY30 && plotBottom - yScale(30) >= 24) {
    quadText(
      plotRight - 10,
      plotBottom - 9,
      isCompact ? 'Descumprimento da cota (< 30%)' : 'Descumprimento da cota (< 30% do Fundo)',
      { anchor: 'end', color: '#FF7AE5' },
    );
  }

  // 4. Micro-legenda discreta no canto superior direito (Cor + Tamanho)
  const legG = svg.append('g').attr('aria-label', 'h3-legend');
  const legW = isCompact ? Math.min(width - 12, 310) : 344;
  const legH = isCompact ? 46 : 40;
  const legX = Math.max(6, plotRight - legW);
  const legY = 4;

  legG.append('rect')
    .attr('x', legX)
    .attr('y', legY)
    .attr('width', legW)
    .attr('height', legH)
    .attr('rx', 6)
    .attr('fill', '#005C40')
    .attr('stroke', 'rgba(255, 255, 255, 0.25)')
    .attr('stroke-width', 1);

  // Linha 1: Cor (acima vs. abaixo da proporcionalidade)
  const row1Y = legY + (isCompact ? 14 : 13);
  legG.append('circle').attr('cx', legX + 12).attr('cy', row1Y - 3).attr('r', 4).attr('fill', '#FCE34D').attr('fill-opacity', 0.9).attr('stroke', '#FFFFFF').attr('stroke-width', 0.8);
  legG.append('text').attr('x', legX + 20).attr('y', row1Y).attr('font-size', isCompact ? 9.5 : 10).attr('fill', '#FFFFFF').text('Y ≥ X (proporcional)');

  const col2X = legX + (isCompact ? 132 : 148);
  legG.append('circle').attr('cx', col2X).attr('cy', row1Y - 3).attr('r', 4).attr('fill', '#FF5E2B').attr('fill-opacity', 0.9).attr('stroke', '#FFFFFF').attr('stroke-width', 0.8);
  legG.append('text').attr('x', col2X + 8).attr('y', row1Y).attr('font-size', isCompact ? 9.5 : 10).attr('fill', '#FFFFFF').text('Y < X (subfinanciado)');

  // Linha 2: Tamanho (Volume total do Fundo em R$)
  const row2Y = legY + (isCompact ? 34 : 31);
  const sampleRadii = [3.5, 5.8, 8.2];
  let cxCursor = legX + 12;
  for (const sr of sampleRadii) {
    legG.append('circle')
      .attr('cx', cxCursor + sr)
      .attr('cy', row2Y - 3.5)
      .attr('r', sr)
      .attr('fill', 'rgba(255, 255, 255, 0.2)')
      .attr('fill-opacity', 0.7)
      .attr('stroke', 'rgba(255, 255, 255, 0.75)')
      .attr('stroke-width', 0.9);
    cxCursor += sr * 2 + 4;
  }
  legG.append('text')
    .attr('x', cxCursor + 4)
    .attr('y', row2Y)
    .attr('font-size', isCompact ? 9.5 : 10)
    .attr('fill', 'rgba(255, 255, 255, 0.88)')
    .text(`Tamanho: Fundo Público total (até ${fmtCompactBrl(maxPub)})`);

  // 5. Bolhas (ordenadas da maior para a menor — Z-index correto)
  const dotG = svg.append('g').attr('aria-label', 'dot');
  const circles = dotG.selectAll('circle')
    .data(parties, (d) => d.party)
    .join('circle')
    .attr('cx', (d) => d.cx)
    .attr('cy', (d) => d.cy)
    .attr('r', (d) => d.r)
    .attr('fill', (d) => (d.yPct >= d.xPct ? '#FCE34D' : '#FF5E2B'))
    .attr('fill-opacity', 0.75)
    .attr('stroke', '#FFFFFF')
    .attr('stroke-opacity', 1)
    .attr('stroke-width', 1.1)
    .attr('data-party', (d) => d.party)
    .attr('tabindex', 0)
    .attr('role', 'button')
    .attr('aria-label', (d) => `${d.party}: ${fmtPct(d.xPct)} mulheres, ${fmtPct(d.yPct)} Fundo Público`)
    .style('cursor', onSelectParty ? 'pointer' : 'default')
    .style('transition', 'opacity 140ms ease, fill-opacity 140ms ease, stroke-width 140ms ease');

  // 6. Rótulos seletivos (Top 6 + extremos) com repulsão d3-force e leader lines
  const selectedParties = selectLabels(parties);
  const labelNodes = runLabelForceLayout({
    parties,
    selectedParties,
    bounds: { left: plotLeft, right: plotRight, top: plotTop, bottom: plotBottom },
    diagSeg,
    isCompact,
  });

  const leaderG = svg.append('g')
    .attr('aria-label', 'label-leaders')
    .style('pointer-events', 'none');

  const labelG = svg.append('g')
    .attr('aria-label', 'text')
    .style('pointer-events', 'none');

  for (const n of labelNodes) {
    const dx = n.x - n.ax;
    const dy = n.y - n.ay;
    const dist = Math.hypot(dx, dy) || 1;
    const anchorRectPt = closestPointOnRect(n.x, n.y, n.w / 2, n.h / 2, n.ax, n.ay);
    const startX = n.ax + (dx / dist) * n.r;
    const startY = n.ay + (dy / dist) * n.r;
    const gap = Math.hypot(anchorRectPt.x - startX, anchorRectPt.y - startY);

    if (gap > 4) {
      leaderG.append('line')
        .attr('data-party', n.party)
        .attr('x1', startX.toFixed(1))
        .attr('y1', startY.toFixed(1))
        .attr('x2', anchorRectPt.x.toFixed(1))
        .attr('y2', anchorRectPt.y.toFixed(1))
        .attr('stroke', 'rgba(255, 255, 255, 0.58)')
        .attr('stroke-width', 0.9)
        .attr('stroke-opacity', 0.78)
        .style('transition', 'opacity 140ms ease');
    }

    labelG.append('text')
      .attr('data-party', n.party)
      .attr('x', n.x.toFixed(1))
      .attr('y', (n.y + 3.5).toFixed(1))
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('font-weight', 600)
      .attr('fill', '#FFFFFF')
      .attr('stroke', '#003D2B')
      .attr('stroke-width', 3.2)
      .attr('stroke-linejoin', 'round')
      .attr('paint-order', 'stroke')
      .style('transition', 'opacity 140ms ease')
      .text(n.party);
  }

  // Camada para rótulo temporário no hover (para partidos sem rótulo fixo)
  const hoverLabelG = svg.append('g')
    .attr('aria-label', 'hover-label')
    .style('pointer-events', 'none');

  function applyHoverHighlight(datum) {
    circles
      .style('opacity', (d) => (d.party === datum.party ? 1 : 0.2))
      .attr('fill-opacity', (d) => (d.party === datum.party ? 0.95 : 0.75))
      .attr('stroke-width', (d) => (d.party === datum.party ? 2.2 : 1.1));

    labelG.selectAll('text').style('opacity', function () {
      return this.dataset.party === datum.party ? 1 : 0.22;
    });
    leaderG.selectAll('line').style('opacity', function () {
      return this.dataset.party === datum.party ? 1 : 0.2;
    });

    hoverLabelG.selectAll('*').remove();
    if (!selectedParties.has(datum.party)) {
      const hy = datum.cy - datum.r - 8 >= plotTop + 10 ? datum.cy - datum.r - 8 : datum.cy + datum.r + 14;
      const hx = Math.max(plotLeft + 26, Math.min(plotRight - 26, datum.cx));
      hoverLabelG.append('text')
        .attr('x', hx.toFixed(1))
        .attr('y', hy.toFixed(1))
        .attr('text-anchor', 'middle')
        .attr('font-size', 10.5)
        .attr('font-weight', 700)
        .attr('fill', '#FCE34D')
        .attr('stroke', '#003D2B')
        .attr('stroke-width', 3.5)
        .attr('stroke-linejoin', 'round')
        .attr('paint-order', 'stroke')
        .text(datum.party);
    }
  }

  function clearHoverHighlight() {
    circles
      .style('opacity', 1)
      .attr('fill-opacity', 0.75)
      .attr('stroke-width', 1.1);
    labelG.selectAll('text').style('opacity', 1);
    leaderG.selectAll('line').style('opacity', 0.78);
    hoverLabelG.selectAll('*').remove();
  }

  circles.each(function (datum) {
    const el = this;
    if (onSelectParty) {
      el.addEventListener('click', () => onSelectParty(datum.party));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelectParty(datum.party);
        }
      });
    }

    bindTooltipEvents(
      el,
      tipCtrl,
      () => {
        const gapPp = datum.yPct - datum.xPct;
        const badgeTone = Math.abs(gapPp) < 0.05 ? 'floor' : (gapPp > 0 ? 'above' : 'below');
        const status = Math.abs(gapPp) < 0.05
          ? 'No proporcional'
          : (gapPp > 0 ? 'Acima do proporcional' : 'Abaixo do proporcional');
        return buildTooltipCard({
          title: `${datum.party} · ${fmtInt(datum.n)} APTO`,
          badge: status,
          badgeTone,
          rows: [
            {
              label: 'Mulheres na chapa',
              value: fmtPct(datum.xPct),
              sub: `${fmtInt(datum.nF)} mulheres`,
            },
            {
              label: 'Fundo Público (F)',
              value: fmtPct(datum.yPct),
              sub: `${fmtCompactBrl(datum.pubF)} de ${fmtCompactBrl(datum.pubTotal)}`,
            },
            {
              label: 'Proporcionalidade',
              value: fmtRatio(datum.ratio),
              sub: fmtSignedPP(gapPp),
              focus: true,
            },
          ],
          hint: onSelectParty ? 'Clique na bolha para filtrar o partido' : '',
        });
      },
      {
        focusable: true,
        onEnter: () => applyHoverHighlight(datum),
        onLeave: () => clearHoverHighlight(),
      },
    );
  });

  if (omitted.length > 0) {
    const note = document.createElement('p');
    note.className = 'chart-note';
    const list = omitted
      .map((p) => `${p.party} (${p.xPct.toFixed(1).replace('.', ',')}% / ${p.yPct.toFixed(1).replace('.', ',')}%)`)
      .join(' · ');
    note.textContent = useFocus
      ? `Fora do foco principal (use "Todos" para exibir): ${list}.`
      : `Fora da escala log₁₀ por apresentar 0% (use "Escala Linear" para exibir): ${list}.`;
    container.appendChild(note);
  }
}
