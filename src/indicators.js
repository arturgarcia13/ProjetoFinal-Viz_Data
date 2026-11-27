/**
 * Módulo auditável de indicadores e veredictos (H1–H9).
 * Sem dependências de DOM: executável em Node (testes) e no navegador.
 */

export function median(values) {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function quantile(values, q) {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const k = keyFn(item);
    let arr = map.get(k);
    if (!arr) {
      arr = [];
      map.set(k, arr);
    }
    arr.push(item);
  }
  return map;
}

function safeDiv(num, den) {
  return den > 0 ? num / den : 0;
}

/**
 * H1 — Piso (30%) vs. Teto Burocrático (30%–33%)
 * Compara chapas registradas vs. APTO; exclui gênero 'ND' do denominador e separa micro-chapas (n < 4).
 */
export function computeH1(candidates) {
  const validGender = candidates.filter((c) => c.g === 'F' || c.g === 'M');
  const regGroups = groupBy(validGender, (c) => c.slateKey || `${c.y}|${c.uf}|${c.cargo}|${c.chapa}`);

  const slates = [];
  let microSlatesReg = 0;
  let microCandsReg = 0;
  let microSlatesApto = 0;
  let microCandsApto = 0;
  let regCompliantTotal = 0;
  let droppedByInapto = 0;

  for (const [key, rows] of regGroups.entries()) {
    const sample = rows[0];
    const hasPrecomputed = Number.isFinite(sample.slateNReg) && sample.slateNReg > 0;
    const uf = sample.uf;
    const cargo = sample.cargo;
    const chapa = sample.chapa;
    const nReg = hasPrecomputed ? sample.slateNReg : rows.length;
    const fReg = hasPrecomputed ? sample.slateFReg : rows.filter((r) => r.g === 'F').length;
    const pctReg = hasPrecomputed ? sample.slatePctReg : fReg / nReg;

    const aptoRows = rows.filter((r) => r.apto);
    const nApto = hasPrecomputed ? sample.slateNApto : aptoRows.length;
    const fApto = hasPrecomputed ? sample.slateFApto : aptoRows.filter((r) => r.g === 'F').length;
    const pctApto = hasPrecomputed ? sample.slatePctApto : (nApto > 0 ? fApto / nApto : 0);

    if (nReg < 4) {
      microSlatesReg += 1;
      microCandsReg += nReg;
    } else if (pctReg >= 0.3) {
      regCompliantTotal += 1;
      if (nApto >= 4 && pctApto < 0.3) {
        droppedByInapto += 1;
      }
    }

    if (nApto > 0 && nApto < 4) {
      microSlatesApto += 1;
      microCandsApto += nApto;
    }

    if (nReg >= 4) {
      slates.push({
        key,
        uf,
        cargo,
        chapa,
        nReg,
        fReg,
        pctReg,
        nApto,
        fApto,
        pctApto,
      });
    }
  }

  const totalSlates = slates.length;
  const compliant = slates.filter((s) => s.pctReg >= 0.3).length;
  const floorBand = slates.filter((s) => s.pctReg >= 0.3 && s.pctReg <= 0.3334).length;
  const ge40 = slates.filter((s) => s.pctReg >= 0.4).length;
  const below30 = slates.filter((s) => s.pctReg < 0.3).length;

  const aptoSlates = slates.filter((s) => s.nApto >= 4);
  const aptoCompliant = aptoSlates.filter((s) => s.pctApto >= 0.3).length;
  const aptoFloorBand = aptoSlates.filter((s) => s.pctApto >= 0.3 && s.pctApto <= 0.3334).length;

  const pctCompliant = safeDiv(compliant, totalSlates);
  const pctFloorBand = safeDiv(floorBand, totalSlates);
  const pctGe40 = safeDiv(ge40, totalSlates);
  const pctAptoCompliant = safeDiv(aptoCompliant, aptoSlates.length);
  const pctDroppedByInapto = safeDiv(droppedByInapto, totalSlates);
  const pctDroppedAmongCompliant = safeDiv(droppedByInapto, compliant);

  let verdict;
  if (totalSlates < 10) {
    verdict = {
      status: 'inconclusivo',
      label: 'Inconclusivo',
      reason: `Amostra insuficiente no recorte (${totalSlates} chapas com n ≥ 4).`,
    };
  } else if (pctFloorBand >= 0.35 || pctCompliant < 0.85) {
    verdict = {
      status: 'vaza',
      label: 'Vaza nesta Etapa',
      reason: `${(pctFloorBand * 100).toFixed(1)}% das chapas acumulam-se entre 30% e 33,3% (teto operacional), e ${(pctCompliant * 100).toFixed(1)}% cumprem o piso no registro.`,
    };
  } else {
    verdict = {
      status: 'funcionou',
      label: 'A Cota Funciona',
      reason: `${(pctCompliant * 100).toFixed(1)}% cumprem o piso de 30% sem concentração excessiva na faixa 30%–33%.`,
    };
  }

  return {
    slates,
    totalSlates,
    compliant,
    floorBand,
    above40: ge40,
    ge40,
    below30,
    pctCompliant,
    pctFloorBand,
    pctAbove40: pctGe40,
    pctGe40,
    aptoSlatesCount: aptoSlates.length,
    pctAptoCompliant,
    pctAptoFloorBand: safeDiv(aptoFloorBand, aptoSlates.length),
    regCompliantTotal,
    droppedByInapto,
    pctDroppedByInapto,
    pctDroppedAmongCompliant,
    microSlatesReg,
    microCandsReg,
    microSlatesApto,
    microCandsApto,
    verdict,
  };
}

export const H1_MIRROR_BINS = [
  { id: '50+', label: '50%+', zone: 'above', status: 'Paridade / maioria feminina', test: (p) => p >= 50 },
  { id: '40-49', label: '40%–49%', zone: 'above', status: 'Acima da cota', test: (p) => p >= 40 && p < 50 },
  { id: '33-39', label: '33,4%–39%', zone: 'above', status: 'Acima do piso', test: (p) => p > 33.34 && p < 40 },
  { id: '30-33', label: '30%–33,3%', zone: 'floor', status: 'Limiar legal (teto operacional)', test: (p) => p >= 30 && p <= 33.34 },
  { id: 'lt30', label: '< 30%', zone: 'below', status: 'Irregular (abaixo da cota)', test: (p) => p < 30 },
];

/**
 * H1 (Comparativo Espelhado 2022 vs. 2026) — 5 faixas estratégicas sobre chapas (n >= 4),
 * calculando distribuição percentual e absoluta em dois universos limpos: Registradas e Aptas,
 * além de partidos por faixa (para visões coordenadas) e análise das chapas < 30%.
 */
export function computeH1Comparison(
  allCandidates,
  { cargo = 'all', uf = null, party = null, parties = null, ufs = null } = {},
) {
  const byYear = {};
  const slatePartiesByYear = { 2022: new Map(), 2026: new Map() };

  for (const yr of [2022, 2026]) {
    const subset = allCandidates.filter((c) => {
      if (c.y !== yr) return false;
      if (cargo && cargo !== 'all' && c.cargo !== cargo) return false;
      if (uf && c.uf !== uf) return false;
      if (party && c.p !== party) return false;
      if (parties && parties.size > 0 && !parties.has(c.p)) return false;
      if (ufs && ufs.size > 0 && !ufs.has(c.uf)) return false;
      return true;
    });
    for (const c of subset) {
      if (c.g !== 'F' && c.g !== 'M') continue;
      const sk = c.slateKey || `${c.y}|${c.uf}|${c.cargo}|${c.chapa}`;
      let set = slatePartiesByYear[yr].get(sk);
      if (!set) {
        set = new Set();
        slatePartiesByYear[yr].set(sk, set);
      }
      set.add(c.p);
    }
    byYear[yr] = computeH1(subset);
  }

  const collectParties = (yr, slates) => {
    const out = new Set();
    const map = slatePartiesByYear[yr];
    for (const s of slates) {
      const pSet = map.get(s.key);
      if (pSet) pSet.forEach((p) => out.add(p));
    }
    return [...out].sort();
  };

  const bins = H1_MIRROR_BINS.map((def) => {
    const entry = { id: def.id, label: def.label, zone: def.zone, status: def.status };
    const regPartiesUnion = new Set();
    const aptoPartiesUnion = new Set();
    for (const yr of [2022, 2026]) {
      const h1y = byYear[yr];
      const totalReg = h1y.totalSlates;
      const totalApto = h1y.aptoSlatesCount;
      const regSlates = h1y.slates.filter((s) => def.test(s.pctReg * 100));
      const aptoSlates = h1y.slates.filter((s) => s.nApto >= 4 && def.test(s.pctApto * 100));
      const regN = regSlates.length;
      const aptoN = aptoSlates.length;
      const regPct = safeDiv(regN, totalReg) * 100;
      const aptoPct = safeDiv(aptoN, totalApto) * 100;
      const pReg = collectParties(yr, regSlates);
      const pApto = collectParties(yr, aptoSlates);
      pReg.forEach((p) => regPartiesUnion.add(p));
      pApto.forEach((p) => aptoPartiesUnion.add(p));
      entry[`y${yr}`] = {
        regN,
        aptoN,
        regPct,
        aptoPct,
        totalReg,
        totalApto,
        partiesReg: pReg,
        partiesApto: pApto,
      };
    }
    entry.deltaRegPP = entry.y2026.regPct - entry.y2022.regPct;
    entry.deltaAptoPP = entry.y2026.aptoPct - entry.y2022.aptoPct;
    entry.deltaRegN = entry.y2026.regN - entry.y2022.regN;
    entry.deltaAptoN = entry.y2026.aptoN - entry.y2022.aptoN;
    entry.partiesUnion = {
      reg: [...regPartiesUnion].sort(),
      apto: [...aptoPartiesUnion].sort(),
    };
    return entry;
  });

  // Análise detalhada das chapas abaixo de 30% (2022 vs. 2026)
  const lt30ByYear = {};
  const lt30RegSets = {};
  const lt30AptoSets = {};
  const lt30PartyCounts = { 2022: new Map(), 2026: new Map() };

  for (const yr of [2022, 2026]) {
    const h1y = byYear[yr];
    const regLt30 = h1y.slates.filter((s) => s.pctReg < 0.3);
    const aptoLt30 = h1y.slates.filter((s) => s.nApto >= 4 && s.pctApto < 0.3);
    const nearFloorRegCount = regLt30.filter((s) => s.pctReg >= 0.25).length;

    const countByParty = (slates) => {
      const m = new Map();
      for (const s of slates) {
        const pSet = slatePartiesByYear[yr].get(s.key);
        if (!pSet) continue;
        for (const p of pSet) {
          m.set(p, (m.get(p) || 0) + 1);
        }
      }
      return [...m.entries()]
        .map(([partyCode, count]) => ({ party: partyCode, count }))
        .sort((a, b) => b.count - a.count || a.party.localeCompare(b.party));
    };

    const topReg = countByParty(regLt30);
    for (const item of topReg) lt30PartyCounts[yr].set(item.party, item.count);

    lt30RegSets[yr] = new Set(regLt30.map((s) => `${s.uf}|${s.cargo}|${s.chapa}`));
    lt30AptoSets[yr] = new Set(aptoLt30.map((s) => `${s.uf}|${s.cargo}|${s.chapa}`));

    const regPct = safeDiv(regLt30.length, h1y.totalSlates) * 100;
    const aptoPct = safeDiv(aptoLt30.length, h1y.aptoSlatesCount) * 100;
    lt30ByYear[yr] = {
      regCount: regLt30.length,
      regPct,
      aptoCount: aptoLt30.length,
      aptoPct,
      deltaRegToAptoPP: aptoPct - regPct,
      droppedByInapto: h1y.droppedByInapto,
      pctDroppedOfReg: h1y.pctDroppedByInapto * 100,
      nearFloorRegCount,
      topPartiesReg: topReg.slice(0, 6),
      topPartiesApto: countByParty(aptoLt30).slice(0, 6),
    };
  }

  let sameSlateRepeats = 0;
  for (const k of lt30RegSets[2022]) {
    if (lt30RegSets[2026].has(k)) sameSlateRepeats += 1;
  }
  let sameSlateAptoRepeats = 0;
  for (const k of lt30AptoSets[2022]) {
    if (lt30AptoSets[2026].has(k)) sameSlateAptoRepeats += 1;
  }

  const repeatPartiesReg = [];
  for (const [p, c22] of lt30PartyCounts[2022].entries()) {
    const c26 = lt30PartyCounts[2026].get(p);
    if (c26) repeatPartiesReg.push({ party: p, count2022: c22, count2026: c26 });
  }
  repeatPartiesReg.sort((a, b) => (b.count2022 + b.count2026) - (a.count2022 + a.count2026));

  return {
    bins,
    lt30Details: {
      byYear: lt30ByYear,
      sameSlateRepeats,
      sameSlateAptoRepeats,
      repeatPartiesReg,
    },
    byYear: {
      2022: {
        totalSlates: byYear[2022].totalSlates,
        aptoSlatesCount: byYear[2022].aptoSlatesCount,
        pctGe40: byYear[2022].pctGe40,
        pctAptoCompliant: byYear[2022].pctAptoCompliant,
        microSlatesReg: byYear[2022].microSlatesReg,
        microCandsReg: byYear[2022].microCandsReg,
        microSlatesApto: byYear[2022].microSlatesApto,
        microCandsApto: byYear[2022].microCandsApto,
        droppedByInapto: byYear[2022].droppedByInapto,
        pctDroppedByInapto: byYear[2022].pctDroppedByInapto,
      },
      2026: {
        totalSlates: byYear[2026].totalSlates,
        aptoSlatesCount: byYear[2026].aptoSlatesCount,
        pctGe40: byYear[2026].pctGe40,
        pctAptoCompliant: byYear[2026].pctAptoCompliant,
        microSlatesReg: byYear[2026].microSlatesReg,
        microCandsReg: byYear[2026].microCandsReg,
        microSlatesApto: byYear[2026].microSlatesApto,
        microCandsApto: byYear[2026].microCandsApto,
        droppedByInapto: byYear[2026].droppedByInapto,
        pctDroppedByInapto: byYear[2026].pctDroppedByInapto,
      },
    },
  };
}

