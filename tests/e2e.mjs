import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};

const rootDir = process.env.E2E_ROOT ? path.resolve(process.env.E2E_ROOT) : null;
const cwd = process.cwd();

function resolveRequestPath(urlPath) {
  if (rootDir) return path.join(rootDir, urlPath);
  if (urlPath.startsWith('/dist/')) return path.join(cwd, urlPath);
  if (urlPath.startsWith('/data/') && !urlPath.startsWith('/data/raw/')) return path.join(cwd, urlPath);
  return path.join(cwd, 'public', urlPath);
}

const server = http.createServer((req, res) => {
  const cleanUrl = req.url.split('?')[0];
  const urlPath = cleanUrl === '/' ? '/index.html' : cleanUrl;
  const filePath = resolveRequestPath(urlPath);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 820 });

const errors = [];
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`CONSOLE_ERROR: ${m.text()}`);
});

await page.goto(`http://127.0.0.1:${port}/?steps=full`, { waitUntil: 'networkidle0' });
await page.waitForSelector('#canvas-h1 svg');
await page.evaluate(() => document.fonts.ready);

// 0. Shell Nova Capa, Paleta Editorial, Plenário 100 Cadeiras & Modal de Metodologia
const shellCheck = await page.evaluate(() => {
  const bodyS = getComputedStyle(document.body);
  const h1S = getComputedStyle(document.querySelector('h1'));
  const h1SpanS = getComputedStyle(document.querySelector('h1 .hero-hl-30'));
  const skip = document.querySelector('a.skip-link');
  const topBar = document.querySelector('.top-editorial-bar').getBoundingClientRect();
  const navActLinks = [...document.querySelectorAll('.act-pills a')].map((a) => a.getAttribute('href'));
  const seatsCount = document.querySelectorAll('#hemicycle-seats circle.hemicycle-seat').length;
  const filledInit = document.querySelectorAll('#hemicycle-seats circle.hemicycle-seat.is-filled').length;
  const plenarioTabs = document.querySelectorAll('.plenario-tabs [role="tab"]').length;
  const stepDotsGroups = document.querySelectorAll('.step-dots').length;
  const covRows = document.querySelectorAll('#coverage-tbody tr').length;
  const readouts = [...document.querySelectorAll('.readout-box strong')].map((el) => el.textContent.trim());
  const heroVals = ['plenario-pct-0', 'plenario-pct-1', 'plenario-pct-2'].map((id) => document.getElementById(id)?.textContent?.trim() || '');
  return {
    bodyBg: bodyS.backgroundColor,
    h1Color: h1S.color,
    h1SpanColor: h1SpanS.color,
    h1Font: h1S.fontFamily,
    heroBodyFont: getComputedStyle(document.querySelector('.hero-lead')).fontFamily,
    bodyFont: bodyS.fontFamily,
    skipHref: skip?.getAttribute('href'),
    skipIsFirst: document.body.firstElementChild === skip,
    topBarH: topBar.height,
    navActLinks,
    seatsCount,
    filledInit,
    plenarioTabs,
    scopeItems: document.querySelectorAll('.hero-scope-item').length,
    noRoadmap: document.querySelectorAll('.roadmap').length === 0,
    noSilhouettes: document.querySelectorAll('.hero-silhouettes-bg').length === 0,
    stepDotsGroups,
    covRows,
    readouts,
    heroVals,
    dataStatus: document.getElementById('data-status-label')?.textContent?.trim(),
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
  };
});

if (
  shellCheck.bodyBg !== 'rgb(251, 248, 241)'
  || shellCheck.h1Color !== 'rgb(251, 248, 241)'
  || shellCheck.h1SpanColor !== 'rgb(248, 223, 79)'
  || !shellCheck.h1Font.includes('Fraunces')
  || !shellCheck.heroBodyFont.includes('Inter')
  || !shellCheck.bodyFont.includes('Inter')
  || shellCheck.skipHref !== '#main-content'
  || !shellCheck.skipIsFirst
  || shellCheck.topBarH > 72
  || shellCheck.navActLinks.join(',') !== '#ato-01,#ato-02,#ato-03,#ato-04,#ato-05'
  || shellCheck.seatsCount !== 100
  || shellCheck.filledInit !== 34
  || shellCheck.plenarioTabs !== 3
  || shellCheck.scopeItems !== 3
  || !shellCheck.noRoadmap
  || !shellCheck.noSilhouettes
  || shellCheck.stepDotsGroups !== 9
  || shellCheck.covRows !== 3
  || shellCheck.readouts.some((v) => !v.endsWith('%'))
  || shellCheck.heroVals.some((v) => !v.endsWith('%'))
  || shellCheck.dataStatus !== 'Fonte: TSE'
  || shellCheck.overflowX
) {
  throw new Error(`Shell/UX check falhou: ${JSON.stringify(shellCheck)}`);
}

