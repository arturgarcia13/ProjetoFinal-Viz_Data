const SVG_NS = 'http://www.w3.org/2000/svg';

const CX = 260;
const CY = 252;
const PAD_ANGLE = 0.04;
const CYCLE_MS = 4500;

const ROWS = [
  { count: 12, radius: 100 },
  { count: 16, radius: 124 },
  { count: 20, radius: 148 },
  { count: 24, radius: 172 },
  { count: 28, radius: 196 },
];

const STAGE_META = [
  {
    id: 0,
    shortLabel: '01 · Papel',
    title: 'Candidaturas aptas',
    subtitle: 'Cumprimento protocolar no registro',
    color: '#ECD64C',
    pct: 34.2,
  },
  {
    id: 1,
    shortLabel: '02 · Dinheiro',
    title: 'Fundo público recebido',
    subtitle: 'Fatia do FEFC + FP para mulheres',
    color: '#E872D0',
    pct: 34.4,
  },
  {
    id: 2,
    shortLabel: '03 · Cadeira',
    title: 'Cadeiras eleitas',
    subtitle: 'Presença efetiva após a apuração',
    color: '#EE6A4B',
    pct: 17.9,
  },
];

function fmtPct(v) {
  return `${Number(v || 0).toFixed(1).replace('.', ',')}%`;
}

function fmtSignedPP(diff) {
  const rounded = Math.abs(diff).toFixed(1).replace('.', ',');
  const sign = diff < 0 ? '−' : '+';
  return `${sign}${rounded} p.p. na urna`;
}

function buildSeatsGeometry() {
  const seats = [];
  ROWS.forEach((row, rowIdx) => {
    for (let i = 0; i < row.count; i += 1) {
      const t = i / (row.count - 1);
      const angle = (Math.PI - PAD_ANGLE) - t * (Math.PI - 2 * PAD_ANGLE);
      seats.push({
        rowIdx,
        angle,
        x: CX + row.radius * Math.cos(angle),
        y: CY - row.radius * Math.sin(angle),
      });
    }
  });
  seats.sort((a, b) => (b.angle - a.angle) || (a.rowIdx - b.rowIdx));
  return seats;
}

const controllerState = {
  initialized: false,
  activeStage: 0,
  isPlaying: true,
  reducedMotion: false,
  timerId: null,
  seatEls: [],
  stages: STAGE_META.map((s) => ({ ...s })),
};

function clearCycleTimer() {
  if (controllerState.timerId !== null) {
    clearTimeout(controllerState.timerId);
    controllerState.timerId = null;
  }
}

function scheduleNextCycle() {
  clearCycleTimer();
  if (!controllerState.isPlaying || controllerState.reducedMotion) return;
  controllerState.timerId = window.setTimeout(() => {
    const next = (controllerState.activeStage + 1) % controllerState.stages.length;
    setActiveStage(next, { restartTimer: true });
  }, CYCLE_MS);
}

function syncPlayButtonUI() {
  const btn = document.getElementById('plenario-play-btn');
  if (!btn) return;
  const playing = controllerState.isPlaying;
  btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
  btn.setAttribute('aria-label', playing ? 'Pausar ciclo automático' : 'Retomar ciclo automático');
  btn.setAttribute('title', playing ? 'Pausar ciclo automático' : 'Retomar ciclo automático');
  const pauseIcon = btn.querySelector('.icon-pause');
  const playIcon = btn.querySelector('.icon-play');
  if (pauseIcon) pauseIcon.hidden = !playing;
  if (playIcon) playIcon.hidden = playing;
}

