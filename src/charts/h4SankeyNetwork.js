import * as d3 from 'd3';
import { sankey as d3Sankey, sankeyLinkHorizontal } from 'd3-sankey';

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
  const svg = d3.select(container).append('svg')
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

  svg.append('g')
    .attr('fill', 'none')
    .selectAll('path')
    .data(graph.links)
    .join('path')
    .attr('d', sankeyLinkHorizontal())
    .attr('stroke', (d) => (d.source.name.includes('(F)') ? '#b4452f' : d.source.name.includes('(M)') ? '#3d5a80' : '#9c8f7d'))
    .attr('stroke-opacity', 0.35)
    .attr('stroke-width', (d) => Math.max(1.5, d.width))
    .append('title')
    .text((d) => `${d.source.name} → ${d.target.name}: R$ ${(d.value / 1e6).toFixed(2)}M`);

  const nodeG = svg.append('g')
    .selectAll('g')
    .data(graph.nodes)
    .join('g');

  nodeG.append('rect')
    .attr('x', (d) => d.x0)
    .attr('y', (d) => d.y0)
    .attr('height', (d) => Math.max(2, d.y1 - d.y0))
    .attr('width', (d) => d.x1 - d.x0)
    .attr('fill', (d) => nodeColor(d.name))
    .append('title')
    .text((d) => `${d.name}: R$ ${(d.value / 1e6).toFixed(2)}M`);

  nodeG.append('text')
    .attr('x', (d) => (d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6))
    .attr('y', (d) => (d.y0 + d.y1) / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', (d) => (d.x0 < width / 2 ? 'start' : 'end'))
    .attr('font-size', 11)
    .attr('fill', '#1b1a17')
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
      .slice(0, 22)
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
  const links = activeLinks.map((l) => ({ source: `C_${l.cid}`, target: l.hid, val: l.val, share: l.share }));

  const height = 340;
  const svg = d3.select(container).append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', width)
    .attr('height', height);

  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id((d) => d.id).distance(42))
    .force('charge', d3.forceManyBody().strength(-75))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collide', d3.forceCollide().radius((d) => (d.kind === 'hub' ? 10 : 5)))
    .stop();

  for (let i = 0; i < 160; i += 1) sim.tick();

  const linkEl = svg.append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('x1', (d) => Math.max(16, Math.min(width - 16, d.source.x)))
    .attr('y1', (d) => Math.max(16, Math.min(height - 16, d.source.y)))
    .attr('x2', (d) => Math.max(16, Math.min(width - 16, d.target.x)))
    .attr('y2', (d) => Math.max(16, Math.min(height - 16, d.target.y)))
    .attr('stroke', '#8d8375')
    .attr('stroke-opacity', 0.45)
    .attr('stroke-width', (d) => Math.max(1, Math.min(5, d.share * 6)));

  const nodeEl = svg.append('g')
    .selectAll('path')
    .data(nodes)
    .join('g')
    .attr('transform', (d) => `translate(${Math.max(16, Math.min(width - 16, d.x))},${Math.max(16, Math.min(height - 16, d.y))})`);

  nodeEl.filter((d) => d.kind === 'hub')
    .append('rect')
    .attr('x', -7).attr('y', -7).attr('width', 14).attr('height', 14).attr('rx', 2)
    .attr('fill', '#1b1a17')
    .attr('stroke', '#fffdf9')
    .attr('stroke-width', 1.2)
    .style('cursor', 'pointer')
    .on('click', (_, d) => {
      if (onSelectParty) onSelectParty(d.p);
    })
    .append('title')
    .text((d) => `Hub ${d.label} (${d.p}/${d.uf}) · ${d.candsN} cand. (${d.lowVoteN} <20 votos) · R$ ${d.totalVal.toLocaleString('pt-BR')}`);

  nodeEl.filter((d) => d.kind === 'cand')
    .append('circle')
    .attr('r', (d) => (d.v < 20 ? 5.5 : 4))
    .attr('fill', (d) => (d.g === 'F' ? '#b4452f' : '#3d5a80'))
    .attr('stroke', (d) => (d.v < 20 ? '#1b1a17' : '#fffdf9'))
    .attr('stroke-width', (d) => (d.v < 20 ? 1.5 : 0.8))
    .append('title')
    .text((d) => `Candidatura anônima (${d.g}) · ${d.p}/${d.uf} · ${d.v} votos · Despesa: R$ ${d.e.toLocaleString('pt-BR')}`);

  // Destaca ligações no hover do hub
  nodeEl.filter((d) => d.kind === 'hub')
    .on('mouseenter', (_, d) => {
      linkEl.attr('stroke-opacity', (l) => (l.target.id === d.id ? 0.95 : 0.1))
        .attr('stroke', (l) => (l.target.id === d.id ? '#b4452f' : '#8d8375'));
    })
    .on('mouseleave', () => {
      linkEl.attr('stroke-opacity', 0.45).attr('stroke', '#8d8375');
    });
}
