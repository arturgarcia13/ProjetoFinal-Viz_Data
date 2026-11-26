import * as d3 from 'd3';
import { SEMANTIC_PALETTE } from './palette.js';
import { addDirectAnnotation } from './annotate.js';
import { animDelay, animDur, drawPath, MOTION, shouldAnimate } from './motion.js';
import { bindTooltipEvents, buildTooltipCard, createChartTooltip, fmtPct } from './tooltip.js';

const SHORT = { REPUBLICANOS: 'REPUBL.', SOLIDARIEDADE: 'SOLID.', CIDADANIA: 'CIDAD.' };

/**
 * H5 — Funil de conversão por partido com constância de objeto bidirecional (step <-> prevStep).
 */
export function renderH5Conversion(
  container,
  h5Data,
  { step = 2, prevStep = 2, view = 'bars', width = 700, selectedParty = '', onSelectParty = null, onClearParty = null } = {},
) {
  container.innerHTML = '';
  const parties = (h5Data?.byParty || []).map((p) => ({
    party: p.party,
    cand: p.pctCandF * 100,
    votos: p.pctVotosF * 100,
    eleitas: p.pctEleitasF * 100,
  }));

  if (parties.length === 0) {
    container.innerHTML = '<p class="chart-empty">Sem partidos com cadeiras eleitas suficientes neste recorte.</p>';
    return;
  }

  const stages = [
    { key: 'cand', label: '1. Candidatas', color: SEMANTIC_PALETTE.male, min: 0 },
    { key: 'votos', label: '2. Votos nominais', color: '#E5A910', min: 1 },
    { key: 'eleitas', label: '3. Eleitas', color: SEMANTIC_PALETTE.female, min: 2 },
  ];

  const isCompact = width < 460;
  const margin = { top: 34, right: 14, bottom: isCompact ? 64 : 44, left: 42 };
  const W = width - margin.left - margin.right;
  const H = isCompact ? 280 : 330;
  const yMax = Math.max(44, Math.ceil((d3.max(parties, (p) => Math.max(p.cand, p.votos, p.eleitas)) + 4) / 10) * 10);

  const tipCtrl = createChartTooltip(container);
  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('class', 'h5-conversion-svg')
    .attr('viewBox', `0 0 ${width} ${H + margin.top + margin.bottom}`)
    .attr('width', width).attr('height', H + margin.top + margin.bottom)
    .attr('role', 'img')
    .attr('aria-label', 'Conversão de candidaturas em votos e cadeiras por partido, ordenado pela taxa de eleitas')
    .style('font-family', 'Inter, system-ui, sans-serif');
  if (onClearParty) svg.on('click', (evt) => { if (selectedParty && !evt.target.closest('.h5-party-row')) onClearParty(); });
  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x0 = d3.scaleBand().domain(parties.map((p) => p.party)).range([0, W]).paddingInner(0.28).paddingOuter(0.08);
  const x1 = d3.scaleBand().domain(stages.map((s) => s.key)).range([0, x0.bandwidth()]).padding(0.1);
  const y = d3.scaleLinear().domain([0, yMax]).range([H, 0]);

  g.append('g')
    .call(d3.axisLeft(y).ticks(5).tickSize(-W).tickFormat((d) => `${d}%`))
    .call((a) => a.select('.domain').remove())
    .call((a) => a.selectAll('.tick line').attr('stroke', SEMANTIC_PALETTE.grid))
    .call((a) => a.selectAll('.tick text').attr('fill', SEMANTIC_PALETTE.muted).attr('font-size', 11));

  const y30 = y(30);
  g.append('line').attr('x1', 0).attr('x2', W).attr('y1', y30).attr('y2', y30)
    .attr('stroke', SEMANTIC_PALETTE.emerald).attr('stroke-width', 2).attr('stroke-dasharray', '5,4');
  g.append('text').attr('x', W - 4).attr('y', y30 - 6).attr('text-anchor', 'end')
    .attr('fill', SEMANTIC_PALETTE.emerald).attr('font-size', 11).attr('font-weight', 700).text('Meta legal: 30%');

  g.append('line').attr('x1', 0).attr('x2', W).attr('y1', H).attr('y2', H).attr('stroke', '#CBD5E1');

  const animate = shouldAnimate();
  const dur = animDur(520);

  parties.forEach((p, pIdx) => {
    const gx = x0(p.party);
    const dimmed = selectedParty && selectedParty !== p.party;
    const delay = animDelay(pIdx * 22);
    const row = g.append('g').attr('class', 'h5-party-row').attr('data-party', p.party)
      .attr('transform', `translate(${gx},0)`)
      .style('cursor', onSelectParty ? 'pointer' : 'default')
      .style('opacity', dimmed ? 0.3 : 1);

    row.append('rect').attr('x', -6).attr('y', 0).attr('width', x0.bandwidth() + 12).attr('height', H + margin.bottom - 6).attr('fill', 'transparent');

    const label = SHORT[p.party] && x0.bandwidth() < 62 ? SHORT[p.party] : p.party;
    const lx = x0.bandwidth() / 2;
    row.append('text').attr('class', 'h5-party-label')
      .attr('x', lx).attr('y', isCompact ? H + 10 : H + 16).attr('text-anchor', isCompact ? 'end' : 'middle')
      .attr('transform', isCompact ? `rotate(-90 ${lx} ${H + 10})` : null)
      .attr('dy', isCompact ? '0.35em' : null)
      .attr('font-size', isCompact ? 9.5 : 10.5).attr('font-weight', 700)
      .attr('fill', selectedParty === p.party ? SEMANTIC_PALETTE.female : SEMANTIC_PALETTE.ink).text(label);

    if (view === 'bars') {
      stages.forEach((s) => {
        const wasShown = prevStep >= s.min;
        const isShown = step >= s.min;
        if (!wasShown && !isShown) return;
        const targetY = y(p[s.key]);
        const targetH = H - targetY;
        const bar = row.append('rect').attr('class', `h5-bar h5-bar-${s.key}`)
          .attr('x', x1(s.key)).attr('width', x1.bandwidth()).attr('rx', 2).attr('fill', s.color)
          .attr('y', animate ? (wasShown ? targetY : H) : (isShown ? targetY : H))
          .attr('height', animate ? (wasShown ? targetH : 0) : (isShown ? targetH : 0));
        if (animate && wasShown !== isShown) {
          bar.transition().duration(dur).delay(delay).ease(MOTION.easeOut)
            .attr('y', isShown ? targetY : H)
            .attr('height', isShown ? targetH : 0);
        }
      });
    } else {
      const visible = stages.filter((s) => step >= s.min);
      const pts = visible.map((s) => ({ s, cx: x1(s.key) + x1.bandwidth() / 2, cy: y(p[s.key]) }));
      if (pts.length > 1) {
        const slopePath = row.append('path').datum(pts).attr('d', d3.line().x((d) => d.cx).y((d) => d.cy))
          .attr('fill', 'none').attr('stroke', p.eleitas >= 30 ? SEMANTIC_PALETTE.emerald : '#94A3B8')
          .attr('stroke-width', p.eleitas >= 30 ? 3 : 2).attr('stroke-opacity', 0.88);
        if (animate && step > prevStep) drawPath(slopePath, { duration: 480, delay });
      }
      pts.forEach((pt) => {
        const isNew = animate && step > prevStep && pt.s.min === step;
        const c = row.append('circle').attr('class', 'h5-bar')
          .attr('cx', pt.cx).attr('cy', pt.cy)
          .attr('r', isNew ? 0 : 4.6)
          .attr('fill', pt.s.color);
        if (isNew) c.transition().duration(320).delay(delay + 120).ease(MOTION.easeOut).attr('r', 4.6);
      });
    }

    const node = row.node();
    node.setAttribute('tabindex', '0');
    node.setAttribute('role', 'button');
    node.setAttribute('aria-label', `${p.party}: candidatas ${fmtPct(p.cand)}, votos ${fmtPct(p.votos)}, eleitas ${fmtPct(p.eleitas)}`);
    bindTooltipEvents(node, tipCtrl, () => buildTooltipCard({
      title: p.party,
      rows: [
        { label: '1. Candidatas', value: fmtPct(p.cand) },
        { label: '2. Votos nominais', value: fmtPct(p.votos) },
        { label: '3. Eleitas', value: fmtPct(p.eleitas), focus: true },
      ],
      hint: 'Clique para destacar o partido nos demais gráficos',
    }), { focusable: true });
    if (onSelectParty) {
      row.on('click', (evt) => { evt.stopPropagation(); onSelectParty(p.party); });
      row.on('keydown', (evt) => { if (evt.key === 'Enter' || evt.key === ' ') { evt.preventDefault(); onSelectParty(p.party); } });
    }
  });

  const annG = g.append('g');
  if (step === 1) {
    const worst = [...parties].sort((a, b) => (b.cand - b.votos) - (a.cand - a.votos))[0];
    if (worst) {
      const tx = x0(worst.party) + x1('votos') + x1.bandwidth() / 2;
      const ty = y(worst.votos);
      addDirectAnnotation(annG, {
        x1: Math.max(70, tx - 110), y1: Math.max(24, ty - 40), x2: tx, y2: ty - 4,
        title: `${worst.party}: −${(worst.cand - worst.votos).toFixed(1).replace('.', ',')} p.p. já na urna`,
        subtitle: 'Votos concentram-se nos homens', color: '#7A5200',
        animate: prevStep !== 1,
      });
    }
  }
  if (step >= 2) {
    const best = [...parties].sort((a, b) => b.eleitas - a.eleitas)[0];
    if (best) {
      const tx = x0(best.party) + x1('eleitas') + x1.bandwidth() / 2;
      const ty = y(best.eleitas);
      addDirectAnnotation(annG, {
        x1: Math.min(W - 140, tx + 40), y1: Math.max(24, ty - 24), x2: tx + 3, y2: ty - 3,
        title: `${best.party}: maior fatia de eleitas`, subtitle: `${fmtPct(best.eleitas)} das cadeiras`, color: SEMANTIC_PALETTE.emerald,
        animate: prevStep < 2,
      });
    }
  }
}
