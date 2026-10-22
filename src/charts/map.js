import * as d3 from 'd3';
import { C, chartFrame, fmtPct, fmtNum, showTip, hideTip } from './helpers.js';
import { UF_CODES, UF_NAMES } from '../data.js';
import { ufDiagnostics, BOTTLENECK_LABEL } from '../state.js';

const STAGE_COLOR = {
  financiamento: '#C2452F',
  urna: '#6D4C8B',
  institucional: '#2F6B8B',
  integridade: '#4A4A48'
};
const STAGE_LABEL = {
  financiamento: 'financiamento',
  urna: 'urna',
  institucional: 'institucional',
  integridade: 'integridade'
};
const LABEL_NUDGE = {
  RN: [-8, -5], PB: [-12, 2], PE: [18, 1], AL: [-12, 12], SE: [13, 12],
  RJ: [7, 3], ES: [7, 1], DF: [9, -6], SC: [0, 2], PR: [0, -1]
};

export function renderMap(container, ctx, mode = 'women') {
  const { geo, state, mapRows, qeMap, on } = ctx;
  const { svg, width, height } = chartFrame(container, 600);
  const diag = ufDiagnostics(mapRows, state.threshold, qeMap);
  const agg = new Map(diag.map(d => [d.uf, d]));
  const wide = width >= 820;
  const mapW = wide ? Math.min(820, width * 0.69) : width;
  const mapH = height - (wide ? 52 : 44);
  const projection = d3.geoMercator().fitExtent([[14, 10], [mapW - 14, mapH]], geo);
  const path = d3.geoPath(projection);

  let fill, legend;
  if (mode === 'women') {
    const vals = [...agg.values()].map(d => d.cs).filter(Number.isFinite);
    const lo = Math.min(0.28, d3.min(vals) || 0.28), hi = Math.max(0.42, d3.max(vals) || 0.42);
    const scale = d3.scaleSequential(d3.interpolateRgbBasis(['#F3E3C9', '#D3A26C', '#8E402C'])).domain([lo, hi]);
    fill = d => { const a = agg.get(d); return a ? scale(a.cs) : '#E9E2D5'; };
    legend = { type: 'seq', scale, lo, hi, title: '% de mulheres nas candidaturas' };
  } else if (mode === 'signal') {
    const vals = [...agg.values()].map(d => d.sig2Any).filter(Number.isFinite);
    const lo = Math.min(0.02, d3.min(vals) || 0.02), hi = Math.max(0.12, d3.max(vals) || 0.12);
    const scale = d3.scaleSequential(d3.interpolateRgbBasis(['#F3E7CE', '#DBAA58', '#8E3B2A'])).domain([lo, hi]);
    fill = d => { const a = agg.get(d); return a ? scale(a.sig2Any) : '#E9E2D5'; };
    legend = { type: 'seq', scale, lo, hi, title: 'candidaturas com ≥ 2 sinais' };
  } else {
    fill = d => { const a = agg.get(d); return a ? STAGE_COLOR[a.dominant] : '#E9E2D5'; };
    legend = { type: 'cat', title: 'gargalo dominante (argmax Z)' };
  }

  const g = svg.append('g');
  const features = geo.features;
  g.selectAll('path.uf').data(features).join('path')
    .attr('class', 'uf')
    .attr('d', path)
    .attr('fill', d => fill(UF_CODES[d.properties.codarea]))
    .attr('stroke', d => state.uf === UF_CODES[d.properties.codarea] ? C.ink : C.white)
    .attr('stroke-width', d => state.uf === UF_CODES[d.properties.codarea] ? 2.2 : .7)
    .style('cursor', 'pointer')
    .style('transition', 'opacity .15s')
    .on('mousemove', (event, d) => {
      const uf = UF_CODES[d.properties.codarea];
      const a = agg.get(uf);
      if (!a) { showTip(`<strong>${UF_NAMES[uf] || uf}</strong><br><span class="tip-muted">amostra insuficiente (mín. 20)</span>`, event); return; }
      const z = a.z || {};
      showTip(`<strong>${UF_NAMES[uf] || uf} <span class="tip-muted">${uf}</span></strong><br>
        ${fmtNum(a.n)} candidaturas · ${fmtPct(a.cs)} mulheres<br>
        FEFC: ${fmtPct(a.res)} · votos: ${fmtPct(a.vote)} · cadeiras: ${fmtPct(a.seat)}<br>
        <span class="tip-muted">Z: fin ${z.financiamento?.toFixed(2)} · urna ${z.urna?.toFixed(2)} · inst ${z.institucional?.toFixed(2)} · integr ${z.integridade?.toFixed(2)}</span><br>
        <strong>gargalo: ${STAGE_LABEL[a.dominant]}</strong> <span class="tip-muted">(Z = ${a.zMax?.toFixed(2).replace('.', ',')})</span>`, event);
    })
    .on('mouseleave', hideTip)
    .on('click', (event, d) => on.toggleUF(UF_CODES[d.properties.codarea]));

  // rótulos com halo para não sumirem sobre cores fortes
  const centroids = features.map(f => {
    const c = path.centroid(f);
    const n = LABEL_NUDGE[UF_CODES[f.properties.codarea]] || [0, 0];
    return { f, c: [c[0] + n[0], c[1] + n[1]] };
  }).filter(o => Number.isFinite(o.c[0]));
  g.selectAll('text.uflabel').data(centroids).join('text')
    .attr('class', 'uflabel')
    .attr('x', d => d.c[0]).attr('y', d => d.c[1] + 3)
    .attr('text-anchor', 'middle').attr('font-size', 8.6).attr('font-weight', 700)
    .attr('paint-order', 'stroke').attr('stroke', C.white).attr('stroke-width', 2.4).attr('stroke-linejoin', 'round')
    .attr('fill', C.ink)
    .style('pointer-events', 'none')
    .text(d => UF_CODES[d.f.properties.codarea]);

  // legenda no rodapé do mapa
  const ly = height - 28, lx = 12;
  if (legend.type === 'seq') {
    const lw = 160;
    const defs = svg.append('defs');
    const grad = defs.append('linearGradient').attr('id', `grad-${mode}`);
    for (let i = 0; i <= 10; i++) grad.append('stop').attr('offset', `${i * 10}%`).attr('stop-color', legend.scale(legend.lo + (legend.hi - legend.lo) * i / 10));
    svg.append('rect').attr('x', lx).attr('y', ly).attr('width', lw).attr('height', 7).attr('fill', `url(#grad-${mode})`);
    svg.append('text').attr('x', lx).attr('y', ly - 6).attr('font-size', 9).attr('fill', C.muted).text(legend.title);
    svg.append('text').attr('x', lx).attr('y', ly + 20).attr('font-size', 9).attr('fill', C.muted).text(fmtPct(legend.lo, 0));
    svg.append('text').attr('x', lx + lw).attr('y', ly + 20).attr('text-anchor', 'end').attr('font-size', 9).attr('fill', C.muted).text(fmtPct(legend.hi, 0));
  } else {
    const keys = ['financiamento', 'urna', 'institucional', 'integridade'];
    let lx2 = lx;
    svg.append('text').attr('x', lx2).attr('y', ly - 6).attr('font-size', 9).attr('fill', C.muted).text(legend.title);
    keys.forEach(k => {
      svg.append('rect').attr('x', lx2).attr('y', ly).attr('width', 9).attr('height', 9).attr('fill', STAGE_COLOR[k]);
      svg.append('text').attr('x', lx2 + 13).attr('y', ly + 8).attr('font-size', 9).attr('fill', C.muted).text(STAGE_LABEL[k]);
      lx2 += k === 'integridade' ? 76 : 88;
    });
  }
  svg.append('text').attr('x', mapW - 12).attr('y', height - 8)
    .attr('text-anchor', 'end').attr('font-size', 9).attr('fill', C.faint)
    .text('clique em uma UF para filtrar');

  if (wide) {
    const px = mapW + 24, pw = width - px - 14;
    const isStage = mode === 'stage';
    const ranked = [...agg.values()]
      .filter(a => isStage ? Number.isFinite(a.zMax) : Number.isFinite(mode === 'women' ? a.cs : a.sig2Any))
      .sort((a, b) => isStage ? b.zMax - a.zMax : (mode === 'women' ? b.cs - a.cs : b.sig2Any - a.sig2Any))
      .slice(0, 8);
    const title = mode === 'women' ? 'Maiores presenças' : mode === 'signal' ? 'Mais sinais' : 'Gargalos dominantes';
    const sub = mode === 'women' ? '% de mulheres na chapa' : mode === 'signal' ? 'candidaturas com ≥ 2 sinais' : 'argmax(Z) por UF · barra = força do Z';
    svg.append('text').attr('x', px).attr('y', 20).attr('font-size', 9).attr('letter-spacing', '.1em').attr('fill', C.muted).text(title.toUpperCase());
    svg.append('text').attr('x', px).attr('y', 34).attr('font-size', 10.5).attr('fill', C.faint).text(sub);

    const rowH = 26, top = 60;
    const val = a => isStage ? a.zMax : (mode === 'women' ? a.cs : a.sig2Any);
    const vmax = isStage ? Math.max(1, d3.max(ranked, d => d.zMax) || 1) : (mode === 'women' ? 0.5 : (d3.max(ranked, d => d.sig2Any) || 0.12));
    const barMax = Math.min(pw - 76, 210);
    const x0 = px + 40, bw = barMax;
    ranked.forEach((a, i) => {
      const y = top + i * rowH;
      const v = val(a);
      const w = Math.max(2, (isStage ? v / vmax : v / vmax) * bw);
      const color = isStage ? STAGE_COLOR[a.dominant] : (mode === 'women' ? '#A45A3B' : '#B4762B');
      svg.append('text').attr('x', px).attr('y', y + 10).attr('font-size', 10).attr('font-weight', 700).attr('fill', C.ink).text(a.uf);
      svg.append('rect').attr('x', x0).attr('y', y + 2).attr('width', bw).attr('height', 10).attr('fill', C.grid).attr('opacity', .35).attr('rx', 1);
      svg.append('rect').attr('x', x0).attr('y', y + 2).attr('width', w).attr('height', 10).attr('fill', color).attr('rx', 1);
      svg.append('text').attr('x', x0 + bw + 6).attr('y', y + 10).attr('font-size', 9).attr('fill', C.muted)
        .text(isStage ? `${STAGE_LABEL[a.dominant]} · Z ${a.zMax.toFixed(2).replace('.', ',')}` : fmtPct(v));
    });
    svg.append('text').attr('x', px).attr('y', top + 8 * rowH + 16).attr('font-size', 9).attr('fill', C.faint)
      .text(isStage ? '4 dimensões padronizadas: financiamento, urna, institucional, integridade' : 'UF com amostra mínima de 20 candidaturas');
  }
}
