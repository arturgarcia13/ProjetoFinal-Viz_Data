import * as d3 from 'd3';
import { sankey as d3Sankey, sankeyLinkHorizontal } from 'd3-sankey';
import {
  bindTooltipEvents,
  buildTooltipCard,
  createChartTooltip,
  fmtBrl,
  fmtCompactBrl,
  fmtInt,
  fmtPct,
} from './tooltip.js';

/**
 * H4 — Diagrama de Sankey do Fluxo Público + Grafo de Rede Bipartida (Candidaturas anônimas × Fornecedores-Hub)
 */
export function renderH4Sankey(container, h4Data, { width = 700 } = {}) {
  container.innerHTML = '';
  const f = h4Data.byGender.F;
  const m = h4Data.byGender.M;
  if (f.pubFlow <= 0 && m.pubFlow <= 0) {
    container.innerHTML = '<p class="chart-empty">Sem volume de recurso público alocado neste recorte.</p>';
    return;
  }

  const nodes = [
    { name: 'Fundo Público (FEFC+FP)' },
    { name: 'Candidatas (F)' },
    { name: 'Candidatos (M)' },
    { name: 'Campanha Direta (Exclusiva)' },
    { name: 'Fornecedor Compartilhado' },
    { name: 'Direção Partidária' },
    { name: 'Outras Candidaturas (M)' },
    { name: 'Outras Candidaturas (F/ND)' },
  ];

  const rawLinks = [
    { source: 0, target: 1, value: f.pubFlow },
    { source: 0, target: 2, value: m.pubFlow },
    { source: 1, target: 3, value: f.excl },
    { source: 1, target: 4, value: f.shared },
    { source: 1, target: 5, value: f.party },
    { source: 1, target: 6, value: f.candM },
    { source: 1, target: 7, value: f.candFOther },
    { source: 2, target: 3, value: m.excl },
    { source: 2, target: 4, value: m.shared },
    { source: 2, target: 5, value: m.party },
    { source: 2, target: 6, value: m.candM },
    { source: 2, target: 7, value: m.candFOther },
  ].filter((l) => l.value > 0);

  const height = 310;
  const tipCtrl = createChartTooltip(container);
  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', width)
    .attr('height', height);

  const layout = d3Sankey()
    .nodeWidth(16)
    .nodePadding(14)
    .extent([[12, 16], [width - 12, height - 16]]);

  const graph = layout({
    nodes: nodes.map((d) => ({ ...d })),
    links: rawLinks.map((d) => ({ ...d })),
  });

  const nodeColor = (name) => {
    if (name.includes('(F)')) return '#b4452f';
    if (name.includes('(M)')) return '#3d5a80';
    if (name.includes('Compartilhado') || name.includes('Partidária')) return '#d97a4a';
    if (name.includes('Direta')) return '#2f6f5e';
    return '#5c554c';
  };

  const linkSel = svg.append('g')
    .attr('fill', 'none')
    .selectAll('path')
    .data(graph.links)
    .join('path')
    .attr('d', sankeyLinkHorizontal())
    .attr('stroke', (d) => (d.source.name.includes('(F)') ? '#b4452f' : d.source.name.includes('(M)') ? '#3d5a80' : '#9c8f7d'))
    .attr('stroke-opacity', 0.35)
    .attr('stroke-width', (d) => Math.max(1.5, d.width))
    .style('cursor', 'pointer');

  linkSel.each(function (d) {
    const shareOfSource = d.source.value > 0 ? (d.value / d.source.value) * 100 : 0;
    const isDeviation = d.target.name.includes('Partidária') || d.target.name.includes('Outras Candidaturas (M)');
    bindTooltipEvents(
      this,
      tipCtrl,
      () => buildTooltipCard({
        title: `${d.source.name} → ${d.target.name}`,
        badge: `${fmtPct(shareOfSource)} da origem`,
        badgeTone: isDeviation ? 'floor' : 'neutral',
        rows: [
          { label: 'Montante proporcional', value: fmtCompactBrl(d.value), focus: true },
          { label: 'Fatia na origem', value: fmtPct(shareOfSource) },
        ],
      }),
      {
        onEnter: () => linkSel.attr('stroke-opacity', (l) => (l === d ? 0.85 : 0.14)),
        onLeave: () => linkSel.attr('stroke-opacity', 0.35),
      },
    );
  });

  const nodeG = svg.append('g')
    .selectAll('g')
    .data(graph.nodes)
    .join('g');

  const nodeRects = nodeG.append('rect')
    .attr('x', (d) => d.x0)
    .attr('y', (d) => d.y0)
    .attr('height', (d) => Math.max(2, d.y1 - d.y0))
    .attr('width', (d) => d.x1 - d.x0)
    .attr('fill', (d) => nodeColor(d.name))
    .style('cursor', 'pointer');

  const totalRoot = graph.nodes[0]?.value || 0;
  nodeRects.each(function (d) {
    const shareTotal = totalRoot > 0 ? (d.value / totalRoot) * 100 : 0;
    bindTooltipEvents(this, tipCtrl, () => buildTooltipCard({
      title: d.name,
      badge: `${fmtPct(shareTotal)} do fundo`,
      badgeTone: d.name.includes('Direta') ? 'above' : (d.name.includes('Partidária') ? 'floor' : 'neutral'),
      rows: [
        { label: 'Volume proporcional', value: fmtCompactBrl(d.value), focus: true },
        { label: 'Participação no total', value: fmtPct(shareTotal) },
      ],
    }));
  });

  nodeG.append('text')
    .attr('x', (d) => (d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6))
    .attr('y', (d) => (d.y0 + d.y1) / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', (d) => (d.x0 < width / 2 ? 'start' : 'end'))
    .attr('font-size', 11)
    .attr('fill', '#1b1a17')
    .style('pointer-events', 'none')
    .text((d) => `${d.name} (${(d.value / 1e6).toFixed(1)}M)`);
}

export function renderH4Network(container, networkYear, filters = {}, { width = 700, onSelectParty = null } = {}) {
  container.innerHTML = '';
  if (!networkYear || !networkYear.hubs || networkYear.hubs.length === 0) {
    container.innerHTML = '<p class="chart-empty">Sem dados de rede bipartida para este ano.</p>';
    return;
  }

  const { uf = null, party = null, cargo = 'all' } = filters;
  const candById = new Map(networkYear.candidates.map((c) => [c.cid, c]));

  const filteredLinks = networkYear.links.filter((l) => {
    const c = candById.get(l.cid);
    if (!c) return false;
    if (uf && c.uf !== uf) return false;
    if (party && c.p !== party) return false;
    if (cargo && cargo !== 'all' && c.cargo !== cargo) return false;
    return true;
  });

  const hubStats = new Map();
  for (const l of filteredLinks) {
    hubStats.set(l.hid, (hubStats.get(l.hid) || 0) + l.val);
  }

  const topHubIds = new Set(
    [...hubStats.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([hid]) => hid),
  );

  const activeLinks = filteredLinks.filter((l) => topHubIds.has(l.hid));
  if (activeLinks.length === 0) {
    container.innerHTML = '<p class="chart-empty">Nenhum fornecedor-hub encontrado neste recorte (critério: ≥2 candidaturas e &gt;15% da despesa de candidatura com &lt;20 votos).</p>';
    return;
  }

  const activeHubs = networkYear.hubs.filter((h) => topHubIds.has(h.hid)).map((h) => ({ ...h, id: h.hid, kind: 'hub' }));
  const activeCandIds = new Set(activeLinks.map((l) => l.cid));
  const activeCands = [...activeCandIds].map((cid) => ({ ...candById.get(cid), id: `C_${cid}`, kind: 'cand' }));

  const nodes = [...activeHubs, ...activeCands];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const links = activeLinks.map((l) => ({ source: `C_${l.cid}`, target: l.hid, val: l.val, share: l.share }));

  // 1. Separa componentes conectados para evitar que ilhas desconectadas se repilam para as bordas
  const adj = new Map(nodes.map((n) => [n.id, []]));
  for (const l of links) {
    adj.get(l.source).push(l.target);
    adj.get(l.target).push(l.source);
  }

  const visited = new Set();
  const components = [];
  for (const n of nodes) {
    if (visited.has(n.id)) continue;
    const queue = [n.id];
    visited.add(n.id);
    const compNodeIds = new Set();
    while (queue.length > 0) {
      const cur = queue.shift();
      compNodeIds.add(cur);
      for (const nb of adj.get(cur) || []) {
        if (!visited.has(nb)) {
          visited.add(nb);
          queue.push(nb);
        }
      }
    }
    const compNodes = [...compNodeIds].map((id) => nodeById.get(id));
    const compLinks = links.filter((l) => compNodeIds.has(l.source) && compNodeIds.has(l.target));
    const compHubs = compNodes.filter((x) => x.kind === 'hub').sort((a, b) => b.totalVal - a.totalVal);
    components.push({
      id: components.length,
      nodes: compNodes,
      links: compLinks,
      mainHub: compHubs[0] || null,
      totalVal: compHubs.reduce((s, h) => s + (h.totalVal || 0), 0),
    });
  }
  components.sort((a, b) => b.totalVal - a.totalVal);

  // 2. Layout local estável por componente (cada constelação centralizada em 0,0)
  for (const comp of components) {
    const hubCount = comp.nodes.filter((d) => d.kind === 'hub').length;
    const candCount = comp.nodes.length - hubCount;
    const linkDist = hubCount > 1 ? 36 : Math.max(24, Math.min(46, 18 + Math.sqrt(candCount) * 4.2));

    // Inicialização determinística em anel evita simetrias degeneradas
    comp.nodes.forEach((d, idx) => {
      const angle = (idx / Math.max(1, comp.nodes.length)) * Math.PI * 2;
      const rad = d.kind === 'hub' ? (hubCount > 1 ? 18 : 0) : linkDist;
      d.x = Math.cos(angle) * rad;
      d.y = Math.sin(angle) * rad;
      d.compId = comp.id;
    });

    const localSim = d3.forceSimulation(comp.nodes)
      .force('link', d3.forceLink(comp.links).id((d) => d.id).distance(linkDist).strength(0.9))
      .force('charge', d3.forceManyBody().strength(candCount > 25 ? -28 : -45))
      .force('x', d3.forceX(0).strength(0.08))
      .force('y', d3.forceY(0).strength(0.08))
      .force('collide', d3.forceCollide().radius((d) => (d.kind === 'hub' ? 12 : (d.v < 20 ? 7.5 : 5.8))))
      .stop();

    for (let i = 0; i < 160; i += 1) localSim.tick();

    // Centraliza o componente na sua própria média e calcula o raio envolvente
    const cx = d3.mean(comp.nodes, (d) => d.x) || 0;
    const cy = d3.mean(comp.nodes, (d) => d.y) || 0;
    let maxR = 18;
    for (const d of comp.nodes) {
      d.x -= cx;
      d.y -= cy;
      const rr = Math.hypot(d.x, d.y) + (d.kind === 'hub' ? 12 : 8);
      if (rr > maxR) maxR = rr;
    }
    comp.r = maxR + 22;
  }

  // 3. Empacota os componentes sem sobreposição usando d3.packSiblings
  d3.packSiblings(components);
  for (const comp of components) {
    for (const d of comp.nodes) {
      d.x += comp.x;
      d.y += comp.y;
    }
  }

  // 4. Ajusta escala uniforme e centraliza todo o grafo dentro do viewBox útil (sem esmagar nas bordas)
  const isNarrow = width < 520;
  const height = isNarrow ? 420 : 400;
  const padX = 24;
  const padTop = 18;
  const legendH = isNarrow ? 58 : 38;
  const availW = width - padX * 2;
  const availH = height - padTop - legendH - 10;

  const minX = d3.min(components, (c) => c.x - c.r);
  const maxX = d3.max(components, (c) => c.x + c.r);
  const minY = d3.min(components, (c) => c.y - c.r);
  const maxY = d3.max(components, (c) => c.y + c.r);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const scale = Math.min(availW / spanX, availH / spanY, 1.35);
  const offX = padX + (availW - spanX * scale) / 2 - minX * scale;
  const offY = padTop + (availH - spanY * scale) / 2 - minY * scale;

  for (const d of nodes) {
    d.px = d.x * scale + offX;
    d.py = d.y * scale + offY;
  }

  const tipCtrl = createChartTooltip(container);
  const svg = d3.select(tipCtrl.wrap).append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', width)
    .attr('height', height);

  // Moldura suave de agrupamento por componente (facilita identificar cada cluster partido/UF)
  svg.append('g')
    .attr('aria-label', 'component-halos')
    .selectAll('circle')
    .data(components)
    .join('circle')
    .attr('cx', (c) => c.x * scale + offX)
    .attr('cy', (c) => c.y * scale + offY)
    .attr('r', (c) => Math.max(18, (c.r - 4) * scale))
    .attr('fill', '#ebe4d8')
    .attr('fill-opacity', 0.28)
    .attr('stroke', '#d7cdbc')
    .attr('stroke-width', 0.8)
    .attr('stroke-dasharray', '3,3');

  const linkEl = svg.append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('x1', (d) => d.source.px)
    .attr('y1', (d) => d.source.py)
    .attr('x2', (d) => d.target.px)
    .attr('y2', (d) => d.target.py)
    .attr('stroke', '#8d8375')
    .attr('stroke-opacity', 0.48)
    .attr('stroke-width', (d) => Math.max(0.9, Math.min(4.2, d.share * 5.2)));

  const nodeEl = svg.append('g')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .attr('transform', (d) => `translate(${d.px.toFixed(1)},${d.py.toFixed(1)})`);

  const candCircles = nodeEl.filter((d) => d.kind === 'cand')
    .append('circle')
    .attr('r', (d) => (d.v < 20 ? 5.2 : 3.6))
    .attr('fill', (d) => (d.g === 'F' ? '#b4452f' : '#3d5a80'))
    .attr('stroke', (d) => (d.v < 20 ? '#1b1a17' : '#fffdf9'))
    .attr('stroke-width', (d) => (d.v < 20 ? 1.5 : 0.7))
    .style('cursor', 'pointer');

  candCircles.each(function (d) {
    bindTooltipEvents(this, tipCtrl, () => buildTooltipCard({
      title: `Candidatura anônima (${d.g === 'F' ? 'Mulher' : 'Homem'})`,
      badge: `${d.p}/${d.uf}`,
      badgeTone: d.v < 20 ? 'below' : 'neutral',
      rows: [
        {
          label: 'Votos válidos',
          value: fmtInt(d.v),
          sub: d.v < 20 ? '< 20 votos' : '',
          focus: d.v < 20,
        },
        { label: 'Despesa total', value: fmtBrl(d.e) },
      ],
    }));
  });

  const hubRects = nodeEl.filter((d) => d.kind === 'hub')
    .append('rect')
    .attr('x', -6.5).attr('y', -6.5).attr('width', 13).attr('height', 13).attr('rx', 2.2)
    .attr('fill', '#1b1a17')
    .attr('stroke', '#fffdf9')
    .attr('stroke-width', 1.3)
    .style('cursor', 'pointer')
    .on('click', (_, d) => {
      if (onSelectParty) onSelectParty(d.p);
    });

  hubRects.each(function (d) {
    bindTooltipEvents(
      this,
      tipCtrl,
      () => buildTooltipCard({
        title: d.label,
        badge: `Hub · ${d.p}/${d.uf}`,
        badgeTone: d.lowVoteN > 0 ? 'below' : 'neutral',
        rows: [
          { label: 'Candidaturas atendidas', value: fmtInt(d.candsN) },
          { label: 'Com < 20 votos', value: fmtInt(d.lowVoteN), focus: d.lowVoteN > 0 },
          { label: 'Volume no grupo', value: fmtCompactBrl(d.totalVal) },
        ],
        hint: onSelectParty ? `Clique no quadrado para filtrar ${d.p}` : '',
      }),
      {
        onEnter: () => {
          linkEl
            .attr('stroke-opacity', (l) => (l.target.id === d.id ? 0.95 : 0.08))
            .attr('stroke', (l) => (l.target.id === d.id ? '#b4452f' : '#8d8375'));
          nodeEl.attr('opacity', (n) => (n.compId === d.compId ? 1 : 0.22));
        },
        onLeave: () => {
          linkEl.attr('stroke-opacity', 0.48).attr('stroke', '#8d8375');
          nodeEl.attr('opacity', 1);
        },
      },
    );
  });

  // Rótulo discreto (Partido/UF) acomodado na base interna de cada constelação
  svg.append('g')
    .attr('aria-label', 'cluster-labels')
    .style('pointer-events', 'none')
    .selectAll('text')
    .data(components.filter((c) => c.mainHub))
    .join('text')
    .attr('x', (c) => c.x * scale + offX)
    .attr('y', (c) => (c.y + c.r - 7) * scale + offY)
    .attr('text-anchor', 'middle')
    .attr('font-size', 9.2)
    .attr('font-weight', '600')
    .attr('fill', '#3b362f')
    .attr('stroke', '#fffdf9')
    .attr('stroke-width', 2.8)
    .attr('paint-order', 'stroke')
    .text((c) => `${c.mainHub.p}/${c.mainHub.uf}`);

  // Legenda clara no rodapé do SVG
  const leg = svg.append('g').attr('transform', `translate(14, ${height - (isNarrow ? 40 : 20)})`);
  const legendItems = [
    { kind: 'square', fill: '#1b1a17', stroke: '#fffdf9', label: 'Fornecedor-Hub (clique filtra partido)' },
    { kind: 'circle', fill: '#b4452f', stroke: '#fffdf9', sw: 0.8, label: 'Candidata (F)' },
    { kind: 'circle', fill: '#3d5a80', stroke: '#fffdf9', sw: 0.8, label: 'Candidato (M)' },
    { kind: 'circle', fill: '#b4452f', stroke: '#1b1a17', sw: 1.8, label: '< 20 votos (borda preta)' },
  ];
  let lx = 0;
  let ly = 0;
  for (const item of legendItems) {
    const itemW = item.label.length * 5.8 + 24;
    if (lx > 0 && lx + itemW > width - 20) {
      lx = 0;
      ly += 16;
    }
    const g = leg.append('g').attr('transform', `translate(${lx}, ${ly})`);
    if (item.kind === 'square') {
      g.append('rect').attr('x', 0).attr('y', -5).attr('width', 10).attr('height', 10).attr('rx', 2)
        .attr('fill', item.fill).attr('stroke', item.stroke).attr('stroke-width', 1);
    } else {
      g.append('circle').attr('cx', 5).attr('cy', 0).attr('r', 4.5)
        .attr('fill', item.fill).attr('stroke', item.stroke).attr('stroke-width', item.sw);
    }
    g.append('text').attr('x', 14).attr('y', 3.5).attr('font-size', 10.5).attr('fill', '#3b362f').text(item.label);
    lx += itemW + 10;
  }
}
