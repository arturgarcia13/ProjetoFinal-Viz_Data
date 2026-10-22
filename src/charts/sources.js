import * as d3 from 'd3';
import { C, chartFrame, fmtMoney, fmtPct, fmtRatio, label, showTip, hideTip } from './helpers.js';

const SOURCES = [
  { k: 'FEFC', c: '#C2452F', f: c => c.fefc },
  { k: 'Fundo partidário', c: '#C98A2E', f: c => c.party },
  { k: 'Privado + próprio', c: '#2F6B4F', f: c => c.priv },
  { k: 'Outros / repasses', c: '#8E8678', f: c => c.otherR + c.cand }
];

export function renderSources(container, ctx) {
  const { stats } = ctx;
  const F = stats.rows.filter(c => c.g === 'F');
  const M = stats.rows.filter(c => c.g === 'M');
  if (!F.length || !M.length) { container.innerHTML = '<p class="empty">Sem candidaturas dos dois gêneros neste recorte.</p>'; return; }

  const { svg, width, height } = chartFrame(container, 270);
  const m = { top: 54, right: 100, bottom: 42, left: 84 };
  const w = width - m.left - m.right;
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  const data = ['F', 'M'].map(gender => {
    const rows = gender === 'F' ? F : M;
    const total = d3.sum(rows, c => c.r);
    const parts = SOURCES.map(s => ({ ...s, v: d3.sum(rows, s.f) }));
    return { gender, total, parts };
  });

  const x = d3.scaleLinear().domain([0, 1]).range([0, w]);
  const rowH = 46;
  const x0 = 0;

  data.forEach((d, i) => {
    const y = i * (rowH + 34);
    g.append('text').attr('x', -12).attr('y', y + 18).attr('text-anchor', 'end')
      .attr('font-size', 12).attr('font-weight', 700).attr('fill', d.gender === 'F' ? C.women : C.men)
      .text(d.gender === 'F' ? 'Mulheres' : 'Homens');
    g.append('text').attr('x', -12).attr('y', y + 32).attr('text-anchor', 'end')
      .attr('font-size', 9).attr('fill', C.muted).text(fmtMoney(d.total));

    let acc = 0;
    d.parts.forEach(p => {
      const share = d.total ? p.v / d.total : 0;
      const x1 = x(acc), x2 = x(acc + share);
      g.append('rect').attr('x', x1).attr('y', y).attr('width', Math.max(0, x2 - x1)).attr('height', 28)
        .attr('fill', p.c)
        .style('cursor', 'default')
        .on('mousemove', event => showTip(`<strong>${p.k}</strong><br>${d.gender === 'F' ? 'mulheres' : 'homens'}: ${fmtPct(share)} · ${fmtMoney(p.v)}`, event))
        .on('mouseleave', hideTip);
      if (share > 0.08) {
        g.append('text').attr('x', (x1 + x2) / 2).attr('y', y + 18)
          .attr('text-anchor', 'middle').attr('font-size', 10).attr('font-weight', 600)
          .attr('fill', p.c === '#C98A2E' || p.c === '#8E8678' ? C.ink : C.white)
          .text(fmtPct(share, 0));
      }
      acc += share;
    });
    g.append('text').attr('x', w + 10).attr('y', y + 18).attr('font-size', 10).attr('fill', C.muted).text('100%');
  });

  // legenda
  let lx = 0;
  SOURCES.forEach(s => {
    g.append('rect') .attr('x', lx).attr('y', -22).attr('width', 9).attr('height', 9).attr('fill', s.c);
    g.append('text') .attr('x', lx + 13).attr('y', -13).attr('font-size', 9.5).attr('fill', C.muted).text(s.k);
    lx += s.k === 'Partido' ? 58 : 55;
  });

  const priv = stats.h2.privateRatio, pub = stats.h2.publicRatio;
  g.append('text').attr('x', 0).attr('y', 152).attr('font-size', 10).attr('fill', C.ink).attr('font-weight', 600)
    .text(`Mediana F/M — público ${fmtRatio(pub)}× · privado ${fmtRatio(priv)}×`);
  g.append('text').attr('x', 0).attr('y', 167).attr('font-size', 9.5).attr('fill', C.muted)
    .text('A paridade do dinheiro público não se repete no privado.');
}
