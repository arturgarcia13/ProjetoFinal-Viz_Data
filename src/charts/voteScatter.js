import * as d3 from 'd3';
import { C, fmtMoney, fmtNum, label, showTip, hideTip } from './helpers.js';

export function renderVoteScatter(container, ctx) {
  const { scatterRows, state, on } = ctx;
  const rows = scatterRows.filter(c => c.g === 'F' || c.g === 'M');
  if (rows.length < 50) { container.innerHTML = '<p class="empty">Amostra insuficiente para o dispersão.</p>'; return; }

  const raceGroup = c => (c.race === 'PRETA' || c.race === 'PARDA') ? 'negra'
    : c.race === 'BRANCA' ? 'branca' : 'outra';
  const groupKey = c => `${c.g}-${raceGroup(c)}`;
  const GROUP = {
    'F-negra': { label: 'mulheres negras', short: 'M. negras', color: '#A9362A' },
    'F-branca': { label: 'mulheres brancas', short: 'M. brancas', color: '#D98B72' },
    'M-negra': { label: 'homens negros', short: 'H. negros', color: '#1D6A7A' },
    'M-branca': { label: 'homens brancos', short: 'H. brancos', color: '#7FAEB7' }
  };
  const pointColor = c => GROUP[groupKey(c)]?.color || '#B9B0A1';

  container.innerHTML = '';
  const cw = Math.max(320, container.clientWidth || 700);
  const width = cw < 480 ? 620 : cw;
  container.classList.toggle('scroll-x', width > cw + 10);
  const height = 480;
  const m = { top: 24, right: 24, bottom: 54, left: 64 };
  const w = width - m.left - m.right, h = height - m.top - m.bottom;

  const wrap = d3.select(container).append('div').attr('class', 'scatter-wrap')
    .style('position', 'relative').style('width', `${width}px`).style('height', `${height}px`);

  const canvas = wrap.append('canvas')
    .attr('width', width * devicePixelRatio).attr('height', height * devicePixelRatio)
    .style('position', 'absolute').style('left', '0').style('top', '0')
    .style('width', `${width}px`).style('height', `${height}px`)
    .style('pointer-events', 'none');
  const cctx = canvas.node().getContext('2d');
  cctx.scale(devicePixelRatio, devicePixelRatio);

  const maxR = d3.max(rows, c => c.r) || 1;
  const maxV = d3.max(rows, c => c.v) || 1;
  const x = d3.scaleLog().domain([1, maxR * 1.4]).range([m.left, m.left + w]).clamp(true);
  const y = d3.scaleLog().domain([1, maxV * 1.4]).range([m.top + h, m.top]).clamp(true);

  const svg = wrap.append('svg')
    .attr('width', width).attr('height', height)
    .style('position', 'absolute').style('left', '0').style('top', '0');

  // grid
  const g = svg.append('g');
  g.selectAll('line.gy').data(y.ticks(5)).join('line')
    .attr('x1', m.left).attr('x2', m.left + w).attr('y1', d => y(d)).attr('y2', d => y(d))
    .attr('stroke', C.grid).attr('stroke-dasharray', '2 4').attr('opacity', .6);
  g.selectAll('line.gx').data(x.ticks(5)).join('line')
    .attr('y1', m.top).attr('y2', m.top + h).attr('x1', d => x(d)).attr('x2', d => x(d))
    .attr('stroke', C.grid).attr('stroke-dasharray', '2 4').attr('opacity', .6);

  // pontos
  const draw = () => {
    cctx.clearRect(0, 0, width, height);
    const brush = state.brush;
    for (const c of rows) {
      const inBrush = !brush || (c.r >= brush.r[0] && c.r <= brush.r[1] && c.v >= brush.v[0] && c.v <= brush.v[1]);
      cctx.beginPath();
      cctx.arc(x(Math.max(1, c.r)), y(Math.max(1, c.v)), inBrush ? 1.9 : 1.2, 0, Math.PI * 2);
      cctx.fillStyle = pointColor(c);
      cctx.globalAlpha = inBrush ? .38 : .07;
      cctx.fill();
    }
    cctx.globalAlpha = 1;

    // Retas OLS log-log por grupo, restritas a campanhas ativas.
    const active = d => d.r > 1000 && d.v > 10;
    const ols = (subset) => {
      const pts = subset.filter(active).map(d => ({ x: Math.log(d.r), y: Math.log(d.v) }));
      if (pts.length < 20) return null;
      const mx = d3.mean(pts, d => d.x), my = d3.mean(pts, d => d.y);
      let sxy = 0, sxx = 0;
      for (const d of pts) { sxy += (d.x - mx) * (d.y - my); sxx += (d.x - mx) * (d.x - mx); }
      if (sxx < 1e-9) return null;
      const b = sxy / sxx;
      return { a: my - b * mx, b, n: pts.length };
    };
    for (const [key, meta] of Object.entries(GROUP)) {
      const fit = ols(rows.filter(c => groupKey(c) === key));
      if (!fit) continue;
      const xs = rows.filter(c => groupKey(c) === key && active(c)).map(c => c.r);
      if (!xs.length) continue;
      const r0 = Math.max(1, d3.min(xs)), r1 = Math.max(r0 + 1, d3.max(xs));
      cctx.beginPath();
      const p0 = { x: x(r0), y: y(Math.max(1, Math.exp(fit.a + fit.b * Math.log(r0)))) };
      const p1 = { x: x(r1), y: y(Math.max(1, Math.exp(fit.a + fit.b * Math.log(r1)))) };
      cctx.moveTo(p0.x, p0.y); cctx.lineTo(p1.x, p1.y);
      cctx.strokeStyle = meta.color;
      cctx.lineWidth = 2.2;
      cctx.globalAlpha = .95;
      cctx.stroke();
      cctx.globalAlpha = 1;
    }
  };
  draw();

  // eixos
  g.append('g').attr('transform', `translate(0,${m.top + h})`)
    .call(d3.axisBottom(x).ticks(6, d => d >= 1e6 ? `${d / 1e6} mi` : d >= 1e3 ? `${d / 1e3} mil` : d).tickSizeOuter(0))
    .call(sel => { sel.selectAll('text').attr('fill', C.muted).attr('font-size', 9.5); sel.select('.domain').attr('stroke', C.grid); });
  g.append('g').attr('transform', `translate(${m.left},0)`)
    .call(d3.axisLeft(y).ticks(6, d => d >= 1e6 ? `${d / 1e6} mi` : d >= 1e3 ? `${d / 1e3} mil` : d).tickSizeOuter(0))
    .call(sel => { sel.selectAll('text').attr('fill', C.muted).attr('font-size', 9.5); sel.select('.domain').attr('stroke', C.grid); });
  label(svg, m.left + w / 2, height - 12, 'receita total recebida (R$, escala log)', { size: 10, anchor: 'middle' });
  label(svg, 14, m.top + h / 2, 'votos nominais (escala log)', { size: 10, anchor: 'middle' }).attr('transform', `rotate(-90,14,${m.top + h / 2})`);

  // legenda interseccional
  let lx = m.left + 2;
  for (const meta of Object.values(GROUP)) {
    svg.append('circle').attr('cx', lx).attr('cy', 12).attr('r', 4).attr('fill', meta.color);
    svg.append('text').attr('x', lx + 9).attr('y', 15.5).attr('font-size', 9.2).attr('fill', C.muted).text(meta.short);
    lx += meta.short.length * 4.9 + 26;
  }
  svg.append('text').attr('x', m.left + w).attr('y', 15.5).attr('text-anchor', 'end').attr('font-size', 8.5).attr('fill', C.faint).text('linhas = OLS log-log · campanhas ativas');

  // brush
  const brush = d3.brush()
    .extent([[m.left, m.top], [m.left + w, m.top + h]])
    .on('end', event => {
      if (!event.sourceEvent) return;
      if (!event.selection) { on.clearBrush(); return; }
      const [[x0, y0], [x1, y1]] = event.selection;
      const r0 = Math.max(1, x.invert(x0)), r1 = Math.max(1, x.invert(x1));
      const v0 = Math.max(1, y.invert(y1)), v1 = Math.max(1, y.invert(y0));
      on.setBrush({ r: [Math.min(r0, r1), Math.max(r0, r1)], v: [Math.min(v0, v1), Math.max(v0, v1)] });
    });
  const brushG = svg.append('g').attr('class', 'brush').call(brush);
  if (state.brush) {
    const { r, v } = state.brush;
    brushG.call(brush.move, [[x(r[0]), y(v[1])], [x(r[1]), y(v[0])]]);
  }

  // tooltip
  const tree = d3.quadtree().x(d => x(Math.max(1, d.r))).y(d => y(Math.max(1, d.v))).addAll(rows);
  wrap.on('mousemove', event => {
    const [mx, my] = d3.pointer(event);
    if (mx < m.left || mx > m.left + w || my < m.top || my > m.top + h) { hideTip(); return; }
    const p = tree.find(mx, my, 11);
    if (!p) { hideTip(); return; }
    const rg = raceGroup(p);
    const raceTxt = p.race ? p.race.toLowerCase() : 'raça não divulgada';
    showTip(`<strong>${p.g === 'F' ? 'Mulher' : 'Homem'}${rg === 'outra' ? '' : ' ' + rg}</strong> · ${p.leg}<br>${fmtMoney(p.r)} recebidos<br>${fmtNum(p.v)} votos<br><span class="tip-muted">${p.uf} · ${raceTxt} · candidatura anônima</span>`, event);
  }).on('mouseleave', hideTip);
}
