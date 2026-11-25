import * as d3 from 'd3';
import { IBGE_TO_UF, UF_NAMES } from '../data.js';
import { SEMANTIC_PALETTE } from './palette.js';
import {
  bindTooltipEvents,
  buildTooltipCard,
  createChartTooltip,
  fmtInt,
  fmtPct,
} from './tooltip.js';

export const H9_METRICS = [
  { key: 'pctEleitasF', label: '5. Eleitas (%)', short: 'Eleitas', kind: 'parity' },
  { key: 'pctCandF', label: '1. Candidatas (%)', short: 'Papel', kind: 'parity' },
  { key: 'pctPubF', label: '2. Fundo Público (%)', short: 'Fundo Púb.', kind: 'parity' },
  { key: 'pctPrivF', label: '3. Privado/Próprio (%)', short: 'Privado', kind: 'parity' },
  { key: 'pctVotosF', label: '4. Votos (%)', short: 'Votos', kind: 'parity' },
  { key: 'pctAlertsF', label: '6. Alertas ≥2 (%)', short: 'Alertas', kind: 'alert' },
];

function cellColors(val, kind) {
  if (val === null || !Number.isFinite(val)) {
    return { bg: '#E6EEEA', fg: '#647A71', tone: 'neutral' };
  }
  if (kind === 'alert') {
    if (val >= 5) return { bg: SEMANTIC_PALETTE.alert, fg: '#FFFFFF', tone: 'below' };
    if (val >= 2) return { bg: SEMANTIC_PALETTE.floor, fg: '#003D2B', tone: 'floor' };
    return { bg: '#D2F1E5', fg: '#005C40', tone: 'above' };
  }
  if (val >= 30) return { bg: SEMANTIC_PALETTE.ok, fg: '#FFFFFF', tone: 'above' };
  if (val >= 20) return { bg: '#E6EEEA', fg: '#142620', tone: 'neutral' };
  if (val >= 12) return { bg: SEMANTIC_PALETTE.floor, fg: '#003D2B', tone: 'floor' };
  return { bg: SEMANTIC_PALETTE.alert, fg: '#FFFFFF', tone: 'below' };
}

/**
 * H9 (Painel 1) — Mapa Coroplético Quantitativo das 27 UFs por métrica do funil.
 */
