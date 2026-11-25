import * as d3 from 'd3';
import { createChartTooltip, fmtInt, fmtPct, fmtSignedPP } from './tooltip.js';

const PALETTE = {
  y2022: '#FF7AE5',
  y2026: '#FCE34D',
  warn: '#FF5E2B',
  warnText: '#001A12',
  floorBg: '#005C40',
  floorPill: '#FCE34D',
  floorPillText: '#003D2B',
  ink: '#FFFFFF',
  muted: 'rgba(255, 255, 255, 0.84)',
  zero: 'rgba(255, 255, 255, 0.72)',
  grid: 'rgba(255, 255, 255, 0.14)',
  axis: 'rgba(255, 255, 255, 0.42)',
};

function niceAxisMax(rawMax) {
  if (rawMax <= 0) return 20;
  const step = rawMax <= 25 ? 5 : 10;
  return Math.min(100, Math.max(10, Math.ceil((rawMax * 1.08) / step) * step));
}

function buildTooltipHtml(bin, mode, focusYear = null) {
  const isApto = mode === 'apto';
  const a = bin.y2022;
  const b = bin.y2026;

  const p22 = isApto ? a.aptoPct : a.regPct;
  const p26 = isApto ? b.aptoPct : b.regPct;
  const dPP = isApto ? bin.deltaAptoPP : bin.deltaRegPP;

  const cls22 = focusYear === 2022 ? ' is-focus' : '';
  const cls26 = focusYear === 2026 ? ' is-focus' : '';
  const modeLabel = isApto ? 'Aptas (n ≥ 4)' : 'Registradas (n ≥ 4)';

  return `
    <div class="h1-tip-head">
      <strong>Faixa ${bin.label}</strong>
      <span class="h1-tip-status h1-tip-zone-${bin.zone}">${bin.status}</span>
    </div>
    <table class="h1-tip-table">
      <thead>
        <tr>
          <th>${modeLabel}</th>
          <th class="col-2022${cls22}">2022</th>
          <th class="col-2026${cls26}">2026</th>
          <th>Δ 22→26</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Proporção</td>
          <td class="col-2022${cls22}"><strong>${fmtPct(p22)}</strong></td>
          <td class="col-2026${cls26}"><strong>${fmtPct(p26)}</strong></td>
          <td><strong>${fmtSignedPP(dPP)}</strong></td>
        </tr>
      </tbody>
    </table>
  `;
}

/**
 * H1 — Histograma Espelhado (Butterfly Chart) 2022 vs. 2026 limpo:
 * - 5 faixas estratégicas no eixo central compartilhado (< 30%, 30%–33,3%, 33,4%–39%, 40%–49%, 50%+)
 * - 1 barra sólida limpa por ano (sem sobreposição ambígua), com alternador Registradas / Aptas
 * - Escalas espelhadas rigorosamente simétricas e travadas entre Registradas e Aptas
 * - Linha horizontal divisória no piso legal de 30%
 * - Hover comparativo com proporção (%) e Δ 2022→2026 (em p.p.)
 */