/**
 * H2 — Receita mediana F vs. M por partido e fonte (Público vs. Privado)
 */
export function computeH2(candidates, coverageYear = null) {
  const apto = candidates.filter((c) => c.apto && (c.g === 'F' || c.g === 'M'));
  const withRec = apto.filter((c) => c.hasRec);
  const women = withRec.filter((c) => c.g === 'F');
  const men = withRec.filter((c) => c.g === 'M');

  const medF = median(women.map((c) => c.r));
  const medM = median(men.map((c) => c.r));
  const medPosF = median(women.filter((c) => c.r > 0).map((c) => c.r));
  const medPosM = median(men.filter((c) => c.r > 0).map((c) => c.r));

  const medPubF = median(women.map((c) => c.fefc + c.fp));
  const medPubM = median(men.map((c) => c.fefc + c.fp));
  const medPrivF = median(women.map((c) => c.prop + c.priv));
  const medPrivM = median(men.map((c) => c.prop + c.priv));

  const byPartyMap = groupBy(withRec, (c) => c.p);
  const byParty = [];
  for (const [party, rows] of byPartyMap.entries()) {
    const pf = rows.filter((c) => c.g === 'F');
    const pm = rows.filter((c) => c.g === 'M');
    if (pf.length < 5 || pm.length < 5) continue;
    const pMedF = median(pf.map((c) => c.r));
    const pMedM = median(pm.map((c) => c.r));
    byParty.push({
      party,
      total: rows.length,
      nF: pf.length,
      nM: pm.length,
      medF: pMedF,
      medM: pMedM,
      ratio: safeDiv(pMedF, pMedM),
      medPubF: median(pf.map((c) => c.fefc + c.fp)),
      medPubM: median(pm.map((c) => c.fefc + c.fp)),
      medPrivF: median(pf.map((c) => c.prop + c.priv)),
      medPrivM: median(pm.map((c) => c.prop + c.priv)),
    });
  }
  byParty.sort((a, b) => b.total - a.total);

  const sources = ['F', 'M'].map((g) => {
    const grp = g === 'F' ? women : men;
    const tot = grp.reduce((s, c) => s + c.r, 0);
    const fefc = grp.reduce((s, c) => s + c.fefc, 0);
    const fp = grp.reduce((s, c) => s + c.fp, 0);
    const prop = grp.reduce((s, c) => s + c.prop, 0);
    const priv = grp.reduce((s, c) => s + c.priv, 0);
    return {
      g,
      total: tot,
      fefc,
      fp,
      prop,
      priv,
      pctFefc: safeDiv(fefc, tot),
      pctFp: safeDiv(fp, tot),
      pctProp: safeDiv(prop, tot),
      pctPriv: safeDiv(priv, tot),
    };
  });

  const finalRate = apto.length > 0
    ? safeDiv(apto.filter((c) => c.tpConta === 'FINAL').length, apto.length)
    : (coverageYear ? safeDiv(coverageYear.tp_prestacao_apto?.FINAL || 0, coverageYear.population?.apto_cands || 1) : 0);

  const medRatio = safeDiv(medF, medM);
  const privRatio = safeDiv(medPrivF, medPrivM);
  const topPartiesBelow = byParty.slice(0, 10).filter((p) => p.ratio < 0.95).length;

  let verdict;
  if (women.length < 20 || men.length < 20 || finalRate < 0.7) {
    verdict = {
      status: 'inconclusivo',
      label: 'Inconclusivo',
      reason: `Cobertura ou amostra insuficiente (FINAL: ${(finalRate * 100).toFixed(1)}%, F=${women.length}, M=${men.length}).`,
    };
  } else if (privRatio < 0.6 || topPartiesBelow >= 5 || medRatio < 0.85) {
    verdict = {
      status: 'vaza',
      label: 'Vaza nesta Etapa',
      reason: `No recurso privado/próprio a mediana feminina é ${(privRatio * 100).toFixed(1)}% da masculina, e em ${topPartiesBelow} dos 10 maiores partidos mulheres têm mediana menor (público: ${(safeDiv(medPubF, medPubM) * 100).toFixed(1)}%).`,
    };
  } else {
    verdict = {
      status: 'funcionou',
      label: 'A Cota Funciona',
      reason: `Mediana feminina atinge ${(medRatio * 100).toFixed(1)}% da masculina no geral e ${(privRatio * 100).toFixed(1)}% no privado.`,
    };
  }

  return {
    nAptoF: apto.filter((c) => c.g === 'F').length,
    nAptoM: apto.filter((c) => c.g === 'M').length,
    nRecF: women.length,
    nRecM: men.length,
    medF,
    medM,
    medPosF,
    medPosM,
    medRatio,
    medPubF,
    medPubM,
    medPrivF,
    medPrivM,
    byParty,
    sources,
    finalRate,
    verdict,
  };
}

/**
 * H3 — % de candidatas × % do Fundo Público (FEFC + FP) por partido
 */
export function computeH3(candidates, coverageYear = null) {
  const apto = candidates.filter((c) => c.apto && (c.g === 'F' || c.g === 'M'));
  const nF = apto.filter((c) => c.g === 'F').length;
  const nM = apto.filter((c) => c.g === 'M').length;
  const pctCandF = safeDiv(nF, nF + nM);

  const pubF = apto.filter((c) => c.g === 'F').reduce((s, c) => s + c.fefc + c.fp, 0);
  const pubTotal = apto.reduce((s, c) => s + c.fefc + c.fp, 0);
  const pctPubF = safeDiv(pubF, pubTotal);
  const equityRatio = safeDiv(pctPubF, pctCandF);

  const byPartyMap = groupBy(apto, (c) => c.p);
  const parties = [];
  for (const [party, rows] of byPartyMap.entries()) {
    if (rows.length < 10) continue;
    const pPubTotal = rows.reduce((s, c) => s + c.fefc + c.fp, 0);
    if (pPubTotal <= 0) continue;
    const pF = rows.filter((c) => c.g === 'F').length;
    const pPubF = rows.filter((c) => c.g === 'F').reduce((s, c) => s + c.fefc + c.fp, 0);
    const x = pF / rows.length;
    const y = pPubF / pPubTotal;
    parties.push({
      party,
      n: rows.length,
      nF: pF,
      pctCandF: x,
      pctPubF: y,
      pubTotal: pPubTotal,
      pubF: pPubF,
      gap: y - x,
      deficitBrl: (y - x) * pPubTotal,
      ratio: safeDiv(y, x),
    });
  }
  parties.sort((a, b) => b.pubTotal - a.pubTotal);
  const totalDeficitBrl = parties
    .filter((p) => p.deficitBrl < 0)
    .reduce((s, p) => s + p.deficitBrl, 0);
  const subfinancedCount = parties.filter((p) => p.deficitBrl < 0).length;

  const above30Cand = parties.filter((p) => p.pctCandF >= 0.33);
  const lockedBelow33 = above30Cand.filter((p) => p.pctPubF < p.pctCandF).length;
  const finalRate = apto.length > 0
    ? safeDiv(apto.filter((c) => c.tpConta === 'FINAL').length, apto.length)
    : (coverageYear ? safeDiv(coverageYear.tp_prestacao_apto?.FINAL || 0, coverageYear.population?.apto_cands || 1) : 0);

  let verdict;
  if (pubTotal <= 0 || parties.length < 5 || finalRate < 0.7) {
    verdict = {
      status: 'inconclusivo',
      label: 'Inconclusivo',
      reason: `Dados de fundo público ou amostra insuficientes (partidos=${parties.length}, FINAL=${(finalRate * 100).toFixed(1)}%).`,
    };
  } else if (equityRatio < 0.9 || safeDiv(lockedBelow33, above30Cand.length) > 0.5) {
    verdict = {
      status: 'vaza',
      label: 'Vaza nesta Etapa',
      reason: `Mulheres são ${(pctCandF * 100).toFixed(1)}% das candidaturas APTO, mas recebem ${(pctPubF * 100).toFixed(1)}% do Fundo Público (razão ${equityRatio.toFixed(2)}×).`,
    };
  } else {
    verdict = {
      status: 'funcionou',
      label: 'A Cota Funciona',
      reason: `Repasse do Fundo Público acompanha a presença feminina (razão ${equityRatio.toFixed(2)}×).`,
    };
  }

  return {
    nF,
    nM,
    pctCandF,
    pubF,
    pubTotal,
    pctPubF,
    equityRatio,
    totalDeficitBrl,
    subfinancedCount,
    parties,
    verdict,
  };
}

