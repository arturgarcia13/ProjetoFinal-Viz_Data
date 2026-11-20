import * as d3 from 'd3';
import { IBGE_TO_UF, UF_NAMES } from '../data.js';

const STAGE_COLOR = {
  'Papel': '#7f5539',
  'Dinheiro': '#d97a4a',
  'Urna (Votos)': '#b4452f',
  'Urna (Cadeiras)': '#6d2e46',
  'Integridade': '#c9971b',
  'Sem Vazamento Crítico': '#2f6f5e',
  'Inconclusivo': '#cbc3b6',
};

/**
 * H7 / H9 — Mapa Coroplético do Brasil por UF (etapa crítica ou taxa de sinais H7)
 */
export function renderUFMap(container, brUfGeo, h9Data, h7Data, {
  width = 520,
  mode = 'h9',
  selectedUF = '',
  onSelectUF = null,
} = {}) {
  container.innerHTML = '';
  const height = 420;
  const svg = d3.select(container).append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', width)
    .attr('height', height);

  const projection = d3.geoMercator().fitExtent([[16, 16], [width - 16, height - 48]], brUfGeo);
  const path = d3.geoPath(projection);

  const h9ByUf = new Map(h9Data.ufRows.map((u) => [u.key, u]));
  const h7ByUf = new Map(h7Data.byUf.map((u) => [u.uf, u]));
  const h7Scale = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, 0.12]);

  svg.append('g')
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
    .attr('stroke', (d) => {
      const uf = IBGE_TO_UF[String(d.properties.codarea)];
      return selectedUF === uf ? '#1b1a17' : '#fffdf9';
    })
    .attr('stroke-width', (d) => {
      const uf = IBGE_TO_UF[String(d.properties.codarea)];
      return selectedUF === uf ? 2.5 : 1;
    })
    .style('cursor', 'pointer')
    .on('click', (_, d) => {
      const uf = IBGE_TO_UF[String(d.properties.codarea)];
      if (uf && onSelectUF) onSelectUF(uf);
    })
    .append('title')
    .text((d) => {
      const uf = IBGE_TO_UF[String(d.properties.codarea)];
      const name = UF_NAMES[uf] || uf;
      if (mode === 'h7') {
        const u = h7ByUf.get(uf);
        if (!u || u.inconclusive) return `${uf} — ${name}: Inconclusivo (n < 10)`;
        return `${uf} — ${name}: ${(u.rate * 100).toFixed(1)}% com ≥2 sinais (${u.twoPlusF}/${u.nF})`;
      }
      const u = h9ByUf.get(uf);
      if (!u || u.inconclusive) return `${uf} — ${name}: Inconclusivo`;
      return `${uf} — ${name}\nEtapa crítica: ${u.bottleneck}\nInclusão: ${u.inclusaoPct.toFixed(1)}% · Eq. FEFC: ${u.eqFefc.toFixed(2)}× · Urna: ${u.rendUrna.toFixed(2)}× · Cadeiras: ${u.sucParl.toFixed(2)}×`;
    });

  // Legenda compacta
  const legendItems = mode === 'h7'
    ? [
        ['0% sinais', h7Scale(0)],
        ['6% sinais', h7Scale(0.06)],
        ['≥12% sinais', h7Scale(0.12)],
        ['Inconclusivo', STAGE_COLOR['Inconclusivo']],
      ]
    : Object.entries(STAGE_COLOR).filter(([k]) => h9Data.stageCounts[k] || k === 'Inconclusivo');

  const leg = svg.append('g').attr('transform', `translate(14, ${height - 34})`);
  let xOff = 0;
  legendItems.forEach(([label, color]) => {
    const g = leg.append('g').attr('transform', `translate(${xOff}, 0)`);
    g.append('rect').attr('width', 11).attr('height', 11).attr('rx', 2).attr('fill', color);
    g.append('text').attr('x', 15).attr('y', 9.5).attr('font-size', 10.5).attr('fill', '#1b1a17').text(label);
    xOff += label.length * 6.4 + 26;
  });
}

