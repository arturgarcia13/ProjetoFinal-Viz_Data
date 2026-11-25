import * as d3 from 'd3';
import { IBGE_TO_UF, UF_NAMES } from '../data.js';
import {
  bindTooltipEvents,
  buildTooltipCard,
  createChartTooltip,
  fmtInt,
  fmtPct,
  fmtRatio,
} from './tooltip.js';

const STAGE_COLOR = {
  'Papel': '#FFFFFF',
  'Dinheiro': '#FCE34D',
  'Urna (Votos)': '#FF5E2B',
  'Urna (Cadeiras)': '#FF7AE5',
  'Integridade': '#FFB020',
  'Sem Vazamento Crítico': '#00B884',
  'Inconclusivo': '#245B49',
};

function bottleneckTone(bottleneck) {
  if (!bottleneck || bottleneck === 'Inconclusivo') return 'neutral';
  if (bottleneck === 'Sem Vazamento Crítico') return 'above';
  if (bottleneck === 'Integridade' || bottleneck === 'Papel') return 'floor';
  return 'below';
}

/**
 * H7 / H9 — Mapa Coroplético do Brasil por UF (etapa crítica ou taxa de sinais H7)
 */
export function renderUFMap(container, brUfGeo, h9Data, h7Data, {
  width = 520,
  mode = 'h9',
  selectedUF = '',
  allowedUFs = null,
  onSelectUF = null,
} = {}) {
  container.innerHTML = '';
  const height = 340;
  const tipCtrl = createChartTooltip(container);
  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', width)
    .attr('height', height)
    .style('font-family', 'Barlow, Inter, system-ui, sans-serif');

  const projection = d3.geoMercator().fitExtent([[16, 10], [width - 16, height - 56]], brUfGeo);
  const path = d3.geoPath(projection);

  const h9ByUf = new Map(h9Data.ufRows.map((u) => [u.key, u]));
  const h7ByUf = new Map(h7Data.byUf.map((u) => [u.uf, u]));
  const h7Scale = d3.scaleSequential(d3.interpolateRgbBasis(['#00805A', '#FCE34D', '#FF5E2B'])).domain([0, 0.12]);

  const ufPaths = svg.append('g')
    .selectAll('path')
    .data(brUfGeo.features)
    .join('path')
    .attr('d', path)
    .attr('fill', (d) => {
      const uf = IBGE_TO_UF[String(d.properties.codarea)];
      if (mode === 'h7') {
        const u = h7ByUf.get(uf);
        if (!u || u.inconclusive) return STAGE_COLOR['Inconclusivo'];
        return h7Scale(u.rate);
      }
      const u = h9ByUf.get(uf);
      return STAGE_COLOR[u?.bottleneck || 'Inconclusivo'] || STAGE_COLOR['Inconclusivo'];
    })
    .attr('fill-opacity', (d) => {
      if (!allowedUFs || allowedUFs.size === 0) return 1;
      const uf = IBGE_TO_UF[String(d.properties.codarea)];
      return allowedUFs.has(uf) ? 1 : 0.2;
    })
    .attr('stroke', (d) => {
      const uf = IBGE_TO_UF[String(d.properties.codarea)];
      return selectedUF === uf ? '#FFFFFF' : '#003D2B';
    })
    .attr('stroke-width', (d) => {
      const uf = IBGE_TO_UF[String(d.properties.codarea)];
      return selectedUF === uf ? 2.5 : 1;
    })
    .style('cursor', 'pointer')
    .on('click', (_, d) => {
      const uf = IBGE_TO_UF[String(d.properties.codarea)];
      if (uf && onSelectUF) onSelectUF(uf);
    });

  ufPaths.each(function (d) {
    const uf = IBGE_TO_UF[String(d.properties.codarea)];
    const name = UF_NAMES[uf] || uf;
    const isSelected = selectedUF === uf;

    bindTooltipEvents(
      this,
      tipCtrl,
      () => {
        if (mode === 'h7') {
          const u = h7ByUf.get(uf);
          if (!u || u.inconclusive) {
            return buildTooltipCard({
              title: `${uf} — ${name}`,
              badge: 'Inconclusivo',
              badgeTone: 'neutral',
              rows: [
                { label: 'Critério mínimo', value: 'n < 10 ou FINAL < 70%' },
              ],
              hint: onSelectUF ? 'Clique na UF para filtrar o painel' : '',
            });
          }
          return buildTooltipCard({
            title: `${uf} — ${name}`,
            badge: `${fmtPct(u.rate * 100)} ≥2 sinais`,
            badgeTone: u.rate >= 0.06 ? 'below' : (u.rate >= 0.03 ? 'floor' : 'above'),
            rows: [
              {
                label: 'Mulheres com ≥2 sinais',
                value: fmtPct(u.rate * 100),
                sub: `${fmtInt(u.twoPlusF)}/${fmtInt(u.nF)}`,
                focus: true,
              },
              { label: 'Cobertura FINAL', value: fmtPct(u.finalRate * 100) },
            ],
            hint: onSelectUF ? 'Clique na UF para filtrar o painel' : '',
          });
        }

        const u = h9ByUf.get(uf);
        if (!u || u.inconclusive) {
          return buildTooltipCard({
            title: `${uf} — ${name}`,
            badge: 'Inconclusivo',
            badgeTone: 'neutral',
            rows: [
              { label: 'Critério mínimo', value: 'Amostra ou FINAL < 70%' },
            ],
            hint: onSelectUF ? 'Clique na UF para filtrar o painel' : '',
          });
        }
        return buildTooltipCard({
          title: `${uf} — ${name}`,
          badge: u.bottleneck,
          badgeTone: bottleneckTone(u.bottleneck),
          rows: [
            { label: 'Inclusão no papel', value: fmtPct(u.inclusaoPct), focus: u.bottleneck === 'Papel' },
            { label: 'Equidade FEFC', value: fmtRatio(u.eqFefc), focus: u.bottleneck === 'Dinheiro' },
            { label: 'Rendimento na urna', value: fmtRatio(u.rendUrna), focus: u.bottleneck === 'Urna (Votos)' },
            { label: 'Sucesso em cadeiras', value: fmtRatio(u.sucParl), focus: u.bottleneck === 'Urna (Cadeiras)' },
            { label: 'Integridade', value: fmtPct(u.integridadePct), focus: u.bottleneck === 'Integridade' },
          ],
          hint: onSelectUF ? 'Clique na UF para filtrar o painel' : '',
        });
      },
      {
        onEnter: () => {
          d3.select(this)
            .attr('stroke', '#FFFFFF')
            .attr('stroke-width', isSelected ? 2.5 : 1.9);
        },
        onLeave: () => {
          d3.select(this)
            .attr('stroke', isSelected ? '#FFFFFF' : '#003D2B')
            .attr('stroke-width', isSelected ? 2.5 : 1);
        },
      },
    );
  });

  // Legenda com quebra automática de linha para evitar recorte lateral em telas estreitas
  const legendItems = mode === 'h7'
    ? [
        ['0% sinais', h7Scale(0)],
        ['6% sinais', h7Scale(0.06)],
        ['≥12% sinais', h7Scale(0.12)],
        ['Inconclusivo', STAGE_COLOR['Inconclusivo']],
      ]
    : Object.entries(STAGE_COLOR).filter(([k]) => h9Data.stageCounts[k] || k === 'Inconclusivo');

  const leg = svg.append('g').attr('transform', `translate(12, ${height - 46})`);
  let xOff = 0;
  let yOff = 0;
  legendItems.forEach(([label, color]) => {
    const itemW = label.length * 6.5 + 24;
    if (xOff > 0 && xOff + itemW > width - 20) {
      xOff = 0;
      yOff += 18;
    }
    const g = leg.append('g').attr('transform', `translate(${xOff}, ${yOff})`);
    g.append('rect').attr('width', 11).attr('height', 11).attr('rx', 2).attr('fill', color).attr('stroke', 'rgba(255, 255, 255, 0.25)').attr('stroke-width', 0.6);
    g.append('text').attr('x', 15).attr('y', 9.5).attr('font-size', 10.5).attr('fill', '#FFFFFF').text(label);
    xOff += itemW + 8;
  });
}

