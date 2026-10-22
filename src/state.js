import * as d3 from 'd3';

export const THRESHOLDS = [0, 5, 10, 25, 50, 100];

export function makeState() {
  return {
    year: 2022,
    cargo: 'dep',            // dep | federal | estadual | distrital
    uf: null,
    parties: new Set(),      // cliques em partido
    pcParties: new Set(),    // seleção por coordenadas paralelas
    pcRanges: {},            // para desenhar os brushes
    threshold: 10,
    brush: null,             // {r:[min,max], v:[min,max]}
    slate: null,             // [lo, hi] em proporção
    histMode: 'pct',         // pct | delta
    hoverParty: null,
    mapMode: 'women'
  };
}

export function cargoMatch(cargo, filter) {
  if (filter === 'dep') return cargo === 'DEPUTADO FEDERAL' || cargo === 'DEPUTADO ESTADUAL';
  if (filter === 'federal') return cargo === 'DEPUTADO FEDERAL';
  if (filter === 'estadual') return cargo === 'DEPUTADO ESTADUAL';
  if (filter === 'distrital') return cargo === 'DEPUTADO DISTRITAL';
  return true;
}

export function applyFilters(all, state, except = null) {
  const parties = state.parties;
  const pc = state.pcParties;
  return all.filter(c => {
    if (c.y !== state.year) return false;
    if (!cargoMatch(c.cargo, state.cargo)) return false;
    if (state.uf && c.uf !== state.uf) return false;
    if (parties.size && !parties.has(c.leg)) return false;
    if (pc.size && !pc.has(c.leg)) return false;
    if (except !== 'brush' && state.brush) {
      const { r, v } = state.brush;
      if (c.r < r[0] || c.r > r[1] || c.v < v[0] || c.v > v[1]) return false;
    }
    if (except !== 'slate' && state.slate) {
      if (c.slate < state.slate[0] || c.slate > state.slate[1]) return false;
    }
    return true;
  });
}

