import * as d3 from 'd3';
import { SEMANTIC_PALETTE } from './palette.js';
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

function fmtDeficitCompact(deficitBrl, omitCurrency = false) {
  const absVal = Math.abs(deficitBrl);
  const sign = deficitBrl < 0 ? '−' : '+';
  const cur = omitCurrency ? '' : 'R$ ';
  if (absVal >= 1e6) return `${sign}${cur}${(absVal / 1e6).toFixed(1).replace('.', ',')}M`;
  if (absVal >= 1e3) return `${sign}${cur}${Math.round(absVal / 1e3)} mil`;
  return `${sign}${cur}${Math.round(absVal)}`;
}

function shortPartyLabel(party, isCompact) {
  if (!isCompact) return party;
  if (party === 'SOLIDARIEDADE') return 'SOLIDAR.';
  if (party === 'REPUBLICANOS') return 'REPUB.';
  return party;
}

function selectLabels(parties, isCompact = false) {
  const selected = new Map();
  // 1. TODAS as bolhas vermelhas (subfinanciamento: Y < X) são rotuladas
  for (const p of parties) {
    if (p.yPct < p.xPct) {
      const showVal = Math.abs(p.deficitBrl) >= 2.5e6;
      const pName = shortPartyLabel(p.party, isCompact);
      selected.set(p.party, {
        ...p,
        labelText: showVal ? `${pName} (${fmtDeficitCompact(p.deficitBrl, isCompact)})` : pName,
      });
    }
  }
  // 2. Top 3 partidos acima da diagonal por volume de Fundo Público para referência visual
  const above = parties.filter((p) => p.yPct >= p.xPct).slice(0, 3);
  for (const p of above) {
    selected.set(p.party, { ...p, labelText: shortPartyLabel(p.party, isCompact) });
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
  obstacles = [],
  isCompact = false,
}) {
  const { left, right, top, bottom } = bounds;
  const topQuadRight = left + (isCompact ? 150 : 185);
  const topQuadBottom = top + 22;

  const nodes = [...selectedParties.values()].map((p, idx) => {
    const labelText = p.labelText || p.party;
    const charW = isCompact ? 6.9 : 7.1;
    const w = Math.max(38, labelText.length * charW + 24);
    const h = isCompact ? 21 : 22;
    const aboveDiag = p.yPct >= p.xPct;
    let ty = aboveDiag ? p.cy - p.r - 12 : p.cy + p.r + 14;
    if (ty < top + 16 || (p.cx - w / 2 < topQuadRight && ty - h / 2 < topQuadBottom + 4)) {
      ty = p.cy + p.r + 14;
    }
    if (ty > bottom - 16) ty = p.cy - p.r - 12;
    const tx = Math.max(left + w / 2 + 4, Math.min(right - w / 2 - 4, p.cx));
    const jitterAngle = idx * 2.1;
    return {
      party: p.party,
      labelText,
      isAlert: p.yPct < p.xPct,
      aboveDiag,
      ax: p.cx,
      ay: p.cy,
      r: p.r,
      tx,
      ty,
      x: tx + Math.cos(jitterAngle) * 14,
      y: ty + Math.sin(jitterAngle) * 10,
      w,
      h,
    };
  });

  const separatePass = (pushCircles = true, pushDiag = true) => {
    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j += 1) {
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const ox = (a.w + b.w) / 2 + 6 - Math.abs(dx);
        const oy = (a.h + b.h) / 2 + 5 - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          const nearEdgeX = (a.x - a.w / 2 <= left + 16) || (a.x + a.w / 2 >= right - 16)
            || (b.x - b.w / 2 <= left + 16) || (b.x + b.w / 2 >= right - 16);
          if (oy <= ox || nearEdgeX) {
            const signY = dy === 0 ? (i % 2 === 0 ? -1 : 1) : (dy > 0 ? 1 : -1);
            const step = oy + 2;
            const aPinned = (signY > 0 && a.y - a.h / 2 <= top + 8) || (signY < 0 && a.y + a.h / 2 >= bottom - 8);
            const bPinned = (signY > 0 && b.y + b.h / 2 >= bottom - 8) || (signY < 0 && b.y - b.h / 2 <= top + 8);
            if (aPinned && !bPinned) {
              b.y += step * signY;
            } else if (bPinned && !aPinned) {
              a.y -= step * signY;
            } else {
              a.y -= (step / 2) * signY;
              b.y += (step / 2) * signY;
            }
          } else {
            const signX = dx === 0 ? (i % 2 === 0 ? -1 : 1) : (dx > 0 ? 1 : -1);
            const s = ox / 2 + 1.5;
            a.x -= s * signX;
            b.x += s * signX;
          }
        }
      }
    }

    for (const a of nodes) {
      const hw = a.w / 2;
      const hh = a.h / 2;
      if (pushCircles) {
        for (const p of parties) {
          const push = rectCirclePush(a.x, a.y, hw, hh, p.cx, p.cy, p.r + 7);
          if (push) {
            a.x += push.px * 0.78;
            a.y += push.py * 0.78;
          }
        }
      }
      for (const obs of obstacles) {
        const dx = a.x - obs.cx;
        const dy = a.y - obs.cy;
        const ox = (a.w + obs.w) / 2 + 5 - Math.abs(dx);
        const oy = (a.h + obs.h) / 2 + 5 - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          if (oy <= ox) {
            a.y += (oy + 1.5) * (dy >= 0 ? 1 : -1);
          } else {
            a.x += (ox + 1.5) * (dx >= 0 ? 1 : -1);
          }
        }
      }
      if (diagSeg && pushDiag) {
        const vx = diagSeg.x2 - diagSeg.x1;
        const vy = diagSeg.y2 - diagSeg.y1;
        const len2 = vx * vx + vy * vy || 1;
        const t = Math.max(0, Math.min(1, ((a.x - diagSeg.x1) * vx + (a.y - diagSeg.y1) * vy) / len2));
        const px = diagSeg.x1 + t * vx;
        const py = diagSeg.y1 + t * vy;
        const dist = Math.hypot(a.x - px, a.y - py);
        if (dist < 14) {
          const len = Math.sqrt(len2);
          const nx = vy / len;
          const ny = -vx / len;
          const sign = a.aboveDiag ? 1 : -1;
          const push = (14 - dist) * 0.55 * sign;
          a.x += nx * push;
          a.y += ny * push;
        }
      }
      a.x = Math.max(left + hw + 3, Math.min(right - hw - 3, a.x));
      a.y = Math.max(top + hh + 3, Math.min(bottom - hh - 3, a.y));
    }
  };

  const sim = d3.forceSimulation(nodes)
    .force('x', d3.forceX((d) => d.tx).strength(0.03))
    .force('y', d3.forceY((d) => d.ty).strength(0.03))
    .force('repel', () => separatePass(true, true))
    .stop();

  for (let tick = 0; tick < 240; tick += 1) sim.tick();
  for (let iter = 0; iter < 180; iter += 1) separatePass(true, false);

  // Garantia determinística final: 0 colisão texto×texto, 0 texto×obstáculo e 0 texto×círculo (incl. AABB DOMRect)
  const boxOverlaps = (x1, y1, w1, h1, x2, y2, w2, h2, pad = 3) => (
    Math.abs(x1 - x2) < (w1 + w2) / 2 + pad && Math.abs(y1 - y2) < (h1 + h2) / 2 + pad
  );
  const hitsAnyCircle = (cx, cy, hw, hh) => (
    parties.some((p) => (
      rectCirclePush(cx, cy, hw, hh, p.cx, p.cy, p.r + 6.5)
      || boxOverlaps(cx, cy, hw * 2, hh * 2, p.cx, p.cy, (p.r + 2) * 2, (p.r + 2) * 2, 2.5)
    ))
  );
  const isFree = (node, cx, cy, others, checkCircles = true) => {
    const hw = node.w / 2;
    const hh = node.h / 2;
    if (cx - hw < left + 2 || cx + hw > right - 2 || cy - hh < top + 2 || cy + hh > bottom - 2) return false;
    for (const o of others) {
      if (o === node) continue;
      if (boxOverlaps(cx, cy, node.w, node.h, o.x, o.y, o.w, o.h, 3)) return false;
    }
    for (const obs of obstacles) {
      if (boxOverlaps(cx, cy, node.w, node.h, obs.cx, obs.cy, obs.w, obs.h, 3)) return false;
    }
    if (checkCircles && hitsAnyCircle(cx, cy, hw, hh)) return false;
    return true;
  };
  for (let pass = 0; pass < 4; pass += 1) {
    for (let i = 0; i < nodes.length; i += 1) {
      const a = nodes[i];
      const hasHit = nodes.some((b, j) => j !== i && boxOverlaps(a.x, a.y, a.w, a.h, b.x, b.y, b.w, b.h, 2))
        || obstacles.some((obs) => boxOverlaps(a.x, a.y, a.w, a.h, obs.cx, obs.cy, obs.w, obs.h, 2))
        || hitsAnyCircle(a.x, a.y, a.w / 2, a.h / 2);
      if (!hasHit) continue;
      let best = null;
      for (let rad = 14; rad <= 260; rad += 10) {
        for (let ang = 0; ang < 24; ang += 1) {
          const theta = (ang / 24) * Math.PI * 2;
          const cx = a.ax + Math.cos(theta) * rad;
          const cy = a.ay + Math.sin(theta) * rad;
          if (!isFree(a, cx, cy, nodes, true)) continue;
          const distAnchor = Math.hypot(cx - a.ax, cy - a.ay);
          if (!best || distAnchor < best.score) best = { cx, cy, score: distAnchor };
        }
        if (best) break;
      }
      if (!best) {
        for (let gy = top + a.h / 2 + 4; gy <= bottom - a.h / 2 - 4; gy += 14) {
          for (let gx = left + a.w / 2 + 4; gx <= right - a.w / 2 - 4; gx += 18) {
            if (!isFree(a, gx, gy, nodes, true)) continue;
            const distAnchor = Math.hypot(gx - a.ax, gy - a.ay);
            if (!best || distAnchor < best.score) best = { cx: gx, cy: gy, score: distAnchor };
          }
        }
      }
      if (!best) {
        for (let rad = 14; rad <= 220; rad += 14) {
          for (let ang = 0; ang < 16; ang += 1) {
            const theta = (ang / 16) * Math.PI * 2;
            const cx = a.ax + Math.cos(theta) * rad;
            const cy = a.ay + Math.sin(theta) * rad;
            if (!isFree(a, cx, cy, nodes, false)) continue;
            const cHits = parties.filter((p) => rectCirclePush(cx, cy, a.w / 2, a.h / 2, p.cx, p.cy, p.r + 2)).length;
            const score = cHits * 500 + Math.hypot(cx - a.ax, cy - a.ay);
            if (!best || score < best.score) best = { cx, cy, score };
          }
          if (best) break;
        }
      }
      if (best) {
        a.x = best.cx;
        a.y = best.cy;
      }
    }
  }
  return nodes;
}

