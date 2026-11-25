import * as d3 from 'd3';
import {
  bindTooltipEvents,
  buildTooltipCard,
  createChartTooltip,
  fmtBrl,
  fmtInt,
} from './tooltip.js';

const COLORS = {
  favM: '#FF7AE5',
  favF: '#FCE34D',
  equal: '#FFFFFF',
  capped: '#FF5E2B',
  grid: 'rgba(255, 255, 255, 0.14)',
  zeroAxis: '#FFFFFF',
  muted: 'rgba(255, 255, 255, 0.86)',
};

function fmtFactor(row) {
  if (row.direction === 'equal') return '1,0×';
  const base = row.factor >= 10
    ? `${Math.round(row.factor)}×`
    : `${row.factor.toFixed(1).replace('.', ',')}×`;
  return row.capped ? `${base}+` : base;
}

/**
 * DivergentChart — Gráfico Divergente Ancorado no Zero / Paridade (Igual · 1×).
 * Expande em duas direções: ← Mais para Homens vs. Mais para Mulheres →
 * com marcadores claros de magnitude (2×, 5×, 10×, 15×).
 */
export function renderDivergentChart(
  container,
  divergentData,
  { width = 700, onSelectParty = null } = {},
) {
  container.innerHTML = '';
  const rows = divergentData?.rows || [];
  if (rows.length === 0) {
    container.innerHTML = '<p class="chart-empty">Sem partidos com amostra mínima (≥5 candidatas e ≥5 candidatos) neste recorte.</p>';
    return;
  }

  const cap = divergentData.cap || 15;
  const maxLog = Math.log2(cap);
  const isCompact = width < 480;

  const margin = {
    top: 46,
    right: isCompact ? 34 : 52,
    bottom: 44,
    left: isCompact ? 92 : 114,
  };
  const rowH = 27;
  const plotW = Math.max(180, width - margin.left - margin.right);
  const plotH = rows.length * rowH;
  const height = margin.top + plotH + margin.bottom;

  const x = d3.scaleLinear().domain([-maxLog, maxLog]).range([margin.left, margin.left + plotW]);
  const y = d3.scaleBand().domain(rows.map((r) => r.party)).range([margin.top, margin.top + plotH]).padding(0.28);
  const zeroX = x(0);

  const tickValues = [
    { v: -Math.log2(15), label: '15×' },
    { v: -Math.log2(10), label: '10×' },
    { v: -Math.log2(5), label: '5×' },
    { v: -Math.log2(2), label: '2×' },
    { v: 0, label: 'Igual' },
    { v: Math.log2(2), label: '2×' },
    { v: Math.log2(5), label: '5×' },
    { v: Math.log2(10), label: '10×' },
    { v: Math.log2(15), label: '15×' },
  ].filter((t) => !isCompact || Math.abs(t.v) === 0 || Math.abs(t.v) === Math.log2(5) || Math.abs(t.v) === Math.log2(15));

  const tipCtrl = createChartTooltip(container);
  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('class', 'divergent-svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', width)
    .attr('height', height)
    .attr('role', 'img')
    .attr('aria-label', 'Gráfico divergente da disparidade mediana de receitas entre homens e mulheres por partido');

  // Rótulos direcionais com setas nas extremidades (regra do UX System)
  const dirG = svg.append('g').attr('class', 'div-direction-labels');
  dirG.append('text')
    .attr('x', margin.left)
    .attr('y', 18)
    .attr('text-anchor', 'start')
    .attr('font-size', isCompact ? 10.5 : 12)
    .attr('font-weight', 700)
    .attr('fill', COLORS.favM)
    .text('← Mais para Homens');

  dirG.append('text')
    .attr('x', zeroX)
    .attr('y', 18)
    .attr('text-anchor', 'middle')
    .attr('font-size', isCompact ? 10 : 11)
    .attr('font-weight', 700)
    .attr('fill', COLORS.equal)
    .text('Igual (1×)');

  dirG.append('text')
    .attr('x', margin.left + plotW)
    .attr('y', 18)
    .attr('text-anchor', 'end')
    .attr('font-size', isCompact ? 10.5 : 12)
    .attr('font-weight', 700)
    .attr('fill', COLORS.favF)
    .text('Mais para Mulheres →');

  // Grade vertical e linha central "Igual"
  const gridG = svg.append('g').attr('class', 'div-grid');
  for (const t of tickValues) {
    const tx = x(t.v);
    const isZero = t.v === 0;
    gridG.append('line')
      .attr('x1', tx).attr('x2', tx)
      .attr('y1', margin.top - 8).attr('y2', margin.top + plotH + 4)
      .attr('stroke', isZero ? COLORS.zeroAxis : COLORS.grid)
      .attr('stroke-width', isZero ? 1.8 : 1)
      .attr('stroke-dasharray', isZero ? null : '3,3');

    gridG.append('text')
      .attr('class', isZero ? 'div-equal-tick' : 'div-mag-tick')
      .attr('x', tx)
      .attr('y', margin.top + plotH + 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', isZero ? 11 : 10)
      .attr('font-weight', isZero ? 700 : 600)
      .attr('fill', isZero ? COLORS.equal : COLORS.muted)
      .text(t.label);
  }

  // Rótulos de partido à esquerda
  const labelsG = svg.append('g').attr('class', 'div-party-labels');
  rows.forEach((r) => {
    labelsG.append('text')
      .attr('x', margin.left - 8)
      .attr('y', y(r.party) + y.bandwidth() / 2 + 4)
      .attr('text-anchor', 'end')
      .attr('font-size', 11.5)
      .attr('font-weight', 600)
      .attr('fill', '#FFFFFF')
      .text(r.party);
  });

  // Barras divergentes
  const barsG = svg.append('g').attr('class', 'div-bars');
  const modeLabel = divergentData.mode === 'pub'
    ? 'Fundo Público (FEFC + FP)'
    : (divergentData.mode === 'total' ? 'Receita Total' : 'Recursos Privados/Próprios');

  rows.forEach((r) => {
    const barY = y(r.party);
    const barH = y.bandwidth();
    const targetX = x(r.signedLog);
    const rectX = Math.min(zeroX, targetX);
    const rectW = Math.max(3, Math.abs(targetX - zeroX));
    const fill = r.direction === 'equal'
      ? COLORS.equal
      : (r.direction === 'F' ? COLORS.favF : (r.capped ? COLORS.capped : COLORS.favM));

    const rect = barsG.append('rect')
      .attr('class', 'div-bar')
      .attr('data-party', r.party)
      .attr('x', r.direction === 'equal' ? zeroX - 2 : rectX)
      .attr('y', barY)
      .attr('width', r.direction === 'equal' ? 4 : rectW)
      .attr('height', barH)
      .attr('rx', 2.5)
      .attr('fill', fill)
      .attr('tabindex', 0)
      .attr('role', onSelectParty ? 'button' : 'img')
      .attr(
        'aria-label',
        `${r.party}: ${r.direction === 'M' ? `${fmtFactor(r)} mais para homens` : (r.direction === 'F' ? `${fmtFactor(r)} mais para mulheres` : 'paridade 1×')} (Mulheres ${fmtBrl(r.valF)} vs. Homens ${fmtBrl(r.valM)})`,
      )
      .style('cursor', onSelectParty ? 'pointer' : 'default');

    const labelAnchor = r.signedLog < 0 ? 'end' : 'start';
    const labelX = r.signedLog < 0 ? rectX - 6 : rectX + rectW + 6;
    barsG.append('text')
      .attr('x', r.direction === 'equal' ? zeroX + 8 : labelX)
      .attr('y', barY + barH / 2 + 3.5)
      .attr('text-anchor', r.direction === 'equal' ? 'start' : labelAnchor)
      .attr('font-size', 10.5)
      .attr('font-weight', 700)
      .attr('fill', fill)
      .text(fmtFactor(r));

    const el = rect.node();
    if (onSelectParty) {
      el.addEventListener('click', () => onSelectParty(r.party));
      el.addEventListener('keydown', (evt) => {
        if (evt.key === 'Enter' || evt.key === ' ') {
          evt.preventDefault();
          onSelectParty(r.party);
        }
      });
    }

    bindTooltipEvents(el, tipCtrl, () => {
      const badgeTone = r.direction === 'M' ? 'below' : (r.direction === 'F' ? 'above' : 'neutral');
      const badgeText = r.direction === 'M'
        ? `${fmtFactor(r)} pró-homens`
        : (r.direction === 'F' ? `${fmtFactor(r)} pró-mulheres` : 'Paridade (~1×)');
      const ratioText = r.zeroSide === 'F'
        ? 'F = R$ 0'
        : (r.zeroSide === 'M' ? 'M = R$ 0' : fmtFactor(r));
      return buildTooltipCard({
        title: `Partido ${r.party}`,
        badge: badgeText,
        badgeTone,
        columns: [modeLabel, 'Mulheres', 'Homens', 'Razão'],
        rows: [
          {
            cells: [
              'Mediana',
              fmtBrl(r.valF),
              fmtBrl(r.valM),
              ratioText,
            ],
          },
          {
            cells: [
              'Candidaturas',
              fmtInt(r.nF),
              fmtInt(r.nM),
              fmtInt(r.total),
            ],
          },
        ],
        hint: onSelectParty ? 'Clique na barra para filtrar o partido' : '',
      });
    }, { focusable: true });
  });

  svg.append('text')
    .attr('x', zeroX)
    .attr('y', height - 6)
    .attr('text-anchor', 'middle')
    .attr('font-size', 10.5)
    .attr('fill', COLORS.muted)
    .text(`Razão entre medianas (${modeLabel}) · Escala log₂ ancorada em Igual (1×), teto visual 15×`);
}
