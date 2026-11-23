import * as Plot from '@observablehq/plot';
import {
  bindTooltipEvents,
  buildTooltipCard,
  createChartTooltip,
  fmtCompactBrl,
  fmtInt,
  fmtPct,
  fmtRatio,
  fmtSignedPP,
} from './tooltip.js';

/**
 * H3 — Dispersão por partido: % de candidatas × % do Fundo Público (FEFC + FP),
 * com escala logarítmica (base 10, padrão), modo Foco no cluster principal (evitando
 * condensação causada por micro-partidos extremos), diagonal Y = X e corte de 30%.
 */
export function renderH3Scatter(
  container,
  h3Data,
  { width = 700, scale = 'log', zoom = 'focus', onSelectParty = null } = {},
) {
  container.innerHTML = '';
  const allParties = h3Data.parties.map((p) => ({
    ...p,
    xPct: p.pctCandF * 100,
    yPct: p.pctPubF * 100,
    pubMi: p.pubTotal / 1e6,
  }));

  if (allParties.length === 0) {
    container.innerHTML = '<p class="chart-empty">Sem partidos com amostra mínima (n ≥ 10) e Fundo Público neste recorte.</p>';
    return;
  }

  const isLog = scale === 'log';
  const positiveParties = isLog ? allParties.filter((p) => p.xPct > 0 && p.yPct > 0) : allParties;
  if (positiveParties.length === 0) {
    container.innerHTML = '<p class="chart-empty">Sem partidos com valores positivos para escala logarítmica; alterne para Escala Linear.</p>';
    return;
  }

  // Modo "focus": concentra o quadro na faixa onde está a quase totalidade dos partidos (≤46% X, ≤58% Y),
  // evitando que 2–4 micro-partidos extremos esmaguem todas as bolhas grandes num canto.
  const inFocus = positiveParties.filter((p) => p.xPct <= 46 && p.yPct <= 58);
  const useFocus = zoom === 'focus' && inFocus.length >= 8 && inFocus.length < positiveParties.length;
  const parties = useFocus ? inFocus : positiveParties;
  const omitted = allParties.filter((p) => !parties.includes(p));

  const minXData = Math.min(...parties.map((p) => p.xPct));
  const maxXData = Math.max(...parties.map((p) => p.xPct));
  const minYData = Math.min(...parties.map((p) => p.yPct));
  const maxYData = Math.max(...parties.map((p) => p.yPct));

  const xMin = isLog
    ? Math.max(1, Math.min(29.5, Math.floor(minXData - 1.5)))
    : Math.max(0, Math.min(29, Math.floor(minXData - 1.5)));
  const xMax = Math.ceil(maxXData + (useFocus ? 1.5 : 3));

  const yMin = isLog
    ? Math.max(1, Math.min(29, Math.floor(minYData * 0.92)))
    : Math.max(0, Math.min(28, Math.floor(minYData - 2.5)));
  const yMax = Math.ceil(maxYData * (useFocus ? 1.05 : 1.07));

  const diagLo = Math.max(xMin, yMin);
  const diagHi = Math.min(xMax, yMax);
  const diagPoints = diagHi > diagLo
    ? Array.from({ length: 25 }, (_, i) => {
        const v = diagLo + ((diagHi - diagLo) * i) / 24;
        return [v, v];
      })
    : [];

  const candidateTicksX = useFocus
    ? [28, 30, 32, 34, 36, 38, 40, 42, 44, 46]
    : [1, 5, 10, 20, 25, 30, 35, 40, 50, 60, 70, 80, 100];
  const candidateTicksY = useFocus
    ? [20, 25, 30, 35, 40, 45, 50, 55, 60]
    : [1, 5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 100];
  const xTicks = isLog ? candidateTicksX.filter((t) => t >= xMin && t <= xMax) : undefined;
  const yTicks = isLog ? candidateTicksY.filter((t) => t >= yMin && t <= yMax) : undefined;

  const topLabels = [...parties].sort((a, b) => b.pubTotal - a.pubTotal).slice(0, 10);

  const chart = Plot.plot({
    width,
    height: 410,
    marginTop: 26,
    marginRight: 28,
    marginBottom: 46,
    marginLeft: 54,
    style: { background: 'transparent', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '12px' },
    x: {
      ...(isLog ? { type: 'log', base: 10, ticks: xTicks } : {}),
      label: isLog
        ? '% de candidatas mulheres (APTO · escala log₁₀) →'
        : '% de candidatas mulheres (APTO) →',
      domain: [xMin, xMax],
      tickFormat: (d) => `${d}%`,
      grid: true,
    },
    y: {
      ...(isLog ? { type: 'log', base: 10, ticks: yTicks } : {}),
      label: isLog
        ? '↑ % do Fundo Público (FEFC + FP · escala log₁₀)'
        : '↑ % do Fundo Público (FEFC + FP) para mulheres',
      domain: [yMin, yMax],
      tickFormat: (d) => `${d}%`,
      grid: true,
    },
    r: { range: [4, 13.5] },
    marks: [
      ...(diagPoints.length > 0
        ? [
            Plot.line(diagPoints, {
              stroke: '#555',
              strokeDasharray: '5,4',
              strokeWidth: 1.5,
            }),
          ]
        : []),
      ...(xMin <= 30 && xMax >= 30
        ? [Plot.ruleX([30], { stroke: '#b4452f', strokeDasharray: '3,3', strokeOpacity: 0.7 })]
        : []),
      ...(yMin <= 30 && yMax >= 30
        ? [Plot.ruleY([30], { stroke: '#b4452f', strokeDasharray: '3,3', strokeOpacity: 0.7 })]
        : []),
      Plot.dot(parties, {
        x: 'xPct',
        y: 'yPct',
        r: 'pubTotal',
        fill: (d) => (d.yPct >= d.xPct ? '#2f6f5e' : '#b4452f'),
        fillOpacity: 0.65,
        stroke: '#1b1a17',
        strokeWidth: 0.9,
      }),
      Plot.text(topLabels, {
        x: 'xPct',
        y: 'yPct',
        text: 'party',
        dy: -11,
        fontSize: 10,
        fontWeight: '600',
        fill: '#1b1a17',
        stroke: '#fffdf9',
        strokeWidth: 3.2,
        paintOrder: 'stroke',
      }),
      ...(diagHi > diagLo
        ? [
            Plot.text([{ x: diagHi * 0.99, y: diagHi * 0.99, text: 'Y = X (proporcional)' }], {
              x: 'x',
              y: 'y',
              dy: 20,
              text: 'text',
              textAnchor: 'end',
              fill: '#555',
              fontSize: 11,
            }),
          ]
        : []),
    ],
  });

  // Repulsão real de rótulos lendo transform="translate(x,y)" do Observable Plot + linhas-guia sutis
  const labelGroups = chart.querySelectorAll('g[aria-label="text"]');
  const partyLabelG = labelGroups.length > 0 ? labelGroups[0] : null;
  if (partyLabelG) {
    const labelNodes = [...partyLabelG.querySelectorAll('text')].map((el) => {
      const tr = el.getAttribute('transform') || '';
      const m = tr.match(/translate\(([-0-9.]+)[,\s]+([-0-9.]+)\)/);
      const ax = m ? Number(m[1]) : (Number(el.getAttribute('x')) || 0);
      const ay = m ? Number(m[2]) : (Number(el.getAttribute('y')) || 0);
      const w = (el.textContent?.length || 4) * 6.2 + 8;
      return { el, ax, ay, x: ax, y: ay - 12, w, h: 13 };
    });

    const minXBox = 62;
    const maxXBox = width - 34;
    const minYBox = 30;
    const maxYBox = 358;

    for (let iter = 0; iter < 60; iter += 1) {
      for (let i = 0; i < labelNodes.length; i += 1) {
        const a = labelNodes[i];
        for (let j = i + 1; j < labelNodes.length; j += 1) {
          const b = labelNodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const ox = (a.w + b.w) / 2 - Math.abs(dx);
          const oy = (a.h + b.h) / 2 - Math.abs(dy);
          if (ox > 0 && oy > 0) {
            if (oy < ox) {
              const shift = (oy / 2 + 0.8) * (dy >= 0 ? 1 : -1);
              a.y -= shift;
              b.y += shift;
            } else {
              const shift = (ox / 2 + 0.8) * (dx >= 0 ? 1 : -1);
              a.x -= shift;
              b.x += shift;
            }
          }
        }
        // Mantém os rótulos dentro da área útil
        a.x = Math.max(minXBox + a.w / 2, Math.min(maxXBox - a.w / 2, a.x));
        a.y = Math.max(minYBox, Math.min(maxYBox, a.y));
      }
    }

    const ns = 'http://www.w3.org/2000/svg';
    const leaderG = document.createElementNS(ns, 'g');
    leaderG.setAttribute('aria-label', 'label-leaders');
    leaderG.style.pointerEvents = 'none';

    for (const n of labelNodes) {
      n.el.removeAttribute('dy');
      n.el.setAttribute('transform', `translate(${n.x.toFixed(1)},${n.y.toFixed(1)})`);
      n.el.style.pointerEvents = 'none';
      const dist = Math.hypot(n.x - n.ax, n.y - n.ay);
      if (dist > 15) {
        const line = document.createElementNS(ns, 'line');
        line.setAttribute('x1', n.ax.toFixed(1));
        line.setAttribute('y1', n.ay.toFixed(1));
        line.setAttribute('x2', n.x.toFixed(1));
        line.setAttribute('y2', (n.y + (n.y < n.ay ? 3 : -6)).toFixed(1));
        line.setAttribute('stroke', '#8d8375');
        line.setAttribute('stroke-width', '0.85');
        line.setAttribute('stroke-opacity', '0.75');
        leaderG.appendChild(line);
      }
    }
    partyLabelG.parentNode.insertBefore(leaderG, partyLabelG);
  }

  chart.querySelectorAll('g[aria-label="text"] text').forEach((el) => {
    el.style.pointerEvents = 'none';
  });

  const tipCtrl = createChartTooltip(container);
  tipCtrl.wrap.appendChild(chart);

  chart.querySelectorAll('g[aria-label="dot"] circle').forEach((el) => {
    const datum = parties[el.__data__];
    if (!datum) return;
    if (onSelectParty) {
      el.style.cursor = 'pointer';
      el.dataset.party = datum.party;
      el.addEventListener('click', () => onSelectParty(datum.party));
    }

    bindTooltipEvents(el, tipCtrl, () => {
      const gapPp = datum.yPct - datum.xPct;
      const badgeTone = Math.abs(gapPp) < 0.05 ? 'floor' : (gapPp > 0 ? 'above' : 'below');
      const status = Math.abs(gapPp) < 0.05
        ? 'No proporcional'
        : (gapPp > 0 ? 'Acima do proporcional' : 'Abaixo do proporcional');
      return buildTooltipCard({
        title: `${datum.party} · ${fmtInt(datum.n)} APTO`,
        badge: status,
        badgeTone,
        rows: [
          {
            label: 'Mulheres na chapa',
            value: fmtPct(datum.xPct),
            sub: `${fmtInt(datum.nF)} mulheres`,
          },
          {
            label: 'Fundo Público (F)',
            value: fmtPct(datum.yPct),
            sub: `${fmtCompactBrl(datum.pubF)} de ${fmtCompactBrl(datum.pubTotal)}`,
          },
          {
            label: 'Proporcionalidade',
            value: fmtRatio(datum.ratio),
            sub: fmtSignedPP(gapPp),
            focus: true,
          },
        ],
        hint: onSelectParty ? 'Clique na bolha para filtrar o partido' : '',
      });
    });
  });

  if (omitted.length > 0) {
    const note = document.createElement('p');
    note.className = 'chart-note';
    note.style.cssText = 'margin:6px 0 0;font-size:11.5px;color:#5c554c;line-height:1.45;';
    const list = omitted
      .map((p) => `${p.party} (${p.xPct.toFixed(1).replace('.', ',')}% / ${p.yPct.toFixed(1).replace('.', ',')}%)`)
      .join(' · ');
    note.textContent = useFocus
      ? `Fora do foco principal (use "Todos" ou "Linear" para exibir): ${list}.`
      : `Fora da escala log₁₀ por apresentar 0% (use "Linear" para exibir): ${list}.`;
    container.appendChild(note);
  }
}