// 0b. Interatividade do Plenário (3 etapas + pausa manual + badge de queda) e Modal de Metodologia
await page.click('#plenario-tab-2');
const plenarioStage2 = await page.evaluate(() => ({
  kpi: document.getElementById('hemicycle-kpi-val')?.textContent?.trim(),
  filled: document.querySelectorAll('#hemicycle-seats circle.hemicycle-seat.is-filled').length,
  dropVisible: document.getElementById('plenario-drop-badge')?.classList.contains('is-visible'),
  dropText: document.getElementById('plenario-drop-badge')?.textContent?.trim(),
  playing: document.getElementById('plenario-play-btn')?.getAttribute('aria-pressed'),
}));
if (
  plenarioStage2.kpi !== '17,9%'
  || plenarioStage2.filled !== 18
  || !plenarioStage2.dropVisible
  || !plenarioStage2.dropText?.includes('16,3')
  || plenarioStage2.playing !== 'false'
) {
  throw new Error(`Plenário etapa 3 inválida: ${JSON.stringify(plenarioStage2)}`);
}
await page.click('#plenario-play-btn');
const resumedPlaying = await page.$eval('#plenario-play-btn', (el) => el.getAttribute('aria-pressed'));
if (resumedPlaying !== 'true') throw new Error('Botão Play deveria retomar ciclo automático');
await page.click('#plenario-tab-0');

const hemicycleCollisionCount = await page.evaluate(() => {
  const svg = document.getElementById('hemicycle-svg').getBoundingClientRect();
  const seats = [...document.querySelectorAll('#hemicycle-seats circle')].map((c) => ({
    cx: Number(c.getAttribute('cx')),
    cy: Number(c.getAttribute('cy')),
    r: c.getBoundingClientRect(),
  }));
  const texts = [...document.querySelectorAll('#hemicycle-svg text')].map((t) => t.getBoundingClientRect());
  let hits = 0;
  for (const t of texts) {
    if (t.left < svg.left - 1 || t.right > svg.right + 1 || t.top < svg.top - 1 || t.bottom > svg.bottom + 1) hits += 1;
    for (const s of seats) {
      if (t.left < s.r.right && t.right > s.r.left && t.top < s.r.bottom && t.bottom > s.r.top) {
        hits += 1;
        break;
      }
    }
  }
  const line = document.querySelector('#hemicycle-threshold line');
  const lx1 = Number(line.getAttribute('x1'));
  const ly1 = Number(line.getAttribute('y1'));
  const lx2 = Number(line.getAttribute('x2'));
  const ly2 = Number(line.getAttribute('y2'));
  const lLen = Math.hypot(lx2 - lx1, ly2 - ly1);
  for (const s of seats) {
    const tProj = ((s.cx - lx1) * (lx2 - lx1) + (s.cy - ly1) * (ly2 - ly1)) / (lLen * lLen);
    const px = lx1 + Math.max(0, Math.min(1, tProj)) * (lx2 - lx1);
    const py = ly1 + Math.max(0, Math.min(1, tProj)) * (ly2 - ly1);
    if (Math.hypot(s.cx - px, s.cy - py) < 7.0) hits += 1;
  }
  const pill = document.querySelector('#hemicycle-threshold rect');
  const pillCenterX = Number(pill.getAttribute('x')) + Number(pill.getAttribute('width')) / 2;
  const pillBottomY = Number(pill.getAttribute('y')) + Number(pill.getAttribute('height'));
  if (Math.abs(pillCenterX - lx2) > 1 || Math.abs(pillBottomY - ly2) > 1) hits += 1;
  return hits;
});
if (hemicycleCollisionCount !== 0) throw new Error(`Hemiciclo com ${hemicycleCollisionCount} colisões/clippings de texto`);

await page.click('#btn-fonte-tse');
const modalOpened1 = await page.$eval('#methodology-modal', (el) => el.open);
if (!modalOpened1) throw new Error('Botão Fonte: TSE deveria abrir o modal de metodologia');
await page.keyboard.press('Escape');
const modalClosedEsc = await page.$eval('#methodology-modal', (el) => !el.open);
if (!modalClosedEsc) throw new Error('Escape deveria fechar o modal de metodologia');

