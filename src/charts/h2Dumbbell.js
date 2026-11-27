import * as d3 from 'd3';
import { SEMANTIC_PALETTE } from './palette.js';
import { animDelay, animDur, MOTION, shouldAnimate } from './motion.js';
import { bindTooltipEvents, buildTooltipCard, createChartTooltip, fmtCompactBrl, fmtPct, fmtRatio } from './tooltip.js';

const SHORT = { REPUBLICANOS: 'REPUBL.', SOLIDARIEDADE: 'SOLID.', CIDADANIA: 'CIDAD.' };

// Cores dedicadas e imutáveis por rótulo dentro do Gráfico 2
const H2_COLORS = {
  y2022: '#4B636E',
  y2026Recuou: '#FA532E',
  y2026Avancou: '#0284C7',
  y2026Paridade: '#007D5B',
  pub2022: '#007D5B',
  priv2022: '#F8DF4F',
  priv2022Stroke: '#C98A00',
  pub2026: '#0284C7',
  priv2026: '#FA532E',
};

/**
 * H2 — Gráfico 2:
 * - Passos 0 e 1: Dumbbell da Razão da Mediana (Mulheres ÷ Homens, 2022 → 2026) nos 10 maiores partidos.
 * - Passo 2: Apenas Composição da Receita (2022 · Todos os partidos).
 * - Passo 3: Composição da Receita comparando 2022 vs. 2026 (barras separadas por ano com cores dedicadas).
 */
