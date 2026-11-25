import * as d3 from 'd3';
import { SEMANTIC_PALETTE } from './palette.js';
import {
  bindTooltipEvents,
  buildTooltipCard,
  createChartTooltip,
  fmtBrl,
  fmtInt,
} from './tooltip.js';

function fmtSignedK(val) {
  const k = Math.round(val / 1000);
  if (k === 0) return 'R$ 0';
  const sign = k > 0 ? '+' : '−';
  return `${sign}R$ ${Math.abs(k).toLocaleString('pt-BR')} mil`;
}

/**
 * H2 — Dumbbell Temporal (2022 → 2026) da diferença sinalizada de medianas (Δ = Mediana F − Mediana M) em Reais:
 * - Eixo Y: partidos ordenados pelo gap em 2026 (maior déficit feminino no topo → maior superávit na base)
 * - Eixo X: diferença em R$ mil ancorada em R$ 0
 * - Ponta vazada branca = 2022 · Ponta sólida ciano = 2026
 * - Aresta muda de cor quando mulheres ultrapassam homens em 2026 (Verde #00D09C vs. Laranja #FF5E2B)
 * - Clique em ponto/linha destaca sem colapsar; clicar de novo ou no fundo limpa
 */
export function renderH2Dumbbell(
  container,
  gapData,
  { width = 700, selectedParty = '', onSelectParty = null, onClearParty = null } = {},
) {
  container.innerHTML = '';
  const rows = gapData?.rows || [];

  if (rows.length === 0) {
    container.innerHTML = '<p class="chart-empty">Sem partidos com amostra mínima (≥5 candidatas e ≥5 candidatos em 2026) para comparar a evolução do gap.</p>';
    return;
  }

  const isCompact = width < 500;
  const margin = {
    top: 52,
    right: isCompact ? 76 : 106,
    bottom: 42,
    left: isCompact ? 102 : 124,
  };
  const legItems = [
    { kind: 'ring', stroke: SEMANTIC_PALETTE.y2022, label: '2022' },
    { kind: 'dot', fill: SEMANTIC_PALETTE.y2026, label: '2026' },
    { kind: 'line', stroke: SEMANTIC_PALETTE.ok, label: 'Mulheres > Homens (2026)' },
    { kind: 'line', stroke: SEMANTIC_PALETTE.alert, label: 'Homens > Mulheres (2026)' },
  ];
  const legStartX = isCompact ? 10 : margin.left;
  let lxCalc = legStartX;
  let lyCalc = 12;
  const legPositions = legItems.map((item) => {
    const itemW = item.label.length * 5.9 + 24;
    if (lxCalc > legStartX && lxCalc + itemW > width - 10) {
      lxCalc = legStartX;
      lyCalc += 15;
    }
    const pos = { item, x: lxCalc, y: lyCalc };
    lxCalc += itemW + 8;
    return pos;
  });

  const dirY = lyCalc + 20;
  margin.top = dirY + 14;

  const rowH = 30;
  const plotW = Math.max(160, width - margin.left - margin.right);
  const plotH = rows.length * rowH;
  const height = margin.top + plotH + margin.bottom;

  const vals = [];
  for (const r of rows) {
    if (r.gap2022 !== null) vals.push(r.gap2022 / 1000);
    vals.push(r.gap2026 / 1000);
  }
  const minVal = Math.min(-40, d3.min(vals) ?? -40);
  const maxVal = Math.max(40, d3.max(vals) ?? 40);
  const pad = Math.max(15, (maxVal - minVal) * 0.08);

  const x = d3.scaleLinear()
    .domain([minVal - pad, maxVal + pad])
    .nice()
    .range([margin.left, margin.left + plotW]);

  const y = d3.scaleBand()
    .domain(rows.map((r) => r.party))
    .range([margin.top, margin.top + plotH])
    .padding(0.28);

  const zeroX = x(0);

  const tipCtrl = createChartTooltip(container);
  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('class', 'h2-gap-svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', width)
    .attr('height', height)
    .attr('role', 'img')
    .attr('aria-label', 'Diferença entre mediana de receitas de mulheres e homens por partido em 2022 e 2026')
    .style('font-family', 'Inter, system-ui, sans-serif');

  svg.on('click', (evt) => {
    if (selectedParty && !evt.target.closest('.h2-row') && onClearParty) {
      onClearParty();
    }
  });

  // Marcadores de seta direcional (2022 → 2026)
  const defs = svg.append('defs');
  [
    { id: 'h2-arrow-ok', color: SEMANTIC_PALETTE.ok },
    { id: 'h2-arrow-alert', color: SEMANTIC_PALETTE.alert },
  ].forEach((m) => {
    defs.append('marker')
      .attr('id', m.id)
      .attr('viewBox', '0 0 8 8')
      .attr('refX', 6)
      .attr('refY', 4)
      .attr('markerWidth', 5.2)
      .attr('markerHeight', 5.2)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,1 L7,4 L0,7 Z')
      .attr('fill', m.color);
  });

  // Legenda compacta no topo (sem colisão com cabeçalhos direcionais)
  const legG = svg.append('g').attr('class', 'h2-legend');
  for (const { item, x: ix, y: iy } of legPositions) {
    const g = legG.append('g').attr('transform', `translate(${ix}, ${iy})`);
    if (item.kind === 'ring') {
      g.append('circle').attr('cx', 5).attr('cy', 0).attr('r', 4.2)
        .attr('fill', SEMANTIC_PALETTE.surface).attr('stroke', item.stroke).attr('stroke-width', 2);
    } else if (item.kind === 'dot') {
      g.append('circle').attr('cx', 5).attr('cy', 0).attr('r', 4.5)
        .attr('fill', item.fill);
    } else {
      g.append('line').attr('x1', 0).attr('x2', 12).attr('y1', 0).attr('y2', 0)
        .attr('stroke', item.stroke).attr('stroke-width', 2.8);
    }
    g.append('text').attr('x', 16).attr('y', 3.5).attr('font-size', 10).attr('fill', SEMANTIC_PALETTE.muted).text(item.label);
  }

  // Cabeçalhos direcionais
  svg.append('text')
    .attr('x', margin.left)
    .attr('y', dirY)
    .attr('text-anchor', 'start')
    .attr('font-size', isCompact ? 9.5 : 10.5)
    .attr('font-weight', 700)
    .attr('fill', SEMANTIC_PALETTE.men)
    .text(isCompact ? '← Homens' : '← Homens ganham mais');

  if (!isCompact) {
    svg.append('text')
      .attr('x', zeroX)
      .attr('y', dirY)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10.5)
      .attr('font-weight', 700)
      .attr('fill', SEMANTIC_PALETTE.ink)
      .text('R$ 0');
  }

  svg.append('text')
    .attr('x', margin.left + plotW)
    .attr('y', dirY)
    .attr('text-anchor', 'end')
    .attr('font-size', isCompact ? 9.5 : 10.5)
    .attr('font-weight', 700)
    .attr('fill', SEMANTIC_PALETTE.women)
    .text(isCompact ? 'Mulheres →' : 'Mulheres ganham mais →');

  // Grade e eixo X
  const xTicks = x.ticks(isCompact ? 4 : 6);
  const gridG = svg.append('g').attr('class', 'h2-grid');
  for (const t of xTicks) {
    const tx = x(t);
    const isZero = Math.abs(t) < 0.01;
    gridG.append('line')
      .attr('x1', tx).attr('x2', tx)
      .attr('y1', margin.top - 4).attr('y2', margin.top + plotH + 4)
      .attr('stroke', isZero ? SEMANTIC_PALETTE.ink : SEMANTIC_PALETTE.grid)
      .attr('stroke-width', isZero ? 1.6 : 1)
      .attr('stroke-dasharray', isZero ? null : '3,3');

    gridG.append('text')
      .attr('x', tx)
      .attr('y', margin.top + plotH + 18)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('font-weight', isZero ? 700 : 500)
      .attr('fill', isZero ? SEMANTIC_PALETTE.ink : SEMANTIC_PALETTE.muted)
      .text(t === 0 ? 'R$ 0' : `${t > 0 ? '+' : '−'}${Math.abs(t)}k`);
  }

  // Cabeçalho da coluna de diferença em 2026
  svg.append('text')
    .attr('x', width - 6)
    .attr('y', dirY)
    .attr('text-anchor', 'end')
    .attr('font-size', 10)
    .attr('font-weight', 700)
    .attr('fill', SEMANTIC_PALETTE.y2026)
    .text('Gap 2026');

  const rowsG = svg.append('g').attr('class', 'h2-rows');

  rows.forEach((r) => {
    const cy = y(r.party) + y.bandwidth() / 2;
    const isSel = selectedParty === r.party;
    const isDimmed = Boolean(selectedParty && !isSel);
    const edgeColor = r.womenAhead2026 ? SEMANTIC_PALETTE.ok : SEMANTIC_PALETTE.alert;

    const rowG = rowsG.append('g')
      .attr('class', `h2-row${isSel ? ' is-selected' : ''}`)
      .attr('data-party', r.party)
      .attr('tabindex', 0)
      .attr('role', onSelectParty ? 'button' : 'group')
      .attr('aria-label', `${r.party}: gap 2026 ${fmtSignedK(r.gap2026)}`)
      .style('cursor', onSelectParty ? 'pointer' : 'default')
      .style('opacity', isDimmed ? 0.25 : 1);

    // Hit box transparente para facilitar clique e desmarcar
    rowG.append('rect')
      .attr('x', 2)
      .attr('y', cy - rowH / 2 + 1)
      .attr('width', width - 4)
      .attr('height', rowH - 2)
      .attr('rx', 4)
      .attr('fill', isSel ? 'rgba(14, 140, 147, 0.14)' : 'transparent');

    // Nome do partido no eixo Y
    rowG.append('text')
      .attr('x', margin.left - 8)
      .attr('y', cy + 4)
      .attr('text-anchor', 'end')
      .attr('font-size', isCompact ? 10.5 : 11.5)
      .attr('font-weight', isSel ? 700 : 600)
      .attr('fill', isSel ? SEMANTIC_PALETTE.y2026 : SEMANTIC_PALETTE.ink)
      .text(r.party);

    const x26 = x(r.gap2026 / 1000);
    if (r.gap2022 !== null) {
      const x22 = x(r.gap2022 / 1000);
      const dx = x26 - x22;
      const dist = Math.abs(dx);
      const x2Line = dist > 16 ? x26 - Math.sign(dx) * 6 : x26;
      const lineEl = rowG.append('line')
        .attr('x1', x22)
        .attr('x2', x2Line)
        .attr('y1', cy)
        .attr('y2', cy)
        .attr('stroke', edgeColor)
        .attr('stroke-width', isSel ? 3.5 : 2.6)
        .attr('stroke-linecap', 'round');

      if (dist > 16) {
        lineEl.attr('marker-end', r.womenAhead2026 ? 'url(#h2-arrow-ok)' : 'url(#h2-arrow-alert)');
      }

      if (!isCompact && r.party === 'UNIÃO' && r.gap2022 < 0 && r.gap2026 > 50000 && x22 - margin.left >= 145) {
        rowG.append('text')
          .attr('class', 'h2-uniao-annot')
          .attr('x', x22 - 9)
          .attr('y', cy + 3.5)
          .attr('text-anchor', 'end')
          .attr('font-size', 9.2)
          .attr('font-weight', 600)
          .attr('fill', SEMANTIC_PALETTE.ok)
          .text('Piso p/ 99% F · M lidera P90 →');
      }

      rowG.append('circle')
        .attr('class', 'h2-dot-2022')
        .attr('cx', x22)
        .attr('cy', cy)
        .attr('r', isSel ? 5.8 : 4.8)
        .attr('fill', SEMANTIC_PALETTE.surface)
        .attr('stroke', SEMANTIC_PALETTE.y2022)
        .attr('stroke-width', 2.1);
    }

    rowG.append('circle')
      .attr('class', 'h2-dot-2026')
      .attr('cx', x26)
      .attr('cy', cy)
      .attr('r', isSel ? 6.5 : 5.5)
      .attr('fill', SEMANTIC_PALETTE.y2026)
      .attr('stroke', SEMANTIC_PALETTE.surface)
      .attr('stroke-width', 1.4);

    // Diferença em 2026 alinhada na coluna direita
    rowG.append('text')
      .attr('class', 'h2-gap-label')
      .attr('x', width - 6)
      .attr('y', cy + 4)
      .attr('text-anchor', 'end')
      .attr('font-size', isCompact ? 10 : 11)
      .attr('font-weight', 700)
      .attr('fill', edgeColor)
      .text(fmtSignedK(r.gap2026));

    const el = rowG.node();
    if (onSelectParty) {
      el.addEventListener('click', (evt) => {
        evt.stopPropagation();
        onSelectParty(r.party);
      });
      el.addEventListener('keydown', (evt) => {
        if (evt.key === 'Enter' || evt.key === ' ') {
          evt.preventDefault();
          onSelectParty(r.party);
        }
      });
    }

    bindTooltipEvents(el, tipCtrl, () => {
      const tone = r.womenAhead2026 ? 'above' : 'below';
      const badge = r.womenAhead2026 ? 'Mulheres > Homens (2026)' : 'Homens > Mulheres (2026)';
      const tipRows = [
        {
          cells: [
            '2026',
            fmtBrl(r.medF2026),
            fmtBrl(r.medM2026),
            fmtSignedK(r.gap2026),
          ],
        },
      ];
      if (r.gap2022 !== null) {
        tipRows.unshift({
          cells: [
            '2022',
            fmtBrl(r.medF2022),
            fmtBrl(r.medM2022),
            fmtSignedK(r.gap2022),
          ],
        });
      }
      tipRows.push({
        cells: [
          'Cand. 2026',
          fmtInt(r.nF2026),
          fmtInt(r.nM2026),
          r.deltaGap !== null ? `Evol. ${fmtSignedK(r.deltaGap)}` : '—',
        ],
      });
      return buildTooltipCard({
        title: `Partido ${r.party}`,
        badge,
        badgeTone: tone,
        columns: ['Ano', 'Mediana F', 'Mediana M', 'Δ (F − M)'],
        rows: tipRows,
        hint: onSelectParty ? 'Clique na linha para destacar/limpar o partido' : '',
      });
    }, { focusable: true });
  });

  svg.append('text')
    .attr('x', width / 2)
    .attr('y', height - 6)
    .attr('text-anchor', 'middle')
    .attr('font-size', isCompact ? 9.5 : 10.5)
    .attr('fill', SEMANTIC_PALETTE.muted)
    .text(isCompact ? 'Δ mediana (Mulheres − Homens) em R$ mil →' : 'Diferença entre mediana de receitas (Mulheres − Homens) em R$ mil →');
}
