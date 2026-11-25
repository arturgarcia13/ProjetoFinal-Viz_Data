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
  const urlPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
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

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle0' });
await page.waitForSelector('#canvas-h1 svg');
await page.evaluate(() => document.fonts.ready);

// 0. Brandbook, remoção do Panorama em Escala e barra superior enxuta
const shellCheck = await page.evaluate(() => {
  const bodyS = getComputedStyle(document.body);
  const h1S = getComputedStyle(document.querySelector('h1'));
  const skip = document.querySelector('a.skip-link');
  const filterRect = document.getElementById('filter-bar').getBoundingClientRect();
  const hasEscala = Boolean(document.getElementById('escala'));
  const hasMosaic = document.querySelectorAll('.mosaic-tile').length > 0;
  const heroCta = document.querySelector('.hero-actions a.btn-primary');
  const finalCta = document.querySelector('#cta-final a.btn-primary');
  const emCount = document.querySelectorAll('em').length;
  const bigCand = document.getElementById('big-stat-cand')?.textContent?.trim() || '';
  const bigPub = document.getElementById('big-stat-pub')?.textContent?.trim() || '';
  const bigSeats = document.getElementById('big-stat-seats')?.textContent?.trim() || '';
  return {
    bodyBg: bodyS.backgroundColor,
    h1Color: h1S.color,
    h1Font: h1S.fontFamily,
    bodyFont: bodyS.fontFamily,
    skipHref: skip?.getAttribute('href'),
    skipIsFirst: document.body.firstElementChild === skip,
    filterH: filterRect.height,
    hasEscala,
    hasMosaic,
    heroText: heroCta?.textContent?.trim(),
    heroHref: heroCta?.getAttribute('href'),
    finalText: finalCta?.textContent?.trim(),
    finalHref: finalCta?.getAttribute('href'),
    emCount,
    bigCand,
    bigPub,
    bigSeats,
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
  };
});

if (
  shellCheck.bodyBg !== 'rgb(0, 128, 90)'
  || shellCheck.h1Color !== 'rgb(252, 227, 77)'
  || !shellCheck.h1Font.includes('Anton')
  || !shellCheck.bodyFont.includes('Barlow')
  || shellCheck.skipHref !== '#main-content'
  || !shellCheck.skipIsFirst
  || shellCheck.filterH > 95
  || shellCheck.hasEscala
  || shellCheck.hasMosaic
  || shellCheck.heroText !== shellCheck.finalText
  || shellCheck.heroHref !== '#ato-1'
  || shellCheck.emCount !== 0
  || !shellCheck.bigCand.endsWith('%')
  || !shellCheck.bigPub.endsWith('%')
  || !shellCheck.bigSeats.endsWith('%')
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
    const hasHead = Boolean(tip.querySelector('.chart-tip-head, .h1-tip-head'));
    const hasTable = Boolean(tip.querySelector('.chart-tip-table, .h1-tip-table'));
    return {
      ok: !tip.hidden && hasHead && hasTable && tip.textContent.trim().length > 0,
      insideX: tr.left >= wr.left - 2 && tr.right <= wr.right + 2,
      insideY: tr.top >= wr.top - 2 && tr.bottom <= wr.bottom + 2,
    };
  }, containerSelector, wrapIndex);
  if (!tipInfo.ok || !tipInfo.insideX || !tipInfo.insideY) {
    throw new Error(`Hover padronizado falhou em ${targetSelector}: ${JSON.stringify(tipInfo)}`);
  }
}

// 1. Verifica todos os 10 canvases renderizados simultaneamente no fluxo vertical
const canvasIds = [
  '#canvas-h1', '#canvas-h2', '#canvas-h2b', '#canvas-h3', '#canvas-h4',
  '#canvas-h5', '#canvas-h6', '#canvas-h7', '#canvas-h8', '#canvas-h9-map',
];
for (const cid of canvasIds) {
  const hasSvg = await page.$(`${cid} svg`);
  if (!hasSvg) throw new Error(`SVG ausente em ${cid}`);
}
const hasH9Matrix = await page.$('#canvas-h9-matrix table.h9-matrix-table');
if (!hasH9Matrix) throw new Error('Matriz heatmap de H9 não renderizada');