export function renderH2Dumbbell(
  container,
  gapData,
  h2b22,
  h2b26,
  {
    step = 3,
    prevStep = 3,
    width = 720,
    selectedParty = '',
    onSelectParty = null,
    onClearParty = null,
  } = {},
) {
  container.innerHTML = '';

  const isCompositionOnly = step >= 2;
  const isCompact = width < 480;

  if (isCompositionOnly) {
    renderCompositionChart(container, h2b22, h2b26, { step, prevStep, width, isCompact });
    return;
  }

  const rows = (gapData?.rows || [])
    .filter((r) => r.medM2022 > 0 && r.medM2026 > 0 && r.medF2022 !== null)
    .map((r) => ({
      ...r,
      r22: r.medF2022 / r.medM2022,
      r26: r.medF2026 / r.medM2026,
    }))
    .sort((a, b) => a.r26 - b.r26);

  if (rows.length === 0) {
    container.innerHTML = '<p class="chart-empty">Sem partidos com amostra mínima (≥5 candidatas e ≥5 candidatos em 2022 e 2026) neste recorte.</p>';
    return;
  }

  // Margem direita reservada para coluna alinhada de valores (sem colisão com pontos/setas/linha 1,0×)
  const valColW = isCompact ? 50 : 62;
  const margin = { top: 38, right: valColW + 12, bottom: 44, left: isCompact ? 86 : 114 };
  const rowH = isCompact ? 24 : 27;
  const dbH = Math.max(220, rows.length * rowH);
  const svgW = width;
  const svgH = margin.top + dbH + margin.bottom;
  const W = svgW - margin.left - margin.right;

  const maxRatio = Math.max(1.45, d3.max(rows, (r) => Math.max(r.r22, r.r26)) * 1.12);
  const x = d3.scaleLinear().domain([0, maxRatio]).range([0, W]);
  const y = d3.scalePoint().domain(rows.map((r) => r.party)).range([12, dbH - 12]).padding(0.45);

  const tipCtrl = createChartTooltip(container, { wrapClass: 'h2-wrap', tooltipClass: 'h2-tooltip' });
  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('class', 'h2-gap-svg')
    .attr('viewBox', `0 0 ${svgW} ${svgH}`)
    .attr('width', svgW)
    .attr('height', svgH)
    .attr('role', 'img')
    .attr('aria-label', 'Razão da mediana de financiamento Mulheres ÷ Homens nos 10 maiores partidos (2022 para 2026)')
    .style('font-family', 'Inter, system-ui, sans-serif');

  if (onClearParty) {
    svg.on('click', (evt) => {
      if (selectedParty && !evt.target.closest('.h2-row')) onClearParty();
    });
  }

  const defs = svg.append('defs');
  [
    { id: 'h2-arr-recuou', color: H2_COLORS.y2026Recuou },
    { id: 'h2-arr-paridade', color: H2_COLORS.y2026Paridade },
    { id: 'h2-arr-avancou', color: H2_COLORS.y2026Avancou },
  ].forEach((m) => {
    defs.append('marker')
      .attr('id', m.id)
      .attr('viewBox', '0 -4 8 8')
      .attr('refX', 6.5)
      .attr('refY', 0)
      .attr('markerUnits', 'userSpaceOnUse')
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-3.6L7.5,0L0,3.6Z')
      .attr('fill', m.color);
  });

  const getRowStyle = (d) => {
    if (d.r26 >= 1.0) return { color: H2_COLORS.y2026Paridade, marker: 'url(#h2-arr-paridade)', status: 'Paridade ≥ 1,0×', tone: 'above' };
    if (d.r26 < d.r22) return { color: H2_COLORS.y2026Recuou, marker: 'url(#h2-arr-recuou)', status: 'Recuou em 2026', tone: 'below' };
    return { color: H2_COLORS.y2026Avancou, marker: 'url(#h2-arr-avancou)', status: 'Avançou (< 1,0×)', tone: 'neutral' };
  };

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // Eixo X inferior sem linhas pontilhadas horizontais
  g.append('g')
    .attr('transform', `translate(0,${dbH})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat((d) => `${d.toFixed(1).replace('.', ',')}×`))
    .call((a) => a.select('.domain').attr('stroke', '#CBD5E1'))
    .call((a) => a.selectAll('.tick text').attr('fill', SEMANTIC_PALETTE.muted).style('font-size', '11px'));

  g.append('text')
    .attr('x', W / 2)
    .attr('y', dbH + 34)
    .attr('text-anchor', 'middle')
    .attr('fill', SEMANTIC_PALETTE.muted)
    .style('font-size', '10.5px')
    .style('font-weight', '600')
    .text('Razão da Receita Mediana (Mulheres ÷ Homens)');

  // Eixo Y sem linhas pontilhadas (apenas trilho sólido muito sutil)
  g.append('g')
    .call(d3.axisLeft(y).tickSize(0).tickFormat((d) => (isCompact && SHORT[d] ? SHORT[d] : d)))
    .call((a) => a.select('.domain').remove())
    .call((a) => a.selectAll('.tick text').attr('fill', SEMANTIC_PALETTE.ink).style('font-size', isCompact ? '10px' : '11px').style('font-weight', '700'));

  // Linha de referência de paridade sólida e discreta (sem pontilhado)
  const parityX = x(1.0);
  g.append('line')
    .attr('x1', parityX)
    .attr('x2', parityX)
    .attr('y1', -6)
    .attr('y2', dbH)
    .attr('stroke', H2_COLORS.y2026Paridade)
    .attr('stroke-opacity', 0.45)
    .attr('stroke-width', 1.5);

  g.append('text')
    .attr('x', parityX)
    .attr('y', -14)
    .attr('text-anchor', 'middle')
    .attr('fill', H2_COLORS.y2026Paridade)
    .style('font-size', '10.5px')
    .style('font-weight', '700')
    .text('Paridade (1,0×)');

  const show26 = step >= 1;
  const prevShow26 = prevStep >= 1 && prevStep < 2;
  const animate = shouldAnimate();
  const dur = animDur(560);

  // Cabeçalho da coluna de valores à direita
  g.append('text')
    .attr('x', W + valColW)
    .attr('y', -14)
    .attr('text-anchor', 'end')
    .attr('fill', show26 ? SEMANTIC_PALETTE.ink : H2_COLORS.y2022)
    .style('font-size', '10px')
    .style('font-weight', '700')
    .text(show26 ? '2026 (F÷M)' : '2022 (F÷M)');

  const tracksG = g.append('g');

  rows.forEach((d, idx) => {
    const st = getRowStyle(d);
    const cy = y(d.party);
    const dimmed = Boolean(selectedParty && selectedParty !== d.party);
    const delay = animDelay(idx * 24);
    const row = tracksG.append('g')
      .attr('class', 'h2-row')
      .attr('data-party', d.party)
      .style('cursor', onSelectParty ? 'pointer' : 'default')
      .style('opacity', dimmed ? 0.28 : 1);

    row.append('rect')
      .attr('x', -margin.left)
      .attr('y', cy - rowH / 2)
      .attr('width', svgW)
      .attr('height', rowH)
      .attr('fill', 'transparent');

    // Guia horizontal contínua muito sutil no lugar do pontilhado
    row.append('line')
      .attr('x1', 0)
      .attr('x2', W)
      .attr('y1', cy)
      .attr('y2', cy)
      .attr('stroke', '#EEF2F0')
      .attr('stroke-width', 1);

    const x22 = x(d.r22);
    const x26 = x(d.r26);
    const dx = x26 - x22;
    const hasArrow = show26 && Math.abs(dx) >= 14;
    // Encurta o fim do segmento até a borda do círculo (r = 6 + folga) para a seta não ficar escondida sob o ponto
    const lineEndX26 = hasArrow ? x26 - Math.sign(dx) * 7.5 : x26;

    const startX = animate && prevShow26 ? lineEndX26 : x22;
    const endX = show26 ? lineEndX26 : x22;

    const line = row.append('line')
      .attr('y1', cy)
      .attr('y2', cy)
      .attr('x1', x22)
      .attr('x2', animate ? startX : endX)
      .attr('stroke', show26 ? st.color : H2_COLORS.y2022)
      .attr('stroke-width', 2.6)
      .attr('marker-end', hasArrow ? st.marker : null);

    if (animate && startX !== endX) {
      line.transition().duration(dur).delay(delay).ease(MOTION.easeOut).attr('x2', endX);
    }

    // Ponto de 2022 sempre na mesma cor (#4B636E) em todos os passos
    row.append('circle')
      .attr('class', 'h2-dot-2022')
      .attr('cx', x22)
      .attr('cy', cy)
      .attr('r', 5.2)
      .attr('fill', H2_COLORS.y2022)
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 1.2);

    const dotStartX = animate && prevShow26 ? x26 : x22;
    const dot26 = row.append('circle')
      .attr('class', 'h2-dot-2026')
      .attr('cx', animate ? dotStartX : (show26 ? x26 : x22))
      .attr('cy', cy)
      .attr('r', animate ? (prevShow26 ? 6 : 0) : (show26 ? 6 : 0))
      .attr('fill', st.color)
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 1.2);

    if (animate) {
      dot26.transition().duration(dur).delay(delay).ease(MOTION.easeOut)
        .attr('cx', show26 ? x26 : x22)
        .attr('r', show26 ? 6 : 0);
    }

    // Valor numérico alinhado na coluna direita dedicada (nunca sobrepõe pontos, setas ou linha 1,0×)
    const valColor = show26 ? st.color : H2_COLORS.y2022;
    const valText = show26 ? fmtRatio(d.r26) : fmtRatio(d.r22);
    const valTxt = row.append('text')
      .attr('class', 'h2-val-label')
      .attr('x', W + valColW)
      .attr('y', cy + 4)
      .attr('text-anchor', 'end')
      .style('font-size', '10.5px')
      .style('font-weight', '700')
      .style('font-variant-numeric', 'tabular-nums')
      .style('opacity', animate && show26 && !prevShow26 ? 0 : 1)
      .attr('fill', valColor)
      .text(valText);

    if (animate && show26 && !prevShow26) {
      valTxt.transition().duration(260).delay(delay + 240).style('opacity', 1);
    }

    const node = row.node();
    node.setAttribute('tabindex', '0');
    node.setAttribute('role', 'button');
    node.setAttribute('aria-label', `${d.party}: razão 2022 ${fmtRatio(d.r22)}, 2026 ${fmtRatio(d.r26)}`);
    bindTooltipEvents(node, tipCtrl, () => buildTooltipCard({
      title: d.party,
      badge: show26 ? st.status : 'Baseline 2022',
      badgeTone: show26 ? st.tone : 'neutral',
      rows: [
        { label: 'Razão 2022 (F ÷ M)', value: fmtRatio(d.r22), focus: !show26 },
        { label: 'Razão 2026 (F ÷ M)', value: fmtRatio(d.r26), focus: show26 },
        { label: 'Mediana F (2026)', value: fmtCompactBrl(d.medF2026) },
        { label: 'Mediana M (2026)', value: fmtCompactBrl(d.medM2026) },
      ],
      hint: onSelectParty ? 'Clique para destacar este partido nos demais gráficos' : '',
    }), { focusable: true });

    if (onSelectParty) {
      row.on('click', (evt) => {
        evt.stopPropagation();
        onSelectParty(d.party);
      });
      row.on('keydown', (evt) => {
        if (evt.key === 'Enter' || evt.key === ' ') {
          evt.preventDefault();
          onSelectParty(d.party);
        }
      });
    }
  });
}

function renderCompositionChart(container, h2b22, h2b26, { step, prevStep, width, isCompact }) {
  const show2026 = step >= 3;
  const was2026 = prevStep >= 3;
  const animate = shouldAnimate();
  const dur = animDur(540);

  const pub22F = (h2b22?.pubShareF ?? 0) * 100;
  const pub22M = (h2b22?.pubShareM ?? 0) * 100;
  const pub26F = (h2b26?.pubShareF ?? 0) * 100;
  const pub26M = (h2b26?.pubShareM ?? 0) * 100;

  const groups = [
    {
      label: 'Mulheres',
      bars: [
        { year: 2022, pub: pub22F, priv: Math.max(0, 100 - pub22F), pubCol: H2_COLORS.pub2022, privCol: H2_COLORS.priv2022, privStroke: H2_COLORS.priv2022Stroke, tagCol: H2_COLORS.y2022 },
        ...(show2026 ? [{ year: 2026, pub: pub26F, priv: Math.max(0, 100 - pub26F), pubCol: H2_COLORS.pub2026, privCol: H2_COLORS.priv2026, privStroke: H2_COLORS.priv2026, tagCol: H2_COLORS.pub2026 }] : []),
      ],
    },
    {
      label: 'Homens',
      bars: [
        { year: 2022, pub: pub22M, priv: Math.max(0, 100 - pub22M), pubCol: H2_COLORS.pub2022, privCol: H2_COLORS.priv2022, privStroke: H2_COLORS.priv2022Stroke, tagCol: H2_COLORS.y2022 },
        ...(show2026 ? [{ year: 2026, pub: pub26M, priv: Math.max(0, 100 - pub26M), pubCol: H2_COLORS.pub2026, privCol: H2_COLORS.priv2026, privStroke: H2_COLORS.priv2026, tagCol: H2_COLORS.pub2026 }] : []),
      ],
    },
  ];

  const margin = { top: 44, right: isCompact ? 16 : 24, bottom: 40, left: isCompact ? 94 : 114 };
  const barH = 26;
  const barGap = 8;
  const groupH = show2026 ? barH * 2 + barGap + 24 : barH + 26;
  const svgW = width;
  const svgH = margin.top + groups.length * groupH + margin.bottom;
  const W = svgW - margin.left - margin.right;

  const tipCtrl = createChartTooltip(container, { wrapClass: 'h2-wrap h2-comp-wrap', tooltipClass: 'h2-tooltip' });
  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('class', 'h2-comp-svg')
    .attr('viewBox', `0 0 ${svgW} ${svgH}`)
    .attr('width', svgW)
    .attr('height', svgH)
    .attr('role', 'img')
    .attr('aria-label', show2026
      ? 'Composição da receita em 2022 e 2026 (Todos os partidos): Fundo Público vs. Recursos Privados'
      : 'Composição da receita em 2022 (Todos os partidos): Fundo Público vs. Recursos Privados')
    .style('font-family', 'Inter, system-ui, sans-serif');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  g.append('text')
    .attr('x', -margin.left + 4)
    .attr('y', -22)
    .attr('fill', SEMANTIC_PALETTE.ink)
    .style('font-size', isCompact ? '10.5px' : '12px')
    .style('font-weight', '700')
    .text(show2026
      ? (isCompact ? 'Composição — Todos os Partidos (2022 vs. 2026)' : 'Composição da Receita — Todos os Partidos (2022 vs. 2026)')
      : (isCompact ? 'Composição — Todos os Partidos (2022)' : 'Composição da Receita — Todos os Partidos (2022)'));

  const xSrc = d3.scaleLinear().domain([0, 100]).range([0, W]);
  const chartH = groups.length * groupH - 8;

  g.append('g')
    .attr('transform', `translate(0,${chartH})`)
    .call(d3.axisBottom(xSrc).ticks(5).tickFormat((d) => `${d}%`))
    .call((a) => a.select('.domain').attr('stroke', '#CBD5E1'))
    .call((a) => a.selectAll('.tick text').attr('fill', SEMANTIC_PALETTE.muted).style('font-size', '10.5px'));

  groups.forEach((grp, gIdx) => {
    const gy = gIdx * groupH;
    const grpG = g.append('g').attr('transform', `translate(0,${gy})`);

    grpG.append('text')
      .attr('x', -margin.left + 4)
      .attr('y', show2026 ? barH + 5 : barH / 2 + 4)
      .attr('fill', SEMANTIC_PALETTE.ink)
      .style('font-size', isCompact ? '11px' : '12px')
      .style('font-weight', '700')
      .text(grp.label);

    grp.bars.forEach((b, bIdx) => {
      const yPos = bIdx * (barH + barGap);
      const isNew2026 = animate && b.year === 2026 && !was2026;
      const delay = animDelay(gIdx * 80 + bIdx * 60);

      const barRow = grpG.append('g')
        .attr('class', `h2b-src-bar h2b-yr-${b.year}`)
        .attr('tabindex', 0)
        .style('cursor', 'pointer');

      // Etiqueta fixa do ano (2022 sempre na cor #4B636E, 2026 na cor dedicada #0284C7)
      barRow.append('text')
        .attr('x', -10)
        .attr('y', yPos + barH / 2 + 4)
        .attr('text-anchor', 'end')
        .attr('fill', b.tagCol)
        .style('font-size', '10.5px')
        .style('font-weight', '700')
        .text(String(b.year));

      const pubW = Math.max(0, xSrc(b.pub));
      const privStart = xSrc(b.pub) + 2;
      const privW = Math.max(0, xSrc(b.priv) - 2);

      const pubRect = barRow.append('rect')
        .attr('x', 0)
        .attr('y', yPos)
        .attr('width', isNew2026 ? 0 : pubW)
        .attr('height', barH)
        .attr('rx', 4)
        .attr('fill', b.pubCol);

      const privRect = barRow.append('rect')
        .attr('x', isNew2026 ? 2 : privStart)
        .attr('y', yPos)
        .attr('width', isNew2026 ? 0 : privW)
        .attr('height', barH)
        .attr('rx', 4)
        .attr('fill', b.privCol)
        .attr('stroke', b.privStroke)
        .attr('stroke-width', 0.8);

      if (isNew2026) {
        pubRect.transition().duration(dur).delay(delay).ease(MOTION.easeOut).attr('width', pubW);
        privRect.transition().duration(dur).delay(delay + 120).ease(MOTION.easeOut)
          .attr('x', privStart)
          .attr('width', privW);
      }

      if (pubW > 42) {
        const pubLbl = barRow.append('text')
          .attr('x', 10)
          .attr('y', yPos + barH / 2 + 4)
          .attr('fill', '#FFFFFF')
          .style('font-size', isCompact ? '9.5px' : '10.5px')
          .style('font-weight', '700')
          .style('opacity', isNew2026 ? 0 : 1)
          .text(pubW > 138 ? `Fundo Público: ${fmtPct(b.pub)}` : fmtPct(b.pub));
        if (isNew2026) pubLbl.transition().duration(260).delay(delay + 260).style('opacity', 1);
      }

      if (privW > 38) {
        const privLblColor = b.year === 2022 ? '#142620' : '#FFFFFF';
        const privLbl = barRow.append('text')
          .attr('x', privStart + 8)
          .attr('y', yPos + barH / 2 + 4)
          .attr('fill', privLblColor)
          .style('font-size', isCompact ? '9.5px' : '10.5px')
          .style('font-weight', '700')
          .style('opacity', isNew2026 ? 0 : 1)
          .text(privW > 110 ? `Privado: ${fmtPct(b.priv)}` : fmtPct(b.priv));
        if (isNew2026) privLbl.transition().duration(260).delay(delay + 300).style('opacity', 1);
      }

      bindTooltipEvents(barRow.node(), tipCtrl, () => buildTooltipCard({
        title: `${grp.label} · ${b.year}`,
        badge: 'Todos os partidos',
        badgeTone: grp.label === 'Mulheres' ? 'below' : 'neutral',
        rows: [
          { label: 'Fundo Público (FEFC + FP)', value: fmtPct(b.pub), focus: true },
          { label: 'Recursos Privados / Próprios', value: fmtPct(b.priv) },
        ],
      }), { focusable: true });
    });
  });
}
