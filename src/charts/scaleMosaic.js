import * as d3 from 'd3';
import { CARGO_LABEL, UF_NAMES } from '../data.js';
import { createEvidenceCard, escapeHtml } from '../components/evidenceCard.js';
import {
  bindTooltipEvents,
  buildTooltipCard,
  createChartTooltip,
  fmtInt,
  fmtPct,
} from './tooltip.js';

const BAND_META = {
  below: {
    label: '< 30% (Irregular)',
    short: '<30%',
    fill: '#FF5E2B',
    ink: '#001A12',
    tone: 'below',
    status: 'Irregular (< 30%)',
  },
  floor: {
    label: '30%–33,3% (Piso)',
    short: 'Piso',
    fill: '#FCE34D',
    ink: '#003D2B',
    tone: 'floor',
    status: 'Colada no piso',
  },
  mid: {
    label: '33,4%–40%',
    short: '33–40%',
    fill: '#34B38A',
    ink: '#001A12',
    tone: 'above',
    status: 'Acima do piso',
  },
  high: {
    label: '> 40% (Equilíbrio)',
    short: '>40%',
    fill: '#FF7AE5',
    ink: '#003D2B',
    tone: 'above',
    status: 'Alta presença',
  },
};

const ROLE_TAGS = {
  dropped: { tag: 'Queda por inaptidão', tone: 'below' },
  signals: { tag: 'Piso 30% + sinais', tone: 'floor' },
  below: { tag: 'Abaixo da cota', tone: 'below' },
  contrast: { tag: 'Contraste >40%', tone: 'above' },
};

function formatChapaLabel(chapa) {
  if (!chapa) return 'Chapa';
  return chapa.length > 26 ? `${chapa.slice(0, 24)}…` : chapa;
}

/**
 * Mosaico em Escala (Macro → Micro / Grid to Pull-Out):
 * - focusMode = 'macro': exibe até 48 chapas reais em grade com alta visibilidade
 * - focusMode = 'micro': reduz demais tiles a 0.15 de opacidade, destaca 4 casos
 *   emblemáticos no SVG e renderiza 4 EvidenceCards ampliados em secondaryContainer
 */
