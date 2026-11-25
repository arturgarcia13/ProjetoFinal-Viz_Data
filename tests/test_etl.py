import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


def test_etl_artifacts_exist():
    for path in (
        DATA / "analytical_base.json",
        DATA / "network_hubs.json",
        DATA / "coverage.json",
        ROOT / "docs" / "relatorio_cobertura_2022.md",
    ):
        assert path.is_file(), f"Artefato ETL ausente: {path}"


def test_analytical_base_schema_and_no_pii():
    base = json.loads((DATA / "analytical_base.json").read_text(encoding="utf-8"))
    meta = base["meta"]
    assert meta["baselineYear"] == 2022
    assert meta["comparisonYear"] == 2026
    assert meta["years"] == [2022, 2026]
    assert meta["cargos"] == ["6", "7"]

    schema = meta["schema"]
    forbidden = {"SQ_CANDIDATO", "NR_CPF_CANDIDATO", "NM_CANDIDATO", "NM_URNA_CANDIDATO", "DS_EMAIL"}
    assert not (forbidden & set(schema)), f"PII encontrada no schema: {forbidden & set(schema)}"

    cargos_dict = set(base["dict"]["cargo"])
    assert cargos_dict == {"6", "7"}, f"Cargos inesperados: {cargos_dict}"

    rows = base["candidates"]
    assert len(rows) == 27367 + 19098
    cids = [r[0] for r in rows]
    assert cids == list(range(1, len(rows) + 1))


def test_coverage_and_sanity_invariants():
    cov = json.loads((DATA / "coverage.json").read_text(encoding="utf-8"))["years"]
    c22 = cov["2022"]
    assert c22["population"]["total_cands"] == 27367
    assert c22["population"]["apto_cands"] == 24733
    assert c22["population"]["inapto_cands"] == 2634
    assert c22["sources"]["consulta_cand"]["cargo_6_7_rows"] == c22["sources"]["consulta_cand"]["unique_sq"]

    for yr in ("2022", "2026"):
        c = cov[yr]
        assert c["dt_geracao"].get("doador_originario"), f"DT_GERACAO de doador_originario ausente em {yr}"
        inapto = c["population"]["inapto_impact"]
        assert inapto["v_val"] >= 0 and inapto["r"] >= 0 and inapto["e"] >= 0
        assert c["sanity"]["exported_v_val"] == c["sources"]["votacao"]["sum_v_val"]
        assert c["sanity"]["exported_v_nom"] == c["sources"]["votacao"]["sum_v_nom"]
        assert abs(c["sanity"]["exported_r"] - c["sources"]["receitas"]["sum_r"]) < 5.0
        assert abs(c["sanity"]["exported_fefc"] - c["sources"]["receitas"]["sum_fefc"]) < 5.0
        assert abs(c["sanity"]["exported_e"] - c["sources"]["despesas_contratadas"]["sum_e_efetivo"]) < 5.0


def test_network_hubs_integrity_and_lgpd():
    net = json.loads((DATA / "network_hubs.json").read_text(encoding="utf-8"))["years"]
    cpf_re = re.compile(r"\b\d{11}\b")
    mei_cnpj_re = re.compile(r"^\d{2}\.\d{3}\.\d{3}\s+")
    for yr in ("2022", "2026"):
        ydata = net[yr]
        cids = {c["cid"] for c in ydata["candidates"]}
        hids = {h["hid"] for h in ydata["hubs"]}
        assert len(hids) > 0

        cand_csv = DATA / "raw" / f"consulta_cand_{yr}" / f"consulta_cand_{yr}_BRASIL.csv"
        with cand_csv.open(encoding="cp1252") as f:
            reader = csv.DictReader(f, delimiter=";")
            cand_names = {" ".join((row["NM_CANDIDATO"] or "").upper().split()) for row in reader if row.get("NM_CANDIDATO")}

        for h in ydata["hubs"]:
            lbl = h["label"]
            assert not cpf_re.search(lbl), f"CPF exposto no label do hub ({h['tipo']}): {lbl}"
            assert not mei_cnpj_re.match(lbl.strip()), f"MEI pós-2022 com nome civil exposto ({h['tipo']}): {lbl}"
            assert " ".join(lbl.upper().split()) not in cand_names, f"Nome de candidato exposto como hub em {yr}: {lbl}"
            if h["tipo"] == "PF":
                assert lbl.startswith("Fornecedor PF ("), f"PF label inseguro: {lbl}"
        pf_count = sum(1 for h in ydata["hubs"] if h["tipo"] == "PF")
        assert pf_count > 0, f"Nenhum hub PF encontrado em {yr} (possível inversão de CD_TIPO_FORNECEDOR)"
        for link in ydata["links"]:
            assert link["cid"] in cids
            assert link["hid"] in hids
            assert link["val"] > 0


def test_coverage_markdown_sections():
    md = (ROOT / "docs" / "relatorio_cobertura_2022.md").read_text(encoding="utf-8")
    assert "## Ano 2022 — Baseline Principal" in md
    assert "## Ano 2026 — Comparativo Direto" in md
    assert "Impacto das candidaturas `INAPTO`" in md
    assert "Checagens de Sanidade" in md
