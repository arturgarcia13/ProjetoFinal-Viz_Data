import 'd3-transition';
import { SEMANTIC_PALETTE } from './palette.js';

/**
 * Anotação direta no SVG: texto + curva tracejada + ponto no alvo.
 * Portada do ensaio de referência.
 */
export function addDirectAnnotation(layer, {
  x1, y1, x2, y2, title, subtitle = '', anchor = 'start', color = '#D93814',
}) {
  const g = layer.append('g').attr('class', 'direct-annotation').style('pointer-events', 'none');
  const ctrlX = (x1 + x2) / 2;
  g.append('path')
    .attr('d', `M ${x1},${y1} Q ${ctrlX},${y1} ${x2},${y2}`)
    .attr('fill', 'none').attr('stroke', color)
    .attr('stroke-width', 1.7).attr('stroke-dasharray', '3,2');
  g.append('circle').attr('cx', x2).attr('cy', y2).attr('r', 4).attr('fill', color);
  const label = g.append('g').attr('transform', `translate(${x1}, ${y1 - 5})`);
  label.append('text').attr('text-anchor', anchor).attr('fill', color)
    .style('font-family', 'Inter, sans-serif').style('font-size', '11.5px').style('font-weight', '700')
    .text(title);
  if (subtitle) {
    label.append('text').attr('y', 14).attr('text-anchor', anchor).attr('fill', SEMANTIC_PALETTE.muted)
      .style('font-family', 'Inter, sans-serif').style('font-size', '10.5px').style('font-weight', '500')
      .text(subtitle);
  }
  return g;
}
