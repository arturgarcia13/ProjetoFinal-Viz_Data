import { SEMANTIC_PALETTE } from './palette.js';
import { drawPath, revealAnnotation, shouldAnimate } from './motion.js';

/**
 * Helper de anotação direta no SVG (callout curvo + ponto no alvo + halo legível + entrada coreografada).
 */
export function addDirectAnnotation(layer, {
  x1,
  y1,
  x2,
  y2,
  title,
  subtitle = '',
  anchor = 'start',
  color = SEMANTIC_PALETTE.female,
  noLine = false,
  animate = true,
}) {
  const g = layer.append('g').attr('class', 'direct-annotation').style('pointer-events', 'none');
  const halo = (sel) => sel
    .attr('paint-order', 'stroke')
    .attr('stroke', '#FFFFFF')
    .attr('stroke-width', 4)
    .attr('stroke-linejoin', 'round');

  if (!noLine) {
    const sy = y1 - 5 + (subtitle ? 19 : 5);
    const sx = anchor === 'end' ? x1 : x1 + 6;
    const p = g.append('path')
      .attr('d', `M ${sx},${sy} Q ${(sx + x2) / 2},${sy} ${x2},${y2}`)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 1.7)
      .attr('stroke-dasharray', '3,2');
    if (animate && shouldAnimate()) {
      drawPath(p, { duration: 420, delay: 180, preserveDash: '3,2' });
    }
    const dot = g.append('circle')
      .attr('cx', x2)
      .attr('cy', y2)
      .attr('r', animate && shouldAnimate() ? 0 : 4)
      .attr('fill', color)
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 1.5);
    if (animate && shouldAnimate()) {
      dot.transition().duration(240).delay(380).attr('r', 4);
    }
  }

  const labelG = g.append('g').attr('transform', `translate(${x1}, ${y1 - 5})`);
  halo(
    labelG.append('text')
      .attr('text-anchor', anchor)
      .attr('fill', color)
      .style('font-family', 'Inter, sans-serif')
      .style('font-size', '11.5px')
      .style('font-weight', '700')
      .text(title),
  );
  if (subtitle) {
    halo(
      labelG.append('text')
        .attr('y', 14)
        .attr('text-anchor', anchor)
        .attr('fill', SEMANTIC_PALETTE.muted)
        .style('font-family', 'Inter, sans-serif')
        .style('font-size', '10.5px')
        .style('font-weight', '500')
        .text(subtitle),
    );
  }
  if (animate) revealAnnotation(labelG, { delay: 180, duration: 360 });
  return g;
}
