import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _run_js_indicators(year: int) -> dict:
    script = f"""
    import fs from 'node:fs';
    import {{ decodeAnalyticalBase, filterCandidates }} from './src/data.js';
    import {{ computeH1, computeH2, computeH3, computeH4, computeH5 }} from './src/indicators.js';

    const raw = JSON.parse(fs.readFileSync('data/analytical_base.json', 'utf8'));
    const cov = JSON.parse(fs.readFileSync('data/coverage.json', 'utf8')).years['{year}'];
    const {{ candidates }} = decodeAnalyticalBase(raw);
    const rows = filterCandidates(candidates, {{ year: {year}, cargo: 'all' }});
    const out = {{
      h1: computeH1(rows),
      h2: computeH2(rows, cov),
      h3: computeH3(rows, cov),
      h4: computeH4(rows),
      h5: computeH5(rows),
    }};
    // Omit per-slate array for compact stdout check
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

    # H1: total chapas (reg >= 4 + micro < 4) must match coverage
    assert res["h1"]["totalSlates"] + res["h1"]["microSlatesReg"] == cov["population"]["chapas_reg"]["total"]
    assert res["h1"]["microSlatesReg"] == cov["population"]["chapas_reg"]["micro_lt4"]
    assert res["h1"]["microCandsReg"] == cov["population"]["chapas_reg"]["micro_cands"]
    assert 0.80 <= res["h1"]["pctCompliant"] <= 1.0

    # H2 & H3 & H5: APTO F + M denominators must match coverage
    assert res["h2"]["nAptoF"] == cov["population"]["gender_apto"]["F"]
    assert res["h2"]["nAptoM"] == cov["population"]["gender_apto"]["M"]
    assert res["h3"]["nF"] == cov["population"]["gender_apto"]["F"]
    assert res["h3"]["nM"] == cov["population"]["gender_apto"]["M"]
    assert res["h5"]["nF"] == cov["population"]["gender_apto"]["F"]
    assert res["h5"]["nM"] == cov["population"]["gender_apto"]["M"]

    # H5: seats elected in 2022 (1548 total, 1547 APTO + 1 INAPTO cassado)
    assert res["h5"]["elF"] + res["h5"]["elM"] == 1547
    assert res["h5"]["pctVotosF"] < res["h5"]["pctCandF"]  # bottleneck starts at urn
    assert res["h5"]["verdict"]["status"] == "vaza"


def test_h6_to_h9_indicators_and_inconclusive_states():
    script = """
    import fs from 'node:fs';
    import { decodeAnalyticalBase, filterCandidates } from './src/data.js';
    import { computeH6, computeH7, computeH8, computeH9AndParallel } from './src/indicators.js';

    const raw = JSON.parse(fs.readFileSync('data/analytical_base.json', 'utf8'));
    const cov = JSON.parse(fs.readFileSync('data/coverage.json', 'utf8')).years;
    const { candidates } = decodeAnalyticalBase(raw);
    const rows22 = filterCandidates(candidates, { year: 2022, cargo: 'all' });
    const rowsSmall = rows22.filter(c => c.uf === 'RR' && c.p === 'NOVO');

    console.log(JSON.stringify({
      h6: computeH6(rows22, { coverageYear: cov['2022'] }),
      h7: { bands: computeH7(rows22, { coverageYear: cov['2022'] }).bandStats, verdict: computeH7(rows22, { coverageYear: cov['2022'] }).verdict },
      h8: computeH8(candidates),
      h9: { ufLen: computeH9AndParallel(rows22).ufRows.length, stageCounts: computeH9AndParallel(rows22).stageCounts, partyLen: computeH9AndParallel(rows22).partyRows.length },
      smallH6: computeH6(rowsSmall).verdict.status,
      smallH9: computeH9AndParallel(rowsSmall).verdict.status,
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
    assert out["h6"]["summary"]["F"]["n"] == 8468
    assert out["h6"]["verdict"]["status"] in ("vaza", "funcionou")
    assert len(out["h7"]["bands"]) == 4
    assert out["h8"]["byYear"]["2022"]["n"] == 8468
    assert out["h8"]["byYear"]["2026"]["n"] == 6366
    assert out["h9"]["ufLen"] == 27
    assert out["h9"]["partyLen"] >= 10
    assert out["smallH6"] == "inconclusivo"
    assert out["smallH9"] == "inconclusivo"


def test_h1_to_h5_2026_comparative_consistency():
    cov = json.loads((ROOT / "data" / "coverage.json").read_text(encoding="utf-8"))["years"]["2026"]
    res = _run_js_indicators(2026)

    assert res["h1"]["totalSlates"] + res["h1"]["microSlatesReg"] == cov["population"]["chapas_reg"]["total"]
    assert res["h2"]["nAptoF"] == cov["population"]["gender_apto"]["F"]
    assert res["h2"]["nAptoM"] == cov["population"]["gender_apto"]["M"]
    assert res["h2"]["verdict"]["status"] != "inconclusivo"  # 97.9% FINAL after 20/11 update
    assert res["h5"]["elF"] + res["h5"]["elM"] > 1000
