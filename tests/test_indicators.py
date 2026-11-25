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
