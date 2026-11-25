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

// Helper para validar hover padronizado (modelo H1) e ausência de <title> / Plot tip nativos
async function assertUnifiedHover(targetSelector, containerSelector = '#stage-canvas', wrapIndex = 0) {
  const forbiddenCount = await page.$$eval(
    `${containerSelector} svg title, ${containerSelector} svg g[aria-label="tip"]`,
    (els) => els.length,
  );
  if (forbiddenCount !== 0) {
    throw new Error(`Encontrados ${forbiddenCount} tooltips nativos (<title> ou Plot tip) em ${containerSelector}`);
  }
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
      hidden: tip.hidden,
      hasHead,
      hasTable,
      insideX: tr.left >= wr.left - 1 && tr.right <= wr.right + 1,
      insideY: tr.top >= wr.top - 1 && tr.bottom <= wr.bottom + 1,
      text: tip.textContent.trim().slice(0, 80),
    };
  }, containerSelector, wrapIndex);
  if (!tipInfo.ok || !tipInfo.insideX || !tipInfo.insideY) {
    throw new Error(`Hover padronizado falhou em ${targetSelector} (${containerSelector}): ${JSON.stringify(tipInfo)}`);
  }
}

// 2. Percorre os 9 passos (H1–H9) e testa hover padronizado + click-to-filter
const steps = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8', 'h9'];
for (const s of steps) {
  await page.$eval(`.story-step[data-step="${s}"]`, (el) => el.scrollIntoView({ behavior: 'instant', block: 'center' }));
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
    await assertUnifiedHover('#stage-canvas .h1-row[data-bin="30-33"] .h1-row-hit', '#stage-canvas', 0);
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
    if (s === 'h2') {
      const h2Check = await page.evaluate(() => {
        const dumbbellSvg = document.querySelector('#stage-canvas .chart-wrap:nth-of-type(1) svg[viewBox]');
        const facetLabels = dumbbellSvg.querySelectorAll('g[aria-label="fx-axis tick label"]').length;
        const btns = [...document.querySelectorAll('#stage-controls button')].map((el) => ({
          text: el.textContent.trim(),
          pressed: el.getAttribute('aria-pressed'),
        }));
        const title = document.getElementById('stage-title').textContent;
        return { facetLabels, btns, title };
      });
      if (h2Check.facetLabels !== 0 || h2Check.btns[0]?.text !== '2022' || h2Check.btns[0]?.pressed !== 'true') {
        throw new Error(`H2 deveria ser dumbbell simples com seletor 2022|2026: ${JSON.stringify(h2Check)}`);
      }
      await assertUnifiedHover('#stage-canvas .chart-wrap:nth-of-type(1) g[aria-label="dot"] circle', '#stage-canvas', 0);
      await assertUnifiedHover('#stage-canvas .chart-wrap:nth-of-type(2) g[aria-label="bar"] rect', '#stage-canvas', 1);

      // Troca o ano apenas dentro de H2 (2022 -> 2026) sem alterar o filtro global no topo
      await page.click('#stage-controls button:nth-child(2)');
      const afterH2Toggle = await page.evaluate(() => ({
        h2Pressed26: document.querySelector('#stage-controls button:nth-child(2)').getAttribute('aria-pressed'),
        stageTitle: document.getElementById('stage-title').textContent,
        globalYear22: document.querySelector('[data-year="2022"]').getAttribute('aria-pressed'),
        scopeSummary: document.getElementById('scope-summary').textContent,
      }));
      if (
        afterH2Toggle.h2Pressed26 !== 'true'
        || !afterH2Toggle.stageTitle.includes('2026')
        || afterH2Toggle.globalYear22 !== 'true'
        || !afterH2Toggle.scopeSummary.includes('2022')
      ) {
        throw new Error(`Seletor de ano de H2 não manteve independência do filtro global: ${JSON.stringify(afterH2Toggle)}`);
      }
      await page.click('#stage-controls button:nth-child(1)'); // volta para 2022
    }
    if (s === 'h3') {
      const h3Check = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('#stage-controls button')].map((el) => ({
          text: el.textContent.trim(),
          pressed: el.getAttribute('aria-pressed'),
        }));
        const subtitle = document.getElementById('stage-subtitle');
        const svg = document.querySelector('#stage-canvas svg');
        const circles = [...svg.querySelectorAll('g[aria-label="dot"] circle')];
        const radii = circles.map((c) => Number(c.getAttribute('r')));
        const fillOp = circles[0]?.getAttribute('fill-opacity');
        const strokeOp = circles[0]?.getAttribute('stroke-opacity');
        const labels = [...svg.querySelectorAll('g[aria-label="text"] text')].map((t) => t.textContent.trim());
        const hasLegend = Boolean(svg.querySelector('g[aria-label="h3-legend"]'));
        const hasQuads = Boolean(svg.querySelector('g[aria-label="h3-quadrants"]'));
        const diagTransform = svg.querySelector('text[aria-label="diagonal-label"]')?.getAttribute('transform') || '';
        return {
          btns,
          subtitleVisible: Boolean(subtitle && !subtitle.hidden && subtitle.textContent.trim().length > 10),
          circleCount: circles.length,
          radiiSortedDesc: radii.every((r, i) => i === 0 || r <= radii[i - 1] + 0.01),
          fillOp,
          strokeOp,
          labels,
          hasLegend,
          hasQuads,
          hasRotatedDiag: diagTransform.includes('rotate('),
        };
      });
      if (h3Check.btns[0]?.pressed !== 'true' || h3Check.btns[2]?.pressed !== 'true') {
        throw new Error(`H3 deveria iniciar em Foco (≤46%) + Escala Linear: ${JSON.stringify(h3Check.btns)}`);
      }
      if (!h3Check.subtitleVisible || !h3Check.hasLegend || !h3Check.hasQuads || !h3Check.hasRotatedDiag) {
        throw new Error(`Elementos visuais de H3 incompletos: ${JSON.stringify(h3Check)}`);
      }
      if (!h3Check.radiiSortedDesc || h3Check.fillOp !== '0.75' || h3Check.strokeOp !== '1') {
        throw new Error(`Z-order ou opacidade de bolhas H3 inválidos: ${JSON.stringify(h3Check)}`);
      }
      if (!h3Check.labels.includes('PSOL') || !h3Check.labels.includes('PMB') || h3Check.labels.length > 10) {
        throw new Error(`Rótulos seletivos (top 6 + extremos) inesperados em H3: ${JSON.stringify(h3Check.labels)}`);
      }
      const labelBoxes = await page.$$eval('#stage-canvas g[aria-label="text"] text', (els) => els.map((el) => {
        const b = el.getBoundingClientRect();
        return { p: el.textContent.trim(), l: b.left, r: b.right, t: b.top, b: b.bottom };
      }));
      for (let i = 0; i < labelBoxes.length; i += 1) {
        for (let j = i + 1; j < labelBoxes.length; j += 1) {
          const a = labelBoxes[i];
          const b = labelBoxes[j];
          if (a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t) {
            throw new Error(`Sobreposição de rótulos em H3: ${a.p} vs ${b.p}`);
          }
        }
      }
      await assertUnifiedHover('#stage-canvas g[aria-label="dot"] circle', '#stage-canvas', 0);
      const dimmedCount = await page.$$eval(
        '#stage-canvas g[aria-label="dot"] circle',
        (els) => els.filter((c) => c.style.opacity === '0.2').length,
      );
      if (dimmedCount < h3Check.circleCount - 1) {
        throw new Error(`Hover em H3 não esmaeceu os demais partidos (dimmed=${dimmedCount}/${h3Check.circleCount})`);
      }
      await page.click('#stage-controls .filter-group:nth-child(2) button:nth-child(2)'); // Escala Log (Todos)
      const logActive = await page.$eval('#stage-controls .filter-group:nth-child(2) button:nth-child(2)', (el) => el.getAttribute('aria-pressed'));
      const todosActive = await page.$eval('#stage-controls .filter-group:nth-child(1) button:nth-child(2)', (el) => el.getAttribute('aria-pressed'));
      if (logActive !== 'true' || todosActive !== 'true') {
        throw new Error('Alternância para Todos + Escala Log falhou em H3');
      }
      await page.click('#stage-controls .filter-group:nth-child(1) button:nth-child(1)'); // Volta para Foco (≤46%) -> Linear
      const backLin = await page.$eval('#stage-controls .filter-group:nth-child(2) button:nth-child(1)', (el) => el.getAttribute('aria-pressed'));
      if (backLin !== 'true') throw new Error('Volta para Foco (≤46%) deveria restaurar Escala Linear');
    }
    await page.click('#stage-canvas g[aria-label="dot"] circle');
    const selectedParty = await page.$eval('#filter-party', (el) => el.value);
    if (!selectedParty) throw new Error(`Click-to-filter falhou em ${s}`);
    await page.click('#reset-filters');
    await page.click(`.story-step[data-step="${s}"]`);
  }
  if (s === 'h4') {
    await assertUnifiedHover('#stage-canvas svg rect', '#stage-canvas', 0);
    await page.click('#stage-controls button:nth-child(2)');
    await page.waitForSelector('#stage-canvas svg');
    await assertUnifiedHover('#stage-canvas svg rect', '#stage-canvas', 0);
  }
  if (s === 'h5') {
    await assertUnifiedHover('#stage-canvas g[aria-label="bar"] > g rect', '#stage-canvas', 0);
    await page.click('#stage-canvas g[aria-label="bar"] > g rect');
    const selectedParty = await page.$eval('#filter-party', (el) => el.value);
    if (!selectedParty) throw new Error('Click-to-filter falhou em h5');
    await page.click('#reset-filters');
    await page.click('.story-step[data-step="h5"]');
  }
  if (s === 'h6') {
    await assertUnifiedHover('#stage-canvas g[aria-label="bar"] rect', '#stage-canvas', 0);
  }
  if (s === 'h7') {
    const h7MapPaths = await page.$$eval('#stage-secondary path', (els) => els.length);
    if (h7MapPaths !== 27) {
      throw new Error(`H7 deveria exibir mapa das 27 UFs em stage-secondary, obteve ${h7MapPaths}`);
    }
    await assertUnifiedHover('#stage-canvas g[aria-label="dot"] circle', '#stage-canvas', 0);
    await assertUnifiedHover('#stage-secondary svg path', '#stage-secondary', 0);
  }
  if (s === 'h8') {
    await assertUnifiedHover('#stage-canvas g[aria-label="bar"] rect', '#stage-canvas', 0);
  }
  if (s === 'h9') {
    const ufCount = await page.$$eval('#stage-canvas path', (els) => els.length);
    const pcSvg = await page.$('#stage-secondary svg');
    if (ufCount !== 27 || !pcSvg) {
      throw new Error(`H9 incompleto: ufCount=${ufCount}, pcSvg=${Boolean(pcSvg)}`);
    }
    await assertUnifiedHover('#stage-canvas svg path', '#stage-canvas', 0);
    // Hover sobre uma linha das Coordenadas Paralelas entre os eixos 1 e 2
    const pcPoint = await page.evaluate(() => {
      const path = document.querySelector('#stage-secondary svg > g:first-child path');
      if (!path) return null;
      const len = path.getTotalLength();
      const pt = path.getPointAtLength(len * 0.12);
      const svgRect = path.ownerSVGElement.getBoundingClientRect();
      return { x: svgRect.left + pt.x, y: svgRect.top + pt.y };
    });
    if (!pcPoint) throw new Error('Linha das Coordenadas Paralelas não encontrada');
    await page.mouse.move(pcPoint.x, pcPoint.y);
    const pcTipOk = await page.$eval('#stage-secondary .chart-tooltip', (el) => !el.hidden && el.textContent.trim().length > 0);
    if (!pcTipOk) throw new Error('Tooltip padronizado falhou ao fazer hover nas Coordenadas Paralelas');
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
