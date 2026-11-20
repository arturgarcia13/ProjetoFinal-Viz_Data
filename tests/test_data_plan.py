import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _read_header(rel_path: str) -> list[str]:
    path = ROOT / rel_path
    assert path.is_file(), f"Arquivo fonte ausente: {rel_path}"
    with path.open(encoding="latin1") as f:
        reader = csv.reader(f, delimiter=";")
        return next(reader)


def test_plano_de_dados_exists_and_has_required_sections():
    doc = (ROOT / "docs" / "plano_de_dados.md").read_text(encoding="utf-8")
    for required in (
        "Escopo Temporal, Territorial e de Cargos",
        "Fontes Oficiais e Chaves de Cruzamento",
        "Regras de Codificação, Tipos e Valores Especiais",
        "Regras de Limpeza, Deduplicação e Normalização",
        "Regras de Comparação Condicional",
        "SQ_CANDIDATO",
        "CD_CARGO IN ('6', '7')",
        "n < 4",
        "Súmula 73",
    ):
        assert required in doc, f"Seção/regra ausente no Plano de Dados: {required}"


def test_plano_de_dados_columns_match_2022_sources():
    cand_cols = set(_read_header("consulta_cand_2022/consulta_cand_2022_BRASIL.csv"))
    rec_cols = set(_read_header("prestacao_de_contas_eleitorais_candidatos_2022/receitas_candidatos_2022_BRASIL.csv"))
    desp_cols = set(_read_header("prestacao_de_contas_eleitorais_candidatos_2022/despesas_contratadas_candidatos_2022_BRASIL.csv"))
    orig_cols = set(_read_header("prestacao_de_contas_eleitorais_candidatos_2022/receitas_candidatos_doador_originario_2022_BRASIL.csv"))
    pag_cols = set(_read_header("prestacao_de_contas_eleitorais_candidatos_2022/despesas_pagas_candidatos_2022_BRASIL.csv"))

    for col in ("ANO_ELEICAO", "CD_CARGO", "SG_UF", "SQ_CANDIDATO", "CD_SITUACAO_CANDIDATURA", "CD_GENERO", "DS_GENERO", "DS_COR_RACA", "NR_FEDERACAO", "SG_FEDERACAO", "SQ_COLIGACAO", "SG_PARTIDO", "CD_SIT_TOT_TURNO"):
        assert col in cand_cols, f"Coluna ausente em consulta_cand_2022: {col}"

    for col in ("SQ_CANDIDATO", "TP_PRESTACAO_CONTAS", "CD_FONTE_RECEITA", "CD_ORIGEM_RECEITA", "SQ_RECEITA", "VR_RECEITA"):
        assert col in rec_cols, f"Coluna ausente em receitas_2022: {col}"

    for col in ("SQ_CANDIDATO", "TP_PRESTACAO_CONTAS", "CD_ORIGEM_DESPESA", "NR_CPF_CNPJ_FORNECEDOR", "SQ_CANDIDATO_FORNECEDOR", "CD_ESFERA_PART_FORNECEDOR", "SQ_DESPESA", "DT_DESPESA", "VR_DESPESA_CONTRATADA"):
        assert col in desp_cols, f"Coluna ausente em despesas_contratadas_2022: {col}"

    assert "SQ_RECEITA" in orig_cols
    assert "SQ_CANDIDATO" not in pag_cols and "SQ_DESPESA" in pag_cols
