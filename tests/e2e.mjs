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

// 0. Shell Martini Glass, Editorial Palette & Typography
const shellCheck = await page.evaluate(() => {
  const bodyS = getComputedStyle(document.body);
  const h1S = getComputedStyle(document.querySelector('h1'));
  const skip = document.querySelector('a.skip-link');
  const topBar = document.querySelector('.top-editorial-bar').getBoundingClientRect();
  const heroFunnelSvg = Boolean(document.querySelector('#hero-funnel-svg'));
  const roadmapLinks = document.querySelectorAll('.roadmap a').length;
  const stepDotsGroups = document.querySelectorAll('.step-dots').length;
  const covRows = document.querySelectorAll('#coverage-tbody tr').length;
  const readouts = [...document.querySelectorAll('.readout-box strong')].map((el) => el.textContent.trim());
  const heroVals = ['hero-val-cand', 'hero-val-verba', 'hero-val-eleitas'].map((id) => document.getElementById(id)?.textContent?.trim() || '');
  return {
    bodyBg: bodyS.backgroundColor,
    h1Color: h1S.color,
    h1Font: h1S.fontFamily,
    bodyFont: bodyS.fontFamily,
    skipHref: skip?.getAttribute('href'),
    skipIsFirst: document.body.firstElementChild === skip,
    topBarH: topBar.height,
    heroFunnelSvg,
    roadmapLinks,
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
    || shellCheck.h1Color !== 'rgb(248, 223, 79)'
    || !shellCheck.h1Font.includes('Newsreader')
    || !shellCheck.bodyFont.includes('Inter')
    || shellCheck.skipHref !== '#main-content'
    || !shellCheck.skipIsFirst
    || shellCheck.topBarH > 72
    || !shellCheck.heroFunnelSvg
    || shellCheck.roadmapLinks !== 5
    || shellCheck.stepDotsGroups !== 10
    || shellCheck.covRows !== 3
    || shellCheck.readouts.some((v) => !v.endsWith('%'))
    || shellCheck.heroVals.some((v) => !v.endsWith('%'))
    || !shellCheck.dataStatus?.includes('Dados TSE')
    || shellCheck.overflowX
  ) {
    throw new Error(`Shell/UX check falhou: ${JSON.stringify(shellCheck)}`);
  }

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

// 1. Verifica todos os gráficos renderizados (incluindo Ato 4 comparativo 30–33% vs >33% e Ato 5)
for (const cid of ['#canvas-h1', '#canvas-h2', '#canvas-h3', '#canvas-h4', '#canvas-h5', '#canvas-h6', '#canvas-limiar', '#canvas-h7', '#canvas-h8', '#canvas-h9-map']) {
  const hasSvg = await page.$(`${cid} svg`);
  if (!hasSvg) throw new Error(`SVG ausente em ${cid}`);
}

// 2. H1: Inicia em Todas Registradas, alternância para Aptas + filtro coordenado e chip de recorte
const h1InitialMode = await page.$eval('#controls-h1 button.active', (el) => el.dataset.h1Mode);
if (h1InitialMode !== 'reg') throw new Error(`H1 deveria iniciar em 'reg', obteve ${h1InitialMode}`);
await assertUnifiedHover('#canvas-h1 .h1-col[data-bin="30-33"] .h1-col-hit', '#canvas-h1', 0);
await page.click('#controls-h1 button[data-h1-mode="apto"]');
await page.click('#controls-h1 button[data-h1-mode="reg"]');
await page.click('#canvas-h1 .h1-col[data-bin="lt24"]');
await page.waitForFunction(() => !document.getElementById('btn-recorte-chip').hidden);
await page.click('#btn-recorte-chip');
await page.waitForFunction(() => document.getElementById('btn-recorte-chip').hidden);

// 3. H2: Dumbbell + clique em partido + barras de composição sem sobreposição
const h2RowsCount = await page.$$eval('#canvas-h2 .h2-row', (els) => els.length);
if (h2RowsCount < 8) throw new Error(`H2 deveria ter ≥8 partidos, obteve ${h2RowsCount}`);
await assertUnifiedHover('#canvas-h2 .h2-row', '#canvas-h2', 0);
const h2Geo = await checkSvgGeometry('#canvas-h2 svg', { checkBounds: true });
if (h2Geo.overlaps.length > 0) {
  throw new Error(`H2 textos sobrepostos: ${JSON.stringify(h2Geo.overlaps)}`);
}
await page.click('#canvas-h2 .h2-row[data-party="PT"]');
if ((await page.$eval('#filter-party', (el) => el.value)) !== 'PT') {
  throw new Error('Clique em PT em H2 não atualizou #filter-party');
}
await page.click('#canvas-h2 .h2-row[data-party="PT"]');

// 4. H3: Escala fixa sem zoom + Cargo + Hover + zero colisões nos rótulos
if (await page.$('#zoom-h3-group')) {
  throw new Error('H3 não deveria mais exibir controle de zoom');
}
await assertUnifiedHover('#canvas-h3 .party-bubble', '#canvas-h3', 0);
const h3Geo = await checkSvgGeometry('#canvas-h3 svg', { textSelector: 'g[aria-label="text"] text', checkBounds: true });
if (h3Geo.overlaps.length > 0 || h3Geo.clipped.length > 0) {
  throw new Error(`H3 rótulos colidiram ou saíram do SVG: ${JSON.stringify(h3Geo)}`);
}

// 5. H4 (Hubs em step 2) + H5 + H6 (Consolidado) + Comparativo 30–33% vs >33% + H7/H8 sinalizados
await assertUnifiedHover('#canvas-h4 .h4-hub', '#canvas-h4', 0);
await assertUnifiedHover('#canvas-h5 .h5-party-row', '#canvas-h5', 0);
await page.click('[data-h5-view="slope"]');
await page.click('[data-h5-view="bars"]');
await assertUnifiedHover('#canvas-h6 .h6-dot', '#canvas-h6', 0);
await page.click('[data-h6-year="2026"]');
await page.click('[data-h6-year="2022"]');
await assertUnifiedHover('#canvas-limiar .limiar-panel', '#canvas-limiar', 0);
await page.click('[data-limiar-unit="party"]');
await page.click('[data-limiar-unit="chapa"]');
await assertUnifiedHover('#canvas-h7 .h7-agg-dot', '#canvas-h7', 0);
await page.click('#btn-h7-2018');
await assertUnifiedHover('#canvas-h8 .h8-dot', '#canvas-h8', 0);

// 6. Ato 5 ("Onde a Cota Vira Voto"): 27 UFs reais, 8 callouts compactos, 5 passos, síntese e controles
const h9Check = await page.evaluate(() => ({
  ufPaths: document.querySelectorAll('#canvas-h9-map svg path.ato5-state-path').length,
  compactCallouts: document.querySelectorAll('#ato5-compact-callouts .ato5-callout-pill').length,
  stepsCount: document.querySelectorAll('#sec-h9 .step-card').length,
  navPills: document.querySelectorAll('#ato5-nav-pills .ato5-nav-pill').length,
  hasSynthesis: Boolean(document.querySelector('#sec-h9 .ato5-synthesis-box')),
  podiumCards: document.querySelectorAll('#sec-h9 .ato5-podium-card').length,
}));
if (
  h9Check.ufPaths !== 27
  || h9Check.compactCallouts !== 8
  || h9Check.stepsCount !== 5
  || h9Check.navPills !== 5
  || !h9Check.hasSynthesis
  || h9Check.podiumCards !== 25
) {
  throw new Error(`Ato 5 incompleto: ${JSON.stringify(h9Check)}`);
}
await assertUnifiedHover('#canvas-h9-map svg path.ato5-state-path[data-uf="SP"]', '#canvas-h9-map', 0);
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

// 8. Mobile 390x844 sem overflow horizontal e sem clipping nos gráficos
await page.setViewport({ width: 390, height: 844 });
await new Promise((r) => setTimeout(r, 250));
const mobileCheck = await page.evaluate(() => ({
  overflowX: document.documentElement.scrollWidth > window.innerWidth,
  h5Count: document.querySelectorAll('#canvas-h5 .h5-party-label').length,
}));
const mobIssues = {};
for (const sel of ['#canvas-h1 svg', '#canvas-h3 svg', '#canvas-h4 svg', '#canvas-h6 svg', '#canvas-limiar svg', '#canvas-h7 svg', '#canvas-h8 svg', '#canvas-h9-map svg']) {
  const g = await checkSvgGeometry(sel, {
    textSelector: sel.includes('h3') ? 'g[aria-label="text"] text' : 'text',
    checkBounds: true,
  });
  if (g.missing || g.clipped.length > 0) mobIssues[sel] = g;
}
if (mobileCheck.overflowX || mobileCheck.h5Count < 8 || Object.keys(mobIssues).length > 0) {
  throw new Error(`Falha layout mobile 390px: ${JSON.stringify({ mobileCheck, mobIssues })}`);
}

console.log('E2E OK:', { shellCheck, h2RowsCount, h9Check, mobileCheck, errors });
await browser.close();
server.close();
if (errors.length > 0) process.exit(1);