// 2. H1: Texto >=40% corrigido, hover, gaveta <30%, visão coordenada H1 -> H2 e sincronia Registradas <-> Aptas
const h1Stat = await page.$eval('#stat-h1', (el) => el.textContent);
if (!h1Stat.includes('≥ 40%') || h1Stat.includes('22,1% > 40%')) {
  throw new Error(`Texto de H1 inválido: ${h1Stat}`);
}
await assertUnifiedHover('#canvas-h1 .h1-row[data-bin="30-33"] .h1-row-hit', '#canvas-h1', 0);
await page.click('#canvas-h1 .h1-row[data-bin="lt30"]');
await page.waitForFunction(() => document.getElementById('scope-summary').textContent.includes('H1 < 30%'));
const chipReg = await page.$eval('#active-chips', (el) => el.textContent);
await page.click('#controls-h1 button:nth-child(2)'); // Aptas
const chipApto = await page.$eval('#active-chips', (el) => el.textContent);
if (!chipReg.includes('22 partidos') || !chipApto.includes('24 partidos')) {
  throw new Error(`Sincronia H1 Registradas<->Aptas falhou: reg="${chipReg}" apto="${chipApto}"`);
}
await page.click('#controls-h1 button:nth-child(1)'); // volta Registradas
const h2AfterBin = await page.$$eval('#canvas-h2 .h2-row', (els) => els.length);
if (h2AfterBin < 1) throw new Error('Filtro coordenado H1 <30% zerou H2');
// Clicar novamente na mesma barra desmarca a visão coordenada
await page.click('#canvas-h1 .h1-row[data-bin="lt30"]');
await page.waitForFunction(() => !document.getElementById('scope-summary').textContent.includes('H1 < 30%'));

// 3. H2: Evolução 2022 -> 2026 + Bug de clique corrigido (destaca sem colapsar e desmarca no ponto ou no fundo)
const h2CountBefore = await page.$$eval('#canvas-h2 .h2-row', (els) => els.length);
if (h2CountBefore < 10) throw new Error(`H2 deveria ter ≥10 partidos, obteve ${h2CountBefore}`);
await assertUnifiedHover('#canvas-h2 .h2-row', '#canvas-h2', 0);
await page.click('#canvas-h2 .h2-row[data-party="PT"]');
const h2AfterClick = await page.evaluate(() => ({
  count: document.querySelectorAll('#canvas-h2 .h2-row').length,
  partyFilter: document.getElementById('filter-party').value,
}));
if (h2AfterClick.count !== h2CountBefore || h2AfterClick.partyFilter !== 'PT') {
  throw new Error(`H2 colapsou ou não selecionou PT: ${JSON.stringify(h2AfterClick)}`);
}
// Clicar novamente no mesmo ponto remove a seleção
await page.click('#canvas-h2 .h2-row[data-party="PT"]');
const partyAfterSecondClick = await page.$eval('#filter-party', (el) => el.value);
if (partyAfterSecondClick !== '') {
  throw new Error(`Segundo clique em H2 não removeu seleção: ${partyAfterSecondClick}`);
}
// Seleciona de novo e clica no fundo vazio do SVG para limpar
await page.click('#canvas-h2 .h2-row[data-party="PL"]');
await page.mouse.click(
  ...(await page.$eval('#canvas-h2 svg.h2-gap-svg', (svg) => {
    const r = svg.getBoundingClientRect();
    return [r.left + 8, r.bottom - 8];
  })),
);
const partyAfterBgClick = await page.$eval('#filter-party', (el) => el.value);
if (partyAfterBgClick !== '') {
  throw new Error(`Clique no fundo do gráfico H2 não removeu seleção: ${partyAfterBgClick}`);
}

