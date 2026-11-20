"""Configuração centralizada das fontes do TSE e regras de recorte."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DOCS_DIR = ROOT / "docs"

BASELINE_YEAR = 2022
COMPARISON_YEAR = 2026
DEFAULT_YEARS = (2022, 2026)
SUPPORTED_YEARS = (2018, 2022, 2026)

TARGET_CARGOS = ("6", "7")  # 6 = Deputado Federal, 7 = Deputado Estadual
TARGET_ELECTION_TYPE = "2"  # 2 = Eleição Ordinária
CSV_ENCODING = "windows-1252"

NULL_SENTINELS = ("-1", "-3", "-4", "#NULO", "#NULO#", "#NE", "")
INTERNAL_DRD_EXCLUDE = ("20330000", "20340000")
DONATION_DRD_CODES = ("20240000", "20320000", "30020000")


def source_paths(year: int) -> dict[str, Path]:
    """Retorna os caminhos oficiais *_BRASIL.csv para o ano informado."""
    if year not in SUPPORTED_YEARS:
        raise ValueError(f"Ano não suportado: {year}")
    return {
        "consulta_cand": ROOT / f"consulta_cand_{year}" / f"consulta_cand_{year}_BRASIL.csv",
        "votacao": ROOT / f"votacao-{year}" / f"votacao_candidato_munzona_{year}" / f"votacao_candidato_munzona_{year}_BRASIL.csv",
        "receitas": ROOT / f"prestacao_de_contas_eleitorais_candidatos_{year}" / f"receitas_candidatos_{year}_BRASIL.csv",
        "doador_originario": ROOT / f"prestacao_de_contas_eleitorais_candidatos_{year}" / f"receitas_candidatos_doador_originario_{year}_BRASIL.csv",
        "despesas_contratadas": ROOT / f"prestacao_de_contas_eleitorais_candidatos_{year}" / f"despesas_contratadas_candidatos_{year}_BRASIL.csv",
    }