/**
 * Ato 5 — Coordenadas Paralelas Interativas (5 eixos + brushing vertical nos eixos)
 */
export function renderParallelCoordinates(container, h9Data, {
  width = 700,
  unit = 'party',
  selectedParty = '',
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
    { key: 'inclusaoPct', label: 'Inclusão (%)', domain: [20, 50] },
    { key: 'eqFefc', label: 'Eq. FEFC (×)', domain: [0.4, 1.5] },
    { key: 'rendUrna', label: 'Rend. Urna (×)', domain: [0.2, 1.4] },
    { key: 'sucParl', label: 'Suc. Cadeiras (×)', domain: [0, 1.6] },
    { key: 'integridadePct', label: 'Integridade (%)', domain: [80, 100] },
  ];

  const height = 320;
  const margin = { top: 34, right: 34, bottom: 26, left: 34 };
  const svg = d3.select(container).append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', width)
    .attr('height', height);

  const x = d3.scalePoint()
    .domain(axes.map((a) => a.key))
    .range([margin.left, width - margin.right]);

  const y = new Map(
    axes.map((a) => [
      a.key,
      d3.scaleLinear().domain(a.domain).clamp(true).range([height - margin.bottom, margin.top]),
    ]),
  );

  const line = d3.line()
    .x((d) => x(d.key))
    .y((d) => y.get(d.key)(d.val));

  const activeRanges = new Map();

  const paths = svg.append('g')
    .attr('fill', 'none')
    .selectAll('path')
    .data(rows)
    .join('path')
    .attr('d', (d) => line(axes.map((a) => ({ key: a.key, val: d[a.key] }))))
    .attr('stroke', (d) => STAGE_COLOR[d.bottleneck] || '#555')
    .attr('stroke-width', (d) => (selectedParty === d.key ? 3 : 1.6))
    .attr('stroke-opacity', (d) => (selectedParty && selectedParty !== d.key ? 0.2 : 0.72))
    .style('cursor', 'pointer')
    .on('click', (_, d) => {
      if (onSelectEntity) onSelectEntity(d.key, unit);
    });

  paths.append('title')
    .text((d) => `${d.key} (${d.bottleneck})\nInclusão: ${d.inclusaoPct.toFixed(1)}% · Eq. FEFC: ${d.eqFefc.toFixed(2)}× · Urna: ${d.rendUrna.toFixed(2)}× · Cadeiras: ${d.sucParl.toFixed(2)}× · Integridade: ${d.integridadePct.toFixed(1)}%`);

  function applyBrushStyles() {
    const allowed = new Set();
    paths.each(function (d) {
      let ok = true;
      for (const [k, [y0, y1]] of activeRanges.entries()) {
        const v = d[k];
        if (v < y0 || v > y1) {
          ok = false;
          break;
        }
      }
      if (ok) allowed.add(d.key);
      d3.select(this)
        .attr('stroke-opacity', ok ? 0.85 : 0.08)
        .attr('stroke-width', ok ? 2.1 : 1);
    });
    if (onBrushFilter) onBrushFilter(activeRanges.size > 0 ? allowed : null);
  }

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
    .attr('font-size', 11)
    .attr('font-weight', '600')
    .attr('fill', '#1b1a17')
    .text((d) => d.label);

  // Brush vertical em cada eixo
  axisG.each(function (a) {
    const brush = d3.brushY()
      .extent([[-12, margin.top], [12, height - margin.bottom]])
      .on('brush end', (ev) => {
        if (!ev.selection) {
          activeRanges.delete(a.key);
        } else {
          const [py0, py1] = ev.selection;
          const scale = y.get(a.key);
          const vHi = scale.invert(py0);
          const vLo = scale.invert(py1);
          activeRanges.set(a.key, [vLo, vHi]);
        }
        applyBrushStyles();
      });
    d3.select(this).append('g').attr('class', 'pc-brush').call(brush);
  });
}