function axisDomain(rows, key, [baseLo, baseHi], pad) {
  const vals = rows.map((r) => r[key]).filter(Number.isFinite);
  if (vals.length === 0) return [baseLo, baseHi];
  const lo = Math.min(baseLo, Math.floor((Math.min(...vals) - pad) * 10) / 10);
  const hi = Math.max(baseHi, Math.ceil((Math.max(...vals) + pad) * 10) / 10);
  return [lo, hi];
}

/**
 * Ato 5 — Coordenadas Paralelas Interativas (5 eixos sem clamping + restauração de brush)
 */
export function renderParallelCoordinates(container, h9Data, {
  width = 700,
  unit = 'party',
  selectedEntity = '',
  initialRanges = null,
  onSelectEntity = null,
  onBrushFilter = null,
} = {}) {
  container.innerHTML = '';
  const rows = (unit === 'uf' ? h9Data.ufRows : h9Data.partyRows).filter((r) => !r.inconclusive);

  if (rows.length === 0) {
    container.innerHTML = '<p class="chart-empty">Sem grupos suficientes para traçar coordenadas paralelas neste recorte.</p>';
    return;
  }

  const axes = [
    { key: 'inclusaoPct', label: 'Inclusão (%)', domain: axisDomain(rows, 'inclusaoPct', [20, 45], 2) },
    { key: 'eqFefc', label: 'Eq. FEFC (×)', domain: axisDomain(rows, 'eqFefc', [0.4, 1.5], 0.05) },
    { key: 'rendUrna', label: 'Rend. Urna (×)', domain: axisDomain(rows, 'rendUrna', [0.2, 1.4], 0.05) },
    { key: 'sucParl', label: 'Suc. Cadeiras (×)', domain: axisDomain(rows, 'sucParl', [0, 1.6], 0.05) },
    { key: 'integridadePct', label: 'Integridade (%)', domain: [Math.min(80, ...rows.map((r) => Math.floor(r.integridadePct))), 100] },
  ];

  const height = 235;
  const margin = { top: 30, right: 56, bottom: 22, left: 40 };
  const tipCtrl = createChartTooltip(container);
  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', width)
    .attr('height', height)
    .style('font-family', 'Barlow, Inter, system-ui, sans-serif');

  const x = d3.scalePoint()
    .domain(axes.map((a) => a.key))
    .range([margin.left, width - margin.right]);

  const y = new Map(
    axes.map((a) => [
      a.key,
      d3.scaleLinear().domain(a.domain).range([height - margin.bottom, margin.top]),
    ]),
  );

  const line = d3.line()
    .x((d) => x(d.key))
    .y((d) => y.get(d.key)(d.val));

  const activeRanges = initialRanges instanceof Map ? new Map(initialRanges) : new Map();

  const paths = svg.append('g')
    .attr('fill', 'none')
    .selectAll('path')
    .data(rows)
    .join('path')
    .attr('d', (d) => line(axes.map((a) => ({ key: a.key, val: d[a.key] }))))
    .attr('stroke', (d) => STAGE_COLOR[d.bottleneck] || '#555')
    .attr('stroke-width', (d) => (selectedEntity === d.key ? 3 : 1.6))
    .attr('stroke-opacity', (d) => (selectedEntity && selectedEntity !== d.key ? 0.2 : 0.72))
    .style('cursor', 'pointer')
    .on('click', (_, d) => {
      if (onSelectEntity) onSelectEntity(d.key, unit);
    });

  function isRowAllowed(d) {
    for (const [k, [y0, y1]] of activeRanges.entries()) {
      const v = d[k];
      if (v < y0 || v > y1) return false;
    }
    return true;
  }

  function applyBrushStyles(notify = true) {
    const allowed = new Set();
    paths.each(function (d) {
      const ok = activeRanges.size === 0 || isRowAllowed(d);
      if (activeRanges.size > 0 && ok) allowed.add(d.key);
      if (activeRanges.size > 0) {
        d3.select(this)
          .attr('stroke-opacity', ok ? (selectedEntity && selectedEntity !== d.key ? 0.3 : 0.85) : 0.08)
          .attr('stroke-width', ok ? (selectedEntity === d.key ? 3 : 2.1) : 1);
      } else {
        d3.select(this)
          .attr('stroke-opacity', selectedEntity && selectedEntity !== d.key ? 0.2 : 0.72)
          .attr('stroke-width', selectedEntity === d.key ? 3 : 1.6);
      }
    });
    if (notify && onBrushFilter) {
      onBrushFilter(activeRanges.size > 0 ? allowed : null, new Map(activeRanges));
    }
  }

  paths.each(function (d) {
    const entityLabel = unit === 'uf' ? `${d.key} — ${UF_NAMES[d.key] || d.key}` : d.key;
    bindTooltipEvents(
      this,
      tipCtrl,
      () => buildTooltipCard({
        title: entityLabel,
        badge: d.bottleneck,
        badgeTone: bottleneckTone(d.bottleneck),
        rows: [
          { label: 'Inclusão (%)', value: fmtPct(d.inclusaoPct), focus: d.bottleneck === 'Papel' },
          { label: 'Eq. FEFC', value: fmtRatio(d.eqFefc), focus: d.bottleneck === 'Dinheiro' },
          { label: 'Rend. Urna', value: fmtRatio(d.rendUrna), focus: d.bottleneck === 'Urna (Votos)' },
          { label: 'Suc. Cadeiras', value: fmtRatio(d.sucParl), focus: d.bottleneck === 'Urna (Cadeiras)' },
          { label: 'Integridade (%)', value: fmtPct(d.integridadePct), focus: d.bottleneck === 'Integridade' },
        ],
        hint: onSelectEntity
          ? `Clique na linha para filtrar ${unit === 'uf' ? 'a UF' : 'o partido'}`
          : '',
      }),
      {
        onEnter: () => {
          d3.select(this).attr('stroke-width', 3).attr('stroke-opacity', 1);
        },
        onLeave: () => {
          applyBrushStyles(false);
        },
      },
    );
  });

  const axisG = svg.selectAll('.pc-axis')
    .data(axes)
    .join('g')
    .attr('class', 'pc-axis')
    .attr('transform', (d) => `translate(${x(d.key)},0)`);

  axisG.each(function (a) {
    d3.select(this).call(d3.axisLeft(y.get(a.key)).ticks(5));
  });

  axisG.append('text')
    .attr('y', margin.top - 12)
    .attr('text-anchor', 'middle')
    .attr('font-size', 10.5)
    .attr('font-weight', '600')
    .attr('fill', '#FFFFFF')
    .text((d) => d.label);

  let restoring = false;
  axisG.each(function (a) {
    const scale = y.get(a.key);
    const brush = d3.brushY()
      .extent([[-12, margin.top], [12, height - margin.bottom]])
      .on('brush end', (ev) => {
        if (restoring) return;
        if (!ev.selection) {
          activeRanges.delete(a.key);
        } else {
          const [py0, py1] = ev.selection;
          const vHi = scale.invert(py0);
          const vLo = scale.invert(py1);
          activeRanges.set(a.key, [vLo, vHi]);
        }
        applyBrushStyles(true);
      });
    const bg = d3.select(this).append('g').attr('class', 'pc-brush').call(brush);
    const saved = activeRanges.get(a.key);
    if (saved) {
      const [vLo, vHi] = saved;
      const py0 = Math.max(margin.top, Math.min(height - margin.bottom, scale(vHi)));
      const py1 = Math.max(margin.top, Math.min(height - margin.bottom, scale(vLo)));
      if (py1 > py0) {
        restoring = true;
        bg.call(brush.move, [py0, py1]);
        restoring = false;
      }
    }
  });

  if (activeRanges.size > 0) {
    applyBrushStyles(false);
  }
}