export const sum = (rows, f) => d3.sum(rows, f);
export const median = arr => {
  const a = arr.filter(x => Number.isFinite(x)).sort(d3.ascending);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
export const pct = (x, d = 1) => Number.isFinite(x) ? `${(100 * x).toFixed(d).replace('.', ',')}%` : '—';
export const ratioTxt = x => Number.isFinite(x) ? x.toFixed(2).replace('.', ',') : '—';

export function signalCount(c, threshold) {
  const a = c.v <= threshold ? 1 : 0;
  const b = c.fin && c.r === 0 && c.e === 0 ? 1 : 0;
  const cc = c.dup > 0 ? 1 : 0;
  return a + b + cc;
}
export const hasSignal = (c, threshold) => signalCount(c, threshold) > 0;

export function slatesFrom(rows, threshold, minN = 4) {
  const groups = d3.group(rows, c => c.slateKey);
  const out = [];
  for (const [key, arr] of groups) {
    if (arr.length < minN) continue;
    const nF = arr.filter(c => c.g === 'F').length;
    const sig = arr.filter(c => hasSignal(c, threshold)).length;
    const first = arr[0];
    out.push({
      key,
      leg: first.leg,
      uf: first.uf,
      cargo: first.cargo,
      band: first.slateBand,
      n: arr.length,
      nF,
      pct: nF / arr.length,
      delta: nF - Math.ceil(0.30 * arr.length),
      signalRate: sig / arr.length,
      sig2: arr.filter(c => signalCount(c, threshold) >= 2).length / arr.length
    });
  }
  return out;
}

export function partyRows(rows, threshold) {
  const groups = d3.group(rows.filter(c => c.g === 'F' || c.g === 'M'), c => c.leg);
  const out = [];
  for (const [leg, arr] of groups) {
    const F = arr.filter(c => c.g === 'F');
    const M = arr.filter(c => c.g === 'M');
    if (!F.length || !M.length) continue;
    const n = arr.length;
    const candShare = F.length / n;
    const fefcF = sum(F, c => c.fefc), fefcM = sum(M, c => c.fefc);
    const fefcTot = fefcF + fefcM;
    const fefcShare = fefcTot ? fefcF / fefcTot : NaN;
    const votesF = sum(F, c => c.v), votesM = sum(M, c => c.v);
    const voteShare = votesF + votesM ? votesF / (votesF + votesM) : NaN;
    const elF = sum(F, c => c.el), elM = sum(M, c => c.el);
    const seatShare = elF + elM ? elF / (elF + elM) : NaN;
    const eF = sum(F, c => c.e), eM = sum(M, c => c.e);
    const thirdF = eF ? (sum(F, c => c.toCand + c.toParty)) / eF : NaN;
    const thirdM = eM ? (sum(M, c => c.toCand + c.toParty)) / eM : NaN;
    const sharedF = eF ? sum(F, c => c.shared) / eF : NaN;
    const sharedM = eM ? sum(M, c => c.shared) / eM : NaN;
    const privF = sum(F, c => c.priv), privM = sum(M, c => c.priv);
    const privShare = privF + privM ? privF / (privF + privM) : NaN;
    const ratioPriv = candShare ? privShare / candShare : NaN;
    const sig2F = F.length ? F.filter(c => signalCount(c, threshold) >= 2).length / F.length : NaN;
    const sig2M = M.length ? M.filter(c => signalCount(c, threshold) >= 2).length / M.length : NaN;
    const medRF = median(F.map(c => c.r)), medRM = median(M.map(c => c.r));
    const medPubF = median(F.map(c => c.fefc + c.party)), medPubM = median(M.map(c => c.fefc + c.party));
    const medPrivF = median(F.map(c => c.priv)), medPrivM = median(M.map(c => c.priv));
    const ratioRes = candShare ? fefcShare / candShare : NaN;
    const ratioVote = candShare ? voteShare / candShare : NaN;
    const ratioSeat = candShare ? seatShare / candShare : NaN;
    const ratios = { dinheiro: ratioRes, votos: ratioVote, cadeiras: ratioSeat };
    let worst = 'nenhum';
    let worstVal = 1;
    for (const [k, v] of Object.entries(ratios)) {
      if (Number.isFinite(v) && v < worstVal) { worst = k; worstVal = v; }
    }
    if (worstVal >= 0.95) worst = 'nenhum';
    out.push({
      leg, n, nF: F.length, nM: M.length,
      candShare, fefcF, fefcM, fefcShare, votesF, votesM, voteShare,
      elF, elM, seatShare, ratioRes, ratioVote, ratioSeat,
      medRF, medRM, medPubF, medPubM, medPrivF, medPrivM,
      thirdF, thirdM, sharedF, sharedM, worst, worstVal,
      privF, privM, privShare, ratioPriv,
      sigF: F.filter(c => hasSignal(c, threshold)).length / F.length,
      sigM: M.filter(c => hasSignal(c, threshold)).length / M.length,
      sig2F, sig2M,
      zeroBF: F.filter(c => c.fin && c.r === 0 && c.e === 0).length / F.length,
      zeroBM: M.filter(c => c.fin && c.r === 0 && c.e === 0).length / M.length,
      dupF: F.filter(c => c.dup > 0).length / F.length,
      dupM: M.filter(c => c.dup > 0).length / M.length,
      elRateF: F.length ? elF / F.length : NaN,
      elRateM: M.length ? elM / M.length : NaN,
      medVF: median(F.map(c => c.v)), medVM: median(M.map(c => c.v))
    });
  }
  return out.sort((a, b) => b.n - a.n);
}

function adjustedRaceMeans(rows) {
  // Médias de resíduo por grupo racial/gênero, com o mesmo ajuste do H6:
  // log(votos) ~ log(recursos) + efeitos fixos de partido × cargo × UF.
  if (rows.length < 80) return null;
  const centered = [];
  let sxy = 0, sxx = 0;
  for (const [, arr] of d3.group(rows, r => r.key)) {
    const gx = d3.mean(arr, r => r.x);
    const gy = d3.mean(arr, r => r.y);
    for (const r of arr) {
      const xc = r.x - gx, yc = r.y - gy;
      centered.push({ xc, yc, g: r.g, race: r.race });
      sxy += xc * yc; sxx += xc * xc;
    }
  }
  const b = sxx > 1e-12 ? sxy / sxx : 0;
  const defs = {
    blackWomen: r => r.g === 'F' && (r.race === 'PRETA' || r.race === 'PARDA'),
    whiteWomen: r => r.g === 'F' && r.race === 'BRANCA',
    blackMen: r => r.g === 'M' && (r.race === 'PRETA' || r.race === 'PARDA'),
    whiteMen: r => r.g === 'M' && r.race === 'BRANCA'
  };
  const out = {};
  for (const [k, fn] of Object.entries(defs)) {
    const sub = centered.filter(fn);
    out[k] = sub.length >= 30 ? { n: sub.length, res: d3.mean(sub, r => r.yc - b * r.xc) } : null;
  }
  return out;
}

function residualGap(rows, useGroups = false) {
  // Gap ajustado = diferença das médias dos resíduos (F - M).
  // Com useGroups, y e x são centrados na chapa (efeitos fixos de
  // partido/federação × cargo × UF); sem, o ajuste é só por log(recursos).
  // Evita estimar o coeficiente de gênero quando a variação within é minúscula.
  if (rows.length < 20) return NaN;
  const F = rows.filter(r => r.g === 'F');
  const M = rows.filter(r => r.g === 'M');
  if (!F.length || !M.length) return NaN;

  const centered = [];
  let sxy = 0, sxx = 0;
  let mx = 0, my = 0;
  if (useGroups) {
    for (const [, arr] of d3.group(rows, r => r.key)) {
      const gx = d3.mean(arr, r => r.x);
      const gy = d3.mean(arr, r => r.y);
      for (const r of arr) {
        const xc = r.x - gx, yc = r.y - gy;
        centered.push({ xc, yc, g: r.g });
        sxy += xc * yc; sxx += xc * xc;
      }
    }
  } else {
    mx = d3.mean(rows, r => r.x);
    my = d3.mean(rows, r => r.y);
    for (const r of rows) {
      const xc = r.x - mx, yc = r.y - my;
      centered.push({ xc, yc, g: r.g });
      sxy += xc * yc; sxx += xc * xc;
    }
  }
  const b = sxx > 1e-12 ? sxy / sxx : 0;
  const resF = centered.filter(r => r.g === 'F').map(r => r.yc - b * r.xc);
  const resM = centered.filter(r => r.g === 'M').map(r => r.yc - b * r.xc);
  return d3.mean(resF) - d3.mean(resM);
}

export function gapStats(rows, minN = 60) {
  // H6: o ajuste usa campanhas materialmente ativas. Isso evita que
  // candidaturas sem receita/voto (tratadas em H7) determinem a inclinação.
  const active = rows.filter(c => (c.g === 'F' || c.g === 'M') && c.r > 1000 && c.v > 10);
  const base = active
    .map(c => ({
      y: Math.log1p(c.v),
      x: Math.log1p(c.r),
      f: c.g === 'F' ? 1 : 0,
      g: c.g,
      race: c.race,
      key: `${c.leg}|${c.cargo}|${c.uf}`
    }));
  if (base.length < minN) return null;
  const F = base.filter(r => r.g === 'F'), M = base.filter(r => r.g === 'M');
  if (!F.length || !M.length) return null;
  const raw = d3.mean(F, r => r.y) - d3.mean(M, r => r.y);
  const money = residualGap(base, false);
  const full = residualGap(base, true);
  const race = adjustedRaceMeans(base);
  return { raw, money, full, race, n: base.length, nF: F.length, nM: M.length };
}

export function qeByDistrict(all, year, cargoFilter) {
  const rows = all.filter(c => c.y === year && cargoMatch(c.cargo, cargoFilter)
    && (c.g === 'F' || c.g === 'M'));
  const out = new Map();
  for (const [key, arr] of d3.group(rows, c => `${c.uf}|${c.cargo}`)) {
    const seats = sum(arr, c => c.el);
    const votes = sum(arr, c => c.v);
    if (seats > 0 && votes > 0) out.set(key, votes / seats);
  }
  return out;
}


const BOTTLENECKS = ['financiamento', 'urna', 'institucional', 'integridade'];
export const BOTTLENECK_LABEL = {
  financiamento: 'financiamento',
  urna: 'urna',
  institucional: 'institucional',
  integridade: 'integridade'
};

const RAW_KEY = { financiamento: 'fin', urna: 'urn', institucional: 'inst', integridade: 'integ' };
function zScore(recs, key) {
  const raw = RAW_KEY[key];
  const vals = recs.map(r => r[raw]).filter(Number.isFinite);
  if (vals.length < 3) return;
  const mean = d3.mean(vals), sd = d3.deviation(vals);
  for (const r of recs) {
    if (!Number.isFinite(r[raw])) { r.z[key] = 0; continue; }
    r.z[key] = sd > 1e-9 ? (r[raw] - mean) / sd : 0;
  }
}

function dominantOf(rec) {
  let best = BOTTLENECKS[0], bv = -Infinity;
  for (const k of BOTTLENECKS) {
    const v = rec.z[k];
    if (Number.isFinite(v) && v > bv) { best = k; bv = v; }
  }
  rec.dominant = best;
  rec.zMax = bv;
  return rec;
}

/** Gargalos por UF: 4 métricas brutas, Z-scores e argmax (H10). */
export function ufDiagnostics(rows, threshold, qeMap = null) {
  const recs = [];
  for (const [uf, arr] of d3.group(rows.filter(c => c.g === 'F' || c.g === 'M'), c => c.uf)) {
    const F = arr.filter(c => c.g === 'F'), M = arr.filter(c => c.g === 'M');
    if (arr.length < 20 || !F.length || !M.length) continue;
    const cs = F.length / arr.length;
    const fF = sum(F, c => c.fefc), fM = sum(M, c => c.fefc);
    const pF = sum(F, c => c.priv), pM = sum(M, c => c.priv);
    const vF = sum(F, c => c.v), vM = sum(M, c => c.v);
    const pubRatio = (fF + fM) && cs ? (fF / (fF + fM)) / cs : NaN;
    const privRatio = (pF + pM) && cs ? (pF / (pF + pM)) / cs : NaN;
    const fin = ((Number.isFinite(pubRatio) ? 1 - pubRatio : 0)
      + (Number.isFinite(privRatio) ? 1 - privRatio : 0)) / 2;
    const g = gapStats(arr, 30);
    const rawGap = d3.mean(F, c => Math.log1p(c.v)) - d3.mean(M, c => Math.log1p(c.v));
    const urn = g && Number.isFinite(g.full) ? -g.full : -rawGap;
    const qeOf = c => qeMap?.get(`${c.uf}|${c.cargo}`) || NaN;
    const comp = c => c.cs === 1 && Number.isFinite(qeOf(c)) && c.v >= 0.10 * qeOf(c);
    const compF = F.filter(comp).length, compM = M.filter(comp).length;
    const eF = sum(F, c => c.el), eM = sum(M, c => c.el);
    const compShare = compF + compM ? compF / (compF + compM) : NaN;
    const seatShare = eF + eM ? eF / (eF + eM) : NaN;
    const inst = Number.isFinite(compShare) && Number.isFinite(seatShare) ? compShare - seatShare : 0;
    const sig2F = F.filter(c => signalCount(c, threshold) >= 2).length / F.length;
    const sig2Any = arr.filter(c => signalCount(c, threshold) >= 2).length / arr.length;
    const sigAny = arr.filter(c => hasSignal(c, threshold)).length / arr.length;
    const res = fF + fM ? fF / (fF + fM) : NaN;
    const vote = vF + vM ? vF / (vF + vM) : NaN;
    const seat = eF + eM ? eF / (eF + eM) : NaN;
    recs.push({
      uf, n: arr.length, nF: F.length, cs, pubRatio, privRatio,
      fin, urn, inst, integ: sig2F,
      compShare, seatShare, sig2F, sig2Any, sigAny, res, vote, seat, z: {}
    });
  }
  for (const k of BOTTLENECKS) zScore(recs, k);
  return recs.map(dominantOf);
}

/** Gargalos por partido/federação, mesma regra de Z-score (H10). */
export function partyDiagnostics(rows, threshold, minN = 30) {
  const ps = partyRows(rows, threshold).filter(p => p.n >= minN);
  const recs = ps.map(p => {
    const g = gapStats(rows.filter(c => c.leg === p.leg), 20);
    const fin = ((Number.isFinite(p.ratioRes) ? 1 - p.ratioRes : 0)
      + (Number.isFinite(p.ratioPriv) ? 1 - p.ratioPriv : 0)) / 2;
    const urn = g && Number.isFinite(g.full) ? -g.full : 0;
    const inst = Number.isFinite(p.voteShare) && Number.isFinite(p.seatShare) ? p.voteShare - p.seatShare : 0;
    return { ...p, fin, urn, inst, integ: p.sig2F ?? 0, z: {} };
  });
  for (const k of BOTTLENECKS) zScore(recs, k);
  return recs.map(dominantOf);
}

export function computeStats(rows, contextRows, state, qeMap = null) {
  const all = rows.filter(c => c.g === 'F' || c.g === 'M');
  const F = all.filter(c => c.g === 'F');
  const M = all.filter(c => c.g === 'M');
  const total = all.length;
  const womenShare = total ? F.length / total : NaN;
  const fefcF = sum(F, c => c.fefc), fefcM = sum(M, c => c.fefc);
  const fefcShare = fefcF + fefcM ? fefcF / (fefcF + fefcM) : NaN;
  const votesF = sum(F, c => c.v), votesM = sum(M, c => c.v);
  const voteShare = votesF + votesM ? votesF / (votesF + votesM) : NaN;
  const elF = sum(F, c => c.el), elM = sum(M, c => c.el);
  const seatShare = elF + elM ? elF / (elF + elM) : NaN;

  const slates = slatesFrom(contextRows, state.threshold);
  const slatesFiltered = slatesFrom(rows, state.threshold);
  const parties = partyRows(rows, state.threshold);

  const h1 = {
    n: slates.length,
    compliance: slates.length ? slates.filter(s => s.pct >= 0.30).length / slates.length : NaN,
    pileup: slates.length ? slates.filter(s => s.pct >= 0.30 && s.pct < 0.3334).length / slates.length : NaN,
    above40: slates.length ? slates.filter(s => s.pct > 0.40).length / slates.length : NaN,
    below30: slates.length ? slates.filter(s => s.pct < 0.30).length / slates.length : NaN,
    delta0: slates.length ? slates.filter(s => s.delta === 0).length / slates.length : NaN,
    delta2plus: slates.length ? slates.filter(s => s.delta >= 2).length / slates.length : NaN,
    deltaMedian: median(slates.map(s => s.delta)),
    median: median(slates.map(s => s.pct)),
    slates
  };

  // H2: medianas dentro de partido × cargo × UF
  const strata = d3.group(all, c => `${c.leg}|${c.cargo}|${c.uf}`);
  const ratios = [], pubRatios = [], privRatios = [];
  for (const [, arr] of strata) {
    const f = arr.filter(c => c.g === 'F'), m = arr.filter(c => c.g === 'M');
    if (f.length < 5 || m.length < 5) continue;
    const rf = median(f.map(c => c.r)), rm = median(m.map(c => c.r));
    if (rm > 0) ratios.push(rf / rm);
    const pf = median(f.map(c => c.fefc + c.party)), pm = median(m.map(c => c.fefc + c.party));
    if (pf > 0 && pm > 0) pubRatios.push(pf / pm);
    const qf = median(f.map(c => c.priv)), qm = median(m.map(c => c.priv));
    if (qf > 0 && qm > 0) privRatios.push(qf / qm);
  }
  const medRF = median(F.map(c => c.r)), medRM = median(M.map(c => c.r));
  const medPubF = median(F.map(c => c.fefc + c.party)), medPubM = median(M.map(c => c.fefc + c.party));
  const medPrivF = median(F.map(c => c.priv)), medPrivM = median(M.map(c => c.priv));
  const h2 = {
    ratio: ratios.length >= 8 ? median(ratios) : (medRM ? medRF / medRM : NaN),
    medianRatio: median(ratios),
    publicRatio: pubRatios.length >= 8 ? median(pubRatios) : (medPubM ? medPubF / medPubM : NaN),
    privateRatio: privRatios.length >= 8 ? median(privRatios) : (medPrivM ? medPrivF / medPrivM : NaN),
    medRF, medRM, medPubF, medPubM, medPrivF, medPrivM,
    strata: ratios.length
  };

  // H3: razão de recursos por partido
  const pElig = parties.filter(p => p.n >= 30 && p.fefcF + p.fefcM > 0 && p.candShare > 0);
  const below90 = pElig.filter(p => p.ratioRes < 0.9);
  const h3 = {
    ratio: womenShare ? fefcShare / womenShare : NaN,
    nParties: pElig.length,
    nBelow90: below90.length,
    below90Share: pElig.length ? below90.length / pElig.length : NaN,
    parties: pElig
  };

  // H4: destinos do gasto contratado
  const eF = sum(F, c => c.e), eM = sum(M, c => c.e);
  const thirdF = eF ? sum(F, c => c.toCand + c.toParty) / eF : NaN;
  const thirdM = eM ? sum(M, c => c.toCand + c.toParty) / eM : NaN;
  const sharedF = eF ? sum(F, c => c.shared) / eF : NaN;
  const sharedM = eM ? sum(M, c => c.shared) / eM : NaN;
  // Repasses recebidos de outras candidaturas (CD_ORIGEM_RECEITA = 10040000).
  // A fonte FEFC é lida em CD_FONTE_RECEITA = 2 na própria receita; a tabela
  // de doador originário é usada apenas para conferir a cadeia do doador.
  const repF = sum(F, c => c.cand), repM = sum(M, c => c.cand);
  const repFefcF = sum(F, c => c.candFefc), repFefcM = sum(M, c => c.candFefc);
  const h4 = {
    thirdF, thirdM, diff: thirdF - thirdM, sharedF, sharedM, eF, eM,
    repF, repM, repFefcF, repFefcM,
    repFefcShareF: repF ? repFefcF / repF : NaN,
    repFefcShareM: repM ? repFefcM / repM : NaN
  };

  // H5: funil e conversão
  const deferredF = F.filter(c => c.cs === 1).length, deferredM = M.filter(c => c.cs === 1).length;
  const qeOf = c => qeMap?.get(`${c.uf}|${c.cargo}`) || NaN;
  const competitive = c => c.cs === 1 && Number.isFinite(qeOf(c)) && c.v >= 0.10 * qeOf(c);
  const compF = F.filter(competitive).length, compM = M.filter(competitive).length;
  const h5 = {
    womenShare, voteShare, seatShare,
    convRatio: womenShare ? seatShare / womenShare : NaN,
    voteRatio: womenShare ? voteShare / womenShare : NaN,
    deferredF, deferredM, compF, compM, elF, elM,
    qeByKey: qeMap || new Map(),
    voteGapPP: (womenShare - voteShare) * 100,
    seatGapPP: (voteShare - seatShare) * 100
  };

  const h6 = gapStats(rows);

  // H7: sinais
  const sigCounts = (arr) => {
    const out = [0, 0, 0, 0];
    for (const c of arr) out[signalCount(c, state.threshold)]++;
    return out;
  };
  const sigF = sigCounts(F), sigM = sigCounts(M);
  const h7 = {
    anyF: F.length ? (F.length - sigF[0]) / F.length : NaN,
    anyM: M.length ? (M.length - sigM[0]) / M.length : NaN,
    aF: F.filter(c => c.v <= state.threshold).length / (F.length || 1),
    aM: M.filter(c => c.v <= state.threshold).length / (M.length || 1),
    bF: F.filter(c => c.fin && c.r === 0 && c.e === 0).length / (F.length || 1),
    bM: M.filter(c => c.fin && c.r === 0 && c.e === 0).length / (M.length || 1),
    cF: F.filter(c => c.dup > 0).length / (F.length || 1),
    cM: M.filter(c => c.dup > 0).length / (M.length || 1),
    sigF, sigM, nF: F.length, nM: M.length,
    noFinF: F.filter(c => !c.fin).length / (F.length || 1),
    noFinM: M.filter(c => !c.fin).length / (M.length || 1)
  };

  // H8: sinais por faixa de composição da chapa
  const bandStats = {};
  for (const band of ['<30', '30–33', '33–40', '40+']) {
    const ss = slates.filter(s => s.band === band);
    const cands = contextRows.filter(c => c.slateBand === band);
    bandStats[band] = {
      slates: ss.length,
      n: cands.length,
      any: cands.length ? cands.filter(c => hasSignal(c, state.threshold)).length / cands.length : NaN,
      two: cands.length ? cands.filter(c => signalCount(c, state.threshold) >= 2).length / cands.length : NaN
    };
  }
  const h8 = { bands: bandStats, slates };

  // H10: gargalo dominante por partido (4 dimensões padronizadas).
  const pDiag = partyDiagnostics(rows, state.threshold, 30);
  const partyStages = { financiamento: 0, urna: 0, institucional: 0, integridade: 0 };
  for (const p of pDiag) partyStages[p.dominant] = (partyStages[p.dominant] || 0) + 1;
  const h10 = { partyStages, partyTotal: pDiag.length, partyDiag: pDiag };

  const finalShare = all.length ? all.filter(c => c.final).length / all.length : NaN;
  const finShare = all.length ? all.filter(c => c.fin).length / all.length : NaN;

  return {
    rows: all, N: total, womenShare, fefcShare, voteShare, seatShare,
    elF, elM, totalSeats: elF + elM,
    h1, h2, h3, h4, h5, h6, h7, h8, h10,
    parties, slates, slatesFiltered,
    finalShare, finShare,
    partial: state.year === 2026 && finalShare < 0.5
  };
}

export function computeH9(baseAll, state) {
  const out = {};
  for (const y of [2022, 2026]) {
    const rows = baseAll.filter(c => c.y === y
      && cargoMatch(c.cargo, state.cargo)
      && (!state.uf || c.uf === state.uf)
      && (!state.parties.size || state.parties.has(c.leg))
      && (!state.pcParties.size || state.pcParties.has(c.leg)));
    const all = rows.filter(c => c.g === 'F' || c.g === 'M');
    const women = all.filter(c => c.g === 'F');
    const low = women.filter(c => c.v < 20);

    // H9: flag de maquiagem padronizada. Um "diretório" é legenda/federação × UF.
    // O kit exige >= 3 mulheres com < 20 votos e (a) FEFC idêntico,
    // (b) Fundo Partidário idêntico ou (c) mesmo pacote de fornecedor/valor/data.
    const kit = new Set();
    for (const [, arr] of d3.group(low, c => `${c.leg}|${c.uf}`)) {
      for (const field of ['fefc', 'party']) {
        const counts = d3.rollup(arr.filter(c => c[field] > 0), v => v.length, c => c[field]);
        for (const c of arr) if (c[field] > 0 && (counts.get(c[field]) || 0) >= 3) kit.add(c);
      }
      const dups = arr.filter(c => c.dup > 0);
      if (dups.length >= 3) for (const c of dups) kit.add(c);
    }

    const classic = women.filter(c => c.v === 0 && c.r === 0 && c.e === 0).length;
    out[y] = {
      n: all.length,
      nWomen: women.length,
      classic: women.length ? classic / women.length : NaN,
      kit: women.length ? kit.size / women.length : NaN,
      a: all.filter(c => c.v <= state.threshold).length / (all.length || 1),
      b: all.filter(c => c.fin && c.r === 0 && c.e === 0).length / (all.length || 1),
      c: all.filter(c => c.dup > 0).length / (all.length || 1),
      any: all.filter(c => hasSignal(c, state.threshold)).length / (all.length || 1),
      finalShare: all.length ? all.filter(c => c.final).length / all.length : NaN
    };
  }
  return out;
}

const V = (status, reason, detail = '') => ({ status, reason, detail });

export function verdicts(s, state, ufStages = null) {
  const inc = (reason, detail) => V('inconclusivo', reason, detail);
  const ok = (reason, detail) => V('funciona', reason, detail);
  const leak = (reason, detail) => V('vaza', reason, detail);

  const v1 = (() => {
    if (s.h1.n < 8) return inc('Poucas chapas no recorte', 'Selecione outro partido ou UF para avaliar a composição das chapas.');
    if (s.h1.compliance >= 0.90) {
      const note = s.h1.pileup >= 0.5
        ? `O piso de 30% virou teto: ${pct(s.h1.pileup)} das chapas ficam entre 30% e 33,3%; ${pct(s.h1.delta0)} têm folga zero (Δ=0).`
        : `${pct(s.h1.above40)} das chapas passam de 40% de mulheres — o piso não é o único destino.`;
      return ok(`${pct(s.h1.compliance)} das chapas cumprem os 30%.`, note);
    }
    return leak(`Só ${pct(s.h1.compliance)} das chapas atingem 30%.`, `${pct(s.h1.below30)} ficam abaixo do piso legal.`);
  })();

  const v2 = (() => {
    if (s.partial) return inc('Prestação de 2026 ainda é preliminar', 'Só uma minoria das contas está na versão final. Leia os valores como retrato parcial, não como resultado.');
    if (s.N < 100) return inc('Amostra insuficiente', 'Poucas candidaturas no recorte para comparar medianas com segurança.');
    const r = s.h2.ratio;
    const detail = `Mediana total: ${ratioTxt(r)}×. Público (FEFC + Fundo Partidário): ${ratioTxt(s.h2.publicRatio)}×; privado: ${ratioTxt(s.h2.privateRatio)}×.`;
    if (r >= 0.9) {
      const note = s.h2.privateRatio < 0.8
        ? 'No dinheiro privado, porém, a paridade não se sustenta.'
        : 'A diferença entre gêneros é pequena no conjunto.';
      return ok(`A mediana feminina é ${ratioTxt(r)}× a masculina.`, `${detail} ${note}`);
    }
    return leak(`A mediana feminina é ${ratioTxt(r)}× a masculina.`, detail);
  })();

  const v3 = (() => {
    if (s.partial) return inc('Prestação de 2026 ainda é preliminar', 'A razão de recursos usa receitas parciais.');
    if (s.h3.nParties < 5) return inc('Poucos partidos no recorte', 'São necessários ao menos cinco partidos com candidaturas dos dois gêneros.');
    const r = s.h3.ratio;
    const detail = `Razão global ${ratioTxt(r)}×. ${s.h3.nBelow90} de ${s.h3.nParties} partidos ficam abaixo de 0,90.`;
    if (r >= 0.95 && s.h3.below90Share <= 0.5) return ok('O FEFC chega perto da proporcionalidade.', detail);
    if (r < 0.90) return leak('O FEFC fica abaixo da proporcionalidade.', detail);
    return inc('Resultado no limite', detail);
  })();

  const v4 = (() => {
    if (s.partial) return inc('Prestação de 2026 ainda é preliminar', 'Despesas contratadas de 2026 estão incompletas.');
    if (s.h4.eF + s.h4.eM < 1e6) return inc('Amostra insuficiente', 'Pouco gasto contratado no recorte.');
    const detail = `Repasses a outros candidatos/partido: ${pct(s.h4.thirdF)} (mulheres) × ${pct(s.h4.thirdM)} (homens). Fornecedor compartilhado: ${pct(s.h4.sharedF)} × ${pct(s.h4.sharedM)}. Nas receitas vindas de outras candidaturas, a parcela com fonte FEFC declarada é ${pct(s.h4.repFefcShareF)} × ${pct(s.h4.repFefcShareM)}.`;
    if (s.h4.thirdF > s.h4.thirdM + 0.01) return leak('Candidatas repassam mais a terceiros.', detail);
    return ok('Não há repasse maior entre candidatas.', detail);
  })();

  const v5 = (() => {
    if (s.totalSeats < 20) return inc('Poucas cadeiras no recorte', 'A taxa de conversão fica instável com poucos eleitos.');
    const detail = `Mulheres: ${pct(s.womenShare)} das candidaturas, ${pct(s.voteShare)} dos votos, ${pct(s.seatShare)} das cadeiras. Razão de conversão ${ratioTxt(s.h5.convRatio)}×.`;
    if (s.h5.convRatio < 0.8) return leak('A conversão em cadeiras é bem menor que a presença nas candidaturas.', detail);
    if (s.h5.convRatio >= 0.9) return ok('A conversão se aproxima da proporcionalidade.', detail);
    return inc('Conversão no limite', detail);
  })();

  const v6 = (() => {
    if (state.year === 2026 && s.partial) return inc('Contas preliminares', 'O ajuste usa receitas ainda incompletas; a votação é final, mas o controle por dinheiro não é confiável.');
    if (!s.h6) return inc('Amostra insuficiente', 'Não há candidaturas suficientes para o ajuste.');
    const g = s.h6;
    const n2 = x => Number.isFinite(x) ? x.toFixed(2).replace('.', ',') : '—';
    const detail = `Campanhas ativas (receita > R$ 1 mil e votos > 10): ${g.n}. Gap bruto ${n2(g.raw)} log-pontos; controlado por dinheiro, ${n2(g.money)}; com partido/cargo/UF, ${n2(g.full)}.`;
    const r = g.race;
    const raceDetail = r && r.blackWomen && r.whiteWomen && r.blackMen && r.whiteMen
      ? ` Resíduo ajustado: mulheres negras ${n2(r.blackWomen.res)}, mulheres brancas ${n2(r.whiteWomen.res)}, homens negros ${n2(r.blackMen.res)}, homens brancos ${n2(r.whiteMen.res)}.`
      : '';
    if (g.full < -0.15) {
      const extra = g.full <= g.raw + 0.05 ? 'O ajuste pelo dinheiro não reduz o gap.' : 'O dinheiro explica só uma parte.';
      const intersectional = r && r.blackWomen && r.whiteWomen && r.blackWomen.res < r.whiteWomen.res - 0.05
        ? 'O resíduo é maior entre mulheres negras.'
        : 'Mesmo controlando o dinheiro, sobra desvantagem feminina.';
      return leak(intersectional, `${detail} ${extra}${raceDetail}`);
    }
    return ok('O gap de votos desaparece ao controlar recursos e composição.', `${detail}${raceDetail}`);
  })();

  const v7 = (() => {
    if (state.year === 2026 && s.partial) return inc('Sinais B e C dependem de contas preliminares', `O sinal A (votação) está completo: ${pct(s.h7.aF)} das mulheres e ${pct(s.h7.aM)} dos homens têm votos ≤ ${state.threshold}. B e C ainda são parciais.`);
    if (s.N < 200) return inc('Amostra insuficiente', 'Poucas candidaturas para comparar a prevalência de sinais.');
    const detail = `Qualquer sinal: ${pct(s.h7.anyF)} × ${pct(s.h7.anyM)}. A (votos): ${pct(s.h7.aF)} × ${pct(s.h7.aM)}. B (conta zerada): ${pct(s.h7.bF)} × ${pct(s.h7.bM)}. C (padronização): ${pct(s.h7.cF)} × ${pct(s.h7.cM)}.`;
    if (s.h7.anyF > s.h7.anyM + 0.02) return leak('Candidatas acumulam mais sinais que candidatos.', detail);
    return ok('Não há vantagem feminina na prevalência de sinais.', detail);
  })();

  const v8 = (() => {
    if (state.year === 2026 && s.partial) return inc('Sinais B e C dependem de contas preliminares', 'O sinal A (votação) está completo; B e C ainda são parciais.');
    if (s.h8.bands['30–33'].slates < 20 || s.h8.bands['40+'].slates < 20) return inc('Poucas chapas por faixa', 'Não há chapas suficientes nas duas faixas para comparar.');
    const a = s.h8.bands['30–33'].two, b = s.h8.bands['40+'].two;
    const detail = `Candidaturas com ≥ 2 sinais em chapas 30–33% (Δ≤1): ${pct(a)}; em chapas 40%+: ${pct(b)}.`;
    if (a > b + 0.05) return leak('Chapas que colam no piso concentram mais sinais.', detail);
    return ok('Não há concentração de sinais nas chapas limítrofes.', detail);
  })();

  const v9 = inc('2026 ainda não permite fechar a comparação', 'Apenas uma minoria das prestações de 2026 está na versão final. A queda ou alta observada pode ser artefato de contas pendentes.');

  const v10 = (() => {
    if (state.year === 2026 && s.partial) return inc('Contas preliminares', 'A etapa de dinheiro usa receitas incompletas; a heterogeneidade entre partidos não pode ser fechada em 2026.');
    const counts = s.h10?.partyStages || {};
    const active = Object.entries(counts).filter(([k, v]) => v > 0);
    if (!s.h10 || s.h10.partyTotal < 5) return inc('Poucos partidos no recorte', 'Não há partidos suficientes para comparar onde cada um perde mais.');
    if (active.length >= 2) {
      const detail = active.sort((a, b) => b[1] - a[1]).map(([k, v]) => `${BOTTLENECK_LABEL[k]}: ${v}`).join(' · ');
      const ufActive = ufStages && ufStages.counts
        ? Object.entries(ufStages.counts).filter(([k, v]) => v > 0).sort((a, b) => b[1] - a[1])
        : [];
      const ufDetail = ufActive.length >= 2
        ? ` Nas UFs: ${ufActive.map(([k, v]) => `${BOTTLENECK_LABEL[k]}: ${v}`).join(' · ')}.`
        : '';
      return leak('O vazamento não tem uma única etapa.', `Entre os partidos com amostra, a etapa crítica se divide — ${detail}.${ufDetail} A correção precisa ser desenhada por partido e por UF.`);
    }
    const stage = active[0]?.[0] || 'nenhuma';
    return ok(`A perda se concentra em uma etapa (${stage}).`, 'A heterogeneidade entre partidos é pequena neste recorte.');
  })();

  return { h1: v1, h2: v2, h3: v3, h4: v4, h5: v5, h6: v6, h7: v7, h8: v8, h9: v9, h10: v10 };
}

export function stageSummary(s) {
  const counts = { financiamento: 0, urna: 0, institucional: 0, integridade: 0 };
  for (const p of s.h10?.partyDiag || []) counts[p.dominant]++;
  const total = s.h10?.partyTotal || 1;
  const worst = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return { counts, total, worst: worst[0], worstShare: worst[1] / total };
}