// Helper de hover unificado
async function assertUnifiedHover(targetSelector, containerSelector, wrapIndex = 0) {
  const forbiddenCount = await page.$$eval(
    `${containerSelector} svg title, ${containerSelector} svg g[aria-label="tip"]`,
    (els) => els.length,
  );
  if (forbiddenCount !== 0) {
    throw new Error(`Encontrados ${forbiddenCount} tooltips nativos em ${containerSelector}`);
  }
  await page.$eval(targetSelector, (el) => el.scrollIntoView({ behavior: 'instant', block: 'center' }));
  await page.hover(targetSelector);
  const tipInfo = await page.evaluate((cSel, idx) => {
    const wraps = document.querySelectorAll(`${cSel} .chart-wrap`);
    const wrap = wraps[idx];
    const tip = wrap?.querySelector('.chart-tooltip');
    if (!wrap || !tip) return { ok: false, reason: 'Tooltip/wrap ausente' };
    const wr = wrap.getBoundingClientRect();
    const tr = tip.getBoundingClientRect();
    const hasHead = Boolean(tip.querySelector('.chart-tip-head'));
    const hasTable = Boolean(tip.querySelector('.chart-tip-table'));
    return {
      ok: !tip.hidden && hasHead && hasTable && tip.textContent.trim().length > 0,
      insideX: tr.left >= wr.left - 4 && tr.right <= wr.right + 4,
      insideY: tr.top >= wr.top - 4 && tr.bottom <= wr.bottom + 4,
    };
  }, containerSelector, wrapIndex);
  if (!tipInfo.ok || !tipInfo.insideX || !tipInfo.insideY) {
    throw new Error(`Hover padronizado falhou em ${targetSelector}: ${JSON.stringify(tipInfo)}`);
  }
}

async function checkSvgGeometry(svgSelector, { textSelector = 'text', checkBounds = true } = {}) {
  return page.evaluate((sSel, tSel, doBounds) => {
    const svgs = [...document.querySelectorAll(sSel)];
    if (svgs.length === 0) return { missing: true, overlaps: [], clipped: [] };
    const overlaps = [];
    const clipped = [];
    for (const svg of svgs) {
      const sr = svg.getBoundingClientRect();
      const labels = [...svg.querySelectorAll(tSel)].map((el) => {
        const b = el.getBoundingClientRect();
        return { t: el.textContent.trim(), l: b.left, r: b.right, top: b.top, bot: b.bottom };
      }).filter((b) => b.t.length > 0 && b.r > b.l);
      for (let i = 0; i < labels.length; i += 1) {
        const a = labels[i];
        if (doBounds && (a.l < sr.left - 4 || a.r > sr.right + 4 || a.top < sr.top - 4 || a.bot > sr.bottom + 4)) {
          clipped.push(a.t);
        }
        for (let j = i + 1; j < labels.length; j += 1) {
          const b = labels[j];
          if (a.l < b.r && a.r > b.l && a.top < b.bot && a.bot > b.top) {
            overlaps.push([a.t, b.t]);
          }
        }
      }
    }
    return { missing: false, overlaps, clipped };
  }, svgSelector, textSelector, checkBounds);
}

// 1. Verifica todos os gráficos renderizados (9 blocos: H1..H6, H8/Gráfico 7, Limiar/Gráfico 8, Ato 5; H7 removido)
if (await page.$('#sec-h7')) {
  throw new Error('H7 deveria ter sido removido do DOM');
}
for (const cid of ['#canvas-h1', '#canvas-h2', '#canvas-h3', '#canvas-h4', '#canvas-h5', '#canvas-h6', '#canvas-h8', '#canvas-limiar', '#canvas-h9-map']) {
  const hasSvg = await page.$(`${cid} svg`);
  if (!hasSvg) throw new Error(`SVG ausente em ${cid}`);
}

// 2. H1: Inicia em Todas Registradas, zero textos internos (direct-annotation), 2022 sempre em ardósia (#4B636E) no Passo 2, alternância para Aptas + filtro coordenado e chip de recorte
const h1Dots = await page.$$('#sec-h1 .step-dot');
await h1Dots[1].click(); // Passo 2: apenas 2022
const h1Step2Check = await page.evaluate(() => ({
  bar22Fill: document.querySelector('#canvas-h1 .h1-col[data-bin="30-33"] .bar-2022')?.getAttribute('fill'),
  legendHidden: document.getElementById('legend-h1')?.classList.contains('is-hidden'),
}));
if (h1Step2Check.bar22Fill?.toUpperCase() !== '#4B636E' || !h1Step2Check.legendHidden) {
  throw new Error(`H1 Passo 2 inválido (esperado #4B636E e legenda oculta): ${JSON.stringify(h1Step2Check)}`);
}
await h1Dots[3].click(); // Restaura Passo 4
const h1InitialMode = await page.$eval('#controls-h1 button.active', (el) => el.dataset.h1Mode);
if (h1InitialMode !== 'reg') throw new Error(`H1 deveria iniciar em 'reg', obteve ${h1InitialMode}`);
const h1DirectNotes = await page.$$eval('#canvas-h1 svg .direct-annotation', (els) => els.length);
if (h1DirectNotes !== 0) throw new Error(`H1 não deveria ter textos internos (.direct-annotation), obteve ${h1DirectNotes}`);
const h1LegendHiddenInFull = await page.$eval('#legend-h1', (el) => el.classList.contains('is-hidden'));
if (h1LegendHiddenInFull) throw new Error('Legenda de H1 deveria estar visível no Passo 4 (?steps=full)');
await assertUnifiedHover('#canvas-h1 .h1-col[data-bin="30-33"] .h1-col-hit', '#canvas-h1', 0);
const h1SvgBefore = await page.evaluate(() => {
  window.__h1SvgRef = document.querySelector('#canvas-h1 svg.h1-vertical-svg');
  return Boolean(window.__h1SvgRef);
});
await page.click('#controls-h1 button[data-h1-mode="apto"]');
const h1SvgPreserved = await page.evaluate(() => window.__h1SvgRef === document.querySelector('#canvas-h1 svg.h1-vertical-svg'));
if (!h1SvgBefore || !h1SvgPreserved) throw new Error('H1 deveria preservar o mesmo <svg> ao transitar Registradas -> Aptas');
await page.click('#controls-h1 button[data-h1-mode="reg"]');
await page.click('#canvas-h1 .h1-col[data-bin="lt24"]');
await page.waitForFunction(() => !document.getElementById('btn-recorte-chip').hidden);
await page.click('#btn-recorte-chip');
await page.waitForFunction(() => document.getElementById('btn-recorte-chip').hidden);

