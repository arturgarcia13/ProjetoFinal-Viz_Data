import * as d3 from 'd3';
import { SEMANTIC_PALETTE } from './palette.js';
import { createChartTooltip, fmtInt, fmtPct, fmtSignedPP } from './tooltip.js';

const PALETTE = {
  y2022: SEMANTIC_PALETTE.y2022,
  y2026: SEMANTIC_PALETTE.y2026,
  warn: SEMANTIC_PALETTE.alert,
  warnText: '#001A12',
  floorBg: '#005C40',
  floorPill: SEMANTIC_PALETTE.floor,
  floorPillText: '#003D2B',
  ok: SEMANTIC_PALETTE.ok,
  ink: SEMANTIC_PALETTE.ink,
  muted: SEMANTIC_PALETTE.muted,
  zero: 'rgba(255, 255, 255, 0.72)',
  grid: SEMANTIC_PALETTE.grid,
  axis: SEMANTIC_PALETTE.subtle,
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
    <p class="chart-tip-hint">Clique na faixa para filtrar os partidos nos gráficos seguintes</p>
  `;
}

/**
 * H1 — Histograma Espelhado (Butterfly Chart) 2022 vs. 2026:
 * - Cores temporais dedicadas (Branco 2022 vs. Ciano 2026; Laranja para Piso 30%)
 * - Visão coordenada: clique em uma faixa filtra os gráficos seguintes (clique de novo ou no fundo limpa)
 * - Gaveta analítica "Quem está abaixo de 30%?" com reincidência e Registradas → Aptas
 */
export function renderH1Histogram(
  container,
  h1Comparison,
  {
    width = 700,
    mode = 'reg',
    selectedBinId = null,
    onSelectBin = null,
    onSelectParty = null,
  } = {},
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

  const centerW = isCompact ? 80 : 96;
  const sideLabelPad = isCompact ? 38 : 50;
  const marginTop = 34;
  const marginBottom = 42;
  const rowStep = 42;
  const quotaGap = 24;
  const barH = 24;

  const halfPlotW = Math.max(70, (width - centerW - sideLabelPad * 2) / 2);
  const leftOriginX = sideLabelPad + halfPlotW;
  const rightOriginX = leftOriginX + centerW;
  const centerX = leftOriginX + centerW / 2;

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

  if (onSelectBin) {
    svg.on('click', (evt) => {
      if (selectedBinId && !evt.target.closest('.h1-row')) {
        onSelectBin(null);
      }
    });
  }

  // Cabeçalhos das 3 colunas
  const hdrG = svg.append('g').attr('class', 'h1-col-headers');
  hdrG.append('text')
    .attr('x', leftOriginX)
    .attr('y', 16)
    .attr('text-anchor', 'end')
    .attr('font-size', isCompact ? 11 : 12.5)
    .attr('font-weight', 700)
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
    .attr('font-weight', 700)
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

  // Destaque suave na faixa crítica (30%–33,3%) e anotações diretas (FT style)
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

  if (!isCompact) {
    const ge40_22 = (isApto ? h1Comparison?.byYear?.[2022]?.pctGe40Apto : h1Comparison?.byYear?.[2022]?.pctGe40) || 0;
    const ge40_26 = (isApto ? h1Comparison?.byYear?.[2026]?.pctGe40Apto : h1Comparison?.byYear?.[2026]?.pctGe40) || 0;
    const ge40LeftBound = Math.max(
      xRight(isApto ? (bins[0]?.y2026?.aptoPct || 0) : (bins[0]?.y2026?.regPct || 0)),
      xRight(isApto ? (bins[1]?.y2026?.aptoPct || 0) : (bins[1]?.y2026?.regPct || 0)),
    ) + 54;
    if (width - ge40LeftBound >= 145) {
      svg.append('text')
        .attr('class', 'h1-annot-ge40')
        .attr('x', width - 10)
        .attr('y', rowY(0) + barH - 2)
        .attr('text-anchor', 'end')
        .attr('font-size', 10)
        .attr('font-weight', 700)
        .attr('fill', PALETTE.ok)
        .text(`Faixas ≥ 40%: ${fmtPct(ge40_22 * 100)} → ${fmtPct(ge40_26 * 100)}`);
    }

    if (floorIdx >= 0) {
      const floorBin = bins[floorIdx];
      const f26 = isApto ? floorBin.y2026.aptoPct : floorBin.y2026.regPct;
      const fDelta = isApto ? floorBin.deltaAptoPP : floorBin.deltaRegPP;
      if (width - (xRight(f26) + 52) >= 92) {
        svg.append('text')
          .attr('class', 'h1-annot-floor')
          .attr('x', width - 10)
          .attr('y', rowY(floorIdx) + barH / 2 + 3.5)
          .attr('text-anchor', 'end')
          .attr('font-size', 9.5)
          .attr('font-weight', 700)
          .attr('fill', PALETTE.floorPill)
          .text(`Teto · ${fmtSignedPP(fDelta)}`);
      }
    }
  }

  function showTooltip(bin, rowEl, focusYear, clientX = null) {
    const evt = clientX != null ? { clientX } : null;
    tipCtrl.show(rowEl, buildTooltipHtml(bin, mode, focusYear), evt);
  }

  function hideTooltip() {
    tipCtrl.hide();
  }

  const rowsG = svg.append('g').attr('class', 'h1-rows');

  bins.forEach((bin, i) => {
    const y = rowY(i);
    const n22 = isApto ? bin.y2022.aptoN : bin.y2022.regN;
    const p22 = isApto ? bin.y2022.aptoPct : bin.y2022.regPct;
    const n26 = isApto ? bin.y2026.aptoN : bin.y2026.regN;
    const p26 = isApto ? bin.y2026.aptoPct : bin.y2026.regPct;

    const w22 = Math.max(0, leftOriginX - xLeft(p22));
    const w26 = Math.max(0, xRight(p26) - rightOriginX);
    const isSelected = selectedBinId === bin.id;
    const isDimmed = Boolean(selectedBinId && !isSelected);

    const rowG = rowsG.append('g')
      .attr('class', `h1-row${isSelected ? ' is-bin-selected' : ''}`)
      .attr('data-bin', bin.id)
      .attr('tabindex', 0)
      .attr('role', onSelectBin ? 'button' : 'group')
      .attr('aria-pressed', isSelected ? 'true' : 'false')
      .attr(
        'aria-label',
        `Faixa ${bin.label}: 2022 ${n22} chapas (${fmtPct(p22)}); 2026 ${n26} chapas (${fmtPct(p26)})`,
      )
      .style('opacity', isDimmed ? 0.34 : 1);

    rowG.append('rect')
      .attr('class', 'h1-row-hit')
      .attr('x', 4)
      .attr('y', y - 5)
      .attr('width', width - 8)
      .attr('height', barH + 10)
      .attr('rx', 6)
      .attr('fill', isSelected ? 'rgba(92, 225, 230, 0.14)' : 'transparent')
      .attr('stroke', isSelected ? PALETTE.y2026 : 'none')
      .attr('stroke-width', isSelected ? 1.5 : 0);

    // Barra esquerda (2022 — Branco / vazado sutil)
    if (w22 > 0) {
      rowG.append('rect')
        .attr('class', 'h1-bar-2022')
        .attr('x', xLeft(p22))
        .attr('y', y)
        .attr('width', Math.max(2, w22))
        .attr('height', barH)
        .attr('rx', 3)
        .attr('fill', PALETTE.y2022)
        .attr('fill-opacity', bin.zone === 'below' ? 0.85 : 0.94);
    }

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
    } else if (bin.zone === 'below') {
      rowG.append('rect')
        .attr('x', leftOriginX + 8)
        .attr('y', y + 1)
        .attr('width', centerW - 16)
        .attr('height', barH - 2)
        .attr('rx', 11)
        .attr('ry', 11)
        .attr('fill', PALETTE.warn);
    }

    rowG.append('text')
      .attr('class', 'h1-center-label')
      .attr('x', centerX)
      .attr('y', y + barH / 2 + 4)
      .attr('text-anchor', 'middle')
      .attr('font-size', isCompact ? 10.5 : 11.5)
      .attr('font-weight', (bin.zone === 'floor' || bin.zone === 'below') ? 700 : 600)
      .attr('fill', bin.zone === 'floor'
        ? PALETTE.floorPillText
        : (bin.zone === 'below' ? PALETTE.warnText : PALETTE.ink))
      .text(bin.label);

    // Barra direita (2026 — Ciano)
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

    rowG.append('text')
      .attr('class', 'h1-tip-label')
      .attr('x', xRight(p26) + 6)
      .attr('y', y + barH / 2 + 4)
      .attr('text-anchor', 'start')
      .attr('font-size', isCompact ? 10.5 : 11.5)
      .attr('font-weight', 600)
      .attr('fill', n26 > 0 ? PALETTE.y2026 : PALETTE.zero)
      .text(n26 > 0 ? fmtPct(p26) : '0');

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
      .on('click', (evt) => {
        evt.stopPropagation();
        if (onSelectBin) onSelectBin(bin.id);
      })
      .on('keydown', (evt) => {
        if (evt.key === 'Escape') hideTooltip();
        if ((evt.key === 'Enter' || evt.key === ' ') && onSelectBin) {
          evt.preventDefault();
          onSelectBin(bin.id);
        }
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

  // Gaveta explicativa: Quem está abaixo de 30%?
  const lt30 = h1Comparison.lt30Details;
  if (lt30) {
    const d22 = lt30.byYear[2022];
    const d26 = lt30.byYear[2026];
    const drawer = document.createElement('details');
    drawer.className = 'h1-lt30-drawer';

    const summary = document.createElement('summary');
    summary.textContent = `Quem está abaixo de 30%? · 2022: ${fmtPct(d22.regPct)} → ${fmtPct(d22.aptoPct)} (${d22.aptoCount} aptas) | 2026: ${fmtPct(d26.regPct)} → ${fmtPct(d26.aptoPct)} (${d26.aptoCount} aptas)`;
    drawer.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'h1-lt30-body';

    const top22Str = d22.topPartiesReg.slice(0, 5).map((x) => `${x.party} (${x.count})`).join(', ') || '—';
    const top26Str = d26.topPartiesReg.slice(0, 5).map((x) => `${x.party} (${x.count})`).join(', ') || '—';
    const delta22 = `${d22.deltaRegToAptoPP >= 0 ? '+' : ''}${d22.deltaRegToAptoPP.toFixed(1).replace('.', ',')} p.p.`;
    const delta26 = `${d26.deltaRegToAptoPP >= 0 ? '+' : ''}${d26.deltaRegToAptoPP.toFixed(1).replace('.', ',')} p.p.`;

    body.innerHTML = `
      <p><strong>Por quê caem abaixo de 30%?</strong> Quase todas as chapas registradas abaixo da cota ficam entre <strong>25% e 29,9%</strong> (${d22.nearFloorRegCount}/${d22.regCount} em 2022; ${d26.nearFloorRegCount}/${d26.regCount} em 2026), por falta de 1–2 nomes ou arredondamento no limite. Ao filtrar para <strong>Aptas</strong>, inaptidões derrubaram <strong>${fmtPct(d22.pctDroppedOfReg)} (${d22.droppedByInapto} chapas)</strong> em 2022 (${delta22} na faixa &lt;30%) e <strong>${fmtPct(d26.pctDroppedOfReg)} (${d26.droppedByInapto} chapas)</strong> em 2026 (${delta26}).</p>
      <p><strong>Quem são e reincidência:</strong> No registro, <strong>${lt30.sameSlateRepeats} chapas idênticas (UF × Cargo × Partido)</strong> repetiram &lt;30% nos dois anos. Porém, <strong>${lt30.repeatPartiesReg.length} partidos</strong> repetiram nacionalmente em UFs diferentes — 2022: ${top22Str} · 2026: ${top26Str}.</p>
    `;

    if (lt30.repeatPartiesReg.length > 0 && onSelectParty) {
      const btnRow = document.createElement('div');
      btnRow.className = 'h1-repeat-parties';
      const lbl = document.createElement('span');
      lbl.textContent = 'Partidos reincidentes (<30% no registro em 2022 e 2026):';
      btnRow.appendChild(lbl);
      for (const rp of lt30.repeatPartiesReg) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'h1-repeat-btn';
        b.textContent = `${rp.party} (${rp.count2022}→${rp.count2026})`;
        b.addEventListener('click', () => onSelectParty(rp.party));
        btnRow.appendChild(b);
      }
      body.appendChild(btnRow);
    }

    drawer.appendChild(body);
    container.appendChild(drawer);
  }
}