/**
 * H4 — Fluxo da Verba Pública (Sankey proporcional por fonte pública)
 */
export function computeH4(candidates) {
  const aptoAll = candidates.filter((c) => c.apto && (c.g === 'F' || c.g === 'M'));
  const nF = aptoAll.filter((c) => c.g === 'F').length;
  const nM = aptoAll.filter((c) => c.g === 'M').length;
  const finalRate = safeDiv(aptoAll.filter((c) => c.tpConta === 'FINAL').length, aptoAll.length);
  const apto = aptoAll.filter((c) => c.e > 0);
  const byGender = { F: { pubFlow: 0, excl: 0, shared: 0, party: 0, candM: 0, candFOther: 0 }, M: { pubFlow: 0, excl: 0, shared: 0, party: 0, candM: 0, candFOther: 0 } };

  for (const c of apto) {
    const pubShare = c.r > 0 ? Math.min(1, (c.fefc + c.fp) / c.r) : 0;
    if (pubShare <= 0) continue;
    const acc = byGender[c.g];
    acc.pubFlow += c.e * pubShare;
    acc.excl += c.toExcl * pubShare;
    acc.shared += c.toShared * pubShare;
    acc.party += c.toParty * pubShare;
    acc.candM += c.toCandM * pubShare;
    acc.candFOther += (c.toCandF + c.toCandU) * pubShare;
  }

  const directDivF = safeDiv(byGender.F.party + byGender.F.candM, byGender.F.pubFlow);
  const directDivM = safeDiv(byGender.M.party + byGender.M.candM, byGender.M.pubFlow);
  const sharedF = safeDiv(byGender.F.shared, byGender.F.pubFlow);
  const sharedM = safeDiv(byGender.M.shared, byGender.M.pubFlow);

  let verdict;
  if (nF < 20 || nM < 20 || byGender.F.pubFlow <= 0 || byGender.M.pubFlow <= 0 || finalRate < 0.7) {
    verdict = {
      status: 'inconclusivo',
      label: 'Inconclusivo',
      reason: `Amostra ou cobertura FINAL insuficiente para fluxos (F=${nF}, M=${nM}, FINAL=${(finalRate * 100).toFixed(1)}%).`,
    };
  } else if ((directDivF - directDivM > 0.02) || (sharedF - sharedM > 0.03)) {
    verdict = {
      status: 'vaza',
      label: 'Vaza nesta Etapa',
      reason: `Repasses a partidos/homens (${(directDivF * 100).toFixed(2)}%) ou fornecedores compartilhados (${(sharedF * 100).toFixed(1)}%) superam o padrão masculino.`,
    };
  } else {
    verdict = {
      status: 'funcionou',
      label: 'A Cota Funciona',
      reason: `No agregado, repasses diretos a partidos/homens (${(directDivF * 100).toFixed(2)}% F vs. ${(directDivM * 100).toFixed(2)}% M) e fornecedores compartilhados (${(sharedF * 100).toFixed(1)}% F vs. ${(sharedM * 100).toFixed(1)}% M) não superam os homens; focos pontuais aparecem na rede de hubs.`,
    };
  }

  return {
    byGender,
    diversionShareF: directDivF,
    diversionShareM: directDivM,
    sharedShareF: sharedF,
    sharedShareM: sharedM,
    verdict,
  };
}

/**
 * H5 — Conversão em 3 etapas (% Candidatas → % Votos Nominais → % Eleitas)
 */
export function computeH5(candidates, { selectedParty = '' } = {}) {
  const apto = candidates.filter((c) => c.apto && (c.g === 'F' || c.g === 'M'));
  const nF = apto.filter((c) => c.g === 'F').length;
  const nM = apto.filter((c) => c.g === 'M').length;
  const vF = apto.filter((c) => c.g === 'F').reduce((s, c) => s + c.v, 0);
  const vM = apto.filter((c) => c.g === 'M').reduce((s, c) => s + c.v, 0);
  const elF = apto.filter((c) => c.g === 'F' && c.el).length;
  const elM = apto.filter((c) => c.g === 'M' && c.el).length;

  const pctCandF = safeDiv(nF, nF + nM);
  const pctVotosF = safeDiv(vF, vF + vM);
  const pctEleitasF = safeDiv(elF, elF + elM);
  const conversionRatio = safeDiv(pctEleitasF, pctCandF);
  const dropUrna = pctVotosF - pctCandF;
  const dropCadeira = pctEleitasF - pctVotosF;

  const byPartyMap = groupBy(apto, (c) => c.p);
  const allEligible = [];
  for (const [party, rows] of byPartyMap.entries()) {
    const pElF = rows.filter((c) => c.g === 'F' && c.el).length;
    const pElM = rows.filter((c) => c.g === 'M' && c.el).length;
    const pElTotal = pElF + pElM;
    if (rows.length < 15 || pElTotal < 1) continue;
    const pF = rows.filter((c) => c.g === 'F').length;
    const pVF = rows.filter((c) => c.g === 'F').reduce((s, c) => s + c.v, 0);
    const pVTot = rows.reduce((s, c) => s + c.v, 0);
    const pCandF = pF / rows.length;
    const pVotosF = safeDiv(pVF, pVTot);
    const pEleitasF = pElF / pElTotal;
    allEligible.push({
      party,
      nTotal: rows.length,
      nF: pF,
      elTotal: pElTotal,
      elF: pElF,
      pctCandF: pCandF,
      pctVotosF: pVotosF,
      pctEleitasF: pEleitasF,
      dropUrna: pVotosF - pCandF,
      dropCadeira: pEleitasF - pVotosF,
    });
  }
  allEligible.sort((a, b) => b.elTotal - a.elTotal || b.nTotal - a.nTotal);
  const byParty = allEligible.slice(0, 10);
  if (selectedParty && !byParty.some((p) => p.party === selectedParty)) {
    const extra = allEligible.find((p) => p.party === selectedParty);
    if (extra) byParty.push(extra);
  }
  byParty.sort((a, b) => b.pctEleitasF - a.pctEleitasF || b.pctVotosF - a.pctVotosF || b.elTotal - a.elTotal);

  let verdict;
  if (elF + elM < 5) {
    verdict = {
      status: 'inconclusivo',
      label: 'Inconclusivo',
      reason: `Menos de 5 cadeiras eleitas no recorte (${elF + elM}).`,
    };
  } else if (conversionRatio < 0.75) {
    verdict = {
      status: 'vaza',
      label: 'Vaza nesta Etapa',
      reason: `Mulheres são ${(pctCandF * 100).toFixed(1)}% das candidaturas, caem para ${(pctVotosF * 100).toFixed(1)}% dos votos e ficam com ${(pctEleitasF * 100).toFixed(1)}% das cadeiras (conversão ${conversionRatio.toFixed(2)}×).`,
    };
  } else {
    verdict = {
      status: 'funcionou',
      label: 'A Cota Funciona',
      reason: `Taxa de eleição feminina acompanha a presença nas chapas (conversão ${conversionRatio.toFixed(2)}×).`,
    };
  }

  return {
    nF,
    nM,
    vF,
    vM,
    elF,
    elM,
    pctCandF,
    pctVotosF,
    pctEleitasF,
    conversionRatio,
    dropUrna,
    dropCadeira,
    byParty,
    verdict,
  };
}

export function countSignals(c, voteThreshold = 10) {
  const sigA = c.v <= voteThreshold;
  const sigB = Boolean(c.zeroFin);
  const sigC = Boolean(c.stdPkg);
  return {
    sigA,
    sigB,
    sigC,
    total: (sigA ? 1 : 0) + (sigB ? 1 : 0) + (sigC ? 1 : 0),
  };
}

/**
 * H6 — Sinais acumulados (Sinal A: voto baixo, Sinal B: conta zerada, Sinal C: pacote padronizado)
 * Nota: 3º critério da Súmula 73 (ausência de atos de campanha) não está nos arquivos do TSE.
 */
export function computeH6(candidates, { voteThreshold = 10, coverageYear = null } = {}) {
  const apto = candidates.filter((c) => c.apto && (c.g === 'F' || c.g === 'M'));
  const summary = {
    F: { n: 0, bins: [0, 0, 0, 0], twoPlus: 0, three: 0, sigA: 0, sigB: 0, sigC: 0 },
    M: { n: 0, bins: [0, 0, 0, 0], twoPlus: 0, three: 0, sigA: 0, sigB: 0, sigC: 0 },
  };

  for (const c of apto) {
    const s = countSignals(c, voteThreshold);
    const acc = summary[c.g];
    acc.n += 1;
    acc.bins[s.total] += 1;
    if (s.total >= 2) acc.twoPlus += 1;
    if (s.total === 3) acc.three += 1;
    if (s.sigA) acc.sigA += 1;
    if (s.sigB) acc.sigB += 1;
    if (s.sigC) acc.sigC += 1;
  }

  const pct2PlusF = safeDiv(summary.F.twoPlus, summary.F.n);
  const pct2PlusM = safeDiv(summary.M.twoPlus, summary.M.n);
  const ratio2Plus = safeDiv(pct2PlusF, pct2PlusM);

  const finalRate = apto.length > 0
    ? safeDiv(apto.filter((c) => c.tpConta === 'FINAL').length, apto.length)
    : (coverageYear ? safeDiv(coverageYear.tp_prestacao_apto?.FINAL || 0, coverageYear.population?.apto_cands || 1) : 0);

  let verdict;
  if (summary.F.n < 20 || summary.M.n < 20 || finalRate < 0.7) {
    verdict = {
      status: 'inconclusivo',
      label: 'Inconclusivo',
      reason: `Amostra ou cobertura insuficiente para sinais contábeis (FINAL: ${(finalRate * 100).toFixed(1)}%).`,
    };
  } else if (pct2PlusF > pct2PlusM * 1.25 && pct2PlusF - pct2PlusM > 0.01) {
    verdict = {
      status: 'vaza',
      label: 'Vaza nesta Etapa',
      reason: `${(pct2PlusF * 100).toFixed(1)}% das candidatas têm ≥2 sinais de alerta vs. ${(pct2PlusM * 100).toFixed(1)}% dos homens (${ratio2Plus.toFixed(2)}×; limiar A ≤ ${voteThreshold} votos).`,
    };
  } else {
    verdict = {
      status: 'funcionou',
      label: 'A Cota Funciona',
      reason: `Taxa de ≥2 sinais entre mulheres (${(pct2PlusF * 100).toFixed(1)}%) não excede significativamente a masculina (${(pct2PlusM * 100).toFixed(1)}%).`,
    };
  }

  return {
    voteThreshold,
    summary,
    pct2PlusF,
    pct2PlusM,
    ratio2Plus,
    finalRate,
    verdict,
  };
}

