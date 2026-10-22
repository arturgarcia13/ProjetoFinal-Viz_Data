import * as d3 from 'd3';

export const C = {
  women: '#C2452F',
  womenSoft: '#E8B4A5',
  men: '#1D6A7A',
  menSoft: '#A8CBD2',
  ink: '#1B1A17',
  muted: '#6F6A60',
  faint: '#A39C8F',
  grid: '#D9D2C5',
  paper: '#F5F0E7',
  card: '#FBF8F2',
  accent: '#C98A2E',
  accentSoft: '#EBD3A8',
  green: '#2E6B4F',
  red: '#A9362A',
  amber: '#8A651B',
  white: '#FFFDF8'
};

export const fmtNum = d3.formatLocale({ decimal: ',', thousands: '.' }).format(',');
export const fmtPct = (x, d = 1) => Number.isFinite(x) ? `${(100 * x).toFixed(d).replace('.', ',')}%` : '—';
export const fmtRatio = x => Number.isFinite(x) ? x.toFixed(2).replace('.', ',') : '—';
export const fmtMoney = v => {
  if (!Number.isFinite(v)) return '—';
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(1).replace('.', ',')} bi`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1).replace('.', ',')} mi`;
  if (v >= 1e3) return `R$ ${Math.round(v / 1e3)} mil`;
  return `R$ ${fmtNum(Math.round(v))}`;
};
export const short = (s, n = 18) => s && s.length > n ? s.slice(0, n - 1) + '…' : s;

export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export function chartFrame(container, height = 420, minWidth = 0) {
  container.innerHTML = '';
  const cw = Math.max(280, container.clientWidth || 600);
  // Gráficos densos recebem uma largura mínima em telas estreitas e o cartão
  // rola na horizontal; gráficos simples se ajustam à coluna.
  const width = cw < 480 && minWidth > cw ? minWidth : cw;
  container.classList.toggle('scroll-x', width > cw + 10);
  const svg = d3.select(container).append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'img');
  return { svg, width, height };
}

let tipEl = null;
export function tip() {
  if (!tipEl) {
    tipEl = d3.select('body').append('div').attr('class', 'tooltip').style('opacity', 0);
  }
  return tipEl;
}

export function showTip(html, event) {
  const t = tip();
  t.html(html).style('opacity', 1);
  const pad = 14;
  const node = t.node();
  const w = node.offsetWidth, h = node.offsetHeight;
  let x = event.clientX + pad, y = event.clientY + pad;
  if (x + w > window.innerWidth - 8) x = event.clientX - w - pad;
  if (y + h > window.innerHeight - 8) y = event.clientY - h - pad;
  t.style('left', `${x}px`).style('top', `${y}px`);
}
export function hideTip() { if (tipEl) tipEl.style('opacity', 0); }

export function axisBottom(scale, label, width) {
  return g => {
    g.attr('transform', `translate(0,${label ? 0 : 0})`);
    g.call(d3.axisBottom(scale).ticks(width / 90).tickSizeOuter(0));
    g.selectAll('text').attr('fill', C.muted).attr('font-size', 10.5);
    g.selectAll('line').attr('stroke', C.grid);
    g.select('.domain').attr('stroke', C.grid);
  };
}

export function axisLeft(scale, width) {
  return g => {
    g.call(d3.axisLeft(scale).ticks(5).tickSizeOuter(0));
    g.selectAll('text').attr('fill', C.muted).attr('font-size', 10.5);
    g.selectAll('line').attr('stroke', C.grid);
    g.select('.domain').attr('stroke', C.grid);
  };
}

export function gridY(g, scale, width, ticks = 5) {
  g.selectAll('line').data(scale.ticks(ticks)).join('line')
    .attr('x1', 0).attr('x2', width)
    .attr('y1', d => scale(d)).attr('y2', d => scale(d))
    .attr('stroke', C.grid).attr('stroke-dasharray', '2 4').attr('opacity', .65);
}

export function label(svg, x, y, text, opts = {}) {
  return svg.append('text')
    .attr('x', x).attr('y', y)
    .attr('fill', opts.fill || C.muted)
    .attr('font-size', opts.size || 10.5)
    .attr('font-weight', opts.weight || 500)
    .attr('text-anchor', opts.anchor || 'start')
    .attr('letter-spacing', opts.spacing || 0)
    .text(text);
}

export function wrapText(textSel, width) {
  textSel.each(function () {
    const text = d3.select(this);
    const words = text.text().split(/\s+/).reverse();
    const x = text.attr('x'), y = text.attr('y');
    let line = [], lineNumber = 0, tspan = text.text(null).append('tspan').attr('x', x).attr('y', y);
    let word;
    while ((word = words.pop())) {
      line.push(word);
      tspan.text(line.join(' '));
      if (tspan.node().getComputedTextLength() > width) {
        line.pop();
        tspan.text(line.join(' '));
        line = [word];
        tspan = text.append('tspan').attr('x', x).attr('y', +y + (++lineNumber) * 13).text(word);
      }
    }
  });
}

export function debounce(fn, ms = 60) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
