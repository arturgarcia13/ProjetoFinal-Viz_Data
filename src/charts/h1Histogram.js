import * as d3 from 'd3';
import { SEMANTIC_PALETTE } from './palette.js';
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
 * H1 — Histograma Vertical (8 faixas) com constância de objeto em SVG único:
 * transições fluidas entre passos e entre Registradas ↔ Aptas (Passo 3 → Passo 4).
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
  const bins = h1EightData?.bins || [];
  const isApto = mode === 'apto';
  const tot22 = isApto ? (h1EightData?.totals?.apto22 || 0) : (h1EightData?.totals?.reg22 || 0);
  const tot26 = isApto ? (h1EightData?.totals?.apto26 || 0) : (h1EightData?.totals?.reg26 || 0);

  if (tot22 === 0 && tot26 === 0) {
    container.__h1State = null;
    container.innerHTML = '<p class="chart-empty">Sem chapas com pelo menos 4 candidaturas neste recorte (2022 e 2026).</p>';
    return;
  }

  const isCompact = width < 460;
  const margin = { top: 44, right: isCompact ? 14 : 24, bottom: 58, left: 46 };
  const svgW = width;
  const svgH = isCompact ? 310 : 380;
  const W = svgW - margin.left - margin.right;
  const H = svgH - margin.top - margin.bottom;

  const maxDataPct = d3.max(bins, (b) => Math.max(b.r22.pct, b.r26.pct, b.a22.pct, b.a26.pct)) || 55;
  const maxVal = Math.max(60, maxDataPct * 1.15);
  const x = d3.scaleBand().domain(bins.map((b) => b.range)).range([0, W]).padding(0.2);
  const y = d3.scaleLinear().domain([0, maxVal]).range([H, 0]);

  const sig = `${svgW}|${svgH}|${maxVal.toFixed(2)}|${bins.length}`;
  let st = container.__h1State;
  const isFreshMount = !st || st.sig !== sig || !container.querySelector('svg.h1-vertical-svg');

  if (isFreshMount) {
    container.innerHTML = '';
    const tipCtrl = createChartTooltip(container, { wrapClass: 'h1-wrap', tooltipClass: 'h1-tooltip' });
    const svg = d3.select(tipCtrl.wrap).append('svg')
      .attr('class', 'h1-vertical-svg')
      .attr('viewBox', `0 0 ${svgW} ${svgH}`)
      .attr('width', svgW)
      .attr('height', svgH)
      .attr('role', 'img')
      .style('font-family', 'Inter, system-ui, sans-serif');

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

    const footText = g.append('text')
      .attr('class', 'h1-foot-note')
      .attr('x', 0)
      .attr('y', H + 44)
      .attr('fill', SEMANTIC_PALETTE.muted)
      .style('font-size', isCompact ? '9.8px' : '11px');

    const barsG = g.append('g');
    const colEls = new Map();

    st = {
      sig,
      svg,
      tipCtrl,
      footText,
      colEls,
      binsById: new Map(),
      isApto,
      selectedBinId,
      onSelectBin,
      rendered: new Map(),
      lastStep: step,
      lastMode: mode,
    };
    container.__h1State = st;

    svg.on('click', (evt) => {
      if (st.selectedBinId && st.onSelectBin && !evt.target.closest('.h1-col')) {
        st.onSelectBin(null);
      }
    });

    bins.forEach((b) => {
      const col = barsG.append('g')
        .attr('class', 'h1-col')
        .attr('data-bin', b.id);

      const hit = col.append('rect')
        .attr('class', 'h1-col-hit')
        .attr('x', x(b.range) - 4)
        .attr('y', 0)
        .attr('width', x.bandwidth() + 8)
        .attr('height', H)
        .attr('rx', 4)
        .attr('fill', 'transparent')
        .attr('stroke', 'none')
        .attr('stroke-width', 2);

      const bar22 = col.append('rect')
        .attr('class', 'bar-2022')
        .attr('x', x(b.range))
        .attr('width', x.bandwidth())
        .attr('rx', 3)
        .attr('y', H)
        .attr('height', 0);

      const bar26 = col.append('rect')
        .attr('class', 'bar-2026')
        .attr('x', x(b.range) + x.bandwidth() * 0.52)
        .attr('width', x.bandwidth() * 0.46)
        .attr('rx', 3)
        .attr('fill', SEMANTIC_PALETTE.female)
        .attr('y', H)
        .attr('height', 0);

      const lbl22 = col.append('text')
        .attr('class', 'bar-label bar-lbl-2022')
        .attr('x', x(b.range) + x.bandwidth() / 2)
        .attr('y', H - 4)
        .attr('text-anchor', 'middle')
        .attr('font-size', isCompact ? 8.5 : 10)
        .attr('font-weight', 700)
        .style('pointer-events', 'none')
        .style('opacity', 0);

      const lbl26 = col.append('text')
        .attr('class', 'bar-label bar-lbl-2026')
        .attr('x', x(b.range) + x.bandwidth() * 0.75)
        .attr('y', H - 4)
        .attr('text-anchor', 'middle')
        .attr('font-size', isCompact ? 8.5 : 10)
        .attr('font-weight', 700)
        .attr('fill', '#D93814')
        .style('pointer-events', 'none')
        .style('opacity', 0);

      const node = col.node();
      node.setAttribute('tabindex', '0');
      node.setAttribute('role', 'button');

      bindTooltipEvents(node, tipCtrl, () => {
        const curBin = st.binsById.get(b.id);
        if (!curBin) return '';
        const curApto = st.isApto;
        const cv22 = curApto ? curBin.a22.pct : curBin.r22.pct;
        const cv26 = curApto ? curBin.a26.pct : curBin.r26.pct;
        const cc22 = curApto ? curBin.a22.n : curBin.r22.n;
        const cc26 = curApto ? curBin.a26.n : curBin.r26.n;
        return buildTooltipCard({
          title: `Faixa ${curBin.range} (${curApto ? 'Aptas' : 'Registradas'})`,
          badge: curBin.status,
          badgeTone: curBin.zone,
          columns: ['Ano', '% Chapas', 'Chapas (n ≥ 4)', 'Δ 22→26'],
          rows: [
            { cells: ['2022', { text: fmtPct(cv22), cls: 'is-focus' }, fmtInt(cc22), '—'] },
            { cells: ['2026', { text: fmtPct(cv26), cls: 'is-focus' }, fmtInt(cc26), fmtSignedPP(cv26 - cv22)] },
          ],
          hint: st.onSelectBin ? 'Clique na faixa para filtrar os partidos nos demais gráficos' : '',
        });
      }, { focusable: true });

      col.on('click', (evt) => {
        if (!st.onSelectBin) return;
        evt.stopPropagation();
        st.onSelectBin(st.binsById.get(b.id) || b);
      });
      col.on('keydown', (evt) => {
        if (!st.onSelectBin) return;
        if (evt.key === 'Enter' || evt.key === ' ') {
          evt.preventDefault();
          st.onSelectBin(st.binsById.get(b.id) || b);
        }
      });

      colEls.set(b.id, { col, hit, bar22, bar26, lbl22, lbl26 });
      st.rendered.set(b.id, { v22: 0, v26: 0, show22: false, show26: false });
    });
  }

  st.binsById = new Map(bins.map((b) => [b.id, b]));
  st.isApto = isApto;
  st.selectedBinId = selectedBinId;
  st.onSelectBin = onSelectBin;

  st.svg.attr('aria-label', `Histograma de chapas por percentual de mulheres (${isApto ? 'Aptas' : 'Registradas'}), 2022 vs. 2026`);
  st.footText.text(isCompact
    ? `Chapas n ≥ 4 · ${isApto ? 'Aptas' : 'Registradas'} (2022: ${fmtInt(tot22)} · 2026: ${fmtInt(tot26)})`
    : `Nota: Chapas com n ≥ 4 candidaturas (${isApto ? 'Aptas' : 'Registradas'} · 2022: ${fmtInt(tot22)} chapas, 2026: ${fmtInt(tot26)} chapas).`);

  const show22 = step >= 1;
  const show26 = step >= 2;
  const modeChanged = mode !== st.lastMode || mode !== prevMode;
  const stepChanged = step !== st.lastStep || step !== prevStep;
  const animate = shouldAnimate() && (isFreshMount ? (show22 || show26) : (modeChanged || stepChanged || true));
  const dur = animDur(modeChanged ? 640 : 540);
  const easeFn = modeChanged ? MOTION.easeInOut : MOTION.easeOut;

  bins.forEach((b, idx) => {
    const els = st.colEls.get(b.id);
    if (!els) return;

    const v22 = isApto ? b.a22.pct : b.r22.pct;
    const v26 = isApto ? b.a26.pct : b.r26.pct;
    const prev = st.rendered.get(b.id) || { v22: 0, v26: 0, show22: false, show26: false };

    const selected = selectedBinId === b.id;
    els.col.style('cursor', onSelectBin ? 'pointer' : 'default');
    els.col.node().setAttribute('aria-label', `Faixa ${b.range}: 2022 ${fmtPct(v22)}, 2026 ${fmtPct(v26)}`);
    els.hit.attr('stroke', selected ? SEMANTIC_PALETTE.ink : 'none');

    const w22 = show26 ? x.bandwidth() * 0.46 : x.bandwidth();
    const fill22 = SEMANTIC_PALETTE.male;
    const targetY22 = show22 ? y(v22) : H;
    const targetH22 = show22 ? Math.max(0, H - y(v22)) : 0;
    const targetY26 = show26 ? y(v26) : H;
    const targetH26 = show26 ? Math.max(0, H - y(v26)) : 0;
    const delay = animDelay(modeChanged ? idx * 18 : idx * 24);

    els.bar22.interrupt();
    els.bar26.interrupt();
    els.lbl22.interrupt();
    els.lbl26.interrupt();

    if (animate) {
      els.bar22.transition().duration(dur).delay(delay).ease(easeFn)
        .attr('width', w22)
        .attr('fill', fill22)
        .attr('y', targetY22)
        .attr('height', targetH22);

      els.bar26.transition().duration(dur).delay(delay).ease(easeFn)
        .attr('y', targetY26)
        .attr('height', targetH26);
    } else {
      els.bar22
        .attr('width', w22)
        .attr('fill', fill22)
        .attr('y', targetY22)
        .attr('height', targetH22);

      els.bar26
        .attr('y', targetY26)
        .attr('height', targetH26);
    }

    const updateBarLabel = (lblSel, wasShown, isShown, prevVal, nextVal, cx, fillColor, enterDelayExtra) => {
      const visibleNow = isShown && nextVal >= 1;
      const visibleBefore = wasShown && prevVal >= 1;
      if (animate) {
        if (visibleNow) {
          const startNum = visibleBefore ? prevVal : 0;
          const interp = d3.interpolateNumber(startNum, nextVal);
          lblSel
            .attr('fill', fillColor)
            .transition()
            .duration(visibleBefore ? dur : 300)
            .delay(visibleBefore ? delay : delay + enterDelayExtra)
            .ease(easeFn)
            .attr('x', cx)
            .attr('y', y(nextVal) - 4)
            .style('opacity', 1)
            .tween('text', function () {
              return (t) => {
                this.textContent = fmtPct(interp(t), 0);
              };
            });
        } else {
          lblSel
            .transition()
            .duration(220)
            .ease(MOTION.easeOut)
            .attr('x', cx)
            .attr('y', H - 4)
            .style('opacity', 0)
            .on('end', function () {
              this.textContent = '';
            });
        }
      } else {
        lblSel
          .attr('x', cx)
          .attr('y', visibleNow ? y(nextVal) - 4 : H - 4)
          .attr('fill', fillColor)
          .style('opacity', visibleNow ? 1 : 0)
          .text(visibleNow ? fmtPct(nextVal, 0) : '');
      }
    };

    updateBarLabel(
      els.lbl22,
      prev.show22,
      show22,
      prev.v22,
      v22,
      x(b.range) + w22 / 2,
      SEMANTIC_PALETTE.male,
      220,
    );
    updateBarLabel(
      els.lbl26,
      prev.show26,
      show26,
      prev.v26,
      v26,
      x(b.range) + x.bandwidth() * 0.75,
      '#D93814',
      240,
    );

    st.rendered.set(b.id, { v22, v26, show22, show26 });
  });

  st.lastStep = step;
  st.lastMode = mode;
}