/**
 * H7 — Faixas de % de mulheres na chapa × taxa de sinais de alerta (Boxplot) + Mapa por UF
 */
export function computeH7(candidates, { voteThreshold = 10, coverageYear = null } = {}) {
  const validGender = candidates.filter((c) => c.g === 'F' || c.g === 'M');
  const slateMap = groupBy(validGender, (c) => c.slateKey || `${c.y}|${c.uf}|${c.cargo}|${c.chapa}`);

  const BANDS = [
    { key: '< 30%', test: (p) => p < 0.3 },
    { key: '30%–33,3%', test: (p) => p >= 0.3 && p <= 0.3334 },
    { key: '33,3%–40%', test: (p) => p > 0.3334 && p <= 0.4 },
    { key: '> 40%', test: (p) => p > 0.4 },
  ];

  const slatePoints = [];
  const ufMap = new Map();

  for (const [key, rows] of slateMap.entries()) {
    const sample = rows[0];
    const uf = sample.uf;
    const hasPrecomputed = Number.isFinite(sample.slateNReg) && sample.slateNReg > 0;
    const nReg = hasPrecomputed ? sample.slateNReg : rows.length;
    const pctReg = hasPrecomputed ? sample.slatePctReg : rows.filter((r) => r.g === 'F').length / rows.length;

    const aptoF = rows.filter((r) => r.apto && r.g === 'F');
    if (aptoF.length > 0) {
      let u = ufMap.get(uf);
      if (!u) {
        u = { uf, nF: 0, twoPlusF: 0, finalF: 0 };
        ufMap.set(uf, u);
      }
      for (const c of aptoF) {
        u.nF += 1;
        if (c.tpConta === 'FINAL') u.finalF += 1;
        if (countSignals(c, voteThreshold).total >= 2) u.twoPlusF += 1;
      }
    }

    if (nReg < 4 || aptoF.length === 0) continue;
    const bandObj = BANDS.find((b) => b.test(pctReg));
    const twoPlusCount = aptoF.filter((c) => countSignals(c, voteThreshold).total >= 2).length;
    slatePoints.push({
      key,
      uf,
      band: bandObj.key,
      pctReg,
      nF: aptoF.length,
      twoPlusCount,
      rate: twoPlusCount / aptoF.length,
    });
  }

  const bandStats = BANDS.map((b) => {
    const pts = slatePoints.filter((p) => p.band === b.key);
    const totalF = pts.reduce((s, p) => s + p.nF, 0);
    const total2 = pts.reduce((s, p) => s + p.twoPlusCount, 0);
    return {
      band: b.key,
      slatesCount: pts.length,
      nF: totalF,
      twoPlusCount: total2,
      aggRate: safeDiv(total2, totalF),
      medianRate: median(pts.map((p) => p.rate)),
    };
  });

  const byUf = [...ufMap.values()].map((u) => {
    const ufFinalRate = safeDiv(u.finalF, u.nF);
    return {
      ...u,
      finalRate: ufFinalRate,
      rate: safeDiv(u.twoPlusF, u.nF),
      inconclusive: u.nF < 10 || ufFinalRate < 0.7,
    };
  });

  const bandFloor = bandStats.find((b) => b.band === '30%–33,3%');
  const bandHigh = bandStats.find((b) => b.band === '> 40%');
  const aptoAll = validGender.filter((c) => c.apto);
  const finalRate = aptoAll.length > 0
    ? safeDiv(aptoAll.filter((c) => c.tpConta === 'FINAL').length, aptoAll.length)
    : (coverageYear ? safeDiv(coverageYear.tp_prestacao_apto?.FINAL || 0, coverageYear.population?.apto_cands || 1) : 0);

  let verdict;
  if (slatePoints.length < 10 || finalRate < 0.7) {
    verdict = {
      status: 'inconclusivo',
      label: 'Inconclusivo',
      reason: `Amostra ou entrega FINAL insuficiente no recorte (${slatePoints.length} chapas n ≥ 4; FINAL ${(finalRate * 100).toFixed(1)}%).`,
    };
  } else if (bandFloor && bandHigh && bandFloor.aggRate > bandHigh.aggRate * 1.15) {
    verdict = {
      status: 'vaza',
      label: 'Vaza nesta Etapa',
      reason: `Chapas no piso (30%–33,3%) registram ${(bandFloor.aggRate * 100).toFixed(1)}% das mulheres com ≥2 sinais vs. ${(bandHigh.aggRate * 100).toFixed(1)}% nas chapas >40%.`,
    };
  } else {
    verdict = {
      status: 'funcionou',
      label: 'A Cota Funciona',
      reason: `Taxa de sinais nas chapas 30%–33,3% (${((bandFloor?.aggRate || 0) * 100).toFixed(1)}%) não supera chapas >40% (${((bandHigh?.aggRate || 0) * 100).toFixed(1)}%).`,
    };
  }

  return {
    bandOrder: BANDS.map((b) => b.key),
    slatePoints,
    bandStats,
    byUf,
    verdict,
  };
}

/**
 * H8 — Comparativo Temporal 2018 → 2022 → 2026 (Contas zeradas brutas vs. Movimentações padronizadas em lote)
 */
export function computeH8(allCandidates, { cargo = 'all', uf = null, party = null, parties = null, ufs = null, voteThreshold = 10 } = {}) {
  const rows = [];
  const byYear = {};

  for (const yr of [2018, 2022, 2026]) {
    const subset = allCandidates.filter((c) => {
      if (c.y !== yr) return false;
      if (cargo && cargo !== 'all' && c.cargo !== cargo) return false;
      if (uf && c.uf !== uf) return false;
      if (party && c.p !== party) return false;
      if (parties && parties.size > 0 && !parties.has(c.p)) return false;
      if (ufs && ufs.size > 0 && !ufs.has(c.uf)) return false;
      return c.apto && c.g === 'F';
    });

    const n = subset.length;
    const zeroCount = subset.filter((c) => c.zeroFin).length;
    const stdCount = subset.filter((c) => c.stdPkg).length;
    const classicCount = subset.filter((c) => c.zeroFin && c.v <= voteThreshold).length;
    const adaptedCount = subset.filter((c) => c.stdPkg && c.v <= voteThreshold).length;
    const finalCount = subset.filter((c) => c.tpConta === 'FINAL').length;

    byYear[yr] = {
      year: yr,
      n,
      finalRate: safeDiv(finalCount, n),
      pctZero: safeDiv(zeroCount, n),
      pctStd: safeDiv(stdCount, n),
      pctClassic: safeDiv(classicCount, n),
      pctAdapted: safeDiv(adaptedCount, n),
      zeroCount,
      stdCount,
      classicCount,
      adaptedCount,
    };

    rows.push(
      { year: String(yr), metric: 'Conta zerada (Sinal B)', pct: safeDiv(zeroCount, n) * 100, count: zeroCount, n },
      { year: String(yr), metric: 'Mov. padronizada em lote (Sinal C)', pct: safeDiv(stdCount, n) * 100, count: stdCount, n },
      { year: String(yr), metric: `Zerada + ≤${voteThreshold} votos`, pct: safeDiv(classicCount, n) * 100, count: classicCount, n },
      { year: String(yr), metric: `Padronizada + ≤${voteThreshold} votos`, pct: safeDiv(adaptedCount, n) * 100, count: adaptedCount, n },
    );
  }

  const y18 = byYear[2018];
  const y22 = byYear[2022];
  const y26 = byYear[2026];
  let verdict;
  if (y22.n < 20 || y26.n < 20 || y26.finalRate < 0.7) {
    verdict = {
      status: 'inconclusivo',
      label: 'Inconclusivo',
      reason: `Amostra ou entrega FINAL insuficiente para comparar 2022 (n=${y22.n}) vs. 2026 (n=${y26.n}, FINAL=${(y26.finalRate * 100).toFixed(1)}%).`,
    };
  } else if (y26.pctZero < y22.pctZero && y26.pctStd > y22.pctStd) {
    verdict = {
      status: 'vaza',
      label: 'Vaza nesta Etapa',
      reason: `De 2018 a 2026, contas zeradas caíram (${(y18.pctZero * 100).toFixed(1)}% → ${(y22.pctZero * 100).toFixed(1)}% → ${(y26.pctZero * 100).toFixed(1)}%), mas lotes padronizados subiram (${(y18.pctStd * 100).toFixed(1)}% → ${(y22.pctStd * 100).toFixed(1)}% → ${(y26.pctStd * 100).toFixed(1)}%).`,
    };
  } else if (y26.pctStd > 0.05 || y26.pctZero > 0.05) {
    verdict = {
      status: 'vaza',
      label: 'Vaza nesta Etapa',
      reason: `Em 2026 permanecem ${(y26.pctZero * 100).toFixed(1)}% zeradas e ${(y26.pctStd * 100).toFixed(1)}% com pacote padronizado (2018: ${(y18.pctZero * 100).toFixed(1)}% e ${(y18.pctStd * 100).toFixed(1)}%).`,
    };
  } else {
    verdict = {
      status: 'funcionou',
      label: 'A Cota Funciona',
      reason: `Redução simultânea de contas zeradas e padronizadas entre 2018 e 2026.`,
    };
  }

  return { byYear, rows, verdict };
}

/**
 * H9 & Coordenadas Paralelas — Diagnóstico da Etapa Crítica por UF e 5 eixos por Partido/UF
 */
