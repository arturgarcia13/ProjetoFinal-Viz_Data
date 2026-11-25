import * as d3 from 'd3';
import { SEMANTIC_PALETTE } from './palette.js';
import {
  bindTooltipEvents,
  buildTooltipCard,
  createChartTooltip,
  fmtInt,
  fmtPct,
  fmtRatio,
} from './tooltip.js';

/**
 * H5 — Barras Agrupadas Horizontais em 3 Etapas (% Candidatas → % Votos Nominais → % Eleitas):
 * - Ordenado pela taxa de Eleitas (% Eleitas) decrescente
 * - Eixo Y com margem generosa para eliminar 100% qualquer sobreposição de siglas
 * - Clique em partido destaca sem colapsar; clicar de novo ou no fundo limpa
 */
export function renderH5Conversion(
  container,
  h5Data,
  { width = 700, selectedParty = '', onSelectParty = null, onClearParty = null } = {},
) {
  container.innerHTML = '';
  const topParties = h5Data?.byParty || [];

  if (topParties.length === 0) {
    container.innerHTML = '<p class="chart-empty">Sem partidos com cadeiras eleitas suficientes neste recorte.</p>';
    return;
  }

  const stageDefs = [
    { key: 'pctCandF', label: '1. Candidatas', color: SEMANTIC_PALETTE.cand },
    { key: 'pctVotosF', label: '2. Votos nominais', color: SEMANTIC_PALETTE.votes },
    { key: 'pctEleitasF', label: '3. Eleitas', color: SEMANTIC_PALETTE.elected },
  ];

  const isCompact = width < 460;
  const leftMargin = isCompact ? 104 : 128;
  const rightMargin = isCompact ? 40 : 52;
  const legStartX = isCompact ? 8 : leftMargin;
  let lxCalc = legStartX;
  let lyCalc = 13;
  const legPositions = stageDefs.map((st) => {
    const iw = st.label.length * 5.9 + 20;
    if (lxCalc > legStartX && lxCalc + iw > width - 8) {
      lxCalc = legStartX;
      lyCalc += 15;
    }
    const pos = { st, x: lxCalc, y: lyCalc };
    lxCalc += iw + 8;
    return pos;
  });

  const bannerY = lyCalc + 10;
  const margin = {
    top: bannerY + 42,
    right: rightMargin,
    bottom: 36,
    left: leftMargin,
  };
  const groupH = 38;
  const barH = 8.5;
  const barGap = 2.5;
  const plotW = Math.max(150, width - margin.left - margin.right);
  const plotH = topParties.length * groupH;
  const height = margin.top + plotH + margin.bottom;

  const maxPct = Math.max(
    45,
    d3.max(topParties, (p) => Math.max(p.pctCandF, p.pctVotosF, p.pctEleitasF) * 100) || 50,
  );
  const x = d3.scaleLinear().domain([0, Math.min(100, Math.ceil((maxPct + 5) / 10) * 10)]).range([margin.left, margin.left + plotW]);
  const y = d3.scaleBand().domain(topParties.map((p) => p.party)).range([margin.top, margin.top + plotH]).padding(0.18);

  const tipCtrl = createChartTooltip(container);
  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('class', 'h5-conversion-svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', width)
    .attr('height', height)
    .attr('role', 'img')
    .attr('aria-label', 'Funil horizontal de conversão eleitoral por partido ordenado por taxa de eleitas')
    .style('font-family', 'Inter, system-ui, sans-serif');

  svg.on('click', (evt) => {
    if (selectedParty && !evt.target.closest('.h5-party-row') && onClearParty) {
      onClearParty();
    }
  });

  // Legenda no topo (com wrap seguro sem cortar no mobile)
  for (const { st, x: ix, y: iy } of legPositions) {
    const g = svg.append('g').attr('transform', `translate(${ix}, ${iy})`);
    g.append('rect').attr('x', 0).attr('y', -8).attr('width', 10).attr('height', 10).attr('rx', 2).attr('fill', st.color);
    g.append('text').attr('x', 14).attr('y', 0.5).attr('font-size', isCompact ? 9.5 : 10.5).attr('font-weight', 600).attr('fill', SEMANTIC_PALETTE.ink).text(st.label);
  }

  // Faixa-resumo do funil global (ajustada dentro do canvas no desktop e mobile)
  const dropUrnaPP = (h5Data.dropUrna || 0) * 100;
  const summaryTxt = isCompact
    ? `${fmtPct(h5Data.pctCandF * 100)} cand. → ${fmtPct(h5Data.pctVotosF * 100)} votos (${dropUrnaPP.toFixed(1).replace('.', ',')} p.p.) → ${fmtPct(h5Data.pctEleitasF * 100)} el.`
    : `Funil do recorte: ${fmtPct(h5Data.pctCandF * 100)} candidatas ──(${dropUrnaPP.toFixed(1).replace('.', ',')} p.p. na urna)──▶ ${fmtPct(h5Data.pctVotosF * 100)} votos → ${fmtPct(h5Data.pctEleitasF * 100)} eleitas`;
  const boxX = isCompact ? 8 : margin.left;
  const boxW = isCompact ? width - 16 : plotW;
  svg.append('rect')
    .attr('x', boxX)
    .attr('y', bannerY)
    .attr('width', boxW)
    .attr('height', 20)
    .attr('rx', 4)
    .attr('fill', 'rgba(226, 72, 31, 0.14)')
    .attr('stroke', 'rgba(226, 72, 31, 0.45)')
    .attr('stroke-width', 0.8);
  svg.append('text')
    .attr('x', boxX + 8)
    .attr('y', bannerY + 13.5)
    .attr('font-size', isCompact ? 8.3 : 9.8)
    .attr('font-weight', 700)
    .attr('fill', '#FFD1C2')
    .text(summaryTxt);

  // Grade vertical e referência 30%
  const xTicks = x.ticks(isCompact ? 4 : 6);
  const gridG = svg.append('g').attr('aria-label', 'grid');
  for (const t of xTicks) {
    const tx = x(t);
    gridG.append('line')
      .attr('x1', tx).attr('x2', tx)
      .attr('y1', margin.top - 4).attr('y2', margin.top + plotH)
      .attr('stroke', t === 0 ? SEMANTIC_PALETTE.subtle : SEMANTIC_PALETTE.grid)
      .attr('stroke-width', 1);
    gridG.append('text')
      .attr('x', tx)
      .attr('y', margin.top + plotH + 15)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('fill', SEMANTIC_PALETTE.muted)
      .text(`${t}%`);
  }

  if (x.domain()[1] >= 30) {
    const x30 = x(30);
    gridG.append('line')
      .attr('x1', x30).attr('x2', x30)
      .attr('y1', margin.top - 4).attr('y2', margin.top + plotH)
      .attr('stroke', SEMANTIC_PALETTE.ink)
      .attr('stroke-dasharray', '4,3')
      .attr('stroke-width', 1.4);
    gridG.append('text')
      .attr('x', x30 + 4)
      .attr('y', margin.top - 7)
      .attr('font-size', 9.5)
      .attr('font-weight', 700)
      .attr('fill', SEMANTIC_PALETTE.ink)
      .text('Piso 30%');
  }

  const rowsG = svg.append('g').attr('aria-label', 'party-rows');

  topParties.forEach((p, rowIdx) => {
    const gy = y(p.party);
    const isSel = selectedParty === p.party;
    const isDimmed = Boolean(selectedParty && !isSel);
    const totalBarsH = stageDefs.length * barH + (stageDefs.length - 1) * barGap;
    const startY = gy + (y.bandwidth() - totalBarsH) / 2;

    const rowG = rowsG.append('g')
      .attr('class', `h5-party-row${isSel ? ' is-selected' : ''}`)
      .attr('data-party', p.party)
      .attr('tabindex', 0)
      .attr('role', onSelectParty ? 'button' : 'group')
      .attr('aria-label', `${p.party}: ${fmtPct(p.pctCandF * 100)} candidatas, ${fmtPct(p.pctVotosF * 100)} votos, ${fmtPct(p.pctEleitasF * 100)} eleitas`)
      .style('cursor', onSelectParty ? 'pointer' : 'default')
      .style('opacity', isDimmed ? 0.25 : 1);

    rowG.append('rect')
      .attr('x', 2)
      .attr('y', gy - 2)
      .attr('width', width - 4)
      .attr('height', y.bandwidth() + 4)
      .attr('rx', 4)
      .attr('fill', isSel ? 'rgba(214, 63, 176, 0.14)' : 'transparent');

    // Sigla à esquerda no eixo Y (sem sobreposição!)
    rowG.append('text')
      .attr('class', 'h5-party-label')
      .attr('x', margin.left - 8)
      .attr('y', gy + y.bandwidth() / 2 + 4)
      .attr('text-anchor', 'end')
      .attr('font-size', isCompact ? 10.5 : 11.5)
      .attr('font-weight', isSel ? 700 : 600)
      .attr('fill', isSel ? SEMANTIC_PALETTE.elected : SEMANTIC_PALETTE.ink)
      .text(p.party);

    stageDefs.forEach((st, idx) => {
      const pct = p[st.key] * 100;
      const by = startY + idx * (barH + barGap);
      const bw = Math.max(1.5, x(pct) - margin.left);

      const bar = rowG.append('rect')
        .attr('class', `h5-bar h5-bar-${idx}`)
        .attr('data-party', p.party)
        .attr('x', margin.left)
        .attr('y', by)
        .attr('width', bw)
        .attr('height', barH)
        .attr('rx', 2)
        .attr('fill', st.color);

      if (idx === 2) {
        rowG.append('text')
          .attr('x', margin.left + bw + 5)
          .attr('y', by + barH - 0.5)
          .attr('font-size', 9.5)
          .attr('font-weight', 700)
          .attr('fill', SEMANTIC_PALETTE.elected)
          .attr('stroke', SEMANTIC_PALETTE.surface)
          .attr('stroke-width', 2.6)
          .attr('paint-order', 'stroke')
          .text(fmtPct(pct));
      } else if (rowIdx === 0 && (idx === 0 || !isCompact)) {
        rowG.append('text')
          .attr('x', margin.left + bw + 5)
          .attr('y', by + barH - 0.5)
          .attr('font-size', 8.5)
          .attr('font-weight', 600)
          .attr('fill', st.color)
          .attr('stroke', SEMANTIC_PALETTE.surface)
          .attr('stroke-width', 2.4)
          .attr('paint-order', 'stroke')
          .style('pointer-events', 'none')
          .text(fmtPct(pct));
      }

      bindTooltipEvents(bar.node(), tipCtrl, () => {
        const conv = p.pctCandF > 0 ? p.pctEleitasF / p.pctCandF : 0;
        const badgeTone = conv < 0.75 ? 'below' : 'above';
        return buildTooltipCard({
          title: `${p.party} · Funil de conversão`,
          badge: `${fmtInt(p.elTotal)} cadeiras · ${fmtRatio(conv)}`,
          badgeTone,
          rows: [
            {
              label: '1. Candidatas',
              value: fmtPct(p.pctCandF * 100),
              sub: `${fmtInt(p.nF)}/${fmtInt(p.nTotal)}`,
              focus: idx === 0,
            },
            {
              label: '2. Votos nominais',
              value: fmtPct(p.pctVotosF * 100),
              focus: idx === 1,
            },
            {
              label: '3. Eleitas',
              value: fmtPct(p.pctEleitasF * 100),
              sub: `${fmtInt(p.elF)}/${fmtInt(p.elTotal)}`,
              focus: idx === 2,
            },
          ],
          hint: onSelectParty ? 'Clique na barra para destacar/limpar o partido' : '',
        });
      });
    });

    const rowNode = rowG.node();
    if (onSelectParty) {
      rowNode.addEventListener('click', (evt) => {
        evt.stopPropagation();
        onSelectParty(p.party);
      });
      rowNode.addEventListener('keydown', (evt) => {
        if (evt.key === 'Enter' || evt.key === ' ') {
          evt.preventDefault();
          onSelectParty(p.party);
        }
      });
    }
  });

  svg.append('text')
    .attr('x', isCompact ? width / 2 : margin.left + plotW / 2)
    .attr('y', height - 4)
    .attr('text-anchor', 'middle')
    .attr('font-size', isCompact ? 9.5 : 10.5)
    .attr('fill', SEMANTIC_PALETTE.muted)
    .text(isCompact ? '% feminina — ordenado por % de Eleitas →' : 'Participação feminina (%) — ordenado pela taxa de Eleitas →');
}