// 4. H2B: Público vs Privado + Barra 100% fontes (desktop sem colisão barra×rótulo)
const h2bDeskBarLabelHits = await page.evaluate(() => {
  const hits = [];
  for (const row of document.querySelectorAll('#canvas-h2b .div-row')) {
    const rects = [...row.querySelectorAll('rect.div-bar')].map((r) => r.getBoundingClientRect());
    const txts = [...row.querySelectorAll('text.div-val-label')].map((t) => ({
      t: t.textContent.trim(),
      b: t.getBoundingClientRect(),
    }));
    for (let i = 0; i < rects.length; i += 1) {
      const r = rects[i];
      const lbl = txts[i];
      if (!r || !lbl) continue;
      if (lbl.b.left < r.right - 1 && lbl.b.right > r.left + 1 && lbl.b.top < r.bottom && lbl.b.bottom > r.top) {
        hits.push(lbl.t);
      }
    }
  }
  return hits;
});
if (h2bDeskBarLabelHits.length > 0) {
  throw new Error(`H2B desktop colisão barra×rótulo: ${JSON.stringify(h2bDeskBarLabelHits)}`);
}
await assertUnifiedHover('#canvas-h2b .div-row', '#canvas-h2b', 0);
await assertUnifiedHover('#canvas-h2b .h2b-src-bar', '#canvas-h2b', 1);

// 5. H3: Sem botões de escala/zoom, escala linear, % verba = % mulheres, Cota respeitada, Subfinanciamento, déficit exato em R$, 100% bolhas vermelhas rotuladas sem colisão nem fuga do SVG (2022 e 2026)
async function checkSvgGeometry(svgSelector, { textSelector = 'text', checkBounds = true, checkCircles = false } = {}) {
  return page.evaluate((sSel, tSel, doBounds, doCircles) => {
    const svgs = [...document.querySelectorAll(sSel)];
    if (svgs.length === 0) return { missing: true, overlaps: [], clipped: [], outCircles: [], textCircleHits: [] };
    const overlaps = [];
    const clipped = [];
    const outCircles = [];
    const textCircleHits = [];
    for (const svg of svgs) {
      const sr = svg.getBoundingClientRect();
      const labels = [...svg.querySelectorAll(tSel)].map((el) => {
        const b = el.getBoundingClientRect();
        return { t: el.textContent.trim(), l: b.left, r: b.right, top: b.top, bot: b.bottom };
      }).filter((b) => b.t.length > 0 && b.r > b.l);
      for (let i = 0; i < labels.length; i += 1) {
        const a = labels[i];
        if (doBounds && (a.l < sr.left - 3 || a.r > sr.right + 3 || a.top < sr.top - 3 || a.bot > sr.bottom + 3)) {
          clipped.push(a.t);
        }
        for (let j = i + 1; j < labels.length; j += 1) {
          const b = labels[j];
          if (a.l < b.r && a.r > b.l && a.top < b.bot && a.bot > b.top) {
            overlaps.push([a.t, b.t]);
          }
        }
      }
      if (doCircles) {
        const dots = [...svg.querySelectorAll('g[aria-label="dot"] circle')].map((c) => {
          const b = c.getBoundingClientRect();
          return { p: c.getAttribute('data-party'), l: b.left, r: b.right, top: b.top, bot: b.bottom };
        });
        for (const d of dots) {
          if (d.l < sr.left - 2 || d.r > sr.right + 2 || d.top < sr.top - 2 || d.bot > sr.bottom + 2) {
            outCircles.push(d.p);
          }
          for (const lbl of labels) {
            if (lbl.l < d.r && lbl.r > d.l && lbl.top < d.bot && lbl.bot > d.top) {
              textCircleHits.push([lbl.t, d.p]);
            }
          }
        }
      }
    }
    return { missing: false, overlaps, clipped, outCircles, textCircleHits };
  }, svgSelector, textSelector, checkBounds, checkCircles);
}