function renderActiveStage() {
  const idx = controllerState.activeStage;
  const stage = controllerState.stages[idx];
  const filledSeats = Math.max(0, Math.min(100, Math.round(stage.pct)));
  const menSeats = 100 - filledSeats;

  controllerState.seatEls.forEach((circle, seatIdx) => {
    const isFilled = seatIdx < filledSeats;
    circle.setAttribute('fill', isFilled ? stage.color : '#135740');
    circle.classList.toggle('is-filled', isFilled);
    circle.classList.toggle('is-empty', !isFilled);
  });

  const kpiVal = document.getElementById('hemicycle-kpi-val');
  const kpiLabel = document.getElementById('hemicycle-kpi-label');
  const kpiSub = document.getElementById('hemicycle-kpi-sub');
  if (kpiVal) {
    kpiVal.textContent = fmtPct(stage.pct);
    kpiVal.setAttribute('fill', stage.color);
  }
  if (kpiLabel) kpiLabel.textContent = stage.title;
  if (kpiSub) {
    kpiSub.textContent = `${filledSeats} de 100 cadeiras · ${stage.subtitle}`;
  }

  const svg = document.getElementById('hemicycle-svg');
  if (svg) {
    svg.setAttribute(
      'aria-label',
      `Plenário dinâmico de 100 cadeiras: ${stage.title}, ${fmtPct(stage.pct)}, ${filledSeats} de 100 cadeiras ocupadas por mulheres.`,
    );
  }

  const womenDot = document.getElementById('plenario-women-dot');
  const womenLabel = document.getElementById('plenario-women-label');
  const menLabel = document.getElementById('plenario-men-label');
  if (womenDot) womenDot.style.backgroundColor = stage.color;
  if (womenLabel) womenLabel.textContent = `Mulheres (${filledSeats})`;
  if (menLabel) menLabel.textContent = `Homens (${menSeats})`;

  const dropBadge = document.getElementById('plenario-drop-badge');
  if (dropBadge) {
    const diffPP = controllerState.stages[2].pct - controllerState.stages[0].pct;
    dropBadge.textContent = fmtSignedPP(diffPP);
    const showDrop = idx === 2;
    dropBadge.classList.toggle('is-visible', showDrop);
    dropBadge.setAttribute('aria-hidden', showDrop ? 'false' : 'true');
  }

  controllerState.stages.forEach((s, i) => {
    const pctEl = document.getElementById(`plenario-pct-${i}`);
    if (pctEl) pctEl.textContent = fmtPct(s.pct);
    const tab = document.getElementById(`plenario-tab-${i}`);
    if (!tab) return;
    const isActive = i === idx;
    tab.classList.toggle('is-active', isActive);
    tab.classList.toggle('is-playing', isActive && controllerState.isPlaying && !controllerState.reducedMotion);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tab.setAttribute('tabindex', isActive ? '0' : '-1');
    if (isActive && controllerState.isPlaying && !controllerState.reducedMotion) {
      const bar = tab.querySelector('.plenario-tab-bar i');
      if (bar) {
        bar.style.animation = 'none';
        void bar.offsetWidth;
        bar.style.animation = '';
      }
    }
  });
}

export function setActiveStage(idx, { restartTimer = false } = {}) {
  const clamped = Math.max(0, Math.min(controllerState.stages.length - 1, idx));
  controllerState.activeStage = clamped;
  renderActiveStage();
  if (restartTimer && controllerState.isPlaying && !controllerState.reducedMotion) {
    scheduleNextCycle();
  }
}

export function setPlenarioPlaying(playing) {
  controllerState.isPlaying = Boolean(playing) && !controllerState.reducedMotion;
  syncPlayButtonUI();
  renderActiveStage();
  if (controllerState.isPlaying) {
    scheduleNextCycle();
  } else {
    clearCycleTimer();
  }
}

