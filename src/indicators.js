/**
 * Módulo auditável de indicadores e veredictos (H1–H5 nesta unidade U3).
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
  const regGroups = groupBy(validGender, (c) => `${c.uf}|${c.cargo}|${c.chapa}`);

  const slates = [];
  let microSlatesReg = 0;
  let microCandsReg = 0;
  let microSlatesApto = 0;
  let microCandsApto = 0;
  let regCompliantTotal = 0;
  let droppedByInapto = 0;

  for (const [key, rows] of regGroups.entries()) {
    const [uf, cargo, chapa] = key.split('|');
    const nReg = rows.length;
    const fReg = rows.filter((r) => r.g === 'F').length;
    const pctReg = fReg / nReg;

    const aptoRows = rows.filter((r) => r.apto);
    const nApto = aptoRows.length;
    const fApto = aptoRows.filter((r) => r.g === 'F').length;
    const pctApto = nApto > 0 ? fApto / nApto : 0;

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

  const finalRate = coverageYear
    ? safeDiv(coverageYear.tp_prestacao_apto?.FINAL || 0, coverageYear.population?.apto_cands || apto.length)
    : safeDiv(apto.filter((c) => c.tpConta === 'FINAL').length, apto.length);

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
  const finalRate = coverageYear
    ? safeDiv(coverageYear.tp_prestacao_apto?.FINAL || 0, coverageYear.population?.apto_cands || apto.length)
    : safeDiv(apto.filter((c) => c.tpConta === 'FINAL').length, apto.length);

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
  const apto = candidates.filter((c) => c.apto && (c.g === 'F' || c.g === 'M') && c.e > 0);
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
  if (byGender.F.pubFlow <= 0 || byGender.M.pubFlow <= 0) {
    verdict = {
      status: 'inconclusivo',
      label: 'Inconclusivo',
      reason: 'Sem volume suficiente de gasto público alocado no recorte.',
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
