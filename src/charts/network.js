import * as d3 from 'd3';
import { C, chartFrame, fmtMoney, fmtNum, fmtPct, short, showTip, hideTip } from './helpers.js';

function cnaeCat(s) {
  const t = (s || '').toLowerCase();
  if (/publicidade|marketing|agenciamento|propaganda/.test(t)) return 'Publicidade';
  if (/pessoal|mão de obra|mao de obra|trabalho tempor|recrutamento/.test(t)) return 'Pessoal';
  if (/combust|posto/.test(t)) return 'Combustível';
  if (/veículo|veiculo|locadora|transporte|frete/.test(t)) return 'Veículos';
  if (/aliment|restaurante|refei|buffet/.test(t)) return 'Alimentação';
  if (/advoc|juríd|jurid/.test(t)) return 'Jurídico';
  if (/contab|contador/.test(t)) return 'Contabilidade';
  if (/evento|promoção|promocao|show/.test(t)) return 'Eventos';
  if (/material|gráfic|grafic|impress|papelaria/.test(t)) return 'Material';
  if (/software|internet|tecnologia|hospedagem/.test(t)) return 'Digital';
  return 'Outros';
}

const CAT_COLOR = {
  Publicidade: '#B4452F', Pessoal: '#C98A2E', Combustível: '#6E7C6A',
  Veículos: '#5D4B86', Alimentação: '#8E4B3E', Jurídico: '#3E6B8E',
  Contabilidade: '#8A6D3B', Eventos: '#A9762E', Material: '#9C9384',
  Digital: '#4F7C7A', Outros: '#B9B0A0'
};
const G_COLOR = { F: C.women, M: C.men };

const CARGO_LABEL = {
  'DEPUTADO FEDERAL': 'Federal',
  'DEPUTADO ESTADUAL': 'Estadual',
  'DEPUTADO DISTRITAL': 'Distrital'
};

/** H4 — rede bipartita candidata–fornecedor.
 * Só entram fornecedores-hub: >= 2 candidaturas do mesmo partido e > 15% da
 * despesa contratada de ao menos uma candidata com < 20 votos.
 * Nós de candidaturas são anônimos e identificados apenas por partido/UF/cargo.
 */