// 3. H2 (4 passos): Passo 4 (composição 2022 vs 2026 em 2 cores e sem rótulos dentro das barras), Passo 3 (composição 2022 apenas) e Passo 2 (dumbbell limpo sem pontilhados/anotações)
const h2Comp4 = await page.evaluate(() => ({
  rows: document.querySelectorAll('#canvas-h2 .h2-row').length,
  y22: document.querySelectorAll('#canvas-h2 .h2b-yr-2022').length,
  y26: document.querySelectorAll('#canvas-h2 .h2b-yr-2026').length,
  legendItems: document.querySelectorAll('#legend-h2 .legend-item').length,
  barColors: [...new Set([...document.querySelectorAll('#canvas-h2 .h2b-src-bar rect')].map((el) => el.getAttribute('fill')?.toUpperCase()))],
  innerBarLabels: [...document.querySelectorAll('#canvas-h2 .h2b-src-bar text')].filter((el) => !el.classList.contains('h2b-year-tag')).length,
}));
if (
  h2Comp4.rows !== 0
  || h2Comp4.y22 !== 2
  || h2Comp4.y26 !== 2
  || h2Comp4.legendItems !== 2
  || h2Comp4.barColors.length !== 2
  || !h2Comp4.barColors.includes('#007D5B')
  || !h2Comp4.barColors.includes('#F8DF4F')
  || h2Comp4.innerBarLabels !== 0
) {
  throw new Error(`H2 Passo 4 deveria exibir apenas composição 2022+2026 com 2 cores e sem rótulos internos, obteve ${JSON.stringify(h2Comp4)}`);
}
await assertUnifiedHover('#canvas-h2 .h2b-src-bar', '#canvas-h2', 0);

const h2Dots = await page.$$('#sec-h2 .step-dot');
await h2Dots[2].click(); // Passo 3: apenas 2022
const h2Comp3 = await page.evaluate(() => ({
  rows: document.querySelectorAll('#canvas-h2 .h2-row').length,
  y22: document.querySelectorAll('#canvas-h2 .h2b-yr-2022').length,
  y26: document.querySelectorAll('#canvas-h2 .h2b-yr-2026').length,
}));
if (h2Comp3.rows !== 0 || h2Comp3.y22 !== 2 || h2Comp3.y26 !== 0) {
  throw new Error(`H2 Passo 3 deveria exibir apenas composição 2022, obteve ${JSON.stringify(h2Comp3)}`);
}

await h2Dots[0].click(); // Passo 1: Baseline 2022 sem legenda/título de 2026
const h2Step1Ui = await page.evaluate(() => ({
  recorte: document.getElementById('recorte-h2-label')?.textContent?.trim() || '',
  legendItems: document.querySelectorAll('#legend-h2 .legend-item').length,
}));
if (!h2Step1Ui.recorte.includes('Baseline 2022') || h2Step1Ui.legendItems !== 1) {
  throw new Error(`H2 Passo 1 deveria exibir recorte Baseline 2022 e legenda apenas 2022: ${JSON.stringify(h2Step1Ui)}`);
}

await h2Dots[1].click(); // Passo 2: Dumbbell
const h2RowsCount = await page.$$eval('#canvas-h2 .h2-row', (els) => els.length);
if (h2RowsCount < 8) throw new Error(`H2 deveria ter ≥8 partidos, obteve ${h2RowsCount}`);
const h2Extras = await page.evaluate(() => ({
  annotations: document.querySelectorAll('#canvas-h2 svg .direct-annotation').length,
  dashed: document.querySelectorAll('#canvas-h2 svg [stroke-dasharray]').length,
  ticks: [...document.querySelectorAll('#canvas-h2 .h2-x-axis .tick text')].map((el) => el.textContent.trim()),
}));
if (h2Extras.annotations !== 0 || h2Extras.dashed !== 0 || h2Extras.ticks.includes('0,0×')) {
  throw new Error(`H2 deveria estar sem textos internos, sem pontilhados e com zoom ajustado: ${JSON.stringify(h2Extras)}`);
}
await assertUnifiedHover('#canvas-h2 .h2-row', '#canvas-h2', 0);
const h2Geo = await checkSvgGeometry('#canvas-h2 svg', { checkBounds: true });
if (h2Geo.overlaps.length > 0 || h2Geo.clipped.length > 0) {
  throw new Error(`H2 textos sobrepostos ou cortados: ${JSON.stringify(h2Geo)}`);
}
await page.click('#canvas-h2 .h2-row[data-party="PT"]');
if ((await page.$eval('#filter-party', (el) => el.value)) !== 'PT') {
  throw new Error('Clique em PT em H2 não atualizou #filter-party');
}
await page.click('#canvas-h2 .h2-row[data-party="PT"]');
await h2Dots[3].click(); // Restaura Passo 4 para checagem mobile