export function computeH9AndParallel(candidates, { voteThreshold = 10 } = {}) {
  const STAGES = ['Papel', 'Dinheiro', 'Urna (Votos)', 'Urna (Cadeiras)', 'Integridade'];

  function scoreGroup(label, rows) {
    const validG = rows.filter((c) => c.g === 'F' || c.g === 'M');
    const regF = validG.filter((c) => c.g === 'F').length;
    const pctRegF = safeDiv(regF, validG.length);

    const apto = validG.filter((c) => c.apto);
    const nF = apto.filter((c) => c.g === 'F').length;
    const nM = apto.filter((c) => c.g === 'M').length;
    const pctCandF = safeDiv(nF, nF + nM);
    const finalRate = safeDiv(apto.filter((c) => c.tpConta === 'FINAL').length, apto.length);

    const pubF = apto.filter((c) => c.g === 'F').reduce((s, c) => s + c.fefc + c.fp, 0);
    const pubTot = apto.reduce((s, c) => s + c.fefc + c.fp, 0);
    const eqFefc = pctCandF > 0 && pubTot > 0 && finalRate >= 0.7 ? safeDiv(pubF / pubTot, pctCandF) : null;

    const vF = apto.filter((c) => c.g === 'F').reduce((s, c) => s + c.v, 0);
    const vTot = apto.reduce((s, c) => s + c.v, 0);
    const pctVotosF = safeDiv(vF, vTot);
    const rendUrna = pctCandF > 0 && vTot > 0 ? safeDiv(pctVotosF, pctCandF) : null;

    const elF = apto.filter((c) => c.g === 'F' && c.el).length;
    const elTot = apto.filter((c) => c.el).length;
    // Razão de passo Votos → Cadeiras (evita dupla contagem da perda já ocorrida na urna)
    const sucParl = pctVotosF > 0 && elTot >= 2 ? safeDiv(elF / elTot, pctVotosF) : null;

    const fWith2 = apto.filter((c) => c.g === 'F' && countSignals(c, voteThreshold).total >= 2).length;
    const integrity = nF >= 5 && finalRate >= 0.7 ? 1 - fWith2 / nF : null;

    // Score relativo de retenção por etapa (1.0 = paridade/cumprimento ideal; < 1.0 = perda)
    const papelRatio = pctRegF / 0.3;
    const candidatesStages = [
      { stage: 'Papel', val: validG.length >= 10 ? papelRatio : null },
      { stage: 'Dinheiro', val: eqFefc },
      { stage: 'Urna (Votos)', val: rendUrna },
      { stage: 'Urna (Cadeiras)', val: sucParl },
      { stage: 'Integridade', val: integrity },
    ];

    const available = candidatesStages.filter((s) => s.val !== null);
    let bottleneck = 'Inconclusivo';
    if (apto.length >= 10 && finalRate >= 0.7 && available.length >= 3) {
      available.sort((a, b) => a.val - b.val);
      bottleneck = available[0].val < 0.95 ? available[0].stage : 'Sem Vazamento Crítico';
    }

    return {
      key: label,
      nTotal: validG.length,
      nApto: apto.length,
      nF,
      elTot,
      finalRate,
      inclusaoPct: pctRegF * 100,
      eqFefc: eqFefc ?? 0,
      rendUrna: rendUrna ?? 0,
      sucParl: sucParl ?? 0,
      integridadePct: (integrity ?? 0) * 100,
      bottleneck,
      inconclusive: bottleneck === 'Inconclusivo',
    };
  }

  const byUfMap = groupBy(candidates, (c) => c.uf);
  const ufRows = [...byUfMap.entries()].map(([uf, rows]) => scoreGroup(uf, rows));

  const byPartyMap = groupBy(candidates, (c) => c.p);
  const partyRows = [...byPartyMap.entries()]
    .filter(([, rows]) => rows.length >= 25)
    .map(([party, rows]) => scoreGroup(party, rows))
    .sort((a, b) => b.nApto - a.nApto)
    .slice(0, 20);

  const stageCounts = {};
  for (const u of ufRows) {
    stageCounts[u.bottleneck] = (stageCounts[u.bottleneck] || 0) + 1;
  }

  const validUfs = ufRows.filter((u) => !u.inconclusive);
  const distinctBottlenecks = new Set(validUfs.map((u) => u.bottleneck)).size;

  const verdict = validUfs.length < 5
    ? { status: 'inconclusivo', label: 'Inconclusivo', reason: `Poucas UFs com amostra suficiente (${validUfs.length}).` }
    : {
        status: 'vaza',
        label: distinctBottlenecks > 1 ? 'Vaza por Etapas Distintas' : 'Vaza nesta Etapa',
        reason: `Entre ${validUfs.length} UFs analisadas, o gargalo crítico varia regionalmente (${Object.entries(stageCounts).map(([k, v]) => `${k}: ${v}`).join(' · ')}).`,
      };

  return {
    stages: STAGES,
    ufRows,
    partyRows,
    stageCounts,
    verdict,
  };
}

/**
 * H2 (Evolução 2022 → 2026) — Diferença sinalizada em Reais entre a mediana feminina e masculina (Δ = Mediana F − Mediana M)
 * Ordenada do maior déficit feminino em 2026 no topo para o maior superávit feminino na base.
 */
export function computeH2GapEvolution(
  allCandidates,
  { cargo = 'all', uf = null, parties = null, selectedParty = '', limit = 12 } = {},
) {
  const filterYear = (yr) => allCandidates.filter((c) => {
    if (c.y !== yr) return false;
    if (cargo && cargo !== 'all' && c.cargo !== cargo) return false;
    if (uf && c.uf !== uf) return false;
    if (parties && parties.size > 0 && !parties.has(c.p)) return false;
    return true;
  });

  const h2_22 = computeH2(filterYear(2022));
  const h2_26 = computeH2(filterYear(2026));
  const map22 = new Map(h2_22.byParty.map((p) => [p.party, p]));

  const top26 = h2_26.byParty.slice(0, limit);
  if (selectedParty && !top26.some((p) => p.party === selectedParty)) {
    const extra = h2_26.byParty.find((p) => p.party === selectedParty);
    if (extra) top26.push(extra);
  }

  const rows = top26.map((p26) => {
    const p22 = map22.get(p26.party) || null;
    const gap2022 = p22 ? p22.medF - p22.medM : null;
    const gap2026 = p26.medF - p26.medM;
    const deltaGap = gap2022 !== null ? gap2026 - gap2022 : null;
    return {
      party: p26.party,
      total2026: p26.total,
      nF2026: p26.nF,
      nM2026: p26.nM,
      nF2022: p22?.nF ?? 0,
      nM2022: p22?.nM ?? 0,
      medF2022: p22?.medF ?? null,
      medM2022: p22?.medM ?? null,
      medF2026: p26.medF,
      medM2026: p26.medM,
      gap2022,
      gap2026,
      deltaGap,
      womenAhead2026: gap2026 > 0,
    };
  });

  rows.sort((a, b) => a.gap2026 - b.gap2026 || b.total2026 - a.total2026);

  const globalGap2022 = h2_22.medF - h2_22.medM;
  const globalGap2026 = h2_26.medF - h2_26.medM;
  const deficitParties2026 = rows.filter((r) => r.gap2026 < 0).length;

  let verdict;
  if (rows.length < 3) {
    verdict = {
      status: 'inconclusivo',
      label: 'Inconclusivo',
      reason: `Amostra insuficiente para comparar evolução por partido (${rows.length} partidos).`,
    };
  } else if (deficitParties2026 >= Math.ceil(rows.length * 0.5)) {
    verdict = {
      status: 'vaza',
      label: 'Vaza nesta Etapa',
      reason: `Em 2026, ${deficitParties2026} de ${rows.length} maiores partidos têm mediana feminina menor que a masculina (ex.: PL ${((rows[0]?.gap2026 || 0) / 1000).toFixed(0)} mil).`,
    };
  } else {
    verdict = {
      status: 'funcionou',
      label: 'A Cota Funciona',
      reason: `Maioria dos partidos exibe mediana feminina igual ou superior à masculina em 2026.`,
    };
  }

  return {
    rows,
    globalGap2022,
    globalGap2026,
    h2_22,
    h2_26,
    deficitParties2026,
    verdict,
  };
}

/**
 * H2B — Comparativo direto Fundo Público vs. Recurso Privado/Próprio em Reais (Δ = Mediana F − Mediana M) + fontes 100%.
 */
export function computeH2PublicVsPrivate(h2Data, { selectedParty = '', limit = 12 } = {}) {
  const byParty = h2Data?.byParty || [];
  const selectedList = byParty.slice(0, limit);
  if (selectedParty && !selectedList.some((p) => p.party === selectedParty)) {
    const extra = byParty.find((p) => p.party === selectedParty);
    if (extra) selectedList.push(extra);
  }

  const rows = selectedList.map((p) => ({
    party: p.party,
    total: p.total,
    nF: p.nF,
    nM: p.nM,
    medPubF: p.medPubF,
    medPubM: p.medPubM,
    pubGap: p.medPubF - p.medPubM,
    medPrivF: p.medPrivF,
    medPrivM: p.medPrivM,
    privGap: p.medPrivF - p.medPrivM,
  }));

  rows.sort((a, b) => a.privGap - b.privGap || b.total - a.total);

  const privDeficitCount = rows.filter((r) => r.privGap < 0).length;
  const pubSurplusCount = rows.filter((r) => r.pubGap > 0).length;
  const srcF = (h2Data?.sources || []).find((s) => s.g === 'F');
  const srcM = (h2Data?.sources || []).find((s) => s.g === 'M');
  const pubShareF = srcF ? srcF.pctFefc + srcF.pctFp : 0;
  const pubShareM = srcM ? srcM.pctFefc + srcM.pctFp : 0;

  const verdict = rows.length < 3
    ? { status: 'inconclusivo', label: 'Inconclusivo', reason: `Amostra insuficiente (${rows.length} partidos).` }
    : (privDeficitCount >= Math.ceil(rows.length * 0.6)
        ? {
            status: 'vaza',
            label: 'Vaza no Privado',
            reason: `Mulheres dependem ${(pubShareF * 100).toFixed(1)}% do Fundo Público (vs. ${(pubShareM * 100).toFixed(1)}% dos homens) e ficam atrás no recurso privado em ${privDeficitCount} de ${rows.length} partidos.`,
          }
        : {
            status: 'funcionou',
            label: 'Próximo à Paridade',
            reason: `Equilíbrio entre recursos públicos e privados no recorte.`,
          });

  return {
    rows,
    sources: h2Data?.sources || [],
    medPubF: h2Data?.medPubF || 0,
    medPubM: h2Data?.medPubM || 0,
    medPrivF: h2Data?.medPrivF || 0,
    medPrivM: h2Data?.medPrivM || 0,
    pubShareF,
    pubShareM,
    privDeficitCount,
    pubSurplusCount,
    verdict,
  };
}

/**
 * H4 — Sankey 100% proporcional entre mulheres APTO:
 * Fonte da Receita (FEFC, FP, Próprios, Privadas) → Perfil (Competitivas Top 10% vs. Base 90%) → Resultado (Eleitas vs. Não eleitas).
 */