const h3Check = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('#controls-h3 button')].map((b) => b.textContent.trim());
  const svg = document.querySelector('#canvas-h3 svg.h3-scatter-svg');
  const txtAll = svg.textContent;
  const redParties = [...svg.querySelectorAll('g[aria-label="dot"] circle')]
    .filter((c) => (c.getAttribute('fill') || '').toUpperCase() === '#FF5E2B')
    .map((c) => c.getAttribute('data-party'));
  const labeledParties = new Set(
    [...svg.querySelectorAll('g[aria-label="text"] text')].map((t) => t.getAttribute('data-party')),
  );
  const missingRed = redParties.filter((p) => !labeledParties.has(p));
  const statTxt = document.getElementById('stat-h3')?.textContent || '';
  return {
    btns,
    hasDiag: txtAll.includes('% verba = % mulheres'),
    hasCota: txtAll.includes('Cota respeitada'),
    hasSub: txtAll.includes('Subfinanciamento'),
    hasDeficit: txtAll.includes('Déficit em reais') && txtAll.includes('−R$ 54,4M'),
    statMatches: statTxt.includes('−R$ 54,4 milhões'),
    missingRed,
    labelsCount: labeledParties.size,
  };
});
const h3DeskGeo22 = await checkSvgGeometry('#canvas-h3 svg.h3-scatter-svg', {
  textSelector: 'g[aria-label="text"] text',
  checkBounds: true,
  checkCircles: true,
});
const h3DeskQuad22 = await checkSvgGeometry('#canvas-h3 svg.h3-scatter-svg', {
  textSelector: 'g[aria-label="text"] text, g[aria-label="h3-quadrants"] text',
  checkBounds: true,
  checkCircles: false,
});
await page.click('#controls-h3 button:nth-child(2)');
const h3DeskGeo26 = await checkSvgGeometry('#canvas-h3 svg.h3-scatter-svg', {
  textSelector: 'g[aria-label="text"] text',
  checkBounds: true,
  checkCircles: true,
});
const h3DeskQuad26 = await checkSvgGeometry('#canvas-h3 svg.h3-scatter-svg', {
  textSelector: 'g[aria-label="text"] text, g[aria-label="h3-quadrants"] text',
  checkBounds: true,
  checkCircles: false,
});
await page.click('#controls-h3 button:nth-child(1)');
h3Check.overlaps = h3DeskQuad22.overlaps.length + h3DeskQuad26.overlaps.length;
if (
  h3Check.btns.length !== 2
  || !h3Check.hasDiag
  || !h3Check.hasCota
  || !h3Check.hasSub
  || !h3Check.hasDeficit
  || !h3Check.statMatches
  || h3Check.missingRed.length > 0
  || h3Check.overlaps > 0
  || h3DeskGeo22.outCircles.length > 0
  || h3DeskGeo26.outCircles.length > 0
  || h3DeskGeo22.textCircleHits.length > 0
  || h3DeskGeo26.textCircleHits.length > 0
) {
  throw new Error(`H3 inválido: ${JSON.stringify({ h3Check, h3DeskGeo22, h3DeskGeo26 })}`);
}
await assertUnifiedHover('#canvas-h3 g[aria-label="dot"] circle', '#canvas-h3', 0);

// 6. H4: Sem rede de hubs, apenas % nos rótulos do Sankey, filtro Competitivas Top 10%
const h4Check = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('#controls-h4 button')].map((b) => b.textContent.trim());
  const texts = [...document.querySelectorAll('#canvas-h4 svg text')].map((t) => t.textContent.trim());
  const hasBrlInSvg = texts.some((t) => t.includes('R$'));
  return { btns, hasBrlInSvg, hasTop10: texts.some((t) => t.includes('Competitivas')) };
});
if (h4Check.btns.some((b) => b.includes('Hub')) || h4Check.hasBrlInSvg || !h4Check.hasTop10) {
  throw new Error(`H4 inválido: ${JSON.stringify(h4Check)}`);
}
await assertUnifiedHover('#canvas-h4 svg rect', '#canvas-h4', 0);
await page.click('#controls-h4 button:nth-child(2)'); // Competitivas (Top 10%)
await page.waitForFunction(() => !document.querySelector('#canvas-h4 svg').textContent.includes('Base (90%)'));
await page.click('#controls-h4 button:nth-child(1)'); // volta Todas