// 4. H3: Escala 1:1 (15%–65%), selo Cota mínima (30%), quadrantes novos, máx. 5 piores rotulados + transição fluida Geral -> Federal
if (await page.$('#zoom-h3-group')) {
  throw new Error('H3 não deveria mais exibir controle de zoom');
}
const h3InitCheck = await page.evaluate(() => ({
  recorte: document.getElementById('recorte-h3-label')?.textContent?.trim(),
  annotations: document.querySelectorAll('#canvas-h3 svg .direct-annotation').length,
  worstLabels: document.querySelectorAll('#canvas-h3 svg g[aria-label="text"] text[data-worst5="1"]').length,
  allText: document.querySelector('#canvas-h3 svg')?.textContent || '',
  legendText: document.getElementById('legend-h3')?.textContent || '',
  hasSvgRef: Boolean(window.__h3SvgRef = document.querySelector('#canvas-h3 svg.h3-scatter-svg')),
}));
if (
  !h3InitCheck.recorte?.includes('Deputado Federal')
  || h3InitCheck.annotations !== 0
  || h3InitCheck.worstLabels > 5
  || !h3InitCheck.allText.includes('Cota mínima (30%)')
  || !h3InitCheck.allText.includes('↑ Repasse proporcional (ou acima)')
  || !h3InitCheck.allText.includes('↓ Repasse menor que o peso na chapa')
  || !h3InitCheck.legendText.includes('Tamanho da bola')
) {
  throw new Error(`H3 configuração inválida: ${JSON.stringify(h3InitCheck)}`);
}
const h3Dots = await page.$$('#sec-h3 .step-dot');
await h3Dots[1].click(); // Passo 2 (Geral)
const h3Step2Check = await page.evaluate(() => ({
  recorte: document.getElementById('recorte-h3-label')?.textContent?.trim(),
  sameSvg: window.__h3SvgRef === document.querySelector('#canvas-h3 svg.h3-scatter-svg'),
}));
if (!h3Step2Check.recorte?.includes('Federal + Estadual') || !h3Step2Check.sameSvg) {
  throw new Error(`H3 transição Passo 3->2 falhou: ${JSON.stringify(h3Step2Check)}`);
}
await h3Dots[2].click(); // Volta ao Passo 3 (Federal)
await assertUnifiedHover('#canvas-h3 .party-bubble', '#canvas-h3', 0);
const h3Geo = await checkSvgGeometry('#canvas-h3 svg', { textSelector: 'g[aria-label="text"] text', checkBounds: true });
if (h3Geo.overlaps.length > 0 || h3Geo.clipped.length > 0) {
  throw new Error(`H3 rótulos colidiram ou saíram do SVG: ${JSON.stringify(h3Geo)}`);
}

// 5. H4 (Sankey 3 colunas com corte 1.000 votos, apenas APTO, hover em todos os nós/fluxos incl. Campanha Direta) + H5 + H6 + Limiar + H7/H8
if (await page.$('#cohort-h4-group')) {
  throw new Error('H4 não deveria mais exibir seletor Todas vs Sem Top 10%');
}
const h4Check = await page.evaluate(() => ({
  nodes: document.querySelectorAll('#canvas-h4 .h4-node').length,
  links01: document.querySelectorAll('#canvas-h4 .h4-link-01').length,
  links12: document.querySelectorAll('#canvas-h4 .h4-link-12').length,
  hubs: document.querySelectorAll('#canvas-h4 .h4-hub').length,
}));
if (h4Check.nodes !== 10 || h4Check.links01 !== 8 || h4Check.links12 < 12 || h4Check.hubs !== 0) {
  throw new Error(`H4 Sankey 1000v inválido: ${JSON.stringify(h4Check)}`);
}
await assertUnifiedHover('#canvas-h4 .h4-link-12[data-source="f_gt"][data-target="direct"]', '#canvas-h4', 0);
await assertUnifiedHover('#canvas-h4 .h4-link-12[data-source="m_gt"][data-target="direct"]', '#canvas-h4', 0);
await assertUnifiedHover('#canvas-h4 .h4-node[data-node-id="party"]', '#canvas-h4', 0);
const h4Geo = await checkSvgGeometry('#canvas-h4 svg', { checkBounds: true });
if (h4Geo.overlaps.length > 0 || h4Geo.clipped.length > 0) {
  throw new Error(`H4 textos sobrepostos ou cortados: ${JSON.stringify(h4Geo)}`);
}
if (await page.$('#view-h5-group')) {
  throw new Error('H5 não deveria mais exibir controle de Slopegraph');
}
const h5Annotations = await page.$$eval('#canvas-h5 svg .direct-annotation', (els) => els.length);
if (h5Annotations !== 0) {
  throw new Error(`H5 não deveria ter textos internos (.direct-annotation), obteve ${h5Annotations}`);
}
await assertUnifiedHover('#canvas-h5 .h5-party-row', '#canvas-h5', 0);