/**
 * H3 — Dispersão por partido em modo Foco + Escala Linear fixo:
 * - Sem botões de escala/zoom
 * - Rótulos de condição: "Cota respeitada" (#00D09C), "Subfinanciamento" (#FF5E2B), "% verba = % mulheres"
 * - Todas as bolhas vermelhas rotuladas (maiores com déficit em R$)
 * - Legenda mostrando déficit acumulado em reais
 */
export function renderH3Scatter(
  container,
  h3Data,
  { width = 700, selectedParty = '', onSelectParty = null, onClearParty = null } = {},
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

  // Modo foco em escala linear: inclui 100% dos partidos em subfinanciamento (Y < X) + janela principal
  const inFocus = allParties.filter((p) => p.yPct < p.xPct || (p.xPct <= 52 && p.yPct >= 15 && p.yPct <= 58));
  const useFocus = inFocus.length >= 6;
  const parties = [...(useFocus ? inFocus : allParties)]
    .sort((a, b) => b.pubTotal - a.pubTotal);

  const omitted = allParties.filter((p) => !parties.includes(p));

  const minXData = d3.min(parties, (p) => p.xPct) ?? 28;
  const maxXData = d3.max(parties, (p) => p.xPct) ?? 45;
  const minYData = d3.min(parties, (p) => p.yPct) ?? 20;
  const maxYData = d3.max(parties, (p) => p.yPct) ?? 50;

  const xMin = Math.max(0, Math.min(27, Math.floor(minXData - 1.5)));
  const xMax = Math.min(100, Math.ceil(maxXData + 2.2));
  const yMin = minYData < 15 ? 0 : Math.max(0, Math.min(21, Math.floor(minYData - 2.5)));
  const yMax = Math.min(102, Math.ceil(maxYData + 3.5));

  const isCompact = width < 460;
  const marginTop = isCompact ? 66 : 56;
  const marginRight = isCompact ? 14 : 24;
  const marginBottom = 46;
  const marginLeft = isCompact ? 46 : 54;
  const height = isCompact ? 535 : 475;

  const plotLeft = marginLeft;
  const plotRight = width - marginRight;
  const plotTop = marginTop;
  const plotBottom = height - marginBottom;

  const xScale = d3.scaleLinear().domain([xMin, xMax]).range([plotLeft, plotRight]);
  const yScale = d3.scaleLinear().domain([yMin, yMax]).range([plotBottom, plotTop]);

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
    .attr('class', 'h3-scatter-svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', width)
    .attr('height', height)
    .attr('role', 'img')
    .attr('aria-label', 'Dispersão entre percentual de candidatas mulheres e percentual do Fundo Público por partido em escala linear')
    .style('font-family', 'Barlow, Inter, system-ui, sans-serif');

  svg.on('click', (evt) => {
    if (selectedParty && !evt.target.closest('circle') && onClearParty) {
      onClearParty();
    }
  });

  // 1. Grade e eixos
  const xTicks = xScale.ticks(isCompact ? 5 : 7);
  const yTicks = yScale.ticks(isCompact ? 5 : 7);

  const gridG = svg.append('g').attr('aria-label', 'grid');
  for (const t of xTicks) {
    const x = xScale(t);
    gridG.append('line')
      .attr('x1', x).attr('x2', x)
      .attr('y1', plotTop).attr('y2', plotBottom)
      .attr('stroke', SEMANTIC_PALETTE.grid)
      .attr('stroke-width', 1);
  }
  for (const t of yTicks) {
    const y = yScale(t);
    gridG.append('line')
      .attr('x1', plotLeft).attr('x2', plotRight)
      .attr('y1', y).attr('y2', y)
      .attr('stroke', SEMANTIC_PALETTE.grid)
      .attr('stroke-width', 1);
  }

  svg.append('rect')
    .attr('x', plotLeft)
    .attr('y', plotTop)
    .attr('width', plotRight - plotLeft)
    .attr('height', plotBottom - plotTop)
    .attr('fill', 'none')
    .attr('stroke', 'rgba(255, 255, 255, 0.28)')
    .attr('stroke-width', 1);

  const axisG = svg.append('g').attr('aria-label', 'axes').attr('font-size', 11).attr('fill', SEMANTIC_PALETTE.muted);
  for (const t of xTicks) {
    const x = xScale(t);
    axisG.append('line').attr('x1', x).attr('x2', x).attr('y1', plotBottom).attr('y2', plotBottom + 4).attr('stroke', SEMANTIC_PALETTE.subtle);
    axisG.append('text').attr('x', x).attr('y', plotBottom + 17).attr('text-anchor', 'middle').text(`${t}%`);
  }
  for (const t of yTicks) {
    const y = yScale(t);
    axisG.append('line').attr('x1', plotLeft - 4).attr('x2', plotLeft).attr('y1', y).attr('y2', y).attr('stroke', SEMANTIC_PALETTE.subtle);
    axisG.append('text').attr('x', plotLeft - 8).attr('y', y + 3.5).attr('text-anchor', 'end').text(`${t}%`);
  }

  axisG.append('text')
    .attr('x', (plotLeft + plotRight) / 2)
    .attr('y', height - 6)
    .attr('text-anchor', 'middle')
    .attr('font-size', 11.5)
    .attr('font-weight', 600)
    .attr('fill', SEMANTIC_PALETTE.ink)
    .text('% de candidatas mulheres (APTO) →');

  axisG.append('text')
    .attr('transform', `translate(13, ${(plotTop + plotBottom) / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle')
    .attr('font-size', 11.5)
    .attr('font-weight', 600)
    .attr('fill', SEMANTIC_PALETTE.ink)
    .text('% do Fundo Público (FEFC + FP) p/ mulheres');

  // 2. Linhas de referência: 30% (X e Y) e diagonal % verba = % mulheres
  const rulesG = svg.append('g').attr('aria-label', 'reference-rules');
  const hasRuleX30 = xMin <= 30 && xMax >= 30;
  const hasRuleY30 = yMin <= 30 && yMax >= 30;

  if (hasRuleX30) {
    const x30 = xScale(30);
    rulesG.append('line')
      .attr('x1', x30).attr('x2', x30)
      .attr('y1', plotTop).attr('y2', plotBottom)
      .attr('stroke', 'rgba(255, 255, 255, 0.45)')
      .attr('stroke-dasharray', '3,3')
      .attr('stroke-width', 1.25);
  }
  if (hasRuleY30) {
    const y30 = yScale(30);
    rulesG.append('line')
      .attr('x1', plotLeft).attr('x2', plotRight)
      .attr('y1', y30).attr('y2', y30)
      .attr('stroke', SEMANTIC_PALETTE.alert)
      .attr('stroke-dasharray', '3,3')
      .attr('stroke-opacity', 0.85)
      .attr('stroke-width', 1.35);
  }

  const diagLo = Math.max(xMin, yMin);
  const diagHi = Math.min(xMax, yMax);
  let diagSeg = null;
  const labelObstacles = [];
  if (diagHi > diagLo) {
    const px1 = xScale(diagLo);
    const py1 = yScale(diagLo);
    const px2 = xScale(diagHi);
    const py2 = yScale(diagHi);
    diagSeg = { x1: px1, y1: py1, x2: px2, y2: py2 };

    rulesG.append('line')
      .attr('x1', px1).attr('y1', py1)
      .attr('x2', px2).attr('y2', py2)
      .attr('stroke', 'rgba(255, 255, 255, 0.78)')
      .attr('stroke-dasharray', '5,4')
      .attr('stroke-width', 1.6);

    const dx = px2 - px1;
    const dy = py2 - py1;
    const len = Math.hypot(dx, dy) || 1;
    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    const nx = dy / len;
    const ny = -dx / len;
    const txtLen = 114;

    // Escolhe posição tPos ao longo da diagonal livre de colisão com bolhas
    const diagCandidates = [0.96, 0.72, 0.56, 0.22, 0.86];
    let bestDiag = { lx: px1 + dx * 0.86 + nx * 10, ly: py1 + dy * 0.86 + ny * 10, hits: 999 };
    for (const tCand of diagCandidates) {
      for (const side of [1, -1]) {
        const cxEnd = px1 + dx * tCand + nx * (11 * side);
        const cyEnd = py1 + dy * tCand + ny * (11 * side);
        const sxEnd = cxEnd - (dx / len) * txtLen;
        const syEnd = cyEnd - (dy / len) * txtLen;
        const minX = Math.min(cxEnd, sxEnd);
        const maxX = Math.max(cxEnd, sxEnd);
        const minY = Math.min(cyEnd, syEnd);
        const maxY = Math.max(cyEnd, syEnd);
        if (minX < plotLeft + 6 || maxX > plotRight - 6 || minY < plotTop + 18 || maxY > plotBottom - 18) continue;
        // Testa 4 sub-caixas ao longo da reta inclinada para medir colisão real com círculos
        let hits = 0;
        for (const frac of [0.1, 0.36, 0.64, 0.9]) {
          const pxSample = cxEnd - (dx / len) * (txtLen * frac);
          const pySample = cyEnd - (dy / len) * (txtLen * frac);
          for (const p of parties) {
            if (rectCirclePush(pxSample, pySample, 18, 9, p.cx, p.cy, p.r + 3)) hits += 1;
          }
        }
        if (hits < bestDiag.hits) {
          bestDiag = { lx: cxEnd, ly: cyEnd, sx: sxEnd, sy: syEnd, hits };
        }
        if (hits === 0) break;
      }
      if (bestDiag.hits === 0) break;
    }

    const { lx, ly } = bestDiag;
    const sx = bestDiag.sx ?? (lx - (dx / len) * txtLen);
    const sy = bestDiag.sy ?? (ly - (dy / len) * txtLen);

    rulesG.append('text')
      .attr('aria-label', 'diagonal-label')
      .attr('transform', `translate(${lx.toFixed(1)}, ${ly.toFixed(1)}) rotate(${angleDeg.toFixed(2)})`)
      .attr('text-anchor', 'end')
      .attr('font-size', 10.5)
      .attr('font-weight', 700)
      .attr('fill', SEMANTIC_PALETTE.ink)
      .attr('stroke', SEMANTIC_PALETTE.surface)
      .attr('stroke-width', 3)
      .attr('paint-order', 'stroke')
      .style('pointer-events', 'none')
      .text('% verba = % mulheres');
    labelObstacles.push({
      cx: (lx + sx) / 2,
      cy: (ly + sy) / 2,
      w: Math.abs(lx - sx) + 18,
      h: Math.abs(ly - sy) + 24,
    });
  }

  // 3. Nomes dos quadrantes (registrados como obstáculos p/ nunca colidir com rótulos)
  const quadG = svg.append('g').attr('aria-label', 'h3-quadrants').style('pointer-events', 'none');
  const quadText = (x, y, text, { anchor = 'start', color = SEMANTIC_PALETTE.muted } = {}) => {
    const fz = isCompact ? 9.2 : 10.5;
    const estW = text.length * (isCompact ? 5.2 : 5.9) + 6;
    const cx = anchor === 'end' ? x - estW / 2 : x + estW / 2;
    labelObstacles.push({ cx, cy: y - 4, w: estW, h: 15 });
    quadG.append('text')
      .attr('x', x)
      .attr('y', y)
      .attr('text-anchor', anchor)
      .attr('font-size', fz)
      .attr('font-weight', 700)
      .attr('fill', color)
      .attr('fill-opacity', 0.94)
      .attr('stroke', SEMANTIC_PALETTE.surface)
      .attr('stroke-width', 2.8)
      .attr('paint-order', 'stroke')
      .text(text);
  };

  quadText(plotLeft + 10, plotTop + 15, 'Cota respeitada (acima da diagonal)', { anchor: 'start', color: SEMANTIC_PALETTE.ok });
  if (hasRuleX30 && xScale(30) - plotLeft > 52) {
    quadText(plotLeft + 8, plotBottom - 9, isCompact ? '<30% mulh.' : '< 30% mulheres', { anchor: 'start', color: SEMANTIC_PALETTE.muted });
  }
  if (xMax > 35) {
    const subY = hasRuleY30 && yScale(30) - plotTop > 36 ? yScale(30) - 8 : plotBottom - 10;
    quadText(plotRight - 10, subY, 'Subfinanciamento relativo', { anchor: 'end', color: SEMANTIC_PALETTE.alert });
  }
  if (hasRuleY30 && plotBottom - yScale(30) >= 24) {
    quadText(plotRight - 10, plotBottom - 9, 'Descumprimento (< 30% verba)', { anchor: 'end', color: SEMANTIC_PALETTE.alert });
  }

  // 4. Legenda com déficit acumulado total em reais (igual a h3Data.totalDeficitBrl)
  const focusDeficit = parties.filter((p) => p.deficitBrl < 0).reduce((s, p) => s + p.deficitBrl, 0);
  const legG = svg.append('g').attr('aria-label', 'h3-legend');
  const legW = isCompact ? Math.min(width - 12, 336) : 396;
  const legH = isCompact ? 46 : 42;
  const legX = Math.max(6, plotRight - legW);
  const legY = 4;

  legG.append('rect')
    .attr('x', legX)
    .attr('y', legY)
    .attr('width', legW)
    .attr('height', legH)
    .attr('rx', 6)
    .attr('fill', SEMANTIC_PALETTE.surfaceAlt)
    .attr('stroke', 'rgba(255, 255, 255, 0.25)')
    .attr('stroke-width', 1);

  const row1Y = legY + (isCompact ? 14 : 14);
  legG.append('circle').attr('cx', legX + 12).attr('cy', row1Y - 3).attr('r', 4).attr('fill', SEMANTIC_PALETTE.ok).attr('stroke', '#FFFFFF').attr('stroke-width', 0.8);
  legG.append('text').attr('x', legX + 20).attr('y', row1Y).attr('font-size', isCompact ? 9.5 : 10).attr('fill', '#FFFFFF').text('Cota respeitada');

  const col2X = legX + (isCompact ? 114 : 128);
  legG.append('circle').attr('cx', col2X).attr('cy', row1Y - 3).attr('r', 4).attr('fill', SEMANTIC_PALETTE.alert).attr('stroke', '#FFFFFF').attr('stroke-width', 0.8);
  legG.append('text').attr('x', col2X + 8).attr('y', row1Y).attr('font-size', isCompact ? 9.5 : 10).attr('fill', '#FFFFFF').text('Subfinanciamento');

  const row2Y = legY + (isCompact ? 34 : 32);
  legG.append('text')
    .attr('x', legX + 12)
    .attr('y', row2Y)
    .attr('font-size', isCompact ? 9.2 : 10)
    .attr('font-weight', 700)
    .attr('fill', SEMANTIC_PALETTE.alert)
    .text(`Déficit em reais (abaixo): ${fmtDeficitCompact(focusDeficit)} · Bolha = Fundo total`);

  // 5. Bolhas (maiores ao fundo, menores à frente)
  const dotG = svg.append('g').attr('aria-label', 'dot');
  const circles = dotG.selectAll('circle')
    .data(parties, (d) => d.party)
    .join('circle')
    .attr('cx', (d) => d.cx)
    .attr('cy', (d) => d.cy)
    .attr('r', (d) => d.r)
    .attr('fill', (d) => (d.yPct >= d.xPct ? SEMANTIC_PALETTE.ok : SEMANTIC_PALETTE.alert))
    .attr('fill-opacity', (d) => (selectedParty ? (selectedParty === d.party ? 0.95 : 0.22) : 0.78))
    .attr('stroke', '#FFFFFF')
    .attr('stroke-opacity', 1)
    .attr('stroke-width', (d) => (selectedParty === d.party ? 2.4 : 1.1))
    .attr('data-party', (d) => d.party)
    .attr('tabindex', 0)
    .attr('role', 'button')
    .attr('aria-label', (d) => `${d.party}: ${fmtPct(d.xPct)} mulheres, ${fmtPct(d.yPct)} Fundo Público`)
    .style('cursor', onSelectParty ? 'pointer' : 'default')
    .style('opacity', (d) => (selectedParty && selectedParty !== d.party ? 0.22 : 1))
    .style('transition', 'opacity 140ms ease, fill-opacity 140ms ease, stroke-width 140ms ease');

  // 6. Rótulos (TODAS as bolhas vermelhas + top 3 verdes)
  const selectedParties = selectLabels(parties, isCompact);
  const labelNodes = runLabelForceLayout({
    parties,
    selectedParties,
    bounds: { left: plotLeft, right: plotRight, top: plotTop, bottom: plotBottom },
    diagSeg,
    obstacles: labelObstacles,
    isCompact,
  });

  const leaderG = svg.append('g').attr('aria-label', 'label-leaders').style('pointer-events', 'none');
  const labelG = svg.append('g').attr('aria-label', 'text').style('pointer-events', 'none');

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
        .attr('stroke', n.isAlert ? 'rgba(255, 94, 43, 0.72)' : 'rgba(255, 255, 255, 0.58)')
        .attr('stroke-width', 0.9)
        .style('opacity', selectedParty && selectedParty !== n.party ? 0.2 : 0.82);
    }

    labelG.append('text')
      .attr('data-party', n.party)
      .attr('x', n.x.toFixed(1))
      .attr('y', (n.y + 3.5).toFixed(1))
      .attr('text-anchor', 'middle')
      .attr('font-size', isCompact ? 8.8 : 9.5)
      .attr('font-weight', n.isAlert ? 700 : 600)
      .attr('fill', n.isAlert ? '#FFD1C2' : '#FFFFFF')
      .attr('stroke', SEMANTIC_PALETTE.surface)
      .attr('stroke-width', 3.2)
      .attr('stroke-linejoin', 'round')
      .attr('paint-order', 'stroke')
      .style('opacity', selectedParty && selectedParty !== n.party ? 0.22 : 1)
      .text(n.labelText);
  }

  const hoverLabelG = svg.append('g').attr('aria-label', 'hover-label').style('pointer-events', 'none');

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
        .attr('fill', SEMANTIC_PALETTE.ok)
        .attr('stroke', SEMANTIC_PALETTE.surface)
        .attr('stroke-width', 3.5)
        .attr('stroke-linejoin', 'round')
        .attr('paint-order', 'stroke')
        .text(datum.party);
    }
  }

  function clearHoverHighlight() {
    circles
      .style('opacity', (d) => (selectedParty && selectedParty !== d.party ? 0.22 : 1))
      .attr('fill-opacity', (d) => (selectedParty ? (selectedParty === d.party ? 0.95 : 0.22) : 0.78))
      .attr('stroke-width', (d) => (selectedParty === d.party ? 2.4 : 1.1));
    labelG.selectAll('text').style('opacity', function () {
      return selectedParty && this.dataset.party !== selectedParty ? 0.22 : 1;
    });
    leaderG.selectAll('line').style('opacity', function () {
      return selectedParty && this.dataset.party !== selectedParty ? 0.2 : 0.82;
    });
    hoverLabelG.selectAll('*').remove();
  }

  circles.each(function (datum) {
    const el = this;
    if (onSelectParty) {
      el.addEventListener('click', (evt) => {
        evt.stopPropagation();
        onSelectParty(datum.party);
      });
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
          ? '% verba = % mulheres'
          : (gapPp > 0 ? 'Cota respeitada' : 'Subfinanciamento');
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
              label: 'Saldo / Déficit em R$',
              value: fmtDeficitCompact(datum.deficitBrl),
              sub: `${fmtRatio(datum.ratio)} · ${fmtSignedPP(gapPp)}`,
              focus: true,
            },
          ],
          hint: onSelectParty ? 'Clique na bolha para destacar/limpar o partido' : '',
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
    note.textContent = `Outliers positivos fora do enquadramento (X ≤ 52%, Y 15%–58%): ${list}.`;
    container.appendChild(note);
  }
}
