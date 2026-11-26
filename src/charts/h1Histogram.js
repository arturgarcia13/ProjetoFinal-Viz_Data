import * as d3 from 'd3';
import { SEMANTIC_PALETTE } from './palette.js';
import { addDirectAnnotation } from './annotate.js';
import { animDelay, animDur, MOTION, shouldAnimate } from './motion.js';
import { bindTooltipEvents, buildTooltipCard, createChartTooltip, fmtInt, fmtPct, fmtSignedPP } from './tooltip.js';

const BIN_DEFS = [
  { id: 'lt24', range: '<24%', short: '<24', min: 0, max: 24, zone: 'below', status: 'Abaixo da cota' },
  { id: '24-27', range: '24–27%', short: '24–27', min: 24, max: 27, zone: 'below', status: 'Abaixo da cota' },
  { id: '27-30', range: '27–30%', short: '27–30', min: 27, max: 30, zone: 'below', status: 'Logo abaixo do piso' },
  { id: '30-33', range: '30–33%', short: '30–33', min: 30, max: 33.4, zone: 'floor', status: 'Limiar legal (teto operacional)', isQuota: true },
  { id: '33-36', range: '33–36%', short: '33–36', min: 33.4, max: 36, zone: 'above', status: 'Acima do piso' },
  { id: '36-39', range: '36–39%', short: '36–39', min: 36, max: 39, zone: 'above', status: 'Acima do piso' },
  { id: '39-42', range: '39–42%', short: '39–42', min: 39, max: 42, zone: 'above', status: 'Acima da cota' },
  { id: '42+', range: '≥42%', short: '≥42', min: 42, max: 101, zone: 'above', status: 'Ampla participação' },
];

export function computeH1EightBins(candidates, { cargo = 'all', uf = '', party = '' } = {}) {
  const calcYear = (yr) => {
    const slates = new Map();
    const slateParties = new Map();
    for (const c of candidates) {
      if (c.y !== yr) continue;
      if (cargo && cargo !== 'all' && c.cargo !== cargo) continue;
      if (uf && c.uf !== uf) continue;
      if (party && c.p !== party) continue;
      if (c.g !== 'F' && c.g !== 'M') continue;

      const sk = c.slateKey || `${c.y}|${c.uf}|${c.cargo}|${c.chapa}`;
      if (!slates.has(sk)) {
        slates.set(sk, {
          key: sk,
          nReg: c.slateNReg ?? 0,
          pctReg: (c.slatePctReg ?? 0) * 100,
          nApto: c.slateNApto ?? 0,
          pctApto: (c.slatePctApto ?? 0) * 100,
        });
      }
      let pSet = slateParties.get(sk);
      if (!pSet) {
        pSet = new Set();
        slateParties.set(sk, pSet);
      }
      pSet.add(c.p);
    }

    const regValid = [...slates.values()].filter((s) => s.nReg >= 4);
    const aptoValid = [...slates.values()].filter((s) => s.nApto >= 4);
    return { regValid, aptoValid, slateParties };
  };

  const y22 = calcYear(2022);
  const y26 = calcYear(2026);

  const bins = BIN_DEFS.map((def) => {
    const pick = (yrObj, isApto) => {
      const list = isApto ? yrObj.aptoValid : yrObj.regValid;
      const matched = list.filter((s) => {
        const val = isApto ? s.pctApto : s.pctReg;
        return val >= def.min && val < def.max;
      });
      const parties = new Set();
      for (const s of matched) {
        const pSet = yrObj.slateParties.get(s.key);
        if (pSet) pSet.forEach((p) => parties.add(p));
      }
      return {
        n: matched.length,
        total: list.length,
        pct: list.length > 0 ? (matched.length / list.length) * 100 : 0,
        parties: [...parties],
      };
    };

    const r22 = pick(y22, false);
    const a22 = pick(y22, true);
    const r26 = pick(y26, false);
    const a26 = pick(y26, true);
    const unionReg = new Set([...r22.parties, ...r26.parties]);
    const unionApto = new Set([...a22.parties, ...a26.parties]);

    return {
      ...def,
      r22,
      a22,
      r26,
      a26,
      partiesReg: [...unionReg].sort(),
      partiesApto: [...unionApto].sort(),
    };
  });

  return {
    bins,
    totals: {
      reg22: y22.regValid.length,
      apto22: y22.aptoValid.length,
      reg26: y26.regValid.length,
      apto26: y26.aptoValid.length,
    },
  };
}

/**
 * H1 — Histograma Vertical (8 faixas) com constância de objeto bidirecional (step <-> prevStep).
 */
