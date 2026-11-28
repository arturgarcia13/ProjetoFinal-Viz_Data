import { shouldAnimate, tweenPctText } from './motion.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const CX = 230;
const CY = 212;
const CYCLE_MS = 3600;

const RINGS = [
  { count: 14, radius: 88 },
  { count: 17, radius: 110 },
  { count: 20, radius: 132 },
  { count: 23, radius: 154 },
  { count: 26, radius: 176 },
];

const STAGE_META = [
  {
    id: 0,
    shortLabel: '01 · Papel',
    title: 'Candidaturas aptas',
    subtitle: 'Cumprimento protocolar no registro',
    color: '#F8DF4F',
    pct: 34.2,
  },
  {
    id: 1,
    shortLabel: '02 · Dinheiro',
    title: 'Fundo público recebido',
    subtitle: 'Proporção do FEFC + FP às mulheres',
    color: '#FC7CE5',
    pct: 34.4,
  },
  {
    id: 2,
    shortLabel: '03 · Cadeira',
    title: 'Cadeiras eleitas',
    subtitle: 'Queda de quase metade até a posse',
    color: '#FA532E',
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
  RINGS.forEach((ring, rowIdx) => {
    for (let i = 0; i < ring.count; i += 1) {
      const angle = Math.PI - (i / (ring.count - 1)) * Math.PI;
      seats.push({
        rowIdx,
        angle,
        x: CX + ring.radius * Math.cos(angle),
        y: CY - ring.radius * Math.sin(angle),
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
  isEntering: false,
  timerId: null,
  entranceTimerId: null,
  seatEls: [],
  stages: STAGE_META.map((s) => ({ ...s })),
};

function clearEntranceState() {
  if (controllerState.entranceTimerId !== null) {
    clearTimeout(controllerState.entranceTimerId);
    controllerState.entranceTimerId = null;
  }
  if (controllerState.isEntering) {
    controllerState.isEntering = false;
    controllerState.seatEls.forEach((c) => c.classList.remove('is-entering'));
  }
}

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
  btn.setAttribute('aria-label', playing ? 'Pausar animação do plenário' : 'Retomar animação do plenário');
  btn.setAttribute('title', playing ? 'Pausar animação do plenário' : 'Retomar animação do plenário');
  const pauseIcon = btn.querySelector('.icon-pause');
  const playIcon = btn.querySelector('.icon-play');
  if (pauseIcon) pauseIcon.hidden = !playing;
  if (playIcon) playIcon.hidden = playing;
}

function renderActiveStage({ tweenKpi = false } = {}) {
  const idx = controllerState.activeStage;
  const stage = controllerState.stages[idx];
  const filledSeats = Math.max(0, Math.min(100, Math.round(stage.pct)));
  const menSeats = 100 - filledSeats;

  if (!controllerState.isEntering) {
    controllerState.seatEls.forEach((circle, seatIdx) => {
      const isFilled = seatIdx < filledSeats;
      circle.setAttribute('fill', isFilled ? stage.color : '#0B5741');
      circle.classList.toggle('is-filled', isFilled);
      circle.classList.toggle('is-empty', !isFilled);
    });
  }

  const kpiVal = document.getElementById('hemicycle-kpi-val');
  const kpiLabel = document.getElementById('hemicycle-kpi-label');
  const subtitleEl = document.getElementById('funnel-subtitle');
  if (kpiVal) {
    kpiVal.setAttribute('fill', stage.color);
    if (controllerState.isEntering) {
      kpiVal.textContent = '0,0%';
    } else if (tweenKpi) {
      tweenPctText(kpiVal, stage.pct / 100, { duration: 640 });
    } else {
      kpiVal.textContent = fmtPct(stage.pct);
    }
  }
  if (kpiLabel) kpiLabel.textContent = stage.title;
  if (subtitleEl) {
    subtitleEl.textContent = `${filledSeats} de 100 cadeiras · ${stage.subtitle}`;
  }

  const svg = document.getElementById('hemicycle-svg');
  if (svg) {
    svg.setAttribute(
      'aria-label',
      `Retrato do plenário com 100 cadeiras: ${stage.title}, ${fmtPct(stage.pct)}, ${filledSeats} de 100 cadeiras ocupadas por mulheres.`,
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

  const animate = shouldAnimate();
  controllerState.isEntering = animate;

  const seats = buildSeatsGeometry();
  const frag = document.createDocumentFragment();
  controllerState.seatEls = seats.map((seat, idx) => {
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', seat.x.toFixed(2));
    c.setAttribute('cy', seat.y.toFixed(2));
    c.setAttribute('r', '5.4');
    c.setAttribute('fill', '#0B5741');
    c.setAttribute('class', animate ? 'hemicycle-seat is-empty is-entering' : 'hemicycle-seat is-empty');
    c.style.transitionDelay = animate ? `${idx * 6}ms` : '0ms';
    frag.appendChild(c);
    return c;
  });
  seatsGroup.replaceChildren(frag);

  // Linha divisória do Piso Legal (30% = exatamente entre as 30 primeiras cadeiras e a 31ª)
  const pInner = (() => {
    const a = Math.PI - ((3 + 0.5) / (RINGS[0].count - 1)) * Math.PI;
    return { x: CX + RINGS[0].radius * Math.cos(a), y: CY - RINGS[0].radius * Math.sin(a) };
  })();
  const pOuter = (() => {
    const lastIdx = RINGS.length - 1;
    const a = Math.PI - ((lastIdx + 3 + 0.5) / (RINGS[lastIdx].count - 1)) * Math.PI;
    return { x: CX + RINGS[lastIdx].radius * Math.cos(a), y: CY - RINGS[lastIdx].radius * Math.sin(a) };
  })();
  const vx = pOuter.x - pInner.x;
  const vy = pOuter.y - pInner.y;
  const vLen = Math.hypot(vx, vy);
  const ux = vx / vLen;
  const uy = vy / vLen;

  const x1 = pInner.x - 12 * ux;
  const y1 = pInner.y - 12 * uy;
  const x2 = pOuter.x + 44 * ux;
  const y2 = pOuter.y + 44 * uy;

  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', x1.toFixed(2));
  line.setAttribute('y1', y1.toFixed(2));
  line.setAttribute('x2', x2.toFixed(2));
  line.setAttribute('y2', y2.toFixed(2));
  line.setAttribute('stroke', '#F8DF4F');
  line.setAttribute('stroke-width', '1.4');
  line.setAttribute('stroke-dasharray', '4 3');

  const pillW = 112;
  const pillH = 22;
  const pillX = x2 - pillW / 2;
  const pillY = y2 - pillH;

  const pillGroup = document.createElementNS(SVG_NS, 'g');
  pillGroup.setAttribute('class', 'hemicycle-threshold-pill');
  const pillRect = document.createElementNS(SVG_NS, 'rect');
  pillRect.setAttribute('x', pillX.toFixed(2));
  pillRect.setAttribute('y', pillY.toFixed(2));
  pillRect.setAttribute('width', String(pillW));
  pillRect.setAttribute('height', String(pillH));
  pillRect.setAttribute('rx', '11');
  pillRect.setAttribute('fill', '#004D38');
  pillRect.setAttribute('stroke', '#F8DF4F');
  pillRect.setAttribute('stroke-width', '1');

  const pillText = document.createElementNS(SVG_NS, 'text');
  pillText.setAttribute('x', x2.toFixed(2));
  pillText.setAttribute('y', (pillY + 14.5).toFixed(2));
  pillText.setAttribute('text-anchor', 'middle');
  pillText.setAttribute('fill', '#F8DF4F');
  pillText.textContent = 'Piso legal · 30%';

  pillGroup.append(pillRect, pillText);
  thresholdGroup.replaceChildren(line, pillGroup);

  const tabs = [...document.querySelectorAll('.plenario-tab')];
  tabs.forEach((tab, idx) => {
    tab.addEventListener('click', () => {
      clearEntranceState();
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
        clearEntranceState();
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
    clearEntranceState();
    setPlenarioPlaying(!controllerState.isPlaying);
  });

  reducedMQ?.addEventListener('change', (e) => {
    controllerState.reducedMotion = e.matches;
    if (e.matches) {
      clearEntranceState();
      setPlenarioPlaying(false);
    }
  });

  syncPlayButtonUI();
  renderActiveStage();
  if (animate) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!controllerState.isEntering) return;
        controllerState.seatEls.forEach((c) => c.classList.remove('is-entering'));
        controllerState.entranceTimerId = window.setTimeout(() => {
          controllerState.entranceTimerId = null;
          controllerState.isEntering = false;
          renderActiveStage({ tweenKpi: true });
        }, 260);
      });
    });
  }
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