export function initHeroPlenario() {
  if (controllerState.initialized) return;
  const seatsGroup = document.getElementById('hemicycle-seats');
  const thresholdGroup = document.getElementById('hemicycle-threshold');
  if (!seatsGroup || !thresholdGroup) return;

  controllerState.initialized = true;
  const reducedMQ = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  controllerState.reducedMotion = Boolean(reducedMQ?.matches);
  controllerState.isPlaying = !controllerState.reducedMotion;

  const seats = buildSeatsGeometry();
  const frag = document.createDocumentFragment();
  controllerState.seatEls = seats.map((seat, idx) => {
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', seat.x.toFixed(2));
    c.setAttribute('cy', seat.y.toFixed(2));
    c.setAttribute('r', '5.6');
    c.setAttribute('fill', '#135740');
    c.setAttribute('class', 'hemicycle-seat is-empty');
    c.style.transitionDelay = `${(idx % 12) * 14}ms`;
    frag.appendChild(c);
    return c;
  });
  seatsGroup.replaceChildren(frag);

  // Linha radial do Piso Legal (30%) em t = 0.30, raio 84..214
  const thresholdAngle = (Math.PI - PAD_ANGLE) - 0.30 * (Math.PI - 2 * PAD_ANGLE);
  const x1 = CX + 84 * Math.cos(thresholdAngle);
  const y1 = CY - 84 * Math.sin(thresholdAngle);
  const x2 = CX + 214 * Math.cos(thresholdAngle);
  const y2 = CY - 214 * Math.sin(thresholdAngle);

  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', x1.toFixed(2));
  line.setAttribute('y1', y1.toFixed(2));
  line.setAttribute('x2', x2.toFixed(2));
  line.setAttribute('y2', y2.toFixed(2));
  line.setAttribute('stroke', '#ECD64C');
  line.setAttribute('stroke-width', '1.5');
  line.setAttribute('stroke-dasharray', '4 4');
  line.setAttribute('opacity', '0.88');

  const pillGroup = document.createElementNS(SVG_NS, 'g');
  pillGroup.setAttribute('class', 'hemicycle-threshold-pill');
  const pillRect = document.createElementNS(SVG_NS, 'rect');
  pillRect.setAttribute('x', '18');
  pillRect.setAttribute('y', '42');
  pillRect.setAttribute('width', '118');
  pillRect.setAttribute('height', '22');
  pillRect.setAttribute('rx', '11');
  pillRect.setAttribute('fill', '#033927');
  pillRect.setAttribute('stroke', 'rgba(236, 214, 76, 0.55)');
  pillRect.setAttribute('stroke-width', '1');

  const pillText = document.createElementNS(SVG_NS, 'text');
  pillText.setAttribute('x', '77');
  pillText.setAttribute('y', '56.5');
  pillText.setAttribute('text-anchor', 'middle');
  pillText.setAttribute('fill', '#ECD64C');
  pillText.textContent = 'Piso legal · 30%';

  pillGroup.append(pillRect, pillText);
  thresholdGroup.replaceChildren(line, pillGroup);

  const tabs = [...document.querySelectorAll('.plenario-tab')];
  tabs.forEach((tab, idx) => {
    tab.addEventListener('click', () => {
      // Interação manual pausa o ciclo automático para leitura sem pressa
      controllerState.isPlaying = false;
      clearCycleTimer();
      syncPlayButtonUI();
      setActiveStage(idx, { restartTimer: false });
    });

    tab.addEventListener('keydown', (e) => {
      let nextIdx = null;
      if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') nextIdx = 0;
      else if (e.key === 'End') nextIdx = tabs.length - 1;
      if (nextIdx !== null) {
        e.preventDefault();
        controllerState.isPlaying = false;
        clearCycleTimer();
        syncPlayButtonUI();
        setActiveStage(nextIdx, { restartTimer: false });
        tabs[nextIdx].focus();
      }
    });
  });

  document.getElementById('plenario-play-btn')?.addEventListener('click', () => {
    if (controllerState.reducedMotion) return;
    setPlenarioPlaying(!controllerState.isPlaying);
  });

  reducedMQ?.addEventListener('change', (e) => {
    controllerState.reducedMotion = e.matches;
    if (e.matches) {
      setPlenarioPlaying(false);
    }
  });

  syncPlayButtonUI();
  renderActiveStage();
  if (controllerState.isPlaying) {
    scheduleNextCycle();
  }
}

export function updateHeroPlenario({ cand, verba, eleitas, badgeText } = {}) {
  if (!controllerState.initialized) initHeroPlenario();
  if (Number.isFinite(cand)) controllerState.stages[0].pct = cand;
  if (Number.isFinite(verba)) controllerState.stages[1].pct = verba;
  if (Number.isFinite(eleitas)) controllerState.stages[2].pct = eleitas;

  if (badgeText) {
    const pill = document.getElementById('hero-recorte-pill');
    if (pill) pill.textContent = badgeText;
  }
  renderActiveStage();
}