export function renderH1Histogram(
  container,
  h1EightData,
  {
    step = 3,
    prevStep = 3,
    width = 720,
    mode = 'reg',
    prevMode = mode,
    selectedBinId = null,
    onSelectBin = null,
  } = {},
) {
  container.innerHTML = '';
  const bins = h1EightData?.bins || [];
  const isApto = mode === 'apto';
  const wasApto = prevMode === 'apto';
  const tot22 = isApto ? (h1EightData?.totals?.apto22 || 0) : (h1EightData?.totals?.reg22 || 0);
  const tot26 = isApto ? (h1EightData?.totals?.apto26 || 0) : (h1EightData?.totals?.reg26 || 0);

  if (tot22 === 0 && tot26 === 0) {
    container.innerHTML = '<p class="chart-empty">Sem chapas com pelo menos 4 candidaturas neste recorte (2022 e 2026).</p>';
    return;
  }

  const isCompact = width < 460;
  const margin = { top: 44, right: isCompact ? 14 : 24, bottom: 58, left: 46 };
  const svgW = width;
  const svgH = isCompact ? 310 : 380;
  const W = svgW - margin.left - margin.right;
  const H = svgH - margin.top - margin.bottom;

  const val22 = (b) => (isApto ? b.a22.pct : b.r22.pct);
  const val26 = (b) => (isApto ? b.a26.pct : b.r26.pct);
  const prevVal22 = (b) => (wasApto ? b.a22.pct : b.r22.pct);
  const prevVal26 = (b) => (wasApto ? b.a26.pct : b.r26.pct);
  const cnt22 = (b) => (isApto ? b.a22.n : b.r22.n);
  const cnt26 = (b) => (isApto ? b.a26.n : b.r26.n);

  const maxDataPct = d3.max(bins, (b) => Math.max(b.r22.pct, b.r26.pct, b.a22.pct, b.a26.pct)) || 55;
  const maxVal = Math.max(60, maxDataPct * 1.15);
  const x = d3.scaleBand().domain(bins.map((b) => b.range)).range([0, W]).padding(0.2);
  const y = d3.scaleLinear().domain([0, maxVal]).range([H, 0]);

  const tipCtrl = createChartTooltip(container, { wrapClass: 'h1-wrap', tooltipClass: 'h1-tooltip' });
  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('class', 'h1-vertical-svg')
    .attr('viewBox', `0 0 ${svgW} ${svgH}`)
    .attr('width', svgW)
    .attr('height', svgH)
    .attr('role', 'img')
    .attr('aria-label', `Histograma de chapas por percentual de mulheres (${isApto ? 'Aptas' : 'Registradas'}), 2022 vs. 2026`)
    .style('font-family', 'Inter, system-ui, sans-serif');

  if (onSelectBin) {
    svg.on('click', (evt) => {
      if (selectedBinId && !evt.target.closest('.h1-col')) onSelectBin(null);
    });
  }

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const qBin = bins.find((b) => b.isQuota);
  const qX = x(qBin.range);
  g.append('rect')
    .attr('class', 'h1-floor-zone')
    .attr('x', qX - 5)
    .attr('y', 0)
    .attr('width', x.bandwidth() + 10)
    .attr('height', H)
    .attr('rx', 4)
    .attr('fill', 'rgba(248, 223, 79, 0.34)');

  g.append('line')
    .attr('x1', qX - 5)
    .attr('x2', qX - 5)
    .attr('y1', -14)
    .attr('y2', H)
    .attr('stroke', SEMANTIC_PALETTE.highlightInk)
    .attr('stroke-width', 2.2)
    .attr('stroke-dasharray', '4,3');

  g.append('text')
    .attr('x', qX)
    .attr('y', -18)
    .attr('fill', '#7A5200')
    .style('font-size', isCompact ? '10px' : '11.5px')
    .style('font-weight', '700')
    .text(isCompact ? 'Piso 30% (30%–33%)' : 'Piso legal: 30% (Janela crítica 30%–33%)');

  g.append('g')
    .call(d3.axisLeft(y).ticks(5).tickSize(-W).tickFormat((d) => `${Math.round(d)}%`))
    .call((a) => a.select('.domain').remove())
    .call((a) => a.selectAll('.tick line').attr('stroke', SEMANTIC_PALETTE.grid))
    .call((a) => a.selectAll('.tick text').attr('fill', SEMANTIC_PALETTE.muted).style('font-size', '11px'));

  g.append('g')
    .attr('transform', `translate(0,${H})`)
    .call(d3.axisBottom(x).tickFormat((r) => {
      const b = bins.find((item) => item.range === r);
      return isCompact && b ? b.short : r;
    }))
    .call((a) => a.select('.domain').attr('stroke', '#CBD5E1'))
    .call((a) => a.selectAll('.tick text')
      .attr('fill', SEMANTIC_PALETTE.ink)
      .style('font-size', isCompact ? '10px' : '11.5px')
      .style('font-weight', '600'));

  g.append('text')
    .attr('x', 0)
    .attr('y', H + 44)
    .attr('fill', SEMANTIC_PALETTE.muted)
    .style('font-size', isCompact ? '9.8px' : '11px')
    .text(isCompact
      ? `Chapas n ≥ 4 · ${isApto ? 'Aptas' : 'Registradas'} (2022: ${fmtInt(tot22)} · 2026: ${fmtInt(tot26)})`
      : `Nota: Chapas com n ≥ 4 candidaturas (${isApto ? 'Aptas' : 'Registradas'} · 2022: ${fmtInt(tot22)} chapas, 2026: ${fmtInt(tot26)} chapas).`);

  const show22 = step >= 1;
  const show26 = step >= 2;
  const prevShow22 = prevStep >= 1;
  const prevShow26 = prevStep >= 2;
  const modeChanged = mode !== prevMode;
  const dur = animDur(560);
  const animate = shouldAnimate();
  const barsG = g.append('g');

  bins.forEach((b, idx) => {
    const v22 = val22(b);
    const v26 = val26(b);
    const pv22 = prevVal22(b);
    const pv26 = prevVal26(b);
    const col = barsG.append('g')
      .attr('class', 'h1-col')
      .attr('data-bin', b.id)
      .style('cursor', onSelectBin ? 'pointer' : 'default');

    const selected = selectedBinId === b.id;
    col.append('rect')
      .attr('class', 'h1-col-hit')
      .attr('x', x(b.range) - 4)
      .attr('y', 0)
      .attr('width', x.bandwidth() + 8)
      .attr('height', H)
      .attr('rx', 4)
      .attr('fill', 'transparent')
      .attr('stroke', selected ? SEMANTIC_PALETTE.ink : 'none')
      .attr('stroke-width', 2);

    const w22 = show26 ? x.bandwidth() * 0.46 : x.bandwidth();
    const prevW22 = prevShow26 ? x.bandwidth() * 0.46 : x.bandwidth();
    const delay = animDelay(idx * 28);

    const startY22 = prevShow22 ? y(modeChanged ? pv22 : v22) : H;
    const startH22 = prevShow22 ? H - y(modeChanged ? pv22 : v22) : 0;
    const bar22 = col.append('rect')
      .attr('class', 'bar-2022')
      .attr('x', x(b.range))
      .attr('width', animate ? prevW22 : w22)
      .attr('rx', 3)
      .attr('fill', animate ? (prevShow26 ? SEMANTIC_PALETTE.male : SEMANTIC_PALETTE.female) : (show26 ? SEMANTIC_PALETTE.male : SEMANTIC_PALETTE.female))
      .attr('y', animate ? startY22 : (show22 ? y(v22) : H))
      .attr('height', animate ? startH22 : (show22 ? H - y(v22) : 0));

    if (animate) {
      bar22.transition().duration(dur).delay(delay).ease(MOTION.easeOut)
        .attr('width', w22)
        .attr('fill', show26 ? SEMANTIC_PALETTE.male : SEMANTIC_PALETTE.female)
        .attr('y', show22 ? y(v22) : H)
        .attr('height', show22 ? H - y(v22) : 0);
    }

    const startY26 = prevShow26 ? y(modeChanged ? pv26 : v26) : H;
    const startH26 = prevShow26 ? H - y(modeChanged ? pv26 : v26) : 0;
    const bar26 = col.append('rect')
      .attr('class', 'bar-2026')
      .attr('x', x(b.range) + x.bandwidth() * 0.52)
      .attr('width', x.bandwidth() * 0.46)
      .attr('rx', 3)
      .attr('fill', SEMANTIC_PALETTE.female)
      .attr('y', animate ? startY26 : (show26 ? y(v26) : H))
      .attr('height', animate ? startH26 : (show26 ? H - y(v26) : 0));

    if (animate) {
      bar26.transition().duration(dur).delay(delay).ease(MOTION.easeOut)
        .attr('y', show26 ? y(v26) : H)
        .attr('height', show26 ? H - y(v26) : 0);
    }

    if (show22 && v22 >= 1) {
      const lbl22 = col.append('text')
        .attr('class', 'bar-label')
        .attr('x', x(b.range) + w22 / 2)
        .attr('y', y(v22) - 4)
        .attr('text-anchor', 'middle')
        .attr('font-size', isCompact ? 8.5 : 10)
        .attr('font-weight', 700)
        .attr('fill', show26 ? SEMANTIC_PALETTE.male : '#D93814')
        .style('opacity', animate && !prevShow22 ? 0 : 1)
        .text(fmtPct(v22, 0));
      if (animate && !prevShow22) {
        lbl22.transition().duration(260).delay(delay + 240).style('opacity', 1);
      }
    }
    if (show26 && v26 >= 1) {
      const lbl26 = col.append('text')
        .attr('class', 'bar-label')
        .attr('x', x(b.range) + x.bandwidth() * 0.75)
        .attr('y', y(v26) - 4)
        .attr('text-anchor', 'middle')
        .attr('font-size', isCompact ? 8.5 : 10)
        .attr('font-weight', 700)
        .attr('fill', '#D93814')
        .style('opacity', animate && !prevShow26 ? 0 : 1)
        .text(fmtPct(v26, 0));
      if (animate && !prevShow26) {
        lbl26.transition().duration(260).delay(delay + 260).style('opacity', 1);
      }
    }

    const node = col.node();
    node.setAttribute('tabindex', '0');
    node.setAttribute('role', 'button');
    node.setAttribute('aria-label', `Faixa ${b.range}: 2022 ${fmtPct(v22)}, 2026 ${fmtPct(v26)}`);
    bindTooltipEvents(node, tipCtrl, () => buildTooltipCard({
      title: `Faixa ${b.range} (${isApto ? 'Aptas' : 'Registradas'})`,
      badge: b.status,
      badgeTone: b.zone,
      columns: ['Ano', '% Chapas', 'Chapas (n ≥ 4)', 'Δ 22→26'],
      rows: [
        { cells: ['2022', { text: fmtPct(v22), cls: 'is-focus' }, fmtInt(cnt22(b)), '—'] },
        { cells: ['2026', { text: fmtPct(v26), cls: 'is-focus' }, fmtInt(cnt26(b)), fmtSignedPP(v26 - v22)] },
      ],
      hint: onSelectBin ? 'Clique na faixa para filtrar os partidos nos demais gráficos' : '',
    }), { focusable: true });

    if (onSelectBin) {
      col.on('click', (evt) => {
        evt.stopPropagation();
        onSelectBin(b);
      });
      col.on('keydown', (evt) => {
        if (evt.key === 'Enter' || evt.key === ' ') {
          evt.preventDefault();
          onSelectBin(b);
        }
      });
    }
  });

  if (step >= 1 && !isCompact) {
    const below = bins.find((b) => b.id === '27-30');
    const belowAll = bins.filter((b) => b.zone === 'below');
    const lt30_22 = d3.sum(belowAll, val22);
    const lt30_26 = d3.sum(belowAll, val26);
    const peakVal = show26 ? val26(qBin) : val22(qBin);
    const belowVal = show26 ? val26(below) : val22(below);
    const targetX = qX + x.bandwidth() * (show26 ? 0.72 : 0.5);
    const targetY = y(peakVal);
    addDirectAnnotation(g.append('g'), {
      x1: Math.min(W - 185, qX + x.bandwidth() + 18),
      y1: 22,
      x2: targetX + 4,
      y2: targetY + 4,
      title: `${fmtPct(peakVal)} no limite mínimo`,
      subtitle: `${fmtPct(belowVal)} logo abaixo do piso (27–30%)`,
      color: '#D93814',
      animate: prevStep < 1,
    });

    const lt30BoxX = x(below.range) + x.bandwidth() * 0.5;
    const lt30BoxY = Math.min(H - 58, y(Math.max(lt30_22, lt30_26, 8)) - 44);
    addDirectAnnotation(g.append('g'), {
      x1: 8,
      y1: Math.max(22, lt30BoxY),
      x2: lt30BoxX,
      y2: y(show26 ? val26(below) : val22(below)) - 6,
      anchor: 'start',
      title: `Chapas < 30%: ${fmtPct(lt30_22)} (2022)`,
      subtitle: show26 ? `${fmtPct(lt30_26)} em 2026 (${isApto ? 'Aptas' : 'Registradas'})` : `${isApto ? 'Aptas' : 'Registradas'} · n ≥ 4`,
      color: SEMANTIC_PALETTE.male,
      animate: prevStep < 1,
    });
  }
}
