import * as d3 from 'd3';
import { SEMANTIC_PALETTE } from './palette.js';
import {
  bindTooltipEvents,
  buildTooltipCard,
  createChartTooltip,
  fmtBrl,
  fmtInt,
  fmtPct,
  fmtSignedPP,
} from './tooltip.js';

function fmtSignedKShort(val, compact = false) {
  const k = val / 1000;
  if (Math.abs(k) < 0.05) return compact ? '0' : 'R$ 0';
  const sign = k > 0 ? '+' : '−';
  if (Math.abs(k) < 1) {
    const absInt = Math.abs(Math.round(val)).toLocaleString('pt-BR');
    return compact ? `${sign}${absInt}` : `${sign}R$ ${absInt}`;
  }
  const absK = Math.round(Math.abs(k)).toLocaleString('pt-BR');
  return compact ? `${sign}${absK}k` : `${sign}R$ ${absK}k`;
}

/**
 * H2B — Comparativo Direto Fundo Público vs. Recurso Privado/Próprio em Reais (Δ = Mediana F − M)
 * + Barra empilhada 100% de composição das fontes (provando dependência quase exclusiva do Fundo Público).
 */
export function renderDivergentChart(
  container,
  h2bData,
  { width = 700, selectedParty = '', onSelectParty = null, onClearParty = null } = {},
) {
  container.innerHTML = '';
  const rows = h2bData?.rows || [];
  if (rows.length === 0) {
    container.innerHTML = '<p class="chart-empty">Sem partidos com amostra mínima (≥5 candidatas e ≥5 candidatos) neste recorte.</p>';
    return;
  }

  const isCompact = width < 520;
  const margin = {
    top: 48,
    right: isCompact ? 12 : 24,
    bottom: 36,
    left: isCompact ? 100 : 118,
  };
  const colGap = isCompact ? 26 : 46;
  const rowH = 26;
  const plotH = rows.length * rowH;
  const height = margin.top + plotH + margin.bottom;
  const availW = Math.max(200, width - margin.left - margin.right - colGap);
  const colW = availW / 2;

  const pubExtent = d3.extent([0, ...rows.map((r) => r.pubGap / 1000)]);
  const privExtent = d3.extent([0, ...rows.map((r) => r.privGap / 1000)]);
  const padDomain = ([lo, hi]) => {
    const span = Math.max(20, hi - lo);
    const padLo = isCompact ? 0.64 : 0.36;
    const padHi = isCompact ? 0.64 : 0.34;
    return [lo - span * padLo, hi + span * padHi];
  };

  const xPub = d3.scaleLinear().domain(padDomain(pubExtent)).nice().range([margin.left, margin.left + colW]);
  const xPriv = d3.scaleLinear().domain(padDomain(privExtent)).nice().range([margin.left + colW + colGap, margin.left + colW * 2 + colGap]);
  const y = d3.scaleBand().domain(rows.map((r) => r.party)).range([margin.top, margin.top + plotH]).padding(0.28);

  const tipCtrl = createChartTooltip(container);
  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('class', 'divergent-svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', width)
    .attr('height', height)
    .attr('role', 'img')
    .attr('aria-label', 'Comparativo entre Fundo Público e Recurso Privado na diferença de medianas entre mulheres e homens')
    .style('font-family', 'Inter, system-ui, sans-serif');

  svg.on('click', (evt) => {
    if (selectedParty && !evt.target.closest('.div-row') && onClearParty) {
      onClearParty();
    }
  });

  // Cabeçalhos das duas colunas
  const colsMeta = [
    {
      title: isCompact ? '1. Fundo Público' : '1. Fundo Público (FEFC + FP)',
      sub: isCompact ? 'Cota de 30%' : 'Cota obrigatória de 30%',
      scale: xPub,
      left: margin.left,
    },
    {
      title: isCompact ? '2. Privado' : '2. Recurso Privado / Próprio',
      sub: 'Sem cota legal',
      scale: xPriv,
      left: margin.left + colW + colGap,
    },
  ];

  for (const col of colsMeta) {
    svg.append('text')
      .attr('x', col.left + colW / 2)
      .attr('y', 16)
      .attr('text-anchor', 'middle')
      .attr('font-size', isCompact ? 10.5 : 11.5)
      .attr('font-weight', 700)
      .attr('fill', SEMANTIC_PALETTE.ink)
      .text(col.title);
    svg.append('text')
      .attr('x', col.left + colW / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .attr('font-size', 9.5)
      .attr('fill', SEMANTIC_PALETTE.muted)
      .text(col.sub);

    const ticks = col.scale.ticks(isCompact ? 2 : 3);
    if (!ticks.includes(0)) ticks.push(0);
    for (const t of ticks) {
      const tx = col.scale(t);
      const isZ = Math.abs(t) < 0.01;
      svg.append('line')
        .attr('x1', tx).attr('x2', tx)
        .attr('y1', margin.top - 4).attr('y2', margin.top + plotH + 4)
        .attr('stroke', isZ ? SEMANTIC_PALETTE.ink : SEMANTIC_PALETTE.grid)
        .attr('stroke-width', isZ ? 1.5 : 1)
        .attr('stroke-dasharray', isZ ? null : '3,3');

      svg.append('text')
        .attr('x', tx)
        .attr('y', margin.top + plotH + 17)
        .attr('text-anchor', 'middle')
        .attr('font-size', 9.5)
        .attr('font-weight', isZ ? 700 : 500)
        .attr('fill', isZ ? SEMANTIC_PALETTE.ink : SEMANTIC_PALETTE.muted)
        .text(isZ ? 'R$ 0' : `${t > 0 ? '+' : '−'}${Math.abs(t)}k`);
    }
  }

  const zeroPub = xPub(0);
  const zeroPriv = xPriv(0);

  const rowsG = svg.append('g').attr('class', 'div-rows');

  rows.forEach((r) => {
    const barY = y(r.party);
    const barH = y.bandwidth();
    const cy = barY + barH / 2;
    const isSel = selectedParty === r.party;
    const isDimmed = Boolean(selectedParty && !isSel);

    const rowG = rowsG.append('g')
      .attr('class', `div-row${isSel ? ' is-selected' : ''}`)
      .attr('data-party', r.party)
      .attr('tabindex', 0)
      .attr('role', onSelectParty ? 'button' : 'group')
      .attr('aria-label', `${r.party}: público ${fmtSignedKShort(r.pubGap)}, privado ${fmtSignedKShort(r.privGap)}`)
      .style('cursor', onSelectParty ? 'pointer' : 'default')
      .style('opacity', isDimmed ? 0.25 : 1);

    rowG.append('rect')
      .attr('x', 2)
      .attr('y', barY - 2)
      .attr('width', width - 4)
      .attr('height', barH + 4)
      .attr('rx', 4)
      .attr('fill', isSel ? 'rgba(14, 140, 147, 0.14)' : 'transparent');

    rowG.append('text')
      .attr('x', margin.left - 8)
      .attr('y', cy + 4)
      .attr('text-anchor', 'end')
      .attr('font-size', isCompact ? 10 : 11)
      .attr('font-weight', isSel ? 700 : 600)
      .attr('fill', isSel ? SEMANTIC_PALETTE.y2026 : SEMANTIC_PALETTE.ink)
      .text(r.party);

    const drawBar = (valBrl, scale, zX, colLeft, colRight, barClass) => {
      const valK = valBrl / 1000;
      const tx = scale(valK);
      const rx = Math.min(zX, tx);
      const rw = Math.max(2.5, Math.abs(tx - zX));
      const isPos = valBrl >= 0;
      const fill = Math.abs(valBrl) < 100
        ? SEMANTIC_PALETTE.ink
        : (isPos ? SEMANTIC_PALETTE.ok : SEMANTIC_PALETTE.alert);

      rowG.append('rect')
        .attr('class', `div-bar ${barClass}`)
        .attr('data-party', r.party)
        .attr('x', rx)
        .attr('y', barY)
        .attr('width', rw)
        .attr('height', barH)
        .attr('rx', 2.5)
        .attr('fill', fill);

      const lblTxt = fmtSignedKShort(valBrl, isCompact);
      const estW = lblTxt.length * (isCompact ? 5.2 : 5.6);
      const fitsOutsideRight = rx + rw + 4 + estW <= colRight + 4;
      const fitsOutsideLeft = rx - 4 - estW >= colLeft - 4;
      let lblX;
      let anchor;
      let txtColor = fill;

      if (isPos) {
        if (fitsOutsideRight || rw < estW + 10) {
          lblX = rx + rw + 4;
          anchor = 'start';
        } else {
          lblX = rx + rw - 4;
          anchor = 'end';
          txtColor = '#003D2B';
        }
      } else if (fitsOutsideLeft || rw < estW + 10) {
        lblX = rx - 4;
        anchor = 'end';
      } else {
        lblX = rx + 4;
        anchor = 'start';
        txtColor = '#001A12';
      }

      rowG.append('text')
        .attr('class', 'div-val-label')
        .attr('x', lblX)
        .attr('y', cy + 3.5)
        .attr('text-anchor', anchor)
        .attr('font-size', isCompact ? 8.8 : 9.2)
        .attr('font-weight', 700)
        .attr('fill', txtColor)
        .text(lblTxt);
    };

    drawBar(r.pubGap, xPub, zeroPub, margin.left, margin.left + colW, 'div-bar-pub');
    drawBar(r.privGap, xPriv, zeroPriv, margin.left + colW + colGap, margin.left + colW * 2 + colGap, 'div-bar-priv');

    const el = rowG.node();
    if (onSelectParty) {
      el.addEventListener('click', (evt) => {
        evt.stopPropagation();
        onSelectParty(r.party);
      });
      el.addEventListener('keydown', (evt) => {
        if (evt.key === 'Enter' || evt.key === ' ') {
          evt.preventDefault();
          onSelectParty(r.party);
        }
      });
    }

    bindTooltipEvents(el, tipCtrl, () => buildTooltipCard({
      title: `Partido ${r.party}`,
      badge: r.privGap < 0 ? 'Vaza no Privado' : 'Paridade no Privado',
      badgeTone: r.privGap < 0 ? 'below' : 'above',
      columns: ['Fonte', 'Mediana F', 'Mediana M', 'Δ (F − M)'],
      rows: [
        {
          cells: ['Fundo Público', fmtBrl(r.medPubF), fmtBrl(r.medPubM), fmtSignedKShort(r.pubGap)],
        },
        {
          cells: ['Privado/Próprio', fmtBrl(r.medPrivF), fmtBrl(r.medPrivM), fmtSignedKShort(r.privGap)],
        },
        {
          cells: ['Candidaturas', fmtInt(r.nF), fmtInt(r.nM), fmtInt(r.total)],
        },
      ],
      hint: onSelectParty ? 'Clique na linha para destacar/limpar o partido' : '',
    }), { focusable: true });
  });

  svg.append('text')
    .attr('x', isCompact ? width / 2 : margin.left + availW / 2 + colGap / 2)
    .attr('y', height - 5)
    .attr('text-anchor', 'middle')
    .attr('font-size', isCompact ? 9 : 10)
    .attr('fill', SEMANTIC_PALETTE.muted)
    .text(isCompact
      ? '← Homens | Δ mediana (F − M) em R$ | Mulheres →'
      : '← Homens ganham mais | Δ mediana (Mulheres − Homens) em R$ | Mulheres ganham mais →');

  // Painel Inferior: Barra 100% empilhada de composição das fontes (dependência pública)
  renderSourceCompositionBar(container, h2bData.sources || [], { width });
}

function renderSourceCompositionBar(container, sources, { width = 700 } = {}) {
  if (!sources || sources.length === 0) return;
  const defs = [
    { key: 'pctFefc', label: 'FEFC (Público)', color: SEMANTIC_PALETTE.fefc },
    { key: 'pctFp', label: 'Fundo Partidário (Público)', color: SEMANTIC_PALETTE.fp },
    { key: 'pctProp', label: 'Recursos Próprios', color: SEMANTIC_PALETTE.prop },
    { key: 'pctPriv', label: 'Doações Privadas', color: SEMANTIC_PALETTE.priv },
  ];

  const isCompact = width < 480;
  const leftMargin = isCompact ? 62 : 82;
  const rightMargin = isCompact ? 68 : 98;
  const legStartX = isCompact ? 10 : leftMargin;
  let lxCalc = legStartX;
  let lyCalc = 29;
  const legItems = defs.map((d) => {
    const iw = d.label.length * 5.6 + 20;
    if (lxCalc > legStartX && lxCalc + iw > width - 10) {
      lxCalc = legStartX;
      lyCalc += 14;
    }
    const pos = { d, x: lxCalc, y: lyCalc };
    lxCalc += iw + 8;
    return pos;
  });

  const margin = { top: lyCalc + 14, right: rightMargin, bottom: 40, left: leftMargin };
  const barH = 24;
  const rowStep = 34;
  const height = margin.top + sources.length * rowStep + margin.bottom;
  const plotW = Math.max(150, width - margin.left - margin.right);
  const x = d3.scaleLinear().domain([0, 100]).range([margin.left, margin.left + plotW]);

  const tipCtrl = createChartTooltip(container);
  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('class', 'h2b-sources-svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', width)
    .attr('height', height)
    .attr('role', 'img')
    .attr('aria-label', 'Composição percentual das fontes de receita por gênero')
    .style('font-family', 'Inter, system-ui, sans-serif');

  svg.append('text')
    .attr('x', legStartX)
    .attr('y', 14)
    .attr('font-size', isCompact ? 10.5 : 11)
    .attr('font-weight', 700)
    .attr('fill', SEMANTIC_PALETTE.ink)
    .text(isCompact ? 'Composição das Fontes (%)' : 'Composição das Fontes (%) — Dependência do Dinheiro Público Obrigatório');

  // Legenda em linha (com wrap calculado antes de margin.top)
  for (const { d, x: ix, y: iy } of legItems) {
    const lg = svg.append('g').attr('transform', `translate(${ix}, ${iy})`);
    lg.append('rect').attr('x', 0).attr('y', -8).attr('width', 9).attr('height', 9).attr('rx', 2).attr('fill', d.color);
    lg.append('text').attr('x', 13).attr('y', 0).attr('font-size', 9.5).attr('fill', SEMANTIC_PALETTE.muted).text(d.label);
  }

  const byKey = {};
  for (const s of sources) {
    byKey[s.g] = s;
  }

  sources.forEach((s, idx) => {
    const y0 = margin.top + idx * rowStep;
    const isWomen = s.g === 'F';
    const gLabel = isWomen ? 'Mulheres' : 'Homens';

    svg.append('text')
      .attr('x', margin.left - 8)
      .attr('y', y0 + barH / 2 + 4)
      .attr('text-anchor', 'end')
      .attr('font-size', 11)
      .attr('font-weight', 700)
      .attr('fill', isWomen ? SEMANTIC_PALETTE.women : SEMANTIC_PALETTE.men)
      .text(gLabel);

    const pubPctTot = ((s.pctFefc || 0) + (s.pctFp || 0)) * 100;
    svg.append('text')
      .attr('x', margin.left + plotW + 8)
      .attr('y', y0 + barH / 2 + 4)
      .attr('text-anchor', 'start')
      .attr('font-size', isCompact ? 9.2 : 10.5)
      .attr('font-weight', 700)
      .attr('fill', isWomen ? SEMANTIC_PALETTE.fefc : SEMANTIC_PALETTE.muted)
      .text(`${pubPctTot.toFixed(1).replace('.', ',')}% púb.`);

    let acc = 0;
    for (const d of defs) {
      const pct = (s[d.key] || 0) * 100;
      const x0 = x(acc);
      const x1 = x(acc + pct);
      acc += pct;
      if (x1 - x0 <= 0.5) continue;

      const rect = svg.append('rect')
        .attr('class', 'h2b-src-bar')
        .attr('x', x0)
        .attr('y', y0)
        .attr('width', x1 - x0)
        .attr('height', barH)
        .attr('fill', d.color)
        .attr('stroke', SEMANTIC_PALETTE.surface)
        .attr('stroke-width', 1)
        .style('cursor', 'pointer');

      if (x1 - x0 >= 36) {
        svg.append('text')
          .attr('x', (x0 + x1) / 2)
          .attr('y', y0 + barH / 2 + 4)
          .attr('text-anchor', 'middle')
          .attr('font-size', 10)
          .attr('font-weight', 700)
          .attr('fill', '#003D2B')
          .style('pointer-events', 'none')
          .text(`${pct.toFixed(1).replace('.', ',')}%`);
      }

      bindTooltipEvents(rect.node(), tipCtrl, () => {
        const fVal = (byKey.F?.[d.key] || 0) * 100;
        const mVal = (byKey.M?.[d.key] || 0) * 100;
        return buildTooltipCard({
          title: d.label,
          badge: gLabel,
          badgeTone: isWomen ? 'below' : 'neutral',
          columns: ['Fatia', 'Mulheres', 'Homens', 'Δ F−M'],
          rows: [
            {
              cells: [
                '% da receita',
                { text: fmtPct(fVal), cls: isWomen ? 'is-focus' : '' },
                { text: fmtPct(mVal), cls: !isWomen ? 'is-focus' : '' },
                fmtSignedPP(fVal - mVal),
              ],
            },
          ],
        });
      });
    }
  });

  // Eixo 0%..100%
  for (const t of [0, 25, 50, 75, 100]) {
    const tx = x(t);
    svg.append('text')
      .attr('x', tx)
      .attr('y', margin.top + sources.length * rowStep + 10)
      .attr('text-anchor', 'middle')
      .attr('font-size', 9.5)
      .attr('fill', SEMANTIC_PALETTE.muted)
      .text(`${t}%`);
  }
}
