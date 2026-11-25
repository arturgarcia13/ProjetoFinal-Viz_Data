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
    import { computeH4, computeH6, computeH7, computeH8, computeH9AndParallel } from './src/indicators.js';

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
      smallH4: computeH4(rowsSmall).verdict.status,
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
    assert out["smallH4"] == "inconclusivo"
    assert out["smallH6"] == "inconclusivo"
    assert out["smallH9"] == "inconclusivo"


def test_federation_filter_and_h9_step_ratio():
    script = """
    import fs from 'node:fs';
    import { decodeAnalyticalBase, filterCandidates } from './src/data.js';
    import { computeH1, computeH5, computeH9AndParallel } from './src/indicators.js';

    const raw = JSON.parse(fs.readFileSync('data/analytical_base.json', 'utf8'));
    const { candidates } = decodeAnalyticalBase(raw);
    const rows22 = filterCandidates(candidates, { year: 2022, cargo: 'all' });
    const pcdob = filterCandidates(candidates, { year: 2022, cargo: 'all', party: 'PC do B' });
    const h1Pcdob = computeH1(pcdob);
    const h9All = computeH9AndParallel(rows22);
    const h5All = computeH5(rows22);

    console.log(JSON.stringify({
      pcdobMicro: h1Pcdob.microSlatesReg,
      pcdobSlates: h1Pcdob.totalSlates,
      h9StageCounts: h9All.stageCounts,
      h5UrnaRatio: h5All.pctVotosF / h5All.pctCandF,
      h5CadeiraRatio: h5All.pctEleitasF / h5All.pctVotosF,
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
    # PC do B participa da federação FE Brasil (n>=4 na maioria das UFs, sem 31 falsas micro-chapas)
    assert out["pcdobMicro"] <= 3
    assert out["pcdobSlates"] >= 20
    # H9 deve apontar maioria em Urna (Votos) em linha com H5 (perda maior na urna que nas sobras)
    assert out["h5UrnaRatio"] < out["h5CadeiraRatio"]
    assert out["h9StageCounts"].get("Urna (Votos)", 0) > out["h9StageCounts"].get("Urna (Cadeiras)", 0)


def test_h1_to_h5_2026_comparative_consistency():
    cov = json.loads((ROOT / "data" / "coverage.json").read_text(encoding="utf-8"))["years"]["2026"]
    res = _run_js_indicators(2026)

    assert res["h1"]["totalSlates"] + res["h1"]["microSlatesReg"] == cov["population"]["chapas_reg"]["total"]
    assert res["h2"]["nAptoF"] == cov["population"]["gender_apto"]["F"]
    assert res["h2"]["nAptoM"] == cov["population"]["gender_apto"]["M"]
    assert res["h2"]["verdict"]["status"] != "inconclusivo"  # 97.9% FINAL after 20/11 update
    assert res["h5"]["elF"] + res["h5"]["elM"] > 1000


def test_h1_mirror_comparison_bins_partition_and_totals():
    script = """
    import fs from 'node:fs';
    import { decodeAnalyticalBase } from './src/data.js';
    import { computeH1Comparison } from './src/indicators.js';

    const raw = JSON.parse(fs.readFileSync('data/analytical_base.json', 'utf8'));
    const { candidates } = decodeAnalyticalBase(raw);
    const cmp = computeH1Comparison(candidates, { cargo: 'all' });
    const sum22Reg = cmp.bins.reduce((s, b) => s + b.y2022.regN, 0);
    const sum22Apto = cmp.bins.reduce((s, b) => s + b.y2022.aptoN, 0);
    const sum26Reg = cmp.bins.reduce((s, b) => s + b.y2026.regN, 0);
    const sum26Apto = cmp.bins.reduce((s, b) => s + b.y2026.aptoN, 0);
    const floor = cmp.bins.find((b) => b.id === '30-33');
    console.log(JSON.stringify({
      binCount: cmp.bins.length,
      sum22Reg,
      total22Reg: cmp.byYear[2022].totalSlates,
      sum22Apto,
      total22Apto: cmp.byYear[2022].aptoSlatesCount,
      sum26Reg,
      total26Reg: cmp.byYear[2026].totalSlates,
      sum26Apto,
      total26Apto: cmp.byYear[2026].aptoSlatesCount,
      floor22Reg: floor.y2022.regN,
      floor22Apto: floor.y2022.aptoN,
      floor26Reg: floor.y2026.regN,
      floor26Apto: floor.y2026.aptoN,
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
    assert out["sum22Apto"] == out["total22Apto"] == 1032
    assert out["sum26Reg"] == out["total26Reg"] == 756
    assert out["sum26Apto"] == out["total26Apto"] == 737
    assert out["floor22Reg"] == 575 and out["floor22Apto"] == 511
    assert out["floor26Reg"] == 320 and out["floor26Apto"] == 291


def test_h2_by_year_2022_and_2026_top12():
    res22 = _run_js_indicators(2022)["h2"]
    res26 = _run_js_indicators(2026)["h2"]
    assert len(res22["byParty"]) >= 12
    assert len(res26["byParty"]) >= 12
    assert len(res22["sources"]) == 2
    assert len(res26["sources"]) == 2


def test_scale_mosaic_and_divergent_disparity():
    script = """
    import fs from 'node:fs';
    import { decodeAnalyticalBase, filterCandidates } from './src/data.js';
    import {
      computeH1, computeH2, computeScaleMosaic, computeDivergentDisparity,
    } from './src/indicators.js';

    const raw = JSON.parse(fs.readFileSync('data/analytical_base.json', 'utf8'));
    const { candidates } = decodeAnalyticalBase(raw);
    const rows22 = filterCandidates(candidates, { year: 2022, cargo: 'all' });
    const h1 = computeH1(rows22);
    const h2 = computeH2(rows22);
    const mosaic = computeScaleMosaic(rows22, h1, { voteThreshold: 10, maxTiles: 48 });
    const divPriv = computeDivergentDisparity(h2, { mode: 'priv', limit: 12, cap: 15 });
    const divZeroCheck = computeDivergentDisparity({
      medPrivF: 0,
      medPrivM: 1000,
      byParty: [
        { party: 'EQ', total: 50, nF: 20, nM: 30, medPrivF: 500, medPrivM: 500, medPubF: 1000, medPubM: 1000, medF: 1500, medM: 1500 },
        { party: 'ZEROF', total: 40, nF: 15, nM: 25, medPrivF: 0, medPrivM: 2000, medPubF: 1000, medPubM: 1000, medF: 1000, medM: 3000 },
      ],
    }, { mode: 'priv', cap: 15 });

    console.log(JSON.stringify({
      totalSlates: mosaic.totalSlates,
      tileCount: mosaic.tiles.length,
      pullOutCount: mosaic.pullOuts.length,
      uniquePullOuts: new Set(mosaic.pullOuts.map((p) => p.key)).size,
      pullOutKeysInTiles: mosaic.pullOuts.every((p) => mosaic.tiles.some((t) => t.key === p.key)),
      divCount: divPriv.rows.length,
      favoringM: divPriv.summary.favoringM,
      eqLog: divZeroCheck.rows.find((r) => r.party === 'EQ').signedLog,
      zeroFDir: divZeroCheck.rows.find((r) => r.party === 'ZEROF').direction,
      zeroFFactor: divZeroCheck.rows.find((r) => r.party === 'ZEROF').factor,
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
    assert out["totalSlates"] == 1060
    assert out["tileCount"] == 48
    assert out["pullOutCount"] == 4
    assert out["uniquePullOuts"] == 4
    assert out["pullOutKeysInTiles"] is True
    assert out["divCount"] == 12
    assert out["favoringM"] >= 10
    assert out["eqLog"] == 0
    assert out["zeroFDir"] == "M"
    assert out["zeroFFactor"] == 15
