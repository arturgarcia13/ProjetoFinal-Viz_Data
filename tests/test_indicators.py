import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _run_js_indicators(year: int) -> dict:
    script = f"""
    import fs from 'node:fs';
    import {{ decodeAnalyticalBase, filterCandidates }} from './src/data.js';
    import {{
      computeH1, computeH2, computeH3, computeH4, computeH4WomenSankey, computeH5,
    }} from './src/indicators.js';

    const raw = JSON.parse(fs.readFileSync('data/analytical_base.json', 'utf8'));
    const cov = JSON.parse(fs.readFileSync('data/coverage.json', 'utf8')).years['{year}'];
    const {{ candidates }} = decodeAnalyticalBase(raw);
    const rows = filterCandidates(candidates, {{ year: {year}, cargo: 'all' }});
    const out = {{
      h1: computeH1(rows),
      h2: computeH2(rows, cov),
      h3: computeH3(rows, cov),
      h4: computeH4(rows),
      h4Women: computeH4WomenSankey(rows, {{ profile: 'all', coverageYear: cov }}),
      h5: computeH5(rows),
    }};
    out.h1.slatesLen = out.h1.slates.length;
    delete out.h1.slates;
    console.log(JSON.stringify(out));
    """
    proc = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(proc.stdout)


def test_h1_to_h5_denominators_match_2022_coverage():
    cov = json.loads((ROOT / "data" / "coverage.json").read_text(encoding="utf-8"))["years"]["2022"]
    res = _run_js_indicators(2022)

    # H1: total chapas (reg >= 4 + micro < 4) must match coverage and align >= 40%
    assert res["h1"]["totalSlates"] + res["h1"]["microSlatesReg"] == cov["population"]["chapas_reg"]["total"]
    assert res["h1"]["microSlatesReg"] == cov["population"]["chapas_reg"]["micro_lt4"]
    assert res["h1"]["microCandsReg"] == cov["population"]["chapas_reg"]["micro_cands"]
    assert 0.80 <= res["h1"]["pctCompliant"] <= 1.0
    assert abs(res["h1"]["pctGe40"] - (197 / 1060)) < 1e-4

    # H2, H3, H5: APTO F + M denominators must match coverage
    assert res["h2"]["nAptoF"] == cov["population"]["gender_apto"]["F"]
    assert res["h2"]["nAptoM"] == cov["population"]["gender_apto"]["M"]
    assert res["h3"]["nF"] == cov["population"]["gender_apto"]["F"]
    assert res["h3"]["nM"] == cov["population"]["gender_apto"]["M"]
    assert res["h3"]["totalDeficitBrl"] < -30_000_000
    assert res["h5"]["nF"] == cov["population"]["gender_apto"]["F"]
    assert res["h5"]["nM"] == cov["population"]["gender_apto"]["M"]

    # H4 Women Sankey: top 10% share > 50% and links sum to 100% on source & outcome layers
    assert res["h4Women"]["nF"] == cov["population"]["gender_apto"]["F"]
    assert res["h4Women"]["top10ShareRev"] > 0.55

    # H5: ordered descending by pctEleitasF
    el_rates = [p["pctEleitasF"] for p in res["h5"]["byParty"]]
    assert el_rates == sorted(el_rates, reverse=True)
    assert res["h5"]["elF"] + res["h5"]["elM"] == 1547
    assert res["h5"]["verdict"]["status"] == "vaza"