export function computeH4WomenSankey(candidates, { profile = 'all', coverageYear = null } = {}) {
  const aptoF = candidates.filter((c) => c.apto && c.g === 'F');
  const nF = aptoF.length;
  const finalRate = nF > 0
    ? safeDiv(aptoF.filter((c) => c.tpConta === 'FINAL').length, nF)
    : (coverageYear ? safeDiv(coverageYear.tp_prestacao_apto?.FINAL || 0, coverageYear.population?.apto_cands || 1) : 0);

  const sorted = [...aptoF].sort((a, b) => b.r - a.r || b.v - a.v || a.cid - b.cid);
  const topCount = nF > 0 ? Math.max(1, Math.round(nF * 0.1)) : 0;
  const top10 = sorted.slice(0, topCount);
  const base90 = sorted.slice(topCount);

  const sumBucket = (rows) => {
    let fefc = 0;
    let fp = 0;
    let prop = 0;
    let priv = 0;
    let elRev = 0;
    let nonElRev = 0;
    let elCount = 0;
    for (const c of rows) {
      const totC = c.fefc + c.fp + c.prop + c.priv;
      fefc += c.fefc;
      fp += c.fp;
      prop += c.prop;
      priv += c.priv;
      if (c.el) {
        elRev += totC;
        elCount += 1;
      } else {
        nonElRev += totC;
      }
    }
    const totalRev = fefc + fp + prop + priv;
    return {
      n: rows.length,
      elCount,
      nonElCount: rows.length - elCount,
      fefc,
      fp,
      prop,
      priv,
      elRev,
      nonElRev,
      totalRev,
    };
  };

  const allStats = sumBucket(sorted);
  const topStats = sumBucket(top10);
  const baseStats = sumBucket(base90);

  const groups = profile === 'top10'
    ? [{ id: 'top10', name: 'Competitivas (Top 10%)', stats: topStats }]
    : (profile === 'base90'
        ? [{ id: 'base90', name: 'Base (90%)', stats: baseStats }]
        : [
            { id: 'top10', name: 'Competitivas (Top 10%)', stats: topStats },
            { id: 'base90', name: 'Base (90%)', stats: baseStats },
          ]);

  const activeTotalRev = groups.reduce((s, g) => s + g.stats.totalRev, 0);
  const activeTotalCands = groups.reduce((s, g) => s + g.stats.n, 0);

  const nodes = [
    { id: 'fefc', name: 'FEFC', col: 0 },
    { id: 'fp', name: 'Fundo Partidário', col: 0 },
    { id: 'prop', name: 'Recursos Próprios', col: 0 },
    { id: 'priv', name: 'Doações Privadas', col: 0 },
    ...groups.map((g) => ({ id: g.id, name: g.name, col: 1, candsCount: g.stats.n })),
    { id: 'el', name: 'Eleitas', col: 2 },
    { id: 'non_el', name: 'Não eleitas', col: 2 },
  ];
  const nodeIndex = new Map(nodes.map((n, idx) => [n.id, idx]));

  const links = [];
  if (activeTotalRev > 0) {
    const srcDefs = [
      ['fefc', 'FEFC'],
      ['fp', 'Fundo Partidário'],
      ['prop', 'Recursos Próprios'],
      ['priv', 'Doações Privadas'],
    ];
    for (const g of groups) {
      for (const [sKey] of srcDefs) {
        const brl = g.stats[sKey];
        if (brl <= 0) continue;
        links.push({
          source: nodeIndex.get(sKey),
          target: nodeIndex.get(g.id),
          value: (brl / activeTotalRev) * 100,
          brl,
          candsCount: g.stats.n,
        });
      }
      if (g.stats.elRev > 0) {
        links.push({
          source: nodeIndex.get(g.id),
          target: nodeIndex.get('el'),
          value: (g.stats.elRev / activeTotalRev) * 100,
          brl: g.stats.elRev,
          candsCount: g.stats.elCount,
        });
      }
      if (g.stats.nonElRev > 0) {
        links.push({
          source: nodeIndex.get(g.id),
          target: nodeIndex.get('non_el'),
          value: (g.stats.nonElRev / activeTotalRev) * 100,
          brl: g.stats.nonElRev,
          candsCount: g.stats.nonElCount,
        });
      }
    }
  }

  const top10ShareRev = safeDiv(topStats.totalRev, allStats.totalRev);
  const base90ShareRev = safeDiv(baseStats.totalRev, allStats.totalRev);
  const top10ShareElected = safeDiv(topStats.elCount, allStats.elCount);

  let verdict;
  if (nF < 20 || allStats.totalRev <= 0 || finalRate < 0.7) {
    verdict = {
      status: 'inconclusivo',
      label: 'Inconclusivo',
      reason: `Amostra ou entrega FINAL insuficiente entre candidatas (F=${nF}, FINAL=${(finalRate * 100).toFixed(1)}%).`,
    };
  } else if (top10ShareRev >= 0.5) {
    verdict = {
      status: 'vaza',
      label: 'Concentração Extrema',
      reason: `As 10% mais financiadas (${topStats.n} candidatas) concentram ${(top10ShareRev * 100).toFixed(1)}% de toda a receita feminina e ${(top10ShareElected * 100).toFixed(1)}% das eleitas, enquanto 90% da base divide ${(base90ShareRev * 100).toFixed(1)}%.`,
    };
  } else {
    verdict = {
      status: 'funcionou',
      label: 'Distribuição Mais Equilibrada',
      reason: `As 10% mais financiadas concentram ${(top10ShareRev * 100).toFixed(1)}% da receita feminina.`,
    };
  }

  return {
    profile,
    nF,
    activeTotalCands,
    activeTotalRev,
    allStats,
    topStats,
    baseStats,
    top10ShareRev,
    base90ShareRev,
    top10ShareElected,
    nodes,
    links,
    verdict,
  };
}

/**
 * H6 (Série 2018 → 2022 → 2026) — Evolução da proporção de ≥2 sinais por gênero.
 */
export function computeH6Series(
  allCandidates,
  { cargo = 'all', uf = null, party = null, parties = null, voteThreshold = 10 } = {},
) {
  const years = [2018, 2022, 2026];
  const byYear = {};
  const points = [];

  for (const yr of years) {
    const subset = allCandidates.filter((c) => {
      if (c.y !== yr) return false;
      if (cargo && cargo !== 'all' && c.cargo !== cargo) return false;
      if (uf && c.uf !== uf) return false;
      if (party && c.p !== party) return false;
      if (parties && parties.size > 0 && !parties.has(c.p)) return false;
      return true;
    });
    const h6y = computeH6(subset, { voteThreshold });
    byYear[yr] = h6y;
    points.push(
      {
        year: yr,
        gender: 'Mulheres',
        g: 'F',
        pct2Plus: h6y.pct2PlusF * 100,
        count2Plus: h6y.summary.F.twoPlus,
        n: h6y.summary.F.n,
        ratio2Plus: h6y.ratio2Plus,
        sigA: h6y.summary.F.sigA,
        sigB: h6y.summary.F.sigB,
        sigC: h6y.summary.F.sigC,
      },
      {
        year: yr,
        gender: 'Homens',
        g: 'M',
        pct2Plus: h6y.pct2PlusM * 100,
        count2Plus: h6y.summary.M.twoPlus,
        n: h6y.summary.M.n,
        ratio2Plus: h6y.ratio2Plus,
        sigA: h6y.summary.M.sigA,
        sigB: h6y.summary.M.sigB,
        sigC: h6y.summary.M.sigC,
      },
    );
  }

  const y18 = byYear[2018];
  const y22 = byYear[2022];
  const y26 = byYear[2026];
  let verdict;
  if (y26.summary.F.n < 20 || y26.summary.M.n < 20 || y26.finalRate < 0.7) {
    verdict = {
      status: 'inconclusivo',
      label: 'Inconclusivo',
      reason: `Amostra ou cobertura FINAL insuficiente para série 2018–2026 (FINAL 2026: ${(y26.finalRate * 100).toFixed(1)}%).`,
    };
  } else if (y26.pct2PlusF > y26.pct2PlusM * 1.25 && y26.pct2PlusF - y26.pct2PlusM > 0.01) {
    verdict = {
      status: 'vaza',
      label: 'Vaza nesta Etapa',
      reason: `Mesmo em 2026, mulheres acumulam ${(y26.pct2PlusF * 100).toFixed(1)}% de ≥2 sinais vs. ${(y26.pct2PlusM * 100).toFixed(1)}% dos homens (${y26.ratio2Plus.toFixed(2)}×; em 2018 era ${y18.ratio2Plus.toFixed(1)}×).`,
    };
  } else {
    verdict = {
      status: 'inconclusivo',
      label: 'Inconclusivo',
      reason: `Em ${y26.summary.F.n > 0 ? '2026' : '2022'}, as taxas por gênero são próximas (${(y26.pct2PlusF * 100).toFixed(1)}% F vs. ${(y26.pct2PlusM * 100).toFixed(1)}% M; razão ${y26.ratio2Plus.toFixed(2)}× após queda desde ${y18.ratio2Plus.toFixed(1)}× em 2018). Indicadores isolados são inconclusivos sem prova documental.`,
    };
  }

  return { voteThreshold, years, byYear, points, verdict };
}

/**
 * H7 (Comparativo Lollipop 2022 vs. 2026, com opção 2018) — Taxa agregada de ≥2 sinais por faixa da chapa.
 */
export function computeH7Comparison(
  allCandidates,
  { cargo = 'all', uf = null, party = null, parties = null, voteThreshold = 10 } = {},
) {
  const byYear = {};
  for (const yr of [2018, 2022, 2026]) {
    const subset = allCandidates.filter((c) => {
      if (c.y !== yr) return false;
      if (cargo && cargo !== 'all' && c.cargo !== cargo) return false;
      if (uf && c.uf !== uf) return false;
      if (party && c.p !== party) return false;
      if (parties && parties.size > 0 && !parties.has(c.p)) return false;
      return true;
    });
    byYear[yr] = computeH7(subset, { voteThreshold });
  }

  const bandOrder = byYear[2022].bandOrder;
  const rows = bandOrder.map((band) => {
    const out = { band };
    for (const yr of [2018, 2022, 2026]) {
      const st = byYear[yr].bandStats.find((b) => b.band === band) || { slatesCount: 0, nF: 0, twoPlusCount: 0, aggRate: 0 };
      out[`y${yr}`] = {
        ...st,
        aggRatePct: st.aggRate * 100,
      };
    }
    return out;
  });

  return {
    voteThreshold,
    bandOrder,
    byYear,
    rows,
    verdict2022: byYear[2022].verdict,
    verdict2026: byYear[2026].verdict,
  };
}

/**
 * H9 (Mapa Quantitativo + Matriz Heatmap Ordenável) — 27 UFs e Top 15 Partidos nas 5 etapas.
 */
