import * as d3 from 'd3';
import { SEMANTIC_PALETTE } from './palette.js';
import { animDelay, animDur, MOTION, shouldAnimate } from './motion.js';
import { bindTooltipEvents, buildTooltipCard, createChartTooltip, fmtInt, fmtPct, fmtSignedPP } from './tooltip.js';

const SIGNAL_DEFS = [
  {
    id: 'sigA',
    getLabel: (thr) => `Sinal A (≤${thr} votos)`,
    getShort: (thr) => `Sinal A (≤${thr}v)`,
    desc: 'Votação nominal válida igual ou abaixo do limiar escolhido.',
  },
  {
    id: 'sigB',
    getLabel: () => 'Sinal B (Receita R$ 0)',
    getShort: () => 'Sinal B (R$ 0)',
    desc: 'Prestação de contas entregue com receita e despesa zeradas (R$ 0).',
  },
  {
    id: 'sigC',
    getLabel: () => 'Sinal C (Lote ≥3 idênticos)',
    getShort: () => 'Sinal C (Lote ≥3)',
    desc: '≥3 candidaturas APTO (mesma UF/partido) com valor idêntico ao centavo no mesmo fornecedor/data ou repasse FEFC+FP.',
  },
];

/**
 * H6 — Sinais A, B e C em candidaturas APTAS (sem "≥2 sinais combinados"):
 * - Passo 0: 2018 · Somente Mulheres
 * - Passo 1: Transição 2018 → 2022 · Somente Mulheres
 * - Passo 2: Transição 2022 → 2026 · Somente Mulheres
 * - Passo 3: Inserção dos Homens em 2026 (ou ano escolhido manualmente no controle)
 */