// 7. H5: Barras horizontais ordenadas por % Eleitas e zero sobreposição de siglas
const h5OrderCheck = await page.evaluate(() => {
  const labels = [...document.querySelectorAll('#canvas-h5 .h5-party-label')].map((el) => {
    const b = el.getBoundingClientRect();
    return { t: el.textContent.trim(), top: b.top, bot: b.bottom };
  });
  let overlap = 0;
  for (let i = 1; i < labels.length; i += 1) {
    if (labels[i].top < labels[i - 1].bot) overlap += 1;
  }
  return { count: labels.length, first: labels[0]?.t, overlap };
});
if (h5OrderCheck.count < 8 || h5OrderCheck.first !== 'PT' || h5OrderCheck.overlap > 0) {
  throw new Error(`H5 inválido: ${JSON.stringify(h5OrderCheck)}`);
}
await assertUnifiedHover('#canvas-h5 .h5-bar', '#canvas-h5', 0);

// 8. H6, H7 (com 2018), H8: zero colisão e clipping SVG em desktop
const h6Has2018 = await page.$eval('#canvas-h6 svg', (el) => el.textContent.includes('2018'));
if (!h6Has2018) throw new Error('H6 não exibe 2018');
await page.click('#controls-h7 button'); // ativa 2018 em H7
for (const sel of ['#canvas-h1 svg', '#canvas-h2 svg', '#canvas-h2b svg', '#canvas-h4 svg', '#canvas-h5 svg', '#canvas-h6 svg', '#canvas-h7 svg', '#canvas-h8 svg']) {
  const g = await checkSvgGeometry(sel);
  if (g.missing || g.overlaps.length > 0 || g.clipped.length > 0) {
    throw new Error(`Falha geométrica desktop em ${sel}: ${JSON.stringify(g)}`);
  }
}
await assertUnifiedHover('#canvas-h6 .h6-dot', '#canvas-h6', 0);
await assertUnifiedHover('#canvas-h7 .h7-agg-dot', '#canvas-h7', 0);
await assertUnifiedHover('#canvas-h8 .h8-dot', '#canvas-h8', 0);

// 9. H9: Mapa 27 UFs + Matriz ordenável + clique no fundo da matriz limpa seleção
const h9Check = await page.evaluate(() => ({
  ufPaths: document.querySelectorAll('#canvas-h9-map svg path').length,
  matRows: document.querySelectorAll('#canvas-h9-matrix tbody tr').length,
}));
if (h9Check.ufPaths !== 27 || h9Check.matRows !== 27) {
  throw new Error(`H9 incompleto: ${JSON.stringify(h9Check)}`);
}
await assertUnifiedHover('#canvas-h9-map svg path', '#canvas-h9-map', 0);
await assertUnifiedHover('#canvas-h9-matrix .h9-heat-cell', '#canvas-h9-matrix', 0);
await page.click('#canvas-h9-matrix button[data-sort-key="pctCandF"]');
const sortSorted = await page.$eval('#canvas-h9-matrix button[data-sort-key="pctCandF"]', (el) => el.classList.contains('is-sorted'));
if (!sortSorted) throw new Error('Ordenação da matriz H9 falhou');
await page.click('#controls-h9 .filter-group:nth-child(2) button:nth-child(2)'); // Top 15 Partidos
await page.waitForFunction(() => document.querySelectorAll('#canvas-h9-matrix tbody tr').length <= 16);
await page.click('#canvas-h9-matrix tbody tr[data-entity="PT"]');
if ((await page.$eval('#filter-party', (el) => el.value)) !== 'PT') {
  throw new Error('Clique em PT na matriz H9 não selecionou PT');
}
await page.click('#canvas-h9-matrix .h9-clear-bar');
if ((await page.$eval('#filter-party', (el) => el.value)) !== '') {
  throw new Error('Clique na área de limpeza da matriz H9 não removeu seleção de partido');
}

// 10. Partidos de 2026 no dropdown + Tagline Reveal + Mobile 390px sem overflow e sem colisões SVG
const partiesInSelect = await page.$$eval('#filter-party option', (els) => els.map((e) => e.value));
for (const p26 of ['PCDOB', 'PRD', 'MOBILIZA']) {
  if (!partiesInSelect.includes(p26)) {
    throw new Error(`Partido de 2026 ausente em #filter-party: ${p26}`);
  }
}