// H6: 3 sinais (sem >=2 combinados), APTO explícito, 4 passos 2018(F)->2022(F)->2026(F)->2026(F+M) no mesmo SVG
const h6Init = await page.evaluate(() => ({
  groups: document.querySelectorAll('#canvas-h6 .h6-signal-group').length,
  hasTwoPlus: Boolean(document.querySelector('#canvas-h6 .h6-signal-group[data-signal="twoPlus"]')),
  svgText: document.querySelector('#canvas-h6 svg')?.textContent || '',
  menOp: Number(document.querySelector('#canvas-h6 .h6-dot-M')?.getAttribute('opacity') || 0),
  annotations: document.querySelectorAll('#canvas-h6 svg .direct-annotation').length,
  hasSvgRef: Boolean(window.__h6SvgRef = document.querySelector('#canvas-h6 svg.h6-series-svg')),
}));
if (
  h6Init.groups !== 3
  || h6Init.hasTwoPlus
  || h6Init.svgText.includes('≥ 2')
  || !h6Init.svgText.includes('2026')
  || !h6Init.svgText.includes('Lote ≥3')
  || h6Init.menOp !== 1
  || h6Init.annotations !== 0
) {
  throw new Error(`H6 Passo 4 inválido: ${JSON.stringify(h6Init)}`);
}
const h6Dots = await page.$$('#sec-h6 .step-dot');
for (const [stepIdx, yrStr] of [[0, '2018'], [1, '2022'], [2, '2026']]) {
  await h6Dots[stepIdx].click();
  const sCheck = await page.evaluate(() => ({
    menOp: Number(document.querySelector('#canvas-h6 .h6-dot-M')?.getAttribute('opacity') || 0),
    tag: document.querySelector('#canvas-h6 .h6-year-tag')?.textContent || '',
    sameSvg: window.__h6SvgRef === document.querySelector('#canvas-h6 svg.h6-series-svg'),
  }));
  if (sCheck.menOp !== 0 || !sCheck.tag.includes(yrStr) || !sCheck.sameSvg) {
    throw new Error(`H6 Passo ${stepIdx + 1} (${yrStr} somente mulheres) inválido: ${JSON.stringify(sCheck)}`);
  }
}
await h6Dots[3].click(); // Volta ao Passo 4 (2026 Mulheres + Homens)
await assertUnifiedHover('#canvas-h6 .h6-dot', '#canvas-h6', 0);
await page.click('[data-h6-year="2022"]');
await page.click('[data-h6-year="2026"]');

// Ato 3 deve conter H5 + Limiar (Gráfico 8 Slopegraph); Ato 4 deve conter H6 + H8 (Gráfico 7)
const actsOrderOk = await page.evaluate(() => {
  const ato3 = [...document.querySelectorAll('#ato-03 .scrolly-block')].map((el) => el.id).join(',');
  const ato4 = [...document.querySelectorAll('#ato-04 .scrolly-block')].map((el) => el.id).join(',');
  return { ato3, ato4 };
});
if (actsOrderOk.ato3 !== 'sec-h5,sec-limiar' || actsOrderOk.ato4 !== 'sec-h6,sec-h8') {
  throw new Error(`Ordem esperada: Ato 3 (sec-h5,sec-limiar) e Ato 4 (sec-h6,sec-h8), obteve ${JSON.stringify(actsOrderOk)}`);
}
const h8Annotations = await page.$$eval('#canvas-h8 svg .direct-annotation', (els) => els.length);
if (h8Annotations !== 0) throw new Error(`H8 não deveria ter textos internos, obteve ${h8Annotations}`);
const h8Dots = await page.$$('#sec-h8 .step-dot');
await h8Dots[0].click(); // Passo 1: apenas 2018 visível
const h8Step1 = await page.$eval('#canvas-h8 .yr-g[data-year="2026"] .h8-dot', (el) => ({
  op: Number(el.getAttribute('opacity')),
  tabindex: el.getAttribute('tabindex'),
}));
if (h8Step1.op !== 0 || h8Step1.tabindex !== '-1') {
  throw new Error(`H8 Passo 1 deveria ocultar 2026 e remover tabindex: ${JSON.stringify(h8Step1)}`);
}
await h8Dots[2].click(); // Volta ao Passo 3 (2018->2026 + curva combinada)
await assertUnifiedHover('#canvas-h8 .h8-dot', '#canvas-h8', 0);