export function computeH9MatrixAndMap(
  candidates,
  { voteThreshold = 10, selectedParty = '', limitParties = 15 } = {},
) {
  function calcRow(key, rows) {
    const validG = rows.filter((c) => c.g === 'F' || c.g === 'M');
    const regF = validG.filter((c) => c.g === 'F').length;
    const pctCandRegF = safeDiv(regF, validG.length);

    const apto = validG.filter((c) => c.apto);
    const aptoF = apto.filter((c) => c.g === 'F');
    const nF = aptoF.length;
    const nM = apto.length - nF;
    const pctCandF = safeDiv(nF, apto.length);
    const finalRate = safeDiv(apto.filter((c) => c.tpConta === 'FINAL').length, apto.length);

    const pubF = aptoF.reduce((s, c) => s + c.fefc + c.fp, 0);
    const pubTot = apto.reduce((s, c) => s + c.fefc + c.fp, 0);
    const pctPubF = safeDiv(pubF, pubTot);

    const privF = aptoF.reduce((s, c) => s + c.prop + c.priv, 0);
    const privTot = apto.reduce((s, c) => s + c.prop + c.priv, 0);
    const pctPrivF = safeDiv(privF, privTot);

    const vF = aptoF.reduce((s, c) => s + c.v, 0);
    const vTot = apto.reduce((s, c) => s + c.v, 0);
    const pctVotosF = safeDiv(vF, vTot);

    const elF = aptoF.filter((c) => c.el).length;
    const elTot = apto.filter((c) => c.el).length;
    const pctEleitasF = safeDiv(elF, elTot);

    const alertsF = aptoF.filter((c) => countSignals(c, voteThreshold).total >= 2).length;
    const pctAlertsF = safeDiv(alertsF, nF);

    const inconclusive = apto.length < 10 || finalRate < 0.7;

    return {
      key,
      nTotal: validG.length,
      nApto: apto.length,
      nF,
      nM,
      elF,
      elTot,
      alertsF,
      finalRate,
      inconclusive,
      pctCandRegF: pctCandRegF * 100,
      pctCandF: pctCandF * 100,
      pctPubF: pubTot > 0 ? pctPubF * 100 : null,
      pctPrivF: privTot > 0 ? pctPrivF * 100 : null,
      pctVotosF: vTot > 0 ? pctVotosF * 100 : null,
      pctEleitasF: elTot > 0 ? pctEleitasF * 100 : null,
      pctAlertsF: nF > 0 ? pctAlertsF * 100 : null,
    };
  }

  const byUfMap = groupBy(candidates, (c) => c.uf);
  const ufRows = [...byUfMap.entries()]
    .map(([uf, rows]) => calcRow(uf, rows))
    .sort((a, b) => (b.pctEleitasF ?? -1) - (a.pctEleitasF ?? -1));

  const byPartyMap = groupBy(candidates, (c) => c.p);
  const eligibleParties = [...byPartyMap.entries()]
    .filter(([, rows]) => rows.filter((c) => c.apto).length >= 20)
    .map(([p, rows]) => calcRow(p, rows))
    .sort((a, b) => b.nApto - a.nApto);

  const partyRows = eligibleParties.slice(0, limitParties);
  if (selectedParty && !partyRows.some((p) => p.key === selectedParty)) {
    const extra = eligibleParties.find((p) => p.key === selectedParty);
    if (extra) partyRows.push(extra);
  }

  const validUfs = ufRows.filter((u) => !u.inconclusive && u.pctEleitasF !== null);
  const sortedEl = [...validUfs].sort((a, b) => a.pctEleitasF - b.pctEleitasF);
  const lowUf = sortedEl[0];
  const highUf = sortedEl[sortedEl.length - 1];

  const verdict = validUfs.length < 5
    ? { status: 'inconclusivo', label: 'Inconclusivo', reason: `Poucas UFs com amostra suficiente (${validUfs.length}).` }
    : {
        status: 'vaza',
        label: 'Desigualdade Regional',
        reason: `A eleição feminina varia de ${lowUf.pctEleitasF.toFixed(1)}% (${lowUf.key}) a ${highUf.pctEleitasF.toFixed(1)}% (${highUf.key}) entre UFs analisadas.`,
      };

  return {
    ufRows,
    partyRows,
    verdict,
  };
}

/**
 * Ato 4B — Investigação Comparativa por Faixa de Limiar (30%–33% vs. > 33%, excluindo < 30%)
 * Suporta agrupamento por 'chapa' (UF × Cargo × Federação/Partido, n >= 4) ou por 'party' (partido, n >= 10).
 */
export function computeThresholdBandComparison(candidates, { unit = 'chapa' } = {}) {
  const validG = candidates.filter((c) => c.g === 'F' || c.g === 'M');

  const bands = {
    '30-33': { label: '30%–33%', units: 0, rows: [] },
    gt33: { label: '> 33%', units: 0, rows: [] },
  };
  let excludedBelow30 = 0;

  if (unit === 'party') {
    const byParty = groupBy(validG, (c) => c.p);
    for (const [, rows] of byParty.entries()) {
      if (rows.length < 10) continue;
      const pctF = (rows.filter((c) => c.g === 'F').length / rows.length) * 100;
      if (pctF < 30) {
        excludedBelow30 += 1;
        continue;
      }
      const target = pctF <= 33.34 ? bands['30-33'] : bands.gt33;
      target.units += 1;
      target.rows.push(...rows.filter((c) => c.apto));
    }
  } else {
    const bySlate = groupBy(validG, (c) => c.slateKey || `${c.y}|${c.uf}|${c.cargo}|${c.chapa}`);
    for (const [, rows] of bySlate.entries()) {
      const sample = rows[0];
      const nReg = Number.isFinite(sample.slateNReg) && sample.slateNReg > 0 ? sample.slateNReg : rows.length;
      const pctReg = (Number.isFinite(sample.slatePctReg) ? sample.slatePctReg : safeDiv(rows.filter((c) => c.g === 'F').length, rows.length)) * 100;
      if (nReg < 4) continue;
      if (pctReg < 30) {
        excludedBelow30 += 1;
        continue;
      }
      const target = pctReg <= 33.34 ? bands['30-33'] : bands.gt33;
      target.units += 1;
      target.rows.push(...rows.filter((c) => c.apto));
    }
  }

  function summarizeBand(key, def) {
    const apto = def.rows;
    const f = apto.filter((c) => c.g === 'F');
    const m = apto.filter((c) => c.g === 'M');
    const fRec = f.filter((c) => c.hasRec).map((c) => c.r);
    const mRec = m.filter((c) => c.hasRec).map((c) => c.r);

    const medF = median(fRec);
    const medM = median(mRec);
    const medAll = median(apto.filter((c) => c.hasRec).map((c) => c.r));

    const pctCandF = safeDiv(f.length, apto.length) * 100;
    const pubF = f.reduce((s, c) => s + c.fefc + c.fp, 0);
    const pubTot = apto.reduce((s, c) => s + c.fefc + c.fp, 0);
    const pctPubF = safeDiv(pubF, pubTot) * 100;
    const propSaldoPP = pctPubF - pctCandF;
    const propRatio = safeDiv(pctPubF, pctCandF);

    const sortedF = [...f].sort((a, b) => (b.fefc + b.fp) - (a.fefc + a.fp));
    const top10Count = f.length > 0 ? Math.max(1, Math.round(f.length * 0.1)) : 0;
    const top10Pub = sortedF.slice(0, top10Count).reduce((s, c) => s + c.fefc + c.fp, 0);
    const concTop10Pct = safeDiv(top10Pub, pubF) * 100;
    const base90Pct = Math.max(0, 100 - concTop10Pct);

    const elF = f.filter((c) => c.el).length;
    const elTot = apto.filter((c) => c.el).length;
    const pctEleitasF = safeDiv(elF, elTot) * 100;

    return {
      key,
      label: def.label,
      units: def.units,
      nApto: apto.length,
      nF: f.length,
      nM: m.length,
      medF,
      medM,
      medAll,
      pctCandF,
      pctPubF,
      propSaldoPP,
      propRatio,
      concTop10Pct,
      base90Pct,
      elF,
      elTot,
      pctEleitasF,
    };
  }

  const floor = summarizeBand('30-33', bands['30-33']);
  const above = summarizeBand('gt33', bands.gt33);
  const inconclusive = floor.units < 2 || above.units < 2 || floor.nF < 15 || above.nF < 15;

  const verdict = inconclusive
    ? {
        status: 'inconclusivo',
        label: 'Inconclusivo',
        reason: `Amostra insuficiente entre faixas 30%–33% (${floor.units}) e >33% (${above.units}) no modo ${unit === 'party' ? 'Por Partido' : 'Por Chapa'}.`,
      }
    : {
        status: above.pctEleitasF > floor.pctEleitasF ? 'vaza' : 'funcionou',
        label: above.pctEleitasF > floor.pctEleitasF ? 'Teto 30%–33% Limita Retorno' : 'Faixas Equivalentes',
        reason: `No recorte ${unit === 'party' ? 'por partido' : 'por chapa'}, eleitas passam de ${floor.pctEleitasF.toFixed(1)}% (30%–33%) para ${above.pctEleitasF.toFixed(1)}% (>33%), com mediana feminina de R$ ${(floor.medF / 1e3).toFixed(1)}k vs. R$ ${(above.medF / 1e3).toFixed(1)}k.`,
      };

  return {
    unit,
    excludedBelow30,
    floor,
    above,
    inconclusive,
    verdict,
  };
}

/**
 * Seleciona até `limit` primeiros colocados incluindo todos os empates na posição de corte,
 * com ranking padrão de competição (1, 2, 2, 4...).
 */
export function selectTopWithTies(items, key, higherIsBetter = true, limit = 5) {
  const sorted = [...items].sort((a, b) => (
    higherIsBetter ? b[key] - a[key] : a[key] - b[key]
  ) || a.uf.localeCompare(b.uf));
  if (sorted.length === 0) return [];
  const cutoffIdx = Math.min(limit - 1, sorted.length - 1);
  const cutoffVal = sorted[cutoffIdx][key];
  let curRank = 1;
  return sorted
    .filter((d) => (higherIsBetter ? d[key] >= cutoffVal - 1e-9 : d[key] <= cutoffVal + 1e-9))
    .map((d, idx, arr) => {
      if (idx > 0 && Math.abs(d[key] - arr[idx - 1][key]) > 1e-9) {
        curRank = idx + 1;
      }
      return { item: d, rank: curRank };
    });
}

/**
 * Ato 5 — Onde a Cota Vira Voto (27 UFs · 4 Pilares Estruturais + Consequência na Urna)
 */