export function renderH6Signals(container, h6Series, { step = 3, prevStep = 3, width = 720, year = 2026 } = {}) {
  const activeYear = step === 0 ? 2018 : (step === 1 ? 2022 : (step === 2 ? 2026 : year));
  const showMen = step >= 3;
  const yObj = h6Series?.byYear?.[activeYear] || h6Series?.byYear?.[2022];

  if (!yObj || (yObj.summary?.F?.n || 0) === 0) {
    container.__h6State = null;
    container.innerHTML = '<p class="chart-empty">Sem candidaturas APTO suficientes neste recorte.</p>';
    return;
  }

  const pct = (count, n) => (n > 0 ? (count / n) * 100 : 0);

  // Calcula teto único para 2018, 2022 e 2026 para manter o eixo Y fixo durante as transições
  const allPcts = [2018, 2022, 2026].flatMap((yr) => {
    const obj = h6Series?.byYear?.[yr];
    if (!obj) return [0];
    const sf = obj.summary?.F || { n: 0, sigA: 0, sigB: 0, sigC: 0 };
    const sm = obj.summary?.M || { n: 0, sigA: 0, sigB: 0, sigC: 0 };
    return [
      pct(sf.sigA, sf.n), pct(sf.sigB, sf.n), pct(sf.sigC, sf.n),
      pct(sm.sigA, sm.n), pct(sm.sigB, sm.n), pct(sm.sigC, sm.n),
    ];
  });

  const isCompact = width < 460;
  const margin = { top: 38, right: isCompact ? 16 : 26, bottom: 56, left: isCompact ? 42 : 52 };
  const svgW = width;
  const svgH = isCompact ? 305 : 355;
  const W = svgW - margin.left - margin.right;
  const H = svgH - margin.top - margin.bottom;

  const maxY = Math.max(44, (d3.max(allPcts) || 40) * 1.16);
  const x0 = d3.scaleBand().domain(SIGNAL_DEFS.map((m) => m.id)).range([0, W]).padding(0.3);
  const x1 = d3.scaleBand().domain(['F', 'M']).range([0, x0.bandwidth()]).padding(0.14);
  const y = d3.scaleLinear().domain([0, maxY]).range([H, 0]);

  const sig = `${svgW}|${svgH}|${maxY.toFixed(2)}|${h6Series.voteThreshold}`;
  let st = container.__h6State;
  const isFreshMount = !st || st.sig !== sig || !container.querySelector('svg.h6-series-svg');

  if (isFreshMount) {
    container.innerHTML = '';
    const tipCtrl = createChartTooltip(container, { wrapClass: 'h6-wrap' });
    const svg = d3.select(tipCtrl.wrap).append('svg')
      .attr('class', 'h6-series-svg')
      .attr('viewBox', `0 0 ${svgW} ${svgH}`)
      .attr('width', svgW)
      .attr('height', svgH)
      .attr('role', 'img')
      .style('font-family', 'Inter, system-ui, sans-serif');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickSize(-W).tickFormat((d) => `${Math.round(d)}%`))
      .call((a) => a.select('.domain').remove())
      .call((a) => a.selectAll('.tick line').attr('stroke', SEMANTIC_PALETTE.grid))
      .call((a) => a.selectAll('.tick text').attr('fill', SEMANTIC_PALETTE.muted).style('font-size', '10.5px'));

    const yAxisLbl = g.append('text')
      .attr('class', 'h6-y-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -H / 2)
      .attr('y', isCompact ? -32 : -38)
      .attr('text-anchor', 'middle')
      .attr('fill', SEMANTIC_PALETTE.muted)
      .style('font-size', '10.5px')
      .style('font-weight', '600');

    g.append('g')
      .attr('transform', `translate(0,${H})`)
      .call(d3.axisBottom(x0).tickFormat((id) => {
        const def = SIGNAL_DEFS.find((item) => item.id === id);
        return isCompact ? def.getShort(h6Series.voteThreshold) : def.getLabel(h6Series.voteThreshold);
      }))
      .call((a) => a.select('.domain').attr('stroke', '#CBD5E1'))
      .call((a) => a.selectAll('.tick text')
        .attr('fill', SEMANTIC_PALETTE.ink)
        .style('font-size', isCompact ? '9px' : '10.5px')
        .style('font-weight', '600'));

    const yrWatermark = g.append('text')
      .attr('class', 'h6-year-tag')
      .attr('x', W - 4)
      .attr('y', -12)
      .attr('text-anchor', 'end')
      .attr('fill', SEMANTIC_PALETTE.ink)
      .style('font-size', isCompact ? '10.5px' : '12px')
      .style('font-weight', '700');

    const barsG = g.append('g');
    const groupEls = new Map();

    st = {
      sig,
      svg,
      tipCtrl,
      yAxisLbl,
      yrWatermark,
      groupEls,
      activeYear,
      showMen,
      metricsById: new Map(),
      sF: null,
      sM: null,
      rendered: new Map(),
      lastStep: step,
      lastYear: activeYear,
    };
    container.__h6State = st;

    SIGNAL_DEFS.forEach((def) => {
      const grp = barsG.append('g')
        .attr('class', 'h6-signal-group')
        .attr('data-signal', def.id)
        .attr('transform', `translate(${x0(def.id)},0)`);

      const singleW = Math.min(x0.bandwidth() * 0.56, x1.bandwidth() * 1.45);
      const singleX = (x0.bandwidth() - singleW) / 2;

      const barF = grp.append('rect')
        .attr('class', 'h6-dot h6-dot-F')
        .attr('x', showMen ? x1('F') : singleX)
        .attr('width', showMen ? x1.bandwidth() : singleW)
        .attr('rx', 3)
        .attr('fill', SEMANTIC_PALETTE.female)
        .attr('y', H)
        .attr('height', 0)
        .attr('tabindex', 0)
        .style('cursor', 'pointer');

      const barM = grp.append('rect')
        .attr('class', 'h6-dot h6-dot-M')
        .attr('x', x1('M'))
        .attr('width', x1.bandwidth())
        .attr('rx', 3)
        .attr('fill', SEMANTIC_PALETTE.male)
        .attr('y', H)
        .attr('height', 0)
        .attr('opacity', 0)
        .attr('tabindex', showMen ? 0 : -1)
        .style('cursor', 'pointer')
        .style('pointer-events', showMen ? 'auto' : 'none');

      const lblF = grp.append('text')
        .attr('class', 'h6-val-F')
        .attr('text-anchor', 'middle')
        .attr('font-size', isCompact ? 9 : 10.5)
        .attr('font-weight', 700)
        .attr('fill', '#D93814')
        .style('pointer-events', 'none')
        .style('opacity', 0);

      const lblM = grp.append('text')
        .attr('class', 'h6-val-M')
        .attr('x', x1('M') + x1.bandwidth() / 2)
        .attr('text-anchor', 'middle')
        .attr('font-size', isCompact ? 9 : 10.5)
        .attr('font-weight', 700)
        .attr('fill', SEMANTIC_PALETTE.male)
        .style('pointer-events', 'none')
        .style('opacity', 0);

      const bindBar = (barSel, genderKey) => {
        bindTooltipEvents(barSel.node(), tipCtrl, () => {
          const m = st.metricsById.get(def.id);
          if (!m) return '';
          const diffPP = m.fPct - m.mPct;
          const rows = [
            {
              cells: [
                'Mulheres (F · Aptas)',
                { text: fmtPct(m.fPct, 2), cls: genderKey === 'F' ? 'is-focus' : '' },
                fmtInt(m.fCount),
                fmtInt(st.sF?.n || 0),
              ],
            },
          ];
          if (st.showMen) {
            rows.push({
              cells: [
                'Homens (M · Aptos)',
                { text: fmtPct(m.mPct, 2), cls: genderKey === 'M' ? 'is-focus' : '' },
                fmtInt(m.mCount),
                fmtInt(st.sM?.n || 0),
              ],
            });
          }
          return buildTooltipCard({
            title: `${st.activeYear} · ${def.getLabel(h6Series.voteThreshold)}`,
            badge: st.showMen ? `Δ F−M: ${fmtSignedPP(diffPP)}` : 'Somente Mulheres Aptas',
            badgeTone: st.showMen ? (Math.abs(diffPP) < 3 ? 'neutral' : 'floor') : 'below',
            columns: ['Grupo', '% APTO', 'Ocorrências', 'Universo'],
            rows,
            hint: def.desc,
          });
        }, { focusable: true });
      };

      bindBar(barF, 'F');
      bindBar(barM, 'M');

      groupEls.set(def.id, { grp, barF, barM, lblF, lblM, singleW, singleX });
      st.rendered.set(def.id, { fPct: 0, mPct: 0, showMen: false });
    });
  }

  const sF = yObj.summary.F;
  const sM = yObj.summary.M;
  st.activeYear = activeYear;
  st.showMen = showMen;
  st.sF = sF;
  st.sM = sM;

  st.svg.attr('aria-label', `Sinais A, B e C em ${activeYear} (${showMen ? 'Mulheres vs. Homens APTO' : 'Somente Mulheres APTO'})`);
  st.yAxisLbl.text(`% das candidaturas APTAS (${activeYear})`);
  st.yrWatermark.text(showMen ? `${activeYear} · Mulheres vs. Homens (APTO)` : `${activeYear} · Apenas Mulheres Aptas`);

  const animate = shouldAnimate();
  const dur = animDur(580);
  const easeFn = MOTION.easeInOut;

  SIGNAL_DEFS.forEach((def, idx) => {
    const fCount = sF[def.id] || 0;
    const mCount = sM[def.id] || 0;
    const fPct = pct(fCount, sF.n);
    const mPct = pct(mCount, sM.n);
    st.metricsById.set(def.id, { ...def, fPct, mPct, fCount, mCount });

    const els = st.groupEls.get(def.id);
    if (!els) return;
    const prev = st.rendered.get(def.id) || { fPct: 0, mPct: 0, showMen: false };
    const delay = animDelay(idx * 45);

    const targetFX = showMen ? x1('F') : els.singleX;
    const targetFW = showMen ? x1.bandwidth() : els.singleW;
    const targetFY = y(fPct);
    const targetFH = Math.max(2, H - targetFY);
    const targetFLblX = targetFX + targetFW / 2;
    const targetFLblY = targetFY - 6;

    const targetMY = y(mPct);
    const targetMH = Math.max(2, H - targetMY);
    const targetMLblY = targetMY - 6;

    els.barF.interrupt();
    els.barM.interrupt();
    els.lblF.interrupt();
    els.lblM.interrupt();

    if (animate) {
      els.barF.transition().duration(dur).delay(delay).ease(easeFn)
        .attr('x', targetFX)
        .attr('width', targetFW)
        .attr('y', targetFY)
        .attr('height', targetFH);

      const interpF = d3.interpolateNumber(isFreshMount ? 0 : prev.fPct, fPct);
      els.lblF
        .transition().duration(dur).delay(delay).ease(easeFn)
        .attr('x', targetFLblX)
        .attr('y', targetFLblY)
        .style('opacity', 1)
        .tween('text', function () {
          return (t) => {
            this.textContent = fmtPct(interpF(t), 1);
          };
        });

      if (showMen) {
        els.barM
          .attr('tabindex', 0)
          .style('pointer-events', 'auto')
          .transition().duration(dur).delay(delay + 90).ease(MOTION.easeOut)
          .attr('opacity', 1)
          .attr('y', targetMY)
          .attr('height', targetMH);

        const interpM = d3.interpolateNumber(prev.showMen ? prev.mPct : 0, mPct);
        els.lblM
          .transition().duration(dur).delay(delay + 120).ease(MOTION.easeOut)
          .attr('y', targetMLblY)
          .style('opacity', 1)
          .tween('text', function () {
            return (t) => {
              this.textContent = fmtPct(interpM(t), 1);
            };
          });
      } else {
        els.barM
          .attr('tabindex', -1)
          .style('pointer-events', 'none')
          .transition().duration(280).ease(MOTION.easeOut)
          .attr('opacity', 0)
          .attr('y', H)
          .attr('height', 0);

        els.lblM
          .transition().duration(200)
          .style('opacity', 0)
          .on('end', function () {
            this.textContent = '';
          });
      }
    } else {
      els.barF
        .attr('x', targetFX)
        .attr('width', targetFW)
        .attr('y', targetFY)
        .attr('height', targetFH);

      els.lblF
        .attr('x', targetFLblX)
        .attr('y', targetFLblY)
        .style('opacity', 1)
        .text(fmtPct(fPct, 1));

      els.barM
        .attr('tabindex', showMen ? 0 : -1)
        .style('pointer-events', showMen ? 'auto' : 'none')
        .attr('opacity', showMen ? 1 : 0)
        .attr('y', showMen ? targetMY : H)
        .attr('height', showMen ? targetMH : 0);

      els.lblM
        .attr('y', targetMLblY)
        .style('opacity', showMen ? 1 : 0)
        .text(showMen ? fmtPct(mPct, 1) : '');
    }

    st.rendered.set(def.id, { fPct, mPct, showMen });
  });

  st.lastStep = step;
  st.lastYear = activeYear;
}
