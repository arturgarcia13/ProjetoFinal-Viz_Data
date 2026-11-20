import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_harness_files_exist():
    for name in ("SPEC.md", "progress.md", "feature_list.json", "init.sh", "Proposta do Projeto Final.md"):
        assert (ROOT / name).is_file(), f"Arquivo obrigatório ausente: {name}"


def test_feature_list_schema():
    items = json.loads((ROOT / "feature_list.json").read_text(encoding="utf-8"))
    assert isinstance(items, list) and len(items) >= 10
    required_keys = {"id", "category", "description", "steps", "passes"}
    for item in items:
        assert required_keys.issubset(item.keys()), f"Item inválido: {item}"
        assert isinstance(item["steps"], list) and len(item["steps"]) >= 1
        assert isinstance(item["passes"], bool)


def test_br_uf_geojson_valid():
    geo = json.loads((ROOT / "data" / "br_uf.json").read_text(encoding="utf-8"))
    assert geo.get("type") == "FeatureCollection"
    assert len(geo.get("features", [])) == 27