await page.$eval('#tagline-reveal', (el) => el.scrollIntoView({ behavior: 'instant', block: 'center' }));
await page.waitForFunction(() => document.querySelectorAll('#tagline-reveal .reveal-word.is-lit').length > 0);

await page.setViewport({ width: 390, height: 844 });
await new Promise((r) => setTimeout(r, 250));
const h3MobGeo22 = await checkSvgGeometry('#canvas-h3 svg.h3-scatter-svg', {
  textSelector: 'g[aria-label="text"] text, g[aria-label="h3-quadrants"] text',
  checkBounds: true,
  checkCircles: false,
});
const h3MobTextHits22 = await checkSvgGeometry('#canvas-h3 svg.h3-scatter-svg', {
  textSelector: 'g[aria-label="text"] text',
  checkBounds: true,
  checkCircles: true,
});
await page.click('#controls-h3 button:nth-child(2)');
const h3MobGeo26 = await checkSvgGeometry('#canvas-h3 svg.h3-scatter-svg', {
  textSelector: 'g[aria-label="text"] text, g[aria-label="h3-quadrants"] text',
  checkBounds: true,
  checkCircles: false,
});
const h3MobTextHits26 = await checkSvgGeometry('#canvas-h3 svg.h3-scatter-svg', {
  textSelector: 'g[aria-label="text"] text',
  checkBounds: true,
  checkCircles: true,
});
await page.click('#controls-h3 button:nth-child(1)');

const mobIssues = {};
for (const sel of ['#canvas-h1 svg', '#canvas-h2 svg', '#canvas-h2b svg', '#canvas-h4 svg', '#canvas-h5 svg', '#canvas-h6 svg', '#canvas-h7 svg', '#canvas-h8 svg']) {
  const g = await checkSvgGeometry(sel);
  if (g.missing || g.overlaps.length > 0 || g.clipped.length > 0) {
    mobIssues[sel] = g;
  }
}

const h2bMobBarLabelHits = await page.evaluate(() => {
  const hits = [];
  for (const row of document.querySelectorAll('#canvas-h2b .div-row')) {
    const rects = [...row.querySelectorAll('rect.div-bar')].map((r) => r.getBoundingClientRect());
    const txts = [...row.querySelectorAll('text.div-val-label')].map((t) => ({
      t: t.textContent.trim(),
      b: t.getBoundingClientRect(),
    }));
    for (let i = 0; i < rects.length; i += 1) {
      const r = rects[i];
      const lbl = txts[i];
      if (!r || !lbl) continue;
      if (lbl.b.left < r.right - 1 && lbl.b.right > r.left + 1 && lbl.b.top < r.bottom && lbl.b.bottom > r.top) {
        hits.push(lbl.t);
      }
    }
  }
  return hits;
});

const mobileCheck = await page.evaluate(() => ({
  overflowX: document.documentElement.scrollWidth > window.innerWidth,
  h5Count: document.querySelectorAll('#canvas-h5 .h5-party-label').length,
}));
if (
  mobileCheck.overflowX
  || mobileCheck.h5Count < 8
  || h3MobGeo22.overlaps.length > 0
  || h3MobGeo22.outCircles.length > 0
  || h3MobTextHits22.textCircleHits.length > 0
  || h3MobGeo26.overlaps.length > 0
  || h3MobGeo26.outCircles.length > 0
  || h3MobTextHits26.textCircleHits.length > 0
  || h2bMobBarLabelHits.length > 0
  || Object.keys(mobIssues).length > 0
) {
  throw new Error(`Falha layout/colisões mobile 390px: ${JSON.stringify({
    mobileCheck, h3MobGeo22, h3MobTextHits22, h3MobGeo26, h3MobTextHits26, h2bMobBarLabelHits, mobIssues,
  })}`);
}

console.log('E2E OK:', { shellCheck, h3Check, h5OrderCheck, h9Check, mobileCheck, errors });
await browser.close();
server.close();
if (errors.length > 0) process.exit(1);