export function computeAto5Geography(allCandidates, { year = 2022, cargo = 'all', party = '', parties = null, ufList = [] } = {}) {
  const subset = allCandidates.filter((c) => {
    if (c.y !== year) return false;
    if (cargo && cargo !== 'all' && c.cargo !== cargo) return false;
    if (party && c.p !== party) return false;
    if (parties && parties.size > 0 && !parties.has(c.p)) return false;
    return true;
  });

  const byUf = groupBy(subset, (c) => c.uf);
  const allUfs = ufList.length > 0 ? ufList : [...byUf.keys()].sort();

  const rows = allUfs.map((uf) => {
    const urows = byUf.get(uf) || [];
    const validG = urows.filter((c) => c.g === 'F' || c.g === 'M');
    const apto = validG.filter((c) => c.apto);
    const f = apto.filter((c) => c.g === 'F');
    const m = apto.filter((c) => c.g === 'M');
    const validSample = apto.length >= 10 && f.length >= 3 && m.length >= 3;

    const fRec = f.filter((c) => c.hasRec).map((c) => c.r);
    const mRec = m.filter((c) => c.hasRec).map((c) => c.r);
    const medF = median(fRec);
    const medM = median(mRec);
    const medDiffK = (medF - medM) / 1000;

    const pctCandF = safeDiv(f.length, apto.length) * 100;
    const fefcF = f.reduce((s, c) => s + c.fefc, 0);
    const fefcTot = apto.reduce((s, c) => s + c.fefc, 0);
    const pubF = fefcTot > 0 ? fefcF : f.reduce((s, c) => s + c.fefc + c.fp, 0);
    const pubTot = fefcTot > 0 ? fefcTot : apto.reduce((s, c) => s + c.fefc + c.fp, 0);
    const fefcSaldo = pubTot > 0 ? (safeDiv(pubF, pubTot) * 100) - pctCandF : 0;

    const sortedF = [...f].sort((a, b) => (fefcTot > 0 ? b.fefc - a.fefc : (b.fefc + b.fp) - (a.fefc + a.fp)));
    const top10N = f.length > 0 ? Math.max(1, Math.round(f.length * 0.1)) : 0;
    const top10Val = sortedF.slice(0, top10N).reduce((s, c) => s + (fefcTot > 0 ? c.fefc : c.fefc + c.fp), 0);
    const concTop10 = pubF > 0 ? safeDiv(top10Val, pubF) * 100 : 0;

    const slatesMap = new Map();
    for (const c of validG) {
      const sk = c.slateKey || `${c.y}|${c.uf}|${c.cargo}|${c.chapa}`;
      if (!slatesMap.has(sk)) {
        slatesMap.set(sk, {
          nReg: Number.isFinite(c.slateNReg) && c.slateNReg > 0 ? c.slateNReg : 0,
          pctReg: (c.slatePctReg || 0) * 100,
        });
      }
    }
    const validSlates = [...slatesMap.values()].filter((s) => s.nReg >= 4);
    const trappedSlates = validSlates.filter((s) => s.pctReg >= 30 && s.pctReg <= 33.34).length;
    const tetoTrapped = validSlates.length > 0 ? safeDiv(trappedSlates, validSlates.length) * 100 : 100;

    const elF = f.filter((c) => c.el).length;
    const elTot = apto.filter((c) => c.el).length;
    const eleitasPct = elTot > 0 ? safeDiv(elF, elTot) * 100 : 0;

    return {
      uf,
      validSample,
      nApto: apto.length,
      nF: f.length,
      slatesCount: validSlates.length,
      elF,
      elTot,
      medF,
      medM,
      medDiffK: Number(medDiffK.toFixed(1)),
      fefcSaldo: Number(fefcSaldo.toFixed(1)),
      concTop10: Number(concTop10.toFixed(1)),
      tetoTrapped: Number(tetoTrapped.toFixed(1)),
      eleitasPct: Number(eleitasPct.toFixed(1)),
      pillars: [false, false, false, false],
      pillarRanks: [null, null, null, null],
      eleitasRank: null,
    };
  });

  const eligible = rows.filter((r) => r.validSample);
  const pillarSpecs = [
    { idx: 0, key: 'medDiffK', higherIsBetter: true },
    { idx: 1, key: 'fefcSaldo', higherIsBetter: true },
    { idx: 2, key: 'concTop10', higherIsBetter: true },
    { idx: 3, key: 'tetoTrapped', higherIsBetter: false },
  ];

  for (const spec of pillarSpecs) {
    const pool = eligible.filter((r) => (spec.idx === 3 ? r.slatesCount >= 2 : true));
    selectTopWithTies(pool, spec.key, spec.higherIsBetter, 5).forEach(({ item: w, rank }) => {
      w.pillars[spec.idx] = true;
      w.pillarRanks[spec.idx] = rank;
    });
  }

  const rankedEleitas = selectTopWithTies(eligible.filter((r) => r.elTot > 0), 'eleitasPct', true, 5);
  rankedEleitas.forEach(({ item: w, rank }) => {
    w.eleitasRank = rank;
  });

  const top5Eleitas = rankedEleitas.map(({ item }) => item);
  const twoPlusCount = top5Eleitas.filter((d) => d.pillars.filter(Boolean).length >= 2).length;
  const anyPillarCount = top5Eleitas.filter((d) => d.pillars.filter(Boolean).length >= 1).length;

  const verdict = eligible.length < 5
    ? { status: 'inconclusivo', label: 'Inconclusivo', reason: `Poucas UFs com amostra suficiente neste recorte (${eligible.length}).` }
    : {
        status: 'vaza',
        label: 'Desigualdade Estrutural por UF',
        reason: `${twoPlusCount} de ${top5Eleitas.length} UFs líderes em eleitas (${year}) acumularam ≥ 2 pilares estruturais (★2/4–4/4), e ${anyPillarCount} de ${top5Eleitas.length} lideraram ao menos um pilar.`,
      };

  return {
    year,
    cargo,
    rows,
    eligibleCount: eligible.length,
    top5Eleitas,
    twoPlusCount,
    anyPillarCount,
    verdict,
  };
}

/**
 * H4 — Sankey Interativo em 3 Colunas (Apenas APTO, corte em 1.000 votos):
 * Coluna 1: Origem do Recurso (Fundo Público vs. Recursos Privados)
 * Coluna 2: Perfil da Candidatura (Mulheres >1000, Mulheres <=1000, Homens >1000, Homens <=1000)
 * Coluna 3: Destino do Gasto (Fornecedores Compartilhados, Campanha Direta, Repasses a Candidaturas, Direção Partidária)
 */
export function computeH4Sankey1000(candidates, { voteCutoff = 1000 } = {}) {
  const apto = candidates.filter((c) => c.apto && (c.g === 'F' || c.g === 'M'));

  const profilesDef = [
    { id: 'f_gt', label: 'Mulheres > 1.000 votos', short: 'F > 1.000v', gender: 'F', high: true, test: (c) => c.g === 'F' && c.v > voteCutoff },
    { id: 'f_le', label: 'Mulheres ≤ 1.000 votos', short: 'F ≤ 1.000v', gender: 'F', high: false, test: (c) => c.g === 'F' && c.v <= voteCutoff },
    { id: 'm_gt', label: 'Homens > 1.000 votos', short: 'M > 1.000v', gender: 'M', high: true, test: (c) => c.g === 'M' && c.v > voteCutoff },
    { id: 'm_le', label: 'Homens ≤ 1.000 votos', short: 'M ≤ 1.000v', gender: 'M', high: false, test: (c) => c.g === 'M' && c.v <= voteCutoff },
  ];

  const profiles = profilesDef.map((def) => {
    const grp = apto.filter(def.test);
    let pub = 0;
    let priv = 0;
    let shared = 0;
    let direct = 0;
    let cands = 0;
    let party = 0;
    let elCount = 0;

    for (const c of grp) {
      pub += (c.fefc || 0) + (c.fp || 0);
      priv += (c.prop || 0) + (c.priv || 0);
      shared += c.toShared || 0;
      direct += c.toExcl || 0;
      cands += (c.toCandF || 0) + (c.toCandM || 0) + (c.toCandU || 0);
      party += c.toParty || 0;
      if (c.el) elCount += 1;
    }

    const recTotal = pub + priv;
    const expTotal = shared + direct + cands + party;
    return {
      ...def,
      n: grp.length,
      elCount,
      pub,
      priv,
      recTotal,
      shared,
      direct,
      cands,
      party,
      expTotal,
      weight: Math.max(recTotal, expTotal),
    };
  });

  const totPub = profiles.reduce((s, p) => s + p.pub, 0);
  const totPriv = profiles.reduce((s, p) => s + p.priv, 0);
  const totRec = totPub + totPriv;

  const totShared = profiles.reduce((s, p) => s + p.shared, 0);
  const totDirect = profiles.reduce((s, p) => s + p.direct, 0);
  const totCands = profiles.reduce((s, p) => s + p.cands, 0);
  const totParty = profiles.reduce((s, p) => s + p.party, 0);
  const totExp = totShared + totDirect + totCands + totParty;

  const sources = [
    { id: 'pub', label: 'Fundo Público (FEFC + FP)', short: 'Fundo Público', val: totPub },
    { id: 'priv', label: 'Recursos Privados', short: 'Privados', val: totPriv },
  ];

  const destinations = [
    { id: 'shared', label: 'Fornecedores Compartilhados', short: 'Compartilhados', val: totShared },
    { id: 'direct', label: 'Campanha Direta', short: 'Camp. Direta', val: totDirect },
    { id: 'cands', label: 'Repasses a Candidaturas', short: 'Repasses Cand.', val: totCands },
    { id: 'party', label: 'Direção Partidária', short: 'Partidos', val: totParty },
  ];

  const links01 = [];
  for (const s of sources) {
    for (const p of profiles) {
      const val = s.id === 'pub' ? p.pub : p.priv;
      if (val > 0) {
        links01.push({ source: s.id, target: p.id, val, sourceLabel: s.label, targetLabel: p.label });
      }
    }
  }

  const links12 = [];
  for (const p of profiles) {
    for (const d of destinations) {
      const val = p[d.id] || 0;
      if (val > 0) {
        links12.push({ source: p.id, target: d.id, val, sourceLabel: p.label, targetLabel: d.label });
      }
    }
  }

  const fLe = profiles.find((p) => p.id === 'f_le');
  const fGt = profiles.find((p) => p.id === 'f_gt');
  const sharedPct = safeDiv(totShared, totExp) * 100;
  const directPct = safeDiv(totDirect, totExp) * 100;

  return {
    voteCutoff,
    nApto: apto.length,
    totPub,
    totPriv,
    totRec,
    totShared,
    totDirect,
    totCands,
    totParty,
    totExp,
    sharedPct,
    directPct,
    fLeShareOfPub: safeDiv(fLe?.pub || 0, totPub) * 100,
    fGtShareOfPub: safeDiv(fGt?.pub || 0, totPub) * 100,
    sources,
    profiles,
    destinations,
    links01,
    links12,
  };
}