export function renderUFMap(container, brUfGeo, h9MatrixData, {
  width = 480,
  metric = 'pctEleitasF',
  selectedUF = '',
  onSelectUF = null,
  onClearUF = null,
} = {}) {
  container.innerHTML = '';
  const height = 340;
  const tipCtrl = createChartTooltip(container);
  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('class', 'h9-map-svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', width)
    .attr('height', height)
    .attr('role', 'img')
    .attr('aria-label', 'Mapa coroplético quantitativo por Unidade da Federação')
    .style('font-family', 'Inter, system-ui, sans-serif');

  if (onClearUF) {
    svg.on('click', (evt) => {
      if (selectedUF && !evt.target.closest('path')) {
        onClearUF();
      }
    });
  }

  const meta = H9_METRICS.find((m) => m.key === metric) || H9_METRICS[0];
  const isAlert = meta.kind === 'alert';
  const domain = isAlert ? [0, 6, 12] : [5, 22, 36];
  const rangeColors = isAlert
    ? [SEMANTIC_PALETTE.ok, SEMANTIC_PALETTE.floor, SEMANTIC_PALETTE.alert]
    : [SEMANTIC_PALETTE.alert, SEMANTIC_PALETTE.floor, SEMANTIC_PALETTE.ok];

  const colorScale = d3.scaleLinear().domain(domain).range(rangeColors).clamp(true);
  const byUf = new Map((h9MatrixData?.ufRows || []).map((u) => [u.key, u]));

  const projection = d3.geoMercator().fitExtent([[14, 10], [width - 14, height - 56]], brUfGeo);
  const path = d3.geoPath(projection);

  const ufPaths = svg.append('g')
    .selectAll('path')
    .data(brUfGeo.features)
    .join('path')
    .attr('d', path)
    .attr('data-uf', (d) => IBGE_TO_UF[String(d.properties.codarea)])
    .attr('fill', (d) => {
      const uf = IBGE_TO_UF[String(d.properties.codarea)];
      const row = byUf.get(uf);
      const val = row?.[metric];
      if (!row || row.inconclusive || val === null || !Number.isFinite(val)) return '#D9E2DD';
      return colorScale(val);
    })
    .attr('fill-opacity', (d) => {
      const uf = IBGE_TO_UF[String(d.properties.codarea)];
      return selectedUF && selectedUF !== uf ? 0.35 : 1;
    })
    .attr('stroke', (d) => {
      const uf = IBGE_TO_UF[String(d.properties.codarea)];
      return selectedUF === uf ? SEMANTIC_PALETTE.ink : SEMANTIC_PALETTE.surface;
    })
    .attr('stroke-width', (d) => {
      const uf = IBGE_TO_UF[String(d.properties.codarea)];
      return selectedUF === uf ? 2.5 : 1;
    })
    .style('cursor', onSelectUF ? 'pointer' : 'default')
    .on('click', (evt, d) => {
      evt.stopPropagation();
      const uf = IBGE_TO_UF[String(d.properties.codarea)];
      if (uf && onSelectUF) onSelectUF(uf);
    });

  ufPaths.each(function (d) {
    const uf = IBGE_TO_UF[String(d.properties.codarea)];
    const name = UF_NAMES[uf] || uf;
    const isSelected = selectedUF === uf;

    bindTooltipEvents(
      this,
      tipCtrl,
      () => {
        const u = byUf.get(uf);
        if (!u || u.inconclusive) {
          return buildTooltipCard({
            title: `${uf} — ${name}`,
            badge: 'Inconclusivo',
            badgeTone: 'neutral',
            rows: [{ label: 'Critério mínimo', value: 'n < 10 ou FINAL < 70%' }],
            hint: onSelectUF ? 'Clique na UF para filtrar/limpar' : '',
          });
        }
        const curVal = u[metric];
        const tone = cellColors(curVal, meta.kind).tone;
        return buildTooltipCard({
          title: `${uf} — ${name}`,
          badge: `${meta.short}: ${curVal !== null ? fmtPct(curVal) : '—'}`,
          badgeTone: tone,
          rows: [
            { label: '1. Candidatas (APTO)', value: fmtPct(u.pctCandF), focus: metric === 'pctCandF' },
            { label: '2. Fundo Público', value: u.pctPubF !== null ? fmtPct(u.pctPubF) : '—', focus: metric === 'pctPubF' },
            { label: '3. Privado/Próprio', value: u.pctPrivF !== null ? fmtPct(u.pctPrivF) : '—', focus: metric === 'pctPrivF' },
            { label: '4. Votos nominais', value: u.pctVotosF !== null ? fmtPct(u.pctVotosF) : '—', focus: metric === 'pctVotosF' },
            { label: '5. Eleitas', value: u.pctEleitasF !== null ? fmtPct(u.pctEleitasF) : '—', sub: `${u.elF}/${u.elTot}`, focus: metric === 'pctEleitasF' },
            { label: '6. Alertas ≥2 sinais', value: u.pctAlertsF !== null ? fmtPct(u.pctAlertsF) : '—', focus: metric === 'pctAlertsF' },
          ],
          hint: onSelectUF ? 'Clique na UF para filtrar/limpar o painel' : '',
        });
      },
      {
        onEnter: () => {
          d3.select(this).attr('stroke', SEMANTIC_PALETTE.ink).attr('stroke-width', isSelected ? 2.5 : 1.9);
        },
        onLeave: () => {
          d3.select(this).attr('stroke', isSelected ? SEMANTIC_PALETTE.ink : SEMANTIC_PALETTE.surface).attr('stroke-width', isSelected ? 2.5 : 1);
        },
      },
    );
  });

  // Legenda com gradiente contínuo + Inconclusivo
  const legW = Math.min(200, width - 120);
  const gradId = `h9-map-grad-${isAlert ? 'alert' : 'parity'}`;
  const defs = svg.append('defs');
  const grad = defs.append('linearGradient')
    .attr('id', gradId)
    .attr('x1', '0%').attr('x2', '100%').attr('y1', '0%').attr('y2', '0%');
  grad.append('stop').attr('offset', '0%').attr('stop-color', rangeColors[0]);
  grad.append('stop').attr('offset', '50%').attr('stop-color', rangeColors[1]);
  grad.append('stop').attr('offset', '100%').attr('stop-color', rangeColors[2]);

  const leg = svg.append('g').attr('transform', `translate(10, ${height - 38})`);
  leg.append('rect')
    .attr('x', 0).attr('y', 0)
    .attr('width', legW).attr('height', 10)
    .attr('rx', 3)
    .attr('fill', `url(#${gradId})`)
    .attr('stroke', 'rgba(20, 38, 32, 0.28)')
    .attr('stroke-width', 0.6);

  const ticks = isAlert
    ? [[0, '0%'], [0.5, '6%'], [1, '≥12% alertas']]
    : [[0, '≤5%'], [0.5, '22%'], [1, '≥36%']];
  ticks.forEach(([t, txt], i) => {
    leg.append('text')
      .attr('x', legW * t)
      .attr('y', 23)
      .attr('text-anchor', i === 0 ? 'start' : (i === 2 ? 'end' : 'middle'))
      .attr('font-size', 9.5)
      .attr('fill', SEMANTIC_PALETTE.ink)
      .text(txt);
  });

  const incG = leg.append('g').attr('transform', `translate(${legW + 18}, 0)`);
  incG.append('rect').attr('width', 10).attr('height', 10).attr('rx', 2).attr('fill', '#D9E2DD').attr('stroke', 'rgba(20, 38, 32, 0.28)').attr('stroke-width', 0.6);
  incG.append('text').attr('x', 14).attr('y', 9).attr('font-size', 9.5).attr('fill', SEMANTIC_PALETTE.muted).text('Inconclusivo');

  // Extremos clicáveis do mapa na métrica selecionada
  const validUfs = (h9MatrixData?.ufRows || []).filter((u) => !u.inconclusive && u[metric] !== null);
  if (validUfs.length >= 2) {
    const sorted = [...validUfs].sort((a, b) => a[metric] - b[metric]);
    const minUf = sorted[0];
    const maxUf = sorted[sorted.length - 1];
    const topItem = isAlert ? minUf : maxUf;
    const botItem = isAlert ? maxUf : minUf;

    const extBar = document.createElement('div');
    extBar.className = 'h9-extremes-bar';
    [
      { item: topItem, cls: 'is-high', caption: isAlert ? 'Menor risco (UF)' : `Maior ${meta.short}` },
      { item: botItem, cls: 'is-low', caption: isAlert ? 'Maior alerta (UF)' : `Menor ${meta.short}` },
    ].forEach(({ item, cls, caption }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `h9-extreme-btn ${cls}`;
      btn.innerHTML = `<span>${caption}</span><strong>${item.key} · ${fmtPct(item[metric])}</strong>`;
      if (onSelectUF) btn.addEventListener('click', () => onSelectUF(item.key));
      extBar.appendChild(btn);
    });
    container.appendChild(extBar);
  }
}

