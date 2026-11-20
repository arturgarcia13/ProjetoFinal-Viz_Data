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

const server = http.createServer((req, res) => {
  const urlPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const filePath = path.join(process.cwd(), urlPath);
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
await page.waitForSelector('#stage-canvas svg');

// 1. Verifica layout split-screen (painel narrativo à esquerda, palco à direita)
const layout = await page.evaluate(() => {
  const left = document.getElementById('narrative-pane').getBoundingClientRect();
  const right = document.querySelector('.stage-pane').getBoundingClientRect();
  return { leftX: left.left, rightX: right.left, overflowX: document.documentElement.scrollWidth > window.innerWidth };
});
if (layout.rightX <= layout.leftX || layout.overflowX) {
  throw new Error(`Layout split-screen inválido: ${JSON.stringify(layout)}`);
}

// 2. Percorre todos os 9 passos (H1–H9) nos 5 atos e valida renderização no palco fixo
const steps = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8', 'h9'];
for (const s of steps) {
  await page.click(`.story-step[data-step="${s}"]`);
  await page.waitForSelector('#stage-canvas svg');
  const kicker = await page.$eval('#stage-kicker', (el) => el.textContent);
  if (!kicker.toUpperCase().includes(s.toUpperCase())) {
    throw new Error(`Stage kicker não atualizou para ${s}: ${kicker}`);
  }
  if (s === 'h4') {
    // Testa alternância Sankey -> Rede de Hubs
    await page.click('#stage-controls button:nth-child(2)');
    await page.waitForSelector('#stage-canvas svg');
  }
  if (s === 'h7') {
    // Verifica Boxplot + Mapa por UF de H7
    const h7MapPaths = await page.$$eval('#stage-secondary path', (els) => els.length);
    if (h7MapPaths !== 27) {
      throw new Error(`H7 deveria exibir mapa das 27 UFs em stage-secondary, obteve ${h7MapPaths}`);
    }
  }
  if (s === 'h9') {
    // Testa mapa (27 UFs) + coordenadas paralelas e alternância Partidos <-> UFs
    const ufCount = await page.$$eval('#stage-canvas path', (els) => els.length);
    const pcSvg = await page.$('#stage-secondary svg');
    if (ufCount !== 27 || !pcSvg) {
      throw new Error(`H9 incompleto: ufCount=${ufCount}, pcSvg=${Boolean(pcSvg)}`);
    }
    await page.click('#stage-controls button:nth-child(4)');
    await page.waitForSelector('#stage-secondary svg');
  }
}

// 3. Testa filtros globais (Ano 2026, Cargo 6, UF CE, Limiar A, Limpar)
await page.click('[data-year="2026"]');
await page.waitForFunction(() => document.getElementById('scope-summary').textContent.includes('2026'));
await page.click('[data-cargo="6"]');
await page.select('#filter-uf', 'CE');
await page.waitForFunction(() => document.getElementById('scope-summary').textContent.includes('Ceará'));
const filteredText = await page.$eval('#scope-summary', (el) => el.textContent);

await page.click('#reset-filters');
await page.waitForFunction(() => document.getElementById('scope-summary').textContent.includes('2022'));

// 4. Verifica responsividade mobile (390px) sem erro de console
await page.setViewport({ width: 390, height: 844 });
await page.waitForSelector('#stage-canvas svg');

console.log('E2E OK:', { filteredText, errors });
await browser.close();
server.close();
if (errors.length > 0) process.exit(1);
