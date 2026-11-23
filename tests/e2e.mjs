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

const rootDir = path.resolve(process.env.E2E_ROOT || process.cwd());

const server = http.createServer((req, res) => {
  const urlPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const filePath = path.join(rootDir, urlPath);
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

// 1. Layout split-screen em desktop
const layout = await page.evaluate(() => {
  const left = document.getElementById('narrative-pane').getBoundingClientRect();
  const right = document.querySelector('.stage-pane').getBoundingClientRect();
  return { leftX: left.left, rightX: right.left, overflowX: document.documentElement.scrollWidth > window.innerWidth };
});
if (layout.rightX <= layout.leftX || layout.overflowX) {
  throw new Error(`Layout split-screen inválido: ${JSON.stringify(layout)}`);
}

// 2. Percorre os 9 passos (H1–H9) e testa click-to-filter em H2, H3 e H5
const steps = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8', 'h9'];
for (const s of steps) {
  await page.click(`.story-step[data-step="${s}"]`);
  await page.waitForSelector('#stage-canvas svg');
  const kicker = await page.$eval('#stage-kicker', (el) => el.textContent);
  if (!kicker.toUpperCase().includes(s.toUpperCase())) {
    throw new Error(`Stage kicker não atualizou para ${s}: ${kicker}`);
  }
  if (s === 'h1') {
    const h1Check = await page.evaluate(() => {
      const leftTicks = [...document.querySelectorAll('#stage-canvas .h1-axis-left .h1-axis-tick')].map((e) => e.textContent);
      const rightTicks = [...document.querySelectorAll('#stage-canvas .h1-axis-right .h1-axis-tick')].map((e) => e.textContent);
      const rows = document.querySelectorAll('#stage-canvas .h1-row').length;
      const quotaRule = Boolean(document.querySelector('#stage-canvas .h1-quota-rule line'));
      return { leftTicks, rightTicks, rows, quotaRule };
    });
    if (h1Check.rows !== 5 || !h1Check.quotaRule) {
      throw new Error(`H1 espelhado incompleto: ${JSON.stringify(h1Check)}`);
    }
    if (JSON.stringify(h1Check.leftTicks) !== JSON.stringify(h1Check.rightTicks) || h1Check.leftTicks.length < 2) {
      throw new Error(`Escalas espelhadas de H1 assimétricas: ${JSON.stringify(h1Check)}`);
    }
    // Hover sobre a faixa crítica (30%–33,3%) deve exibir tooltip comparativo sem linha de número absoluto
    await page.hover('#stage-canvas .h1-row[data-bin="30-33"] .h1-row-hit');
    const tipText = await page.$eval('#stage-canvas .h1-tooltip', (el) => ({ hidden: el.hidden, text: el.textContent }));
    if (tipText.hidden || !tipText.text.includes('54,2%') || !tipText.text.includes('42,3%') || tipText.text.includes('Absoluto')) {
      throw new Error(`Tooltip comparativo de H1 falhou no hover: ${JSON.stringify(tipText)}`);
    }
    // Alternância Registradas ↔ Aptas mantém a mesma escala travada (apenas modo %, sem botão N)
    const unitToggleCount = await page.$$eval('#stage-controls button', (els) => els.filter((b) => b.textContent.trim() === 'N').length);
    if (unitToggleCount !== 0) {
      throw new Error(`Botão "N" ainda está presente nos controles de H1`);
    }
    await page.click('#stage-controls button:nth-child(2)'); // Aptas
    const aptoTicks = await page.$$eval('#stage-canvas .h1-axis-left .h1-axis-tick', (els) => els.map((e) => e.textContent));
    if (JSON.stringify(aptoTicks) !== JSON.stringify(h1Check.leftTicks)) {
      throw new Error(`Escala de H1 mudou entre Registradas (${h1Check.leftTicks}) e Aptas (${aptoTicks})`);
    }
    await page.click('#stage-controls button:nth-child(1)'); // volta para Registradas
  }
  if (s === 'h2' || s === 'h3') {
    if (s === 'h3') {
      const logActive = await page.$eval('#stage-controls button:nth-child(1)', (el) => el.getAttribute('aria-pressed'));
      const focusActive = await page.$eval('#stage-controls button:nth-child(3)', (el) => el.getAttribute('aria-pressed'));
      if (logActive !== 'true' || focusActive !== 'true') {
        throw new Error('H3 deveria iniciar em Escala Log + Foco (≤46%)');
      }
      await page.click('#stage-controls button:nth-child(4)'); // Todos
      await page.click('#stage-controls button:nth-child(2)'); // Escala Linear
      const linActive = await page.$eval('#stage-controls button:nth-child(2)', (el) => el.getAttribute('aria-pressed'));
      if (linActive !== 'true') throw new Error('Alternância para Escala Linear falhou em H3');
      await page.click('#stage-controls button:nth-child(1)'); // Escala Log
      await page.click('#stage-controls button:nth-child(3)'); // Foco (≤46%)
    }
    await page.click('#stage-canvas g[aria-label="dot"] circle');
    const selectedParty = await page.$eval('#filter-party', (el) => el.value);
    if (!selectedParty) throw new Error(`Click-to-filter falhou em ${s}`);
    await page.click('#reset-filters');
    await page.click(`.story-step[data-step="${s}"]`);
  }
  if (s === 'h4') {
    await page.click('#stage-controls button:nth-child(2)');
    await page.waitForSelector('#stage-canvas svg');
  }
  if (s === 'h5') {
    await page.click('#stage-canvas g[aria-label="bar"] > g rect');
    const selectedParty = await page.$eval('#filter-party', (el) => el.value);
    if (!selectedParty) throw new Error('Click-to-filter falhou em h5');
    await page.click('#reset-filters');
    await page.click('.story-step[data-step="h5"]');
  }
  if (s === 'h7') {
    const h7MapPaths = await page.$$eval('#stage-secondary path', (els) => els.length);
    if (h7MapPaths !== 27) {
      throw new Error(`H7 deveria exibir mapa das 27 UFs em stage-secondary, obteve ${h7MapPaths}`);
    }
  }
  if (s === 'h9') {
    const ufCount = await page.$$eval('#stage-canvas path', (els) => els.length);
    const pcSvg = await page.$('#stage-secondary svg');
    if (ufCount !== 27 || !pcSvg) {
      throw new Error(`H9 incompleto: ufCount=${ufCount}, pcSvg=${Boolean(pcSvg)}`);
    }
    // Testa brush nas Coordenadas Paralelas e persistência após clique em UF
    const axisBox = await page.$eval('#stage-secondary .pc-brush .overlay', (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y0: r.y + 30, y1: r.y + 120 };
    });
    await page.mouse.move(axisBox.x, axisBox.y0);
    await page.mouse.down();
    await page.mouse.move(axisBox.x, axisBox.y1);
    await page.mouse.up();
    await page.waitForFunction(() => document.getElementById('scope-summary').textContent.includes('Brush'));
    await page.click('#stage-canvas path');
    const selAfterUf = await page.$eval('#stage-secondary .pc-brush .selection', (el) => el.getAttribute('height'));
    if (!selAfterUf || Number(selAfterUf) <= 0) {
      throw new Error('Brush visual desapareceu após clicar em UF no mapa H9');
    }
    // Confirma que #filter-bar não cobre #stage-controls no desktop e que Eixos: UFs ativa de fato
    const deskOverlap = await page.evaluate(() => {
      const f = document.getElementById('filter-bar').getBoundingClientRect();
      const s = document.querySelector('.stage-card').getBoundingClientRect();
      return { filterBottom: f.bottom, stageTop: s.top };
    });
    if (deskOverlap.stageTop < deskOverlap.filterBottom - 1) {
      throw new Error(`Sobreposição desktop em H9: ${JSON.stringify(deskOverlap)}`);
    }
    await page.click('#stage-controls button:nth-child(4)');
    const ufBtnActive = await page.$eval('#stage-controls button:nth-child(4)', (el) => el.getAttribute('aria-pressed'));
    if (ufBtnActive !== 'true') {
      throw new Error(`Botão Eixos: UFs não ativou após clique real (aria-pressed=${ufBtnActive})`);
    }
    await page.waitForSelector('#stage-secondary svg');
  }
}

// 3. Testa troca de ano 2022 -> 2026 e presença de partidos de 2026 (PCDOB, PRD, MOBILIZA)
await page.click('[data-year="2026"]');
await page.waitForFunction(() => document.getElementById('scope-summary').textContent.includes('2026'));
const parties2026 = await page.$$eval('#filter-party option', (els) => els.map((e) => e.value));
for (const p26 of ['PCDOB', 'PRD', 'MOBILIZA']) {
  if (!parties2026.includes(p26)) {
    throw new Error(`Partido de 2026 ausente em #filter-party: ${p26}`);
  }
}

await page.click('[data-cargo="6"]');
await page.select('#filter-uf', 'CE');
await page.waitForFunction(() => document.getElementById('scope-summary').textContent.includes('Ceará'));
const filteredText = await page.$eval('#scope-summary', (el) => el.textContent);

await page.click('#reset-filters');
await page.waitForFunction(() => document.getElementById('scope-summary').textContent.includes('2022'));

// 4. Testa mobile 390x844 sem colisão de filter-bar sobre stage-pane após scroll
await page.setViewport({ width: 390, height: 844 });
await page.evaluate(() => window.scrollTo(0, 600));
const mobileCheck = await page.evaluate(() => {
  const f = document.getElementById('filter-bar').getBoundingClientRect();
  const s = document.querySelector('.stage-pane').getBoundingClientRect();
  return {
    filterBottom: f.bottom,
    stageTop: s.top,
    overlap: f.bottom > s.top + 2 && f.top < s.bottom,
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
  };
});
if (mobileCheck.overlap || mobileCheck.overflowX) {
  throw new Error(`Falha de layout mobile 390px: ${JSON.stringify(mobileCheck)}`);
}

console.log('E2E OK:', { filteredText, mobileCheck, errors });
await browser.close();
server.close();
if (errors.length > 0) process.exit(1);