const limiarDots = await page.$$('#sec-limiar .step-dot');
await limiarDots[0].click(); // Passo 1: 4 frames visíveis, mas apenas Mediana e Proporcionalidade com dados carregados
const slopeStep1 = await page.evaluate(() => ({
  totalFrames: document.querySelectorAll('#canvas-limiar .limiar-panel').length,
  loadedPanels: [...document.querySelectorAll('#canvas-limiar .limiar-panel[data-loaded="true"]')].map((el) => el.getAttribute('data-panel-id')),
  lines: document.querySelectorAll('#canvas-limiar .limiar-slope-line').length,
  dots: document.querySelectorAll('#canvas-limiar .limiar-slope-dot').length,
}));
if (slopeStep1.totalFrames !== 4 || slopeStep1.loadedPanels.join(',') !== 'mediana,proporcionalidade' || slopeStep1.lines !== 2 || slopeStep1.dots !== 4) {
  throw new Error(`Gráfico 8 Passo 1 deveria mostrar os 4 cards com dados apenas nos 2 primeiros: ${JSON.stringify(slopeStep1)}`);
}

await limiarDots[1].click(); // Passo 2: carrega Distribuição
const slopeStep2 = await page.evaluate(() => ({
  totalFrames: document.querySelectorAll('#canvas-limiar .limiar-panel').length,
  loadedPanels: [...document.querySelectorAll('#canvas-limiar .limiar-panel[data-loaded="true"]')].map((el) => el.getAttribute('data-panel-id')),
  lines: document.querySelectorAll('#canvas-limiar .limiar-slope-line').length,
  dots: document.querySelectorAll('#canvas-limiar .limiar-slope-dot').length,
}));
if (slopeStep2.totalFrames !== 4 || slopeStep2.loadedPanels.join(',') !== 'mediana,proporcionalidade,distribuicao' || slopeStep2.lines !== 3 || slopeStep2.dots !== 6) {
  throw new Error(`Gráfico 8 Passo 2 deveria carregar Distribuição apenas aqui: ${JSON.stringify(slopeStep2)}`);
}

await limiarDots[2].click(); // Passo 3: carrega Eleitas (todos os 4)
const slopeCheck = await page.evaluate(() => ({
  panels: document.querySelectorAll('#canvas-limiar .limiar-panel[data-loaded="true"]').length,
  lines: document.querySelectorAll('#canvas-limiar .limiar-slope-line').length,
  dots: document.querySelectorAll('#canvas-limiar .limiar-slope-dot').length,
}));
if (slopeCheck.panels !== 4 || slopeCheck.lines !== 4 || slopeCheck.dots !== 8) {
  throw new Error(`Gráfico 8 (Slopegraph) inválido: ${JSON.stringify(slopeCheck)}`);
}
await assertUnifiedHover('#canvas-limiar .limiar-panel', '#canvas-limiar', 0);
await page.click('[data-limiar-unit="party"]');
await page.click('[data-limiar-unit="chapa"]');