export function renderScaleMosaic(
  container,
  secondaryContainer,
  mosaicData,
  {
    width = 700,
    year = 2022,
    focusMode = 'macro',
    coverageYear = null,
    onSelectUF = null,
  } = {},
) {
  container.innerHTML = '';
  if (secondaryContainer) secondaryContainer.innerHTML = '';

  const tiles = mosaicData?.tiles || [];
  if (tiles.length === 0) {
    container.innerHTML = '<p class="chart-empty">Sem chapas com pelo menos 4 candidaturas neste recorte para montar o mosaico.</p>';
    return;
  }

  const isMicro = focusMode === 'micro';
  const isCompact = width < 460;
  const cols = isCompact ? 6 : 8;
  const rows = Math.ceil(tiles.length / cols);

  const padX = 6;
  const headerH = 28;
  const gap = isCompact ? 5 : 6;
  const tileW = Math.floor((width - padX * 2 - gap * (cols - 1)) / cols);
  const tileH = isCompact ? 42 : 44;
  const height = headerH + rows * (tileH + gap) + 8;

  // Barra de legenda enxuta com proporção real das faixas no universo
  const legendEl = document.createElement('div');
  legendEl.className = 'mosaic-legend';
  const total = mosaicData.totalSlates || tiles.length;
  for (const key of ['below', 'floor', 'mid', 'high']) {
    const meta = BAND_META[key];
    const count = mosaicData.bandCounts?.[key] || 0;
    const pct = total > 0 ? (count / total) * 100 : 0;
    const pill = document.createElement('span');
    pill.className = 'mosaic-legend-item';
    pill.innerHTML = `<i style="background:${meta.fill}"></i>${meta.label}: <strong>${fmtPct(pct)}</strong>`;
    legendEl.appendChild(pill);
  }
  container.appendChild(legendEl);

  const tipCtrl = createChartTooltip(container);
  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('class', `mosaic-svg${isMicro ? ' is-micro-mode' : ''}`)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', width)
    .attr('height', height)
    .attr('role', 'img')
    .attr('aria-label', `Mosaico proporcional de ${tiles.length} chapas reais de ${year} representando ${total} chapas`);

  svg.append('text')
    .attr('x', padX)
    .attr('y', 16)
    .attr('font-size', 11)
    .attr('font-weight', 600)
    .attr('fill', 'rgba(255, 255, 255, 0.86)')
    .text(
      isMicro
        ? `Pull-out: 4 chapas reais em foco sobre a amostra de ${fmtInt(total)} chapas (${year})`
        : `Amostra proporcional: ${tiles.length} blocos representam ${fmtInt(total)} chapas (${year}, n ≥ 4)`,
    );

  const gridG = svg.append('g').attr('class', 'mosaic-grid');

  tiles.forEach((tile, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = padX + col * (tileW + gap);
    const y = headerH + row * (tileH + gap);
    const meta = BAND_META[tile.band] || BAND_META.floor;
    const isFeatured = Boolean(tile.pullOutIndex);
    const dimmed = isMicro && !isFeatured;

    const g = gridG.append('g')
      .attr('class', `mosaic-tile${isFeatured ? ' is-featured' : ''}${dimmed ? ' is-dimmed' : ''}`)
      .attr('data-band', tile.band)
      .attr('data-featured', isFeatured ? 'true' : 'false')
      .attr('transform', `translate(${x}, ${y})`)
      .style('cursor', onSelectUF ? 'pointer' : 'default')
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', `${tile.chapa} (${tile.uf}): ${fmtPct(tile.pctReg * 100)} mulheres no registro`);

    g.append('rect')
      .attr('width', tileW)
      .attr('height', tileH)
      .attr('rx', 4)
      .attr('fill', meta.fill)
      .attr('stroke', isMicro && isFeatured ? '#FFFFFF' : 'rgba(0, 26, 18, 0.35)')
      .attr('stroke-width', isMicro && isFeatured ? 2.4 : 1);

    g.append('text')
      .attr('x', 6)
      .attr('y', 15)
      .attr('font-size', isCompact ? 9.5 : 10.5)
      .attr('font-weight', 700)
      .attr('fill', meta.ink)
      .text(`${tile.uf} · ${CARGO_LABEL[tile.cargo]?.includes('Federal') ? 'Fed' : 'Est'}`);

    g.append('text')
      .attr('x', 6)
      .attr('y', tileH - 8)
      .attr('font-size', isCompact ? 11.5 : 12.5)
      .attr('font-weight', 700)
      .attr('fill', meta.ink)
      .text(fmtPct(tile.pctReg * 100));

    if (isMicro && isFeatured) {
      g.append('circle')
        .attr('cx', tileW - 11)
        .attr('cy', 11)
        .attr('r', 8)
        .attr('fill', '#003D2B')
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', 1.4);

      g.append('text')
        .attr('x', tileW - 11)
        .attr('y', 14.5)
        .attr('text-anchor', 'middle')
        .attr('font-size', 9.5)
        .attr('font-weight', 700)
        .attr('fill', '#FCE34D')
        .text(`#${tile.pullOutIndex}`);
    }

    const node = g.node();
    bindTooltipEvents(node, tipCtrl, () => {
      const cargoName = tile.cargo === '6' ? 'Dep. Federal' : 'Dep. Estadual';
      return buildTooltipCard({
        title: `${formatChapaLabel(tile.chapa)} · ${tile.uf}`,
        badge: tile.pullOutLabel || meta.status,
        badgeTone: meta.tone,
        rows: [
          { label: 'Cargo / UF', value: `${cargoName} · ${UF_NAMES[tile.uf] || tile.uf}` },
          { label: 'No registro', value: fmtPct(tile.pctReg * 100), sub: `${tile.fReg}/${tile.nReg}` },
          { label: 'Entre APTO', value: fmtPct(tile.pctApto * 100), sub: `${tile.fApto}/${tile.nApto}` },
          { label: 'Mulheres ≥2 sinais', value: `${fmtInt(tile.twoPlusF)} (${fmtPct(tile.twoPlusRate * 100)})` },
        ],
        hint: onSelectUF ? `Clique para filtrar por ${tile.uf}` : '',
      });
    }, { focusable: true });

    if (onSelectUF) {
      g.on('click', () => onSelectUF(tile.uf));
      g.on('keydown', (evt) => {
        if (evt.key === 'Enter' || evt.key === ' ') {
          evt.preventDefault();
          onSelectUF(tile.uf);
        }
      });
    }
  });

  if (isMicro && secondaryContainer) {
    const dtCand = coverageYear?.dt_geracao?.consulta_cand || 'extrato oficial';
    const grid = document.createElement('div');
    grid.className = 'pullout-grid';

    for (const item of mosaicData.pullOuts) {
      const roleMeta = ROLE_TAGS[item.pullOutRole] || { tag: item.pullOutLabel, tone: 'neutral' };
      const cargoTxt = item.cargo === '6' ? 'Dep. Federal' : 'Dep. Estadual';
      const deltaApto = (item.pctApto - item.pctReg) * 100;
      const deltaStr = `${deltaApto >= 0 ? '+' : ''}${deltaApto.toFixed(1).replace('.', ',')} p.p.`;
      const highlightTxt = item.droppedByInapto
        ? `<mark class="ev-highlight">${fmtPct(item.pctReg * 100)} → ${fmtPct(item.pctApto * 100)}</mark> após inaptidões (${item.fReg - item.fApto} mulheres barradas)`
        : `<mark class="ev-highlight">${fmtPct(item.pctReg * 100)} de mulheres</mark> (${item.fReg}/${item.nReg}) · ${fmtInt(item.twoPlusF)} com ≥2 sinais`;

      const card = createEvidenceCard({
        meta: `#${item.pullOutIndex} · TSE ${year} · ${item.uf} (${cargoTxt}) · ${dtCand}`,
        linkLabel: 'Dados TSE ↗︎',
        linkHref: `https://dadosabertos.tse.jus.br/dataset/candidatos-${year}`,
        htmlText: `<strong>${escapeHtml(item.chapa)}</strong>: ${highlightTxt} <span class="ev-inline-delta">(APTO: ${deltaStr})</span>.`,
        tag: roleMeta.tag,
        tagTone: roleMeta.tone,
        actionLabel: onSelectUF ? `Filtrar ${item.uf}` : '',
        onAction: onSelectUF ? () => onSelectUF(item.uf) : null,
      });
      grid.appendChild(card);
    }

    secondaryContainer.appendChild(grid);
  }
}
