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
  const above40 = slates.filter((s) => s.pctReg > 0.4).length;
  const below30 = slates.filter((s) => s.pctReg < 0.3).length;

  const aptoSlates = slates.filter((s) => s.nApto >= 4);
  const aptoCompliant = aptoSlates.filter((s) => s.pctApto >= 0.3).length;
  const aptoFloorBand = aptoSlates.filter((s) => s.pctApto >= 0.3 && s.pctApto <= 0.3334).length;

  const pctCompliant = safeDiv(compliant, totalSlates);
  const pctFloorBand = safeDiv(floorBand, totalSlates);
  const pctAbove40 = safeDiv(above40, totalSlates);
  const pctAptoCompliant = safeDiv(aptoCompliant, aptoSlates.length);

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
    above40,
    below30,
    pctCompliant,
    pctFloorBand,
    pctAbove40,
    aptoSlatesCount: aptoSlates.length,
    pctAptoCompliant,
    pctAptoFloorBand: safeDiv(aptoFloorBand, aptoSlates.length),
    regCompliantTotal,
    droppedByInapto,
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
 * calculando distribuição percentual e absoluta em dois universos limpos: Registradas e Aptas.
 */
export function computeH1Comparison(
  allCandidates,
  { cargo = 'all', uf = null, party = null, parties = null, ufs = null } = {},
) {
  const byYear = {};

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
    byYear[yr] = computeH1(subset);
  }

  const bins = H1_MIRROR_BINS.map((def) => {
    const entry = { id: def.id, label: def.label, zone: def.zone, status: def.status };
    for (const yr of [2022, 2026]) {
      const h1y = byYear[yr];
      const totalReg = h1y.totalSlates;
      const totalApto = h1y.aptoSlatesCount;
      const regN = h1y.slates.filter((s) => def.test(s.pctReg * 100)).length;
      const aptoN = h1y.slates.filter((s) => s.nApto >= 4 && def.test(s.pctApto * 100)).length;
      const regPct = safeDiv(regN, totalReg) * 100;
      const aptoPct = safeDiv(aptoN, totalApto) * 100;
      entry[`y${yr}`] = {
        regN,
        aptoN,
        regPct,
        aptoPct,
        totalReg,
        totalApto,
      };
    }
    entry.deltaRegPP = entry.y2026.regPct - entry.y2022.regPct;
    entry.deltaAptoPP = entry.y2026.aptoPct - entry.y2022.aptoPct;
    entry.deltaRegN = entry.y2026.regN - entry.y2022.regN;
    entry.deltaAptoN = entry.y2026.aptoN - entry.y2022.aptoN;
    return entry;
  });

  return {
    bins,
    byYear: {
      2022: {
        totalSlates: byYear[2022].totalSlates,
        aptoSlatesCount: byYear[2022].aptoSlatesCount,
        microSlatesReg: byYear[2022].microSlatesReg,
        microCandsReg: byYear[2022].microCandsReg,
        microSlatesApto: byYear[2022].microSlatesApto,
        microCandsApto: byYear[2022].microCandsApto,
        droppedByInapto: byYear[2022].droppedByInapto,
      },
      2026: {
        totalSlates: byYear[2026].totalSlates,
        aptoSlatesCount: byYear[2026].aptoSlatesCount,
        microSlatesReg: byYear[2026].microSlatesReg,
        microCandsReg: byYear[2026].microCandsReg,
        microSlatesApto: byYear[2026].microSlatesApto,
        microCandsApto: byYear[2026].microCandsApto,
        droppedByInapto: byYear[2026].droppedByInapto,
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
      ratio: safeDiv(y, x),
    });
  }
  parties.sort((a, b) => b.pubTotal - a.pubTotal);

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
export function computeH5(candidates) {
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
  const byParty = [];
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
    byParty.push({
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
  byParty.sort((a, b) => b.elTotal - a.elTotal || b.nTotal - a.nTotal);

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
 * H8 — Comparativo Temporal 2022 vs. 2026 (Contas zeradas brutas vs. Movimentações padronizadas em lote)
 */
export function computeH8(allCandidates, { cargo = 'all', uf = null, party = null, voteThreshold = 10 } = {}) {
  const rows = [];
  const byYear = {};

  for (const yr of [2022, 2026]) {
    const subset = allCandidates.filter((c) => {
      if (c.y !== yr) return false;
      if (cargo && cargo !== 'all' && c.cargo !== cargo) return false;
      if (uf && c.uf !== uf) return false;
      if (party && c.p !== party) return false;
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
    };

    rows.push(
      { year: String(yr), metric: 'Conta zerada (Sinal B)', pct: safeDiv(zeroCount, n) * 100, count: zeroCount, n },
      { year: String(yr), metric: 'Mov. padronizada em lote (Sinal C)', pct: safeDiv(stdCount, n) * 100, count: stdCount, n },
      { year: String(yr), metric: `Zerada + ≤${voteThreshold} votos`, pct: safeDiv(classicCount, n) * 100, count: classicCount, n },
      { year: String(yr), metric: `Padronizada + ≤${voteThreshold} votos`, pct: safeDiv(adaptedCount, n) * 100, count: adaptedCount, n },
    );
  }

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
      reason: `Contas zeradas caíram (${(y22.pctZero * 100).toFixed(1)}% → ${(y26.pctZero * 100).toFixed(1)}%), mas movimentações padronizadas em lote subiram (${(y22.pctStd * 100).toFixed(1)}% → ${(y26.pctStd * 100).toFixed(1)}%).`,
    };
  } else if (y26.pctStd > 0.05 || y26.pctZero > 0.05) {
    verdict = {
      status: 'vaza',
      label: 'Vaza nesta Etapa',
      reason: `Em 2026 permanecem ${(y26.pctZero * 100).toFixed(1)}% zeradas e ${(y26.pctStd * 100).toFixed(1)}% com pacote padronizado (2022: ${(y22.pctZero * 100).toFixed(1)}% e ${(y22.pctStd * 100).toFixed(1)}%).`,
    };
  } else {
    verdict = {
      status: 'funcionou',
      label: 'A Cota Funciona',
      reason: `Redução simultânea de contas zeradas e padronizadas entre 2022 e 2026.`,
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