export function renderNetwork(container, ctx) {
  const { state, on, hubNetwork } = ctx;
  if (!hubNetwork?.links?.length) {
    container.innerHTML = '<p class="empty">Rede de fornecedores indisponível neste build.</p>';
    return;
  }
  const cargos = state.cargo === 'dep' ? ['6', '7'] : state.cargo === 'federal' ? ['6'] : state.cargo === 'estadual' ? ['7'] : ['8'];
  const cById = new Map(hubNetwork.candidates.map(c => [c.id, c]));
  let links = hubNetwork.links.filter(l => l.y === state.year && cargos.includes(String(l.c)));
  if (state.uf) links = links.filter(l => cById.get(l.cid)?.uf === state.uf);
  if (state.parties.size || state.pcParties.size) {
    links = links.filter(l => {
      const c = cById.get(l.cid);
      if (!c) return false;
      if (state.parties.size && !(state.parties.has(c.leg) || state.parties.has(c.p))) return false;
      if (state.pcParties.size && !state.pcParties.has(c.leg)) return false;
      return true;
    });
  }
  if (!links.length) {
    container.innerHTML = '<p class="empty">Sem fornecedores-hub neste recorte. Em 2026, a prestação parcial pode ocultar vínculos.</p>';
    return;
  }

  const hubMeta = new Map(hubNetwork.hubs.map(h => [h.key, h]));
  const hubLinks = new Map();
  for (const l of links) {
    let h = hubLinks.get(l.hubKey);
    if (!h) {
      const meta = hubMeta.get(l.hubKey);
      h = { key: l.hubKey, p: l.p, c: l.c, s: l.s, cnae: l.cnae, cat: cnaeCat(l.cnae), hubLow: 0, maxShare: 0, nc: 0, v: 0, links: [] };
      if (meta) Object.assign(h, { hubLow: meta.hubLow, maxShare: meta.maxShare, nc: meta.nc, v: meta.v, cnae: meta.cnae || l.cnae, cat: cnaeCat(meta.cnae || l.cnae) });
      hubLinks.set(l.hubKey, h);
    }
    h.links.push(l);
  }

  // Até 8 hubs, no máximo 2 por partido, para a rede não virar um emaranhado.
  const candidatesHubs = [...hubLinks.values()].filter(h => h.hubLow > 0)
    .sort((a, b) => b.hubLow - a.hubLow || b.maxShare - a.maxShare || b.nc - a.nc);
  const perParty = new Map(), selected = [];
  for (const h of candidatesHubs) {
    if (selected.length >= 8) break;
    const n = perParty.get(h.p) || 0;
    if (n >= 2) continue;
    perParty.set(h.p, n + 1);
    selected.push(h);
  }
  if (!selected.length) {
    container.innerHTML = '<p class="empty">Nenhum fornecedor atende ao critério de hub neste recorte.</p>';
    return;
  }
  const selectedKeys = new Set(selected.map(h => h.key));
  links = links.filter(l => selectedKeys.has(l.hubKey));

  const candMap = new Map();
  for (const l of links) {
    if (candMap.has(l.cid)) continue;
    const c = cById.get(l.cid);
    if (c) candMap.set(l.cid, c);
  }
  const candNodes = [...candMap.values()].sort((a, b) =>
    a.leg.localeCompare(b.leg) || a.uf.localeCompare(b.uf) || a.g.localeCompare(b.g) || a.v - b.v);
  const supNodes = selected;

  const { svg, width, height } = chartFrame(container, 570, 620);
  const m = { top: 54, right: 18, bottom: 48, left: 16 };
  const w = width - m.left - m.right, h = height - m.top - m.bottom;
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);
  const cX = 30, sX = w - 128;
  const candY = d3.scalePoint().domain(candNodes.map(d => d.id)).range([0, h]).padding(.12);
  const supY = d3.scalePoint().domain(supNodes.map(d => d.key)).range([0, h]).padding(.35);
  const maxExp = d3.max(candNodes, d => d.exp) || 1;
  const rCand = d => 2.3 + Math.sqrt((d.exp || 0) / maxExp) * 2.8 + (d.low ? .8 : 0);
  const maxLow = d3.max(supNodes, d => d.hubLow) || 1;
  const rSup = d => 6 + Math.sqrt(d.hubLow / maxLow) * 4;

  // arestas
  const path = d3.linkHorizontal().x(d => d.x).y(d => d.y);
  g.selectAll('path.hub-edge').data(links).join('path')
    .attr('class', 'hub-edge')
    .attr('d', l => {
      const c = candMap.get(l.cid);
      const hb = hubLinks.get(l.hubKey);
      return path({
        source: { x: cX + rCand(c), y: candY(l.cid) },
        target: { x: sX - rSup(hb), y: supY(l.hubKey) }
      });
    })
    .attr('fill', 'none')
    .attr('stroke', l => CAT_COLOR[cnaeCat(hubMeta.get(l.hubKey)?.cnae || l.cnae)] || C.faint)
    .attr('stroke-width', l => .45 + 1.8 * Math.sqrt(l.share || 0))
    .attr('stroke-opacity', .26)
    .on('mousemove', (event, l) => {
      const c = candMap.get(l.cid), hb = hubLinks.get(l.hubKey);
      showTip(`<strong>${c.g === 'F' ? 'Candidata' : 'Candidato'} anônima/o · ${c.leg}</strong><br>
        ${c.uf} · ${CARGO_LABEL[c.cargo] || c.cargo} · ${fmtNum(c.v)} votos<br>
        ${fmtMoney(l.value)} para ${hb.cat.toLowerCase()} (${fmtPct(l.share)} da despesa)<br>
        <span class="tip-muted">${c.low ? 'baixa votação · ' : ''}fornecedor-hub ${hb.s.slice(-6)}</span>`, event);
    })
    .on('mouseleave', hideTip);

  // candidaturas (círculos)
  const cg = g.selectAll('g.cand').data(candNodes).join('g')
    .attr('class', 'cand')
    .attr('transform', d => `translate(${cX},${candY(d.id)})`)
    .style('cursor', 'help')
    .on('mousemove', (event, d) => showTip(`<strong>${d.g === 'F' ? 'Candidata' : 'Candidato'} anônima/o</strong><br>
      ${d.leg} · ${d.uf}<br>${CARGO_LABEL[d.cargo] || d.cargo} · ${fmtNum(d.v)} votos<br>
      ${fmtMoney(d.exp)} de despesa contratada<br>
      <span class="tip-muted">${d.low ? 'baixa votação (< 20 votos)' : 'não é caso de baixa votação'} · sem nome no painel</span>`, event))
    .on('mouseleave', hideTip);
  cg.append('circle')
    .attr('r', rCand)
    .attr('fill', d => G_COLOR[d.g] || C.faint)
    .attr('fill-opacity', .78)
    .attr('stroke', d => d.low ? C.accent : C.card)
    .attr('stroke-width', d => d.low ? 1.8 : .8);

  // fornecedores (quadrados)
  const sg = g.selectAll('g.hub').data(supNodes).join('g')
    .attr('class', 'hub')
    .attr('transform', d => `translate(${sX},${supY(d.key)})`)
    .style('cursor', 'help')
    .on('mousemove', (event, d) => showTip(`<strong>Fornecedor-hub · ${d.cat}</strong><br>
      ${short(d.cnae || 'CNAE não informado', 64)}<br>
      ${d.p} · ${d.nc} candidaturas · ${fmtMoney(d.v)}<br>
      <span class="tip-muted">${d.hubLow} candidata(s) com < 20 votos e > 15% da despesa · máx. ${fmtPct(d.maxShare)}</span>`, event))
    .on('mouseleave', hideTip);
  sg.append('rect')
    .attr('x', d => -rSup(d)).attr('y', d => -rSup(d))
    .attr('width', d => 2 * rSup(d)).attr('height', d => 2 * rSup(d)).attr('rx', 1.5)
    .attr('fill', d => CAT_COLOR[d.cat] || C.faint).attr('opacity', .9)
    .attr('stroke', C.card).attr('stroke-width', 1.3);
  sg.append('text').attr('x', d => rSup(d) + 7).attr('y', 3.5)
    .attr('font-size', 8.2).attr('fill', C.ink).attr('font-weight', 600)
    .text(d => `${d.cat} · ${d.hubLow} baixa${d.hubLow > 1 ? 's' : ''}`);

  // cabeçalhos e legenda
  svg.append('text').attr('x', m.left + cX).attr('y', 18).attr('text-anchor', 'middle')
    .attr('font-size', 9).attr('letter-spacing', '.08em').attr('fill', C.muted).text('CANDIDATURAS ANÔNIMAS');
  svg.append('text').attr('x', m.left + sX).attr('y', 18).attr('text-anchor', 'middle')
    .attr('font-size', 9).attr('letter-spacing', '.08em').attr('fill', C.muted).text('FORNECEDORES-HUB');

  let lx = m.left + 2;
  const legend = [
    { kind: 'circle', color: C.women, label: 'mulheres' },
    { kind: 'circle', color: C.men, label: 'homens' },
    { kind: 'ring', color: C.accent, label: '< 20 votos' },
    { kind: 'square', color: C.faint, label: 'fornecedor-hub' }
  ];
  for (const item of legend) {
    if (item.kind === 'circle') svg.append('circle').attr('cx', lx + 4).attr('cy', height - 25).attr('r', 4).attr('fill', item.color);
    if (item.kind === 'ring') svg.append('circle').attr('cx', lx + 4).attr('cy', height - 25).attr('r', 4.5).attr('fill', 'none').attr('stroke', item.color).attr('stroke-width', 1.8);
    if (item.kind === 'square') svg.append('rect').attr('x', lx).attr('y', height - 29).attr('width', 8).attr('height', 8).attr('fill', item.color).attr('opacity', .7);
    svg.append('text').attr('x', lx + 13).attr('y', height - 21).attr('font-size', 8.5).attr('fill', C.muted).text(item.label);
    lx += item.label.length * 4.7 + 27;
  }
  svg.append('text').attr('x', width - 12).attr('y', height - 8).attr('text-anchor', 'end')
    .attr('font-size', 8.4).attr('fill', C.faint)
    .text(`${candNodes.length} candidaturas · ${supNodes.length} hubs (até 2 por partido) · aresta = despesa contratada`);
  svg.append('text').attr('x', 12).attr('y', height - 8)
    .attr('font-size', 8.4).attr('fill', C.faint)
    .text('despesa contratada como proxy da despesa pública · não é, por si só, indício de fraude');
}