def test_h6_to_h9_indicators_2018_to_2026_and_inconclusive():
    script = """
    import fs from 'node:fs';
    import { decodeAnalyticalBase, filterCandidates } from './src/data.js';
    import {
      computeH4WomenSankey, computeH6, computeH6Series, computeH7Comparison,
      computeH8, computeH9AndParallel, computeH9MatrixAndMap,
    } from './src/indicators.js';

    const raw = JSON.parse(fs.readFileSync('data/analytical_base.json', 'utf8'));
    const cov = JSON.parse(fs.readFileSync('data/coverage.json', 'utf8')).years;
    const { candidates } = decodeAnalyticalBase(raw);
    const rows22 = filterCandidates(candidates, { year: 2022, cargo: 'all' });
    const rowsSmall = rows22.filter(c => c.uf === 'RR' && c.p === 'NOVO');

    const h6Series = computeH6Series(candidates);
    const h7Comp = computeH7Comparison(candidates);
    const h8 = computeH8(candidates);
    const h9Mat = computeH9MatrixAndMap(rows22);

    console.log(JSON.stringify({
      h6Ratio18: h6Series.byYear[2018].ratio2Plus,
      h6Ratio22: h6Series.byYear[2022].ratio2Plus,
      h6Ratio26: h6Series.byYear[2026].ratio2Plus,
      h7Bands: h7Comp.rows.length,
      h8_18_n: h8.byYear[2018].n,
      h8_22_n: h8.byYear[2022].n,
      h8_26_n: h8.byYear[2026].n,
      h8_18_zero: h8.byYear[2018].pctZero,
      h8_26_zero: h8.byYear[2026].pctZero,
      h8_18_std: h8.byYear[2018].pctStd,
      h8_26_std: h8.byYear[2026].pctStd,
      h9Ufs: h9Mat.ufRows.length,
      h9Parties: h9Mat.partyRows.length,
      smallH4: computeH4WomenSankey(rowsSmall).verdict.status,
      smallH6: computeH6(rowsSmall).verdict.status,
      smallH9: computeH9MatrixAndMap(rowsSmall).verdict.status,
      legacyH9Ufs: computeH9AndParallel(rows22).ufRows.length,
    }));
    """
    proc = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    out = json.loads(proc.stdout)
    assert out["h6Ratio18"] > 8.0
    assert out["h6Ratio22"] < 2.0 and out["h6Ratio26"] < 1.5
    assert out["h7Bands"] == 4
    assert out["h8_18_n"] == 7422
    assert out["h8_22_n"] == 8468
    assert out["h8_26_n"] == 6366
    assert out["h8_26_zero"] < out["h8_18_zero"]
    assert out["h8_26_std"] > out["h8_18_std"]
    assert out["h9Ufs"] == 27
    assert out["legacyH9Ufs"] == 27
    assert out["h9Parties"] >= 10
    assert out["smallH4"] == "inconclusivo"
    assert out["smallH6"] == "inconclusivo"
    assert out["smallH9"] == "inconclusivo"


def test_h2_gap_evolution_and_public_vs_private():
    script = """
    import fs from 'node:fs';
    import { decodeAnalyticalBase, filterCandidates } from './src/data.js';
    import { computeH2, computeH2GapEvolution, computeH2PublicVsPrivate } from './src/indicators.js';

    const raw = JSON.parse(fs.readFileSync('data/analytical_base.json', 'utf8'));
    const { candidates } = decodeAnalyticalBase(raw);
    const gap = computeH2GapEvolution(candidates);
    const h2_26 = computeH2(filterCandidates(candidates, { year: 2026, cargo: 'all' }));
    const h2b = computeH2PublicVsPrivate(h2_26);

    console.log(JSON.stringify({
      gapCount: gap.rows.length,
      gaps26: gap.rows.map(r => r.gap2026),
      pl: gap.rows.find(r => r.party === 'PL'),
      pt: gap.rows.find(r => r.party === 'PT'),
      uniao: gap.rows.find(r => r.party === 'UNIÃO'),
      h2bCount: h2b.rows.length,
      pubShareF: h2b.pubShareF,
      privDeficitCount: h2b.privDeficitCount,
    }));
    """
    proc = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    out = json.loads(proc.stdout)
    assert out["gapCount"] == 12
    assert out["gaps26"] == sorted(out["gaps26"])
    assert out["pl"]["gap2026"] < -100_000
    assert out["pt"]["gap2026"] > 100_000
    assert out["uniao"]["gap2022"] < 0 and out["uniao"]["gap2026"] > 100_000
    assert out["h2bCount"] == 12
    assert out["pubShareF"] > 0.88
    assert out["privDeficitCount"] >= 8


def test_h1_mirror_comparison_bins_and_lt30_details():
    script = """
    import fs from 'node:fs';
    import { decodeAnalyticalBase } from './src/data.js';
    import { computeH1Comparison } from './src/indicators.js';

    const raw = JSON.parse(fs.readFileSync('data/analytical_base.json', 'utf8'));
    const { candidates } = decodeAnalyticalBase(raw);
    const cmp = computeH1Comparison(candidates, { cargo: 'all' });
    const sum22Reg = cmp.bins.reduce((s, b) => s + b.y2022.regN, 0);
    const sum26Reg = cmp.bins.reduce((s, b) => s + b.y2026.regN, 0);
    const lt30 = cmp.bins.find((b) => b.id === 'lt30');
    console.log(JSON.stringify({
      binCount: cmp.bins.length,
      sum22Reg,
      total22Reg: cmp.byYear[2022].totalSlates,
      sum26Reg,
      total26Reg: cmp.byYear[2026].totalSlates,
      lt30PartiesCount: lt30.partiesUnion.reg.length,
      sameSlateRepeats: cmp.lt30Details.sameSlateRepeats,
      repeatParties: cmp.lt30Details.repeatPartiesReg.map(r => r.party),
    }));
    """
    proc = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    out = json.loads(proc.stdout)
    assert out["binCount"] == 5
    assert out["sum22Reg"] == out["total22Reg"] == 1060
    assert out["sum26Reg"] == out["total26Reg"] == 756
    assert out["lt30PartiesCount"] >= 10
    assert out["sameSlateRepeats"] == 0
    assert "DC" in out["repeatParties"] and "REPUBLICANOS" in out["repeatParties"]


