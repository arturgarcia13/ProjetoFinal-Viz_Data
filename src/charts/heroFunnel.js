import * as d3 from 'd3';

function fmtPct(v) {
  return `${Number(v || 0).toFixed(1).replace('.', ',')}%`;
}

/**
 * SVG do Afunilamento da Representação no Hero (Boca superior da taça).
 * Recebe percentuais (0–100) reais de Candidaturas, Fundo Público e Cadeiras Eleitas.
 */
export function renderHeroFunnel(container, { cand = 0, verba = 0, eleitas = 0 } = {}) {
  if (!container) return;
  container.innerHTML = '';

  const W = 920;
  const H = 110;
  const svg = d3.select(container)
    .append('svg')
    .attr('id', 'hero-funnel-svg')
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('preserveAspectRatio', 'none')
    .attr('role', 'img')
    .attr('aria-label', `Diagrama de afunilamento: Candidaturas ${fmtPct(cand)}, Fundo Público ${fmtPct(verba)}, Eleitas ${fmtPct(eleitas)}`);

  const stages = [
    { x: 95, pct: cand, label: 'Candidaturas Aptas' },
    { x: 460, pct: verba, label: 'Fundo Público' },
    { x: 825, pct: eleitas, label: 'Cadeiras Eleitas' },
  ];

  const maxH = 74;
  const maxDomain = Math.max(45, Math.ceil(Math.max(cand, verba, eleitas, 32) / 5) * 5);
  const scaleH = d3.scaleLinear().domain([0, maxDomain]).range([8, maxH]).clamp(true);

  svg.append('rect')
    .attr('x', 40)
    .attr('y', 16)
    .attr('width', W - 80)
    .attr('height', maxH)
    .attr('rx', 6)
    .attr('fill', 'rgba(255,255,255,0.06)')
    .attr('stroke', 'rgba(255,255,255,0.18)');

  const quotaH = scaleH(30);
  const quotaY = 16 + (maxH - quotaH) / 2;
  svg.append('line')
    .attr('x1', 40)
    .attr('x2', W - 40)
    .attr('y1', quotaY)
    .attr('y2', quotaY)
    .attr('stroke', 'rgba(248, 223, 79, 0.7)')
    .attr('stroke-dasharray', '4,4');

  svg.append('text')
    .attr('x', W - 46)
    .attr('y', quotaY - 4)
    .attr('text-anchor', 'end')
    .attr('fill', '#F8DF4F')
    .style('font-family', 'Inter, sans-serif')
    .style('font-size', '10.5px')
    .style('font-weight', '700')
    .text('Piso legal: 30%');

  const defs = svg.append('defs');
  const grad = defs.append('linearGradient')
    .attr('id', 'heroFunnelGrad')
    .attr('x1', '0%')
    .attr('x2', '100%');
  grad.append('stop').attr('offset', '0%').attr('stop-color', '#F8DF4F').attr('stop-opacity', 0.85);
  grad.append('stop').attr('offset', '50%').attr('stop-color', '#FC7CE5').attr('stop-opacity', 0.88);
  grad.append('stop').attr('offset', '100%').attr('stop-color', '#FA532E').attr('stop-opacity', 0.96);

  const centerY = 16 + maxH / 2;
  const ptsTop = stages.map((s) => [s.x, centerY - scaleH(s.pct) / 2]);
  const ptsBot = stages.slice().reverse().map((s) => [s.x, centerY + scaleH(s.pct) / 2]);

  svg.append('polygon')
    .attr('points', [...ptsTop, ...ptsBot].map((p) => p.join(',')).join(' '))
    .attr('fill', 'url(#heroFunnelGrad)');

  stages.forEach((s) => {
    const h = scaleH(s.pct);
    svg.append('line')
      .attr('x1', s.x)
      .attr('x2', s.x)
      .attr('y1', centerY - h / 2 - 4)
      .attr('y2', centerY + h / 2 + 4)
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 2.2);

    svg.append('text')
      .attr('x', s.x)
      .attr('y', H - 3)
      .attr('text-anchor', 'middle')
      .attr('fill', '#FFFFFF')
      .style('font-family', 'Inter, sans-serif')
      .style('font-size', '11px')
      .style('font-weight', '700')
      .text(`${s.label}: ${fmtPct(s.pct)}`);
  });
}