/**
 * H9 (Painel 2) — Matriz Heatmap Ordenável (27 UFs ou Top 15 Partidos × 6 Métricas do Funil).
 */
export function renderH9HeatmapMatrix(container, h9MatrixData, {
  unit = 'uf',
  sortBy = 'pctEleitasF',
  sortDir = 'desc',
  selectedEntity = '',
  onSort = null,
  onSelectEntity = null,
  onClearEntity = null,
} = {}) {
  container.innerHTML = '';
  const rawRows = unit === 'party' ? (h9MatrixData?.partyRows || []) : (h9MatrixData?.ufRows || []);
  if (rawRows.length === 0) {
    container.innerHTML = '<p class="chart-empty">Sem dados suficientes para exibir a matriz neste recorte.</p>';
    return;
  }

  const rows = [...rawRows].sort((a, b) => {
    if (sortBy === 'key') {
      return sortDir === 'asc' ? a.key.localeCompare(b.key) : b.key.localeCompare(a.key);
    }
    const va = a[sortBy] ?? -999;
    const vb = b[sortBy] ?? -999;
    return sortDir === 'asc' ? va - vb : vb - va;
  });

  const tipCtrl = createChartTooltip(container, { wrapClass: 'h9-matrix-shell' });
  const scrollHint = document.createElement('p');
  scrollHint.className = 'h9-scroll-hint';
  scrollHint.textContent = 'Deslize horizontalmente a tabela para ver Votos e Alertas →';
  tipCtrl.wrap.appendChild(scrollHint);
  const wrap = document.createElement('div');
  wrap.className = 'h9-matrix-wrap';
  tipCtrl.wrap.appendChild(wrap);

  if (onClearEntity) {
    const handleClearBg = (evt) => {
      if (
        selectedEntity
        && !evt.target.closest('tr[data-entity]')
        && !evt.target.closest('th')
        && !evt.target.closest('.chart-tooltip')
      ) {
        onClearEntity();
      }
    };
    tipCtrl.wrap.addEventListener('click', handleClearBg);
    container.addEventListener('click', handleClearBg);
  }

  const table = document.createElement('table');
  table.className = 'h9-matrix-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  const cols = [
    { key: 'key', label: unit === 'party' ? 'Partido' : 'UF', kind: 'entity' },
    ...H9_METRICS.map((m) => ({ key: m.key, label: m.short, fullLabel: m.label, kind: m.kind })),
  ];

  for (const c of cols) {
    const th = document.createElement('th');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `h9-sort-btn${sortBy === c.key ? ' is-sorted' : ''}`;
    btn.dataset.sortKey = c.key;
    const arrow = sortBy === c.key ? (sortDir === 'asc' ? ' ▴' : ' ▾') : '';
    btn.textContent = `${c.label}${arrow}`;
    if (c.fullLabel) btn.title = `Ordenar por ${c.fullLabel}`;
    btn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      if (onSort) onSort(c.key);
    });
    th.appendChild(btn);
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.dataset.entity = r.key;
    const isSel = selectedEntity === r.key;
    const isDimmed = Boolean(selectedEntity && !isSel);
    if (isSel) tr.classList.add('is-selected');
    if (isDimmed) tr.classList.add('is-dimmed');

    const nameTd = document.createElement('td');
    nameTd.className = 'h9-entity-cell';
    nameTd.textContent = r.key;
    tr.appendChild(nameTd);

    for (const m of H9_METRICS) {
      const td = document.createElement('td');
      td.className = 'h9-heat-cell';
      const val = r.inconclusive ? null : r[m.key];
      const { bg, fg } = cellColors(val, m.kind);
      td.style.backgroundColor = bg;
      td.style.color = fg;
      td.textContent = val !== null && Number.isFinite(val) ? fmtPct(val) : '—';

      bindTooltipEvents(td, tipCtrl, () => {
        const title = unit === 'uf' ? `${r.key} — ${UF_NAMES[r.key] || r.key}` : `Partido ${r.key}`;
        if (r.inconclusive) {
          return buildTooltipCard({
            title,
            badge: 'Inconclusivo',
            badgeTone: 'neutral',
            rows: [{ label: 'Critério mínimo', value: 'n < 10 ou FINAL < 70%' }],
          });
        }
        return buildTooltipCard({
          title,
          badge: `${m.short}: ${val !== null ? fmtPct(val) : '—'}`,
          badgeTone: cellColors(val, m.kind).tone,
          rows: [
            { label: '1. Candidatas (APTO)', value: fmtPct(r.pctCandF), focus: m.key === 'pctCandF' },
            { label: '2. Fundo Público', value: r.pctPubF !== null ? fmtPct(r.pctPubF) : '—', focus: m.key === 'pctPubF' },
            { label: '3. Privado/Próprio', value: r.pctPrivF !== null ? fmtPct(r.pctPrivF) : '—', focus: m.key === 'pctPrivF' },
            { label: '4. Votos nominais', value: r.pctVotosF !== null ? fmtPct(r.pctVotosF) : '—', focus: m.key === 'pctVotosF' },
            { label: '5. Eleitas', value: r.pctEleitasF !== null ? fmtPct(r.pctEleitasF) : '—', sub: `${r.elF}/${r.elTot}`, focus: m.key === 'pctEleitasF' },
            { label: '6. Alertas ≥2 sinais', value: r.pctAlertsF !== null ? fmtPct(r.pctAlertsF) : '—', focus: m.key === 'pctAlertsF' },
          ],
          hint: onSelectEntity ? `Clique na linha para destacar/limpar ${unit === 'uf' ? 'a UF' : 'o partido'}` : '',
        });
      });

      tr.appendChild(td);
    }

    if (onSelectEntity) {
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', (evt) => {
        evt.stopPropagation();
        onSelectEntity(r.key, unit);
      });
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);

  const clearBar = document.createElement('div');
  clearBar.className = 'h9-clear-bar';
  const hintSpan = document.createElement('span');
  hintSpan.textContent = selectedEntity
    ? `Destaque ativo: ${selectedEntity} · clique nesta faixa ou na linha para limpar`
    : 'Clique em uma linha para destacar · clique nos títulos para ordenar';
  clearBar.appendChild(hintSpan);
  if (selectedEntity && onClearEntity) {
    const clrBtn = document.createElement('button');
    clrBtn.type = 'button';
    clrBtn.className = 'h9-clear-btn';
    clrBtn.textContent = 'Limpar seleção ×';
    clrBtn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      onClearEntity();
    });
    clearBar.appendChild(clrBtn);
  }
  tipCtrl.wrap.appendChild(clearBar);
}