// 6. Ato 5 ("Onde a Cota Vira Voto"): 27 UFs reais, sem linhas pontilhadas/conectoras, empates na 5ª posição incluídos
const h9Check = await page.evaluate(() => ({
  ufPaths: document.querySelectorAll('#canvas-h9-map svg path.ato5-state-path').length,
  leaderLines: document.querySelectorAll('#canvas-h9-map svg .ato5-line-layer, #canvas-h9-map svg polyline').length,
  compactCallouts: document.querySelectorAll('#ato5-compact-callouts .ato5-callout-pill').length,
  stepsCount: document.querySelectorAll('#sec-h9 .step-card').length,
  navPills: document.querySelectorAll('#ato5-nav-pills .ato5-nav-pill').length,
  hasSynthesis: Boolean(document.querySelector('#sec-h9 .ato5-synthesis-box')),
  podiumCards: document.querySelectorAll('#sec-h9 .ato5-podium-card').length,
  step5PodiumUfs: [...document.querySelectorAll('#sec-h9 .step-card[data-step="4"] .ato5-podium-card')].map((el) => ({
    uf: el.getAttribute('data-podium-uf'),
    rank: el.querySelector('.ato5-podium-rank')?.textContent?.trim(),
  })),
  step3ConcentracaoClarified: /10%\s+candidatas mais financiadas/i.test(
    document.querySelector('#sec-h9 .step-card[data-step="2"]')?.textContent || '',
  ),
  missingLblTransforms: [...document.querySelectorAll('#canvas-h9-map .ato5-label-layer g')]
    .filter((g) => !/^translate\(/.test(g.getAttribute('transform') || ''))
    .length,
}));
const step5RankMap = Object.fromEntries(h9Check.step5PodiumUfs.map((x) => [x.uf, x.rank]));
if (
  h9Check.ufPaths !== 27
  || h9Check.leaderLines !== 0
  || h9Check.compactCallouts !== 8
  || h9Check.stepsCount !== 5
  || h9Check.navPills !== 5
  || !h9Check.hasSynthesis
  || h9Check.podiumCards < 25
  || step5RankMap.RO !== '#5'
  || step5RankMap.SE !== '#5'
  || !h9Check.step3ConcentracaoClarified
  || h9Check.missingLblTransforms !== 0
) {
  throw new Error(`Ato 5 incompleto: ${JSON.stringify(h9Check)}`);
}
await assertUnifiedHover('#canvas-h9-map svg path.ato5-state-path[data-uf="SP"]', '#canvas-h9-map', 0);
await page.hover('#sec-h9 .step-card[data-step="4"] .ato5-podium-card[data-podium-uf="AP"]');
const h9PodiumHover = await page.evaluate(() => {
  const ap = document.querySelector('#canvas-h9-map path.ato5-state-path[data-uf="AP"]');
  const rj = document.querySelector('#canvas-h9-map path.ato5-state-path[data-uf="RJ"]');
  return {
    apOp: getComputedStyle(ap).fillOpacity,
    apStroke: ap.getAttribute('stroke'),
    apStrokeW: ap.getAttribute('stroke-width'),
    rjOp: Number(getComputedStyle(rj).fillOpacity),
  };
});
if (h9PodiumHover.apOp !== '1' || h9PodiumHover.apStroke !== '#142620' || Number(h9PodiumHover.apStrokeW) < 2 || h9PodiumHover.rjOp >= 0.5) {
  throw new Error(`Hover em card Top 5 do Ato 5 não destacou estado no mapa: ${JSON.stringify(h9PodiumHover)}`);
}
await page.mouse.move(10, 10);
await page.click('#ato5-compact-callouts .ato5-callout-pill[data-uf="DF"]');
await page.waitForFunction(() => !document.getElementById('btn-map-reset-uf').hidden);
await page.click('#btn-map-reset-uf');
await page.waitForFunction(() => document.getElementById('btn-map-reset-uf').hidden);
await page.click('[data-ato5-year="2026"]');
await page.click('[data-ato5-cargo="6"]');
await page.click('[data-ato5-year="2022"]');
await page.click('[data-ato5-cargo="all"]');

// 7. Boca da Taça: troca para 2026 recalcula readouts e volta ao padrão
const cand22 = await page.$eval('#readout-cand', (el) => el.textContent);
await page.select('#filter-year', '2026');
await page.waitForFunction((prev) => document.getElementById('readout-cand').textContent !== prev, {}, cand22);
await page.click('#btn-reset-filters');
await page.waitForFunction((prev) => document.getElementById('readout-cand').textContent === prev, {}, cand22);

// 8. Breakpoints 1440px, 768px e Mobile 390x844 sem overflow horizontal e sem clipping nos gráficos
for (const vp of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }]) {
  await page.setViewport(vp);
  await new Promise((r) => setTimeout(r, 120));
  const vpOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (vpOverflow) throw new Error(`Overflow horizontal em ${vp.width}x${vp.height}`);
}
await page.setViewport({ width: 390, height: 844 });
await new Promise((r) => setTimeout(r, 250));
const mobileCheck = await page.evaluate(() => {
  const navClip = [...document.querySelectorAll('.top-bar-inner a, .top-bar-inner button')]
    .filter((el) => getComputedStyle(el).display !== 'none' && !el.hidden)
    .some((el) => el.getBoundingClientRect().right > window.innerWidth + 1);
  return {
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
    navClip,
    h5Count: document.querySelectorAll('#canvas-h5 .h5-party-label').length,
  };
});
const mobIssues = {};
for (const sel of ['#canvas-h1 svg', '#canvas-h2 svg', '#canvas-h3 svg', '#canvas-h4 svg', '#canvas-h6 svg', '#canvas-h8 svg', '#canvas-limiar svg', '#canvas-h9-map svg']) {
  const g = await checkSvgGeometry(sel, {
    textSelector: sel.includes('h3') ? 'g[aria-label="text"] text' : 'text',
    checkBounds: true,
  });
  if (g.missing || g.clipped.length > 0) mobIssues[sel] = g;
}
if (mobileCheck.overflowX || mobileCheck.navClip || mobileCheck.h5Count < 8 || Object.keys(mobIssues).length > 0) {
  throw new Error(`Falha layout mobile 390px: ${JSON.stringify({ mobileCheck, mobIssues })}`);
}

console.log('E2E OK:', { shellCheck, h2RowsCount, h9Check, mobileCheck, errors });
await browser.close();
server.close();
if (errors.length > 0) process.exit(1);