export function renderH1Histogram(
  container,
  h1Comparison,
  { width = 700, mode = 'reg', activeYear = 2022 } = {},
) {
  container.innerHTML = '';

  const isApto = mode === 'apto';
  const total22 = isApto
    ? (h1Comparison?.byYear?.[2022]?.aptoSlatesCount || 0)
    : (h1Comparison?.byYear?.[2022]?.totalSlates || 0);
  const total26 = isApto
    ? (h1Comparison?.byYear?.[2026]?.aptoSlatesCount || 0)
    : (h1Comparison?.byYear?.[2026]?.totalSlates || 0);

  if (total22 === 0 && total26 === 0) {
    container.innerHTML = '<p class="chart-empty">Sem chapas com pelo menos 4 candidaturas neste recorte (2022 e 2026).</p>';
    return;
  }

  const bins = h1Comparison.bins;
  const isCompact = width < 440;

  // Escala travada entre 2022, 2026, Registradas e Aptas para comparação fiel ao alternar o botão
  const rawMax = d3.max(bins, (b) => Math.max(
    b.y2022.regPct,
    b.y2022.aptoPct,
    b.y2026.regPct,
    b.y2026.aptoPct,
  )) || 0;

  const axisMax = niceAxisMax(rawMax);

  const tipCtrl = createChartTooltip(container, {
    wrapClass: 'h1-butterfly-wrap',
    tooltipClass: 'h1-tooltip',
  });
  const { wrap } = tipCtrl;

  // Geometria limpa de 3 colunas
  const centerW = isCompact ? 78 : 94;
  const sideLabelPad = isCompact ? 38 : 50;
  const marginTop = 34;
  const marginBottom = 42;
  const rowStep = 42;
  const quotaGap = 24; // espaço para a linha divisória horizontal de 30%
  const barH = 24;

  const halfPlotW = Math.max(70, (width - centerW - sideLabelPad * 2) / 2);
  const leftOriginX = sideLabelPad + halfPlotW;
  const rightOriginX = leftOriginX + centerW;
  const centerX = leftOriginX + centerW / 2;

  // Linha de 30% entre o índice 3 (30%–33,3%) e o índice 4 (< 30%)
  const quotaIdx = bins.findIndex((b) => b.zone === 'below');
  const rowY = (i) => marginTop + i * rowStep + (i >= quotaIdx ? quotaGap : 0);
  const quotaLineY = marginTop + quotaIdx * rowStep + quotaGap / 2 - (rowStep - barH) / 2;
  const plotBottom = rowY(bins.length - 1) + barH + 10;
  const height = plotBottom + marginBottom;

  const xLeft = d3.scaleLinear().domain([0, axisMax]).range([leftOriginX, sideLabelPad]);
  const xRight = d3.scaleLinear().domain([0, axisMax]).range([rightOriginX, rightOriginX + halfPlotW]);

  const ticks = isCompact
    ? [0, Math.round(axisMax / 2), axisMax]
    : (() => {
        const arr = xRight.ticks(4).filter((t) => t <= axisMax);
        if (!arr.includes(0)) arr.unshift(0);
        if (arr[arr.length - 1] !== axisMax && axisMax - arr[arr.length - 1] >= axisMax * 0.15) {
          arr.push(axisMax);
        }
        return arr;
      })();

  const svg = d3.select(wrap).append('svg')
    .attr('class', 'h1-butterfly-svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', width)
    .attr('height', height)
    .attr('role', 'img')
    .style('font-family', 'Barlow, Inter, system-ui, sans-serif')
    .attr(
      'aria-label',
      `Histograma espelhado comparando % de mulheres por chapa em 2022 e 2026 (${isApto ? 'Aptas' : 'Registradas'})`,
    );

  // Cabeçalhos das 3 colunas
  const hdrG = svg.append('g').attr('class', 'h1-col-headers');
  hdrG.append('text')
    .attr('x', leftOriginX)
    .attr('y', 16)
    .attr('text-anchor', 'end')
    .attr('font-size', isCompact ? 11 : 12.5)
    .attr('font-weight', activeYear === 2022 ? 700 : 600)
    .attr('fill', PALETTE.y2022)
    .text(isCompact ? `← 2022 (${fmtInt(total22)})` : `← 2022 (${fmtInt(total22)} chapas)`);

  hdrG.append('text')
    .attr('x', centerX)
    .attr('y', 16)
    .attr('text-anchor', 'middle')
    .attr('font-size', 10.5)
    .attr('font-weight', 600)
    .attr('fill', PALETTE.muted)
    .text('% Mulheres');

  hdrG.append('text')
    .attr('x', rightOriginX)
    .attr('y', 16)
    .attr('text-anchor', 'start')
    .attr('font-size', isCompact ? 11 : 12.5)
    .attr('font-weight', activeYear === 2026 ? 700 : 600)
    .attr('fill', PALETTE.y2026)
    .text(isCompact ? `2026 (${fmtInt(total26)}) →` : `2026 (${fmtInt(total26)} chapas) →`);

  // Grade vertical simétrica
  const gridG = svg.append('g').attr('class', 'h1-grid');
  for (const t of ticks) {
    const xl = xLeft(t);
    const xr = xRight(t);
    gridG.append('line')
      .attr('x1', xl).attr('x2', xl)
      .attr('y1', marginTop - 6).attr('y2', plotBottom)
      .attr('stroke', t === 0 ? PALETTE.axis : PALETTE.grid)
      .attr('stroke-width', t === 0 ? 1.2 : 1);
    gridG.append('line')
      .attr('x1', xr).attr('x2', xr)
      .attr('y1', marginTop - 6).attr('y2', plotBottom)
      .attr('stroke', t === 0 ? PALETTE.axis : PALETTE.grid)
      .attr('stroke-width', t === 0 ? 1.2 : 1);
  }

  // Destaque suave na faixa crítica (30%–33,3%)
  const floorIdx = bins.findIndex((b) => b.zone === 'floor');
  if (floorIdx >= 0) {
    svg.append('rect')
      .attr('x', 4)
      .attr('y', rowY(floorIdx) - 5)
      .attr('width', width - 8)
      .attr('height', barH + 10)
      .attr('rx', 6)
      .attr('fill', PALETTE.floorBg)
      .attr('fill-opacity', 0.85);
  }

  // Tooltip comparativo flutuante compartilhado
  function showTooltip(bin, rowEl, focusYear, clientX = null) {
    const evt = clientX != null ? { clientX } : null;
    tipCtrl.show(rowEl, buildTooltipHtml(bin, mode, focusYear), evt);
  }

  function hideTooltip() {
    tipCtrl.hide();
  }

  // 5 linhas de barras limpas
  const rowsG = svg.append('g').attr('class', 'h1-rows');

  bins.forEach((bin, i) => {
    const y = rowY(i);
    const n22 = isApto ? bin.y2022.aptoN : bin.y2022.regN;
    const p22 = isApto ? bin.y2022.aptoPct : bin.y2022.regPct;
    const n26 = isApto ? bin.y2026.aptoN : bin.y2026.regN;
    const p26 = isApto ? bin.y2026.aptoPct : bin.y2026.regPct;

    const w22 = Math.max(0, leftOriginX - xLeft(p22));
    const w26 = Math.max(0, xRight(p26) - rightOriginX);

    const rowG = rowsG.append('g')
      .attr('class', 'h1-row')
      .attr('data-bin', bin.id)
      .attr('tabindex', 0)
      .attr('role', 'group')
      .attr(
        'aria-label',
        `Faixa ${bin.label}: 2022 ${n22} chapas (${fmtPct(p22)}); 2026 ${n26} chapas (${fmtPct(p26)})`,
      );

    rowG.append('rect')
      .attr('class', 'h1-row-hit')
      .attr('x', 4)
      .attr('y', y - 5)
      .attr('width', width - 8)
      .attr('height', barH + 10)
      .attr('rx', 6)
      .attr('fill', 'transparent');

    // Barra esquerda (2022)
    if (w22 > 0) {
      rowG.append('rect')
        .attr('class', 'h1-bar-2022')
        .attr('x', xLeft(p22))
        .attr('y', y)
        .attr('width', Math.max(2, w22))
        .attr('height', barH)
        .attr('rx', 3)
        .attr('fill', PALETTE.y2022);
    }

    // Rótulo único na ponta esquerda (2022)
    rowG.append('text')
      .attr('class', 'h1-tip-label')
      .attr('x', xLeft(p22) - 6)
      .attr('y', y + barH / 2 + 4)
      .attr('text-anchor', 'end')
      .attr('font-size', isCompact ? 10.5 : 11.5)
      .attr('font-weight', 600)
      .attr('fill', n22 > 0 ? PALETTE.y2022 : PALETTE.zero)
      .text(n22 > 0 ? fmtPct(p22) : '0');

    // Coluna central (faixa)
    if (bin.zone === 'floor') {
      rowG.append('rect')
        .attr('x', leftOriginX + 5)
        .attr('y', y + 1)
        .attr('width', centerW - 10)
        .attr('height', barH - 2)
        .attr('rx', 11)
        .attr('ry', 11)
        .attr('fill', PALETTE.floorPill);
    }
    rowG.append('text')
      .attr('class', 'h1-center-label')
      .attr('x', centerX)
      .attr('y', y + barH / 2 + 4)
      .attr('text-anchor', 'middle')
      .attr('font-size', isCompact ? 10.5 : 11.5)
      .attr('font-weight', bin.zone === 'floor' ? 700 : 600)
      .attr('fill', bin.zone === 'floor' ? PALETTE.floorPillText : (bin.zone === 'below' ? PALETTE.muted : PALETTE.ink))
      .text(bin.label);

    // Barra direita (2026)
    if (w26 > 0) {
      rowG.append('rect')
        .attr('class', 'h1-bar-2026')
        .attr('x', rightOriginX)
        .attr('y', y)
        .attr('width', Math.max(2, w26))
        .attr('height', barH)
        .attr('rx', 3)
        .attr('fill', PALETTE.y2026);
    }

    // Rótulo único na ponta direita (2026)
    rowG.append('text')
      .attr('class', 'h1-tip-label')
      .attr('x', xRight(p26) + 6)
      .attr('y', y + barH / 2 + 4)
      .attr('text-anchor', 'start')
      .attr('font-size', isCompact ? 10.5 : 11.5)
      .attr('font-weight', 600)
      .attr('fill', n26 > 0 ? PALETTE.y2026 : PALETTE.zero)
      .text(n26 > 0 ? fmtPct(p26) : '0');

    // Interações hover + foco
    const node = rowG.node();
    const resolveFocusYear = (evt) => {
      const svgRect = svg.node().getBoundingClientRect();
      const relX = evt.clientX - svgRect.left;
      if (relX < leftOriginX) return 2022;
      if (relX > rightOriginX) return 2026;
      return null;
    };

    rowG
      .on('mouseenter', (evt) => showTooltip(bin, node, resolveFocusYear(evt), evt.clientX))
      .on('mousemove', (evt) => showTooltip(bin, node, resolveFocusYear(evt), evt.clientX))
      .on('mouseleave', () => hideTooltip())
      .on('focus', () => showTooltip(bin, node, null, null))
      .on('blur', () => hideTooltip())
      .on('keydown', (evt) => {
        if (evt.key === 'Escape') hideTooltip();
      });
  });

  // Linha horizontal divisória do piso legal (30%)
  const quotaG = svg.append('g').attr('class', 'h1-quota-rule');
  quotaG.append('line')
    .attr('x1', 4)
    .attr('x2', width - 4)
    .attr('y1', quotaLineY)
    .attr('y2', quotaLineY)
    .attr('stroke', PALETTE.warn)
    .attr('stroke-width', 1.75)
    .attr('stroke-dasharray', '6,4');

  const pillW = isCompact ? 112 : 134;
  quotaG.append('rect')
    .attr('x', centerX - pillW / 2)
    .attr('y', quotaLineY - 9.5)
    .attr('width', pillW)
    .attr('height', 19)
    .attr('rx', 9.5)
    .attr('ry', 9.5)
    .attr('fill', PALETTE.warn);

  quotaG.append('text')
    .attr('x', centerX)
    .attr('y', quotaLineY + 3.5)
    .attr('text-anchor', 'middle')
    .attr('font-size', isCompact ? 9.5 : 10.5)
    .attr('font-weight', 700)
    .attr('fill', PALETTE.warnText)
    .text('Piso legal: 30%');

  // Eixos inferiores espelhados simétricos
  const fmtTick = (t) => `${t}%`;

  const leftAxisG = svg.append('g').attr('class', 'h1-axis h1-axis-left');
  leftAxisG.append('line')
    .attr('x1', sideLabelPad).attr('x2', leftOriginX)
    .attr('y1', plotBottom).attr('y2', plotBottom)
    .attr('stroke', PALETTE.axis);

  const rightAxisG = svg.append('g').attr('class', 'h1-axis h1-axis-right');
  rightAxisG.append('line')
    .attr('x1', rightOriginX).attr('x2', rightOriginX + halfPlotW)
    .attr('y1', plotBottom).attr('y2', plotBottom)
    .attr('stroke', PALETTE.axis);

  for (const t of ticks) {
    const xl = xLeft(t);
    leftAxisG.append('line')
      .attr('x1', xl).attr('x2', xl)
      .attr('y1', plotBottom).attr('y2', plotBottom + 5)
      .attr('stroke', PALETTE.axis);
    leftAxisG.append('text')
      .attr('class', 'h1-axis-tick')
      .attr('x', xl)
      .attr('y', plotBottom + 17)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('fill', PALETTE.muted)
      .text(fmtTick(t));

    const xr = xRight(t);
    rightAxisG.append('line')
      .attr('x1', xr).attr('x2', xr)
      .attr('y1', plotBottom).attr('y2', plotBottom + 5)
      .attr('stroke', PALETTE.axis);
    rightAxisG.append('text')
      .attr('class', 'h1-axis-tick')
      .attr('x', xr)
      .attr('y', plotBottom + 17)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('fill', PALETTE.muted)
      .text(fmtTick(t));
  }

  svg.append('text')
    .attr('x', centerX)
    .attr('y', height - 6)
    .attr('text-anchor', 'middle')
    .attr('font-size', isCompact ? 9.5 : 10.5)
    .attr('fill', PALETTE.muted)
    .text(
      isCompact
        ? '% das chapas do ano (escalas simétricas)'
        : `% das chapas ${isApto ? 'aptas' : 'registradas'} de cada ano (escalas espelhadas idênticas)`,
    );
}