def test_h1_to_h5_2026_comparative_consistency():
    cov = json.loads((ROOT / "data" / "coverage.json").read_text(encoding="utf-8"))["years"]["2026"]
    res = _run_js_indicators(2026)

    assert res["h1"]["totalSlates"] + res["h1"]["microSlatesReg"] == cov["population"]["chapas_reg"]["total"]
    assert res["h2"]["nAptoF"] == cov["population"]["gender_apto"]["F"]
    assert res["h2"]["nAptoM"] == cov["population"]["gender_apto"]["M"]
    assert res["h2"]["verdict"]["status"] != "inconclusivo"
    assert res["h5"]["elF"] + res["h5"]["elM"] > 1000


def test_ato4_threshold_band_comparison_and_ato5_geography():
    script = """
    import fs from 'node:fs';
    import { decodeAnalyticalBase, filterCandidates, UF_NAMES } from './src/data.js';
    import { computeThresholdBandComparison, computeAto5Geography } from './src/indicators.js';

    const raw = JSON.parse(fs.readFileSync('data/analytical_base.json', 'utf8'));
    const { candidates } = decodeAnalyticalBase(raw);
    const rows22 = filterCandidates(candidates, { year: 2022, cargo: 'all' });

    const byChapa = computeThresholdBandComparison(rows22, { unit: 'chapa' });
    const byParty = computeThresholdBandComparison(rows22, { unit: 'party' });
    const geo22 = computeAto5Geography(candidates, { year: 2022, cargo: 'all', ufList: Object.keys(UF_NAMES).sort() });
    const geo26 = computeAto5Geography(candidates, { year: 2026, cargo: '7', ufList: Object.keys(UF_NAMES).sort() });

    console.log(JSON.stringify({
      chapaFloorEleitas: byChapa.floor.pctEleitasF,
      chapaAboveEleitas: byChapa.above.pctEleitasF,
      chapaExcluded: byChapa.excludedBelow30,
      partyFloorUnits: byParty.floor.units,
      partyAboveUnits: byParty.above.units,
      geo22Count: geo22.rows.length,
      geo22Eligible: geo22.eligibleCount,
      geo22Top5Ufs: geo22.top5Eleitas.map(r => ({ uf: r.uf, pct: r.eleitasPct, rank: r.eleitasRank })),
      geo22AnyPillar: geo22.anyPillarCount,
      geo26Count: geo26.rows.length,
    }));
    """
    proc = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    out = json.loads(proc.stdout)
    assert out["chapaAboveEleitas"] > out["chapaFloorEleitas"]
    assert out["chapaExcluded"] > 0
    assert out["partyFloorUnits"] >= 5 and out["partyAboveUnits"] >= 10
    assert out["geo22Count"] == 27 and out["geo22Eligible"] == 27
    top5_map = {item["uf"]: item for item in out["geo22Top5Ufs"]}
    assert len(out["geo22Top5Ufs"]) >= 5 and out["geo22AnyPillar"] >= 1
    assert top5_map["RO"]["rank"] == 5 and top5_map["SE"]["rank"] == 5
    assert top5_map["RO"]["pct"] == top5_map["SE"]["pct"] == 21.9
    assert out["geo26Count"] == 27


def test_h4_sankey_1000_votes_cutoff_and_destinations():
    script = """
    import fs from 'node:fs';
    import { decodeAnalyticalBase, filterCandidates } from './src/data.js';
    import { computeH4Sankey1000 } from './src/indicators.js';

    const raw = JSON.parse(fs.readFileSync('data/analytical_base.json', 'utf8'));
    const cov = JSON.parse(fs.readFileSync('data/coverage.json', 'utf8')).years['2022'];
    const { candidates } = decodeAnalyticalBase(raw);
    const rows22 = filterCandidates(candidates, { year: 2022, cargo: 'all' });
    const s = computeH4Sankey1000(rows22, { voteCutoff: 1000 });

    console.log(JSON.stringify({
      nApto: s.nApto,
      covApto: cov.population.gender_apto.F + cov.population.gender_apto.M,
      profilesCount: s.profiles.length,
      profileSumN: s.profiles.reduce((acc, p) => acc + p.n, 0),
      destIds: s.destinations.map(d => d.id),
      totRec: Math.round(s.totRec),
      sumSources: Math.round(s.totPub + s.totPriv),
      totExp: Math.round(s.totExp),
      sumDests: Math.round(s.totShared + s.totDirect + s.totCands + s.totParty),
      links01: s.links01.length,
      links12: s.links12.length,
    }));
    """
    proc = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    out = json.loads(proc.stdout)
    assert out["nApto"] == out["covApto"] == out["profileSumN"]
    assert out["profilesCount"] == 4
    assert out["destIds"] == ["shared", "direct", "cands", "party"]
    assert out["totRec"] == out["sumSources"]
    assert out["totExp"] == out["sumDests"]
    assert out["links01"] == 8
    assert out["links12"] >= 14
