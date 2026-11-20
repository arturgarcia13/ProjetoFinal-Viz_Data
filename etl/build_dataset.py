"""Gera a base analítica validada (sem PII), a rede de fornecedores-hub e métricas de auditoria."""

from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
from typing import Any

import duckdb

from etl.config import (
    BASELINE_YEAR,
    COMPARISON_YEAR,
    CSV_ENCODING,
    DATA_DIR,
    DEFAULT_YEARS,
    INTERNAL_DRD_EXCLUDE,
    TARGET_CARGOS,
    TARGET_ELECTION_TYPE,
    source_paths,
)
from etl.report_coverage import write_coverage_artifacts

CANDIDATE_SCHEMA = [
    "cid", "y", "g", "race", "p", "fed", "chapa", "uf", "cargo",
    "apto", "el", "v", "vNom", "hasRec", "hasDesp", "tpConta",
    "r", "fefc", "fp", "prop", "priv", "candRec",
    "e", "toParty", "toCandF", "toCandM", "toCandU", "toShared", "toExcl",
    "zeroFin", "stdPkg",
]

VALID_STR_EXPR = "{col} IS NOT NULL AND TRIM({col}) NOT IN ('', '-1', '-3', '-4', '#NULO', '#NULO#', '#NE')"


def _read_csv_sql(path: Path) -> str:
    p = str(path).replace("'", "''")
    return f"read_csv('{p}', delim=';', header=true, encoding='{CSV_ENCODING}', all_varchar=true)"


def _money_expr(col: str) -> str:
    return f"COALESCE(TRY_CAST(REPLACE(TRIM({col}), ',', '.') AS DOUBLE), 0.0)"


def _tp_rank_expr(col: str = "TP_PRESTACAO_CONTAS") -> str:
    return (
        f"CASE UPPER(TRIM(COALESCE({col}, ''))) "
        "WHEN 'FINAL' THEN 1 "
        "WHEN 'REGULARIZAÇÃO DA OMISSÃO' THEN 2 "
        "WHEN 'PARCIAL' THEN 3 "
        "WHEN 'RELATÓRIO FINANCEIRO' THEN 4 "
        "ELSE 9 END"
    )


def _norm_tp_expr(col: str = "TP_PRESTACAO_CONTAS") -> str:
    return f"UPPER(TRIM(COALESCE({col}, 'AUSENTE')))"


def process_year(con: duckdb.DuckDBPyConnection, year: int, start_cid: int = 1) -> tuple[list[dict[str, Any]], dict[str, Any], dict[str, Any]]:
    """Processa um ano eleitoral completo (1 leitura por CSV) e retorna (candidatos, rede, cobertura)."""
    paths = source_paths(year)
    for name, path in paths.items():
        if not path.is_file():
            raise FileNotFoundError(f"Fonte ausente para {year} ({name}): {path}")

    cand_csv = _read_csv_sql(paths["consulta_cand"])
    vot_csv = _read_csv_sql(paths["votacao"])
    rec_csv = _read_csv_sql(paths["receitas"])
    orig_csv = _read_csv_sql(paths["doador_originario"])
    desp_csv = _read_csv_sql(paths["despesas_contratadas"])

    print(f"[ETL {year}] 1/5 lendo consulta_cand...", flush=True)
    chapa_sql = (
        "CASE "
        "WHEN TRIM(TP_AGREMIACAO) = 'COLIGAÇÃO' AND TRIM(SQ_COLIGACAO) NOT IN ('', '-1', '-3', '#NULO', '#NULO#') "
        "THEN 'COL:' || TRIM(SQ_COLIGACAO) "
        "ELSE TRIM(SG_PARTIDO) END"
        if year == 2018
        else
        "CASE "
        "WHEN TRIM(NR_FEDERACAO) NOT IN ('', '-1', '-3', '#NULO', '#NULO#') "
        " AND TRIM(SG_FEDERACAO) NOT IN ('', '-1', '-3', '#NULO', '#NULO#') "
        "THEN 'FED:' || TRIM(SG_FEDERACAO) "
        "ELSE TRIM(SG_PARTIDO) END"
    )

    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE cand_all_scan_{year} AS
        SELECT
            (TRIM(CD_CARGO) IN {TARGET_CARGOS} AND TRIM(CD_TIPO_ELEICAO) = '{TARGET_ELECTION_TYPE}') AS keep_row,
            DT_GERACAO, CD_CARGO, SG_UF, SQ_CANDIDATO,
            CD_SITUACAO_CANDIDATURA, CD_GENERO, DS_COR_RACA,
            SG_PARTIDO, TP_AGREMIACAO, SQ_COLIGACAO, NR_FEDERACAO, SG_FEDERACAO,
            CD_SIT_TOT_TURNO
        FROM {cand_csv}
    """)
    cand_counts = con.execute(f"""
        SELECT
            COUNT(*) AS raw_total,
            COUNT(*) FILTER (WHERE keep_row) AS filtered_total,
            COUNT(DISTINCT SQ_CANDIDATO) FILTER (WHERE keep_row) AS unique_sq,
            MAX(DT_GERACAO) FILTER (WHERE keep_row) AS dt_geracao
        FROM cand_all_scan_{year}
    """).fetchone()

    print(f"[ETL {year}] 2/5 lendo votacao (1 passada)...", flush=True)
    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE vot_scan_agg_{year} AS
        SELECT
            CASE
                WHEN TRIM(CD_CARGO) IN {TARGET_CARGOS} AND TRIM(CD_TIPO_ELEICAO) = '{TARGET_ELECTION_TYPE}'
                THEN TRIM(SQ_CANDIDATO)
                ELSE '__SKIP__'
            END AS sq_key,
            COUNT(*) AS n_rows,
            SUM(COALESCE(TRY_CAST(QT_VOTOS_NOMINAIS AS BIGINT), 0)) AS v_nom,
            SUM(COALESCE(TRY_CAST(QT_VOTOS_NOMINAIS_VALIDOS AS BIGINT), 0)) AS v_val,
            BOOL_OR(TRIM(CD_SITUACAO_JULGAMENTO) IN ('2', '16')) AS julg_deferido,
            MAX(DT_GERACAO) AS dt_geracao
        FROM {vot_csv}
        GROUP BY 1
    """)
    vot_stats = con.execute(f"""
        SELECT
            COALESCE(SUM(n_rows), 0) AS raw_total,
            COALESCE(SUM(n_rows) FILTER (WHERE sq_key != '__SKIP__'), 0) AS filtered_total,
            COUNT(*) FILTER (WHERE sq_key != '__SKIP__') AS unique_sq,
            COALESCE(SUM(v_nom) FILTER (WHERE sq_key != '__SKIP__'), 0) AS sum_nom,
            COALESCE(SUM(v_val) FILTER (WHERE sq_key != '__SKIP__'), 0) AS sum_val,
            MAX(dt_geracao) FILTER (WHERE sq_key != '__SKIP__') AS dt_geracao
        FROM vot_scan_agg_{year}
    """).fetchone()

    apto_sql = (
        "TRIM(c.CD_SITUACAO_CANDIDATURA) = '12'"
        if year in (2018, 2022)
        else
        "COALESCE(v.julg_deferido, TRIM(c.CD_SIT_TOT_TURNO) IN ('2', '3', '4', '5'))"
    )

    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE cand_clean_{year} AS
        SELECT
            TRIM(c.SQ_CANDIDATO) AS sq_candidato,
            {year}::INTEGER AS y,
            CASE TRIM(c.CD_GENERO)
                WHEN '4' THEN 'F'
                WHEN '2' THEN 'M'
                ELSE 'ND'
            END AS g,
            UPPER(TRIM(COALESCE(NULLIF(c.DS_COR_RACA, '#NULO'), 'NÃO INFORMADO'))) AS race,
            TRIM(c.SG_PARTIDO) AS p,
            CASE
                WHEN TRIM(c.NR_FEDERACAO) NOT IN ('', '-1', '-3', '#NULO', '#NULO#')
                 AND TRIM(c.SG_FEDERACAO) NOT IN ('', '-1', '-3', '#NULO', '#NULO#')
                THEN TRIM(c.SG_FEDERACAO)
                ELSE NULL
            END AS fed,
            {chapa_sql} AS chapa,
            TRIM(c.SG_UF) AS uf,
            TRIM(c.CD_CARGO) AS cargo,
            ({apto_sql})::BOOLEAN AS apto,
            (TRIM(c.CD_SIT_TOT_TURNO) IN ('2', '3'))::BOOLEAN AS el,
            COALESCE(v.v_val, 0)::BIGINT AS v,
            COALESCE(v.v_nom, 0)::BIGINT AS v_nom,
            (v.sq_key IS NOT NULL)::BOOLEAN AS has_vot
        FROM cand_all_scan_{year} c
        LEFT JOIN vot_scan_agg_{year} v
          ON TRIM(c.SQ_CANDIDATO) = v.sq_key AND v.sq_key != '__SKIP__'
        WHERE c.keep_row
    """)

    print(f"[ETL {year}] 3/5 lendo receitas e doador_originario...", flush=True)
    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE rec_all_scan_{year} AS
        SELECT
            (TRIM(CD_CARGO) IN {TARGET_CARGOS} AND TRIM(CD_TIPO_ELEICAO) = '{TARGET_ELECTION_TYPE}') AS keep_row,
            TRIM(SQ_CANDIDATO) AS sq_candidato,
            TRIM(SQ_RECEITA) AS sq_receita,
            {_norm_tp_expr()} AS tp_conta,
            {_tp_rank_expr()} AS tp_rank,
            TRIM(CD_FONTE_RECEITA) AS cd_fonte,
            TRIM(CD_ORIGEM_RECEITA) AS cd_origem,
            {_money_expr('VR_RECEITA')} AS vr,
            DT_GERACAO
        FROM {rec_csv}
    """)
    rec_stats = con.execute(f"""
        SELECT
            COUNT(*) AS raw_total,
            COUNT(*) FILTER (WHERE keep_row) AS filtered_total,
            COUNT(DISTINCT sq_candidato) FILTER (WHERE keep_row) AS unique_cands,
            COALESCE(SUM(vr) FILTER (WHERE keep_row), 0.0) AS sum_vr,
            COALESCE(SUM(vr) FILTER (WHERE keep_row AND cd_fonte = '2'), 0.0) AS sum_fefc,
            MAX(DT_GERACAO) FILTER (WHERE keep_row) AS dt_geracao
        FROM rec_all_scan_{year}
    """).fetchone()

    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE rec_filtered_{year} AS
        WITH best_tp AS (
            SELECT sq_candidato, MIN(tp_rank) AS best_rank
            FROM rec_all_scan_{year}
            WHERE keep_row
            GROUP BY sq_candidato
        )
        SELECT r.*
        FROM rec_all_scan_{year} r
        JOIN best_tp b ON r.sq_candidato = b.sq_candidato AND r.tp_rank = b.best_rank
        WHERE r.keep_row
    """)

    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE rec_agg_{year} AS
        SELECT
            sq_candidato,
            ANY_VALUE(tp_conta) AS tp_conta,
            SUM(vr) AS r,
            SUM(CASE WHEN cd_fonte = '2' THEN vr ELSE 0.0 END) AS fefc,
            SUM(CASE WHEN cd_fonte = '0' THEN vr ELSE 0.0 END) AS fp,
            SUM(CASE WHEN cd_fonte = '1' AND cd_origem = '10010100' THEN vr ELSE 0.0 END) AS prop,
            SUM(CASE WHEN cd_fonte = '1' AND cd_origem != '10010100' THEN vr ELSE 0.0 END) AS priv,
            SUM(CASE WHEN cd_origem = '10040000' THEN vr ELSE 0.0 END) AS cand_rec
        FROM rec_filtered_{year}
        GROUP BY sq_candidato
    """)

    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE orig_scan_{year} AS
        SELECT TRIM(SQ_RECEITA) AS sq_receita
        FROM {orig_csv}
    """)
    orig_stats = con.execute(f"""
        WITH rec_keys AS (
            SELECT DISTINCT sq_receita, cd_origem
            FROM rec_filtered_{year}
            WHERE {VALID_STR_EXPR.format(col='sq_receita')}
        ),
        orig_u AS (
            SELECT DISTINCT sq_receita FROM orig_scan_{year}
        )
        SELECT
            (SELECT COUNT(*) FROM orig_scan_{year}) AS orig_raw_total,
            (SELECT COUNT(*) FROM orig_u) AS orig_unique_sq,
            (SELECT COUNT(*) FROM orig_u o JOIN rec_keys r ON o.sq_receita = r.sq_receita) AS orig_matched_rec_sq,
            (SELECT COUNT(*) FROM rec_keys WHERE cd_origem IN ('10040000', '10020000', '10020500')) AS rec_transfer_sq,
            (SELECT COUNT(*) FROM rec_keys rk JOIN orig_u o ON rk.sq_receita = o.sq_receita
             WHERE rk.cd_origem IN ('10040000', '10020000', '10020500')) AS rec_transfer_matched_orig
    """).fetchone()

    print(f"[ETL {year}] 4/5 lendo despesas_contratadas...", flush=True)
    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE desp_all_scan_{year} AS
        SELECT
            (TRIM(CD_CARGO) IN {TARGET_CARGOS} AND TRIM(CD_TIPO_ELEICAO) = '{TARGET_ELECTION_TYPE}') AS keep_row,
            TRIM(SQ_CANDIDATO) AS sq_candidato,
            {_norm_tp_expr()} AS tp_conta,
            {_tp_rank_expr()} AS tp_rank,
            TRIM(CD_ORIGEM_DESPESA) AS cd_origem,
            TRIM(SQ_CANDIDATO_FORNECEDOR) AS sq_cand_forn,
            TRIM(NR_PARTIDO_FORNECEDOR) AS nr_part_forn,
            TRIM(CD_ESFERA_PART_FORNECEDOR) AS cd_esfera_forn,
            TRIM(CD_TIPO_FORNECEDOR) AS cd_tipo_forn,
            TRIM(DS_TIPO_FORNECEDOR) AS ds_tipo_forn,
            TRIM(NR_CPF_CNPJ_FORNECEDOR) AS doc_forn,
            TRIM(COALESCE(NULLIF(NULLIF(NM_FORNECEDOR_RFB, '#NULO'), '#NULO#'), NM_FORNECEDOR)) AS nm_forn,
            TRIM(DT_DESPESA) AS dt_despesa,
            {_money_expr('VR_DESPESA_CONTRATADA')} AS vr,
            DT_GERACAO
        FROM {desp_csv}
    """)
    desp_stats = con.execute(f"""
        SELECT
            COUNT(*) AS raw_total,
            COUNT(*) FILTER (WHERE keep_row) AS filtered_total,
            COUNT(DISTINCT sq_candidato) FILTER (WHERE keep_row) AS unique_cands,
            COALESCE(SUM(vr) FILTER (WHERE keep_row AND cd_origem NOT IN {INTERNAL_DRD_EXCLUDE}), 0.0) AS sum_vr_efetivo,
            COALESCE(SUM(vr) FILTER (WHERE keep_row AND cd_origem IN {INTERNAL_DRD_EXCLUDE}), 0.0) AS sum_vr_interno_excl,
            MAX(DT_GERACAO) FILTER (WHERE keep_row) AS dt_geracao
        FROM desp_all_scan_{year}
    """).fetchone()

    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE desp_clean_{year} AS
        WITH best_tp AS (
            SELECT sq_candidato, MIN(tp_rank) AS best_rank
            FROM desp_all_scan_{year}
            WHERE keep_row
            GROUP BY sq_candidato
        )
        SELECT
            d.*,
            c.uf AS cand_uf,
            c.p AS cand_p,
            c.chapa AS cand_chapa,
            c.apto AS cand_apto,
            rc.g AS recip_g,
            CASE
                WHEN {VALID_STR_EXPR.format(col='d.sq_cand_forn')} THEN 'CAND'
                WHEN {VALID_STR_EXPR.format(col='d.nr_part_forn')}
                  OR {VALID_STR_EXPR.format(col='d.cd_esfera_forn')}
                  OR d.cd_origem = '20240000'
                THEN 'PARTY'
                ELSE 'EXT'
            END AS dest_kind
        FROM desp_all_scan_{year} d
        JOIN best_tp b ON d.sq_candidato = b.sq_candidato AND d.tp_rank = b.best_rank
        JOIN cand_clean_{year} c ON d.sq_candidato = c.sq_candidato
        LEFT JOIN cand_clean_{year} rc ON d.sq_cand_forn = rc.sq_candidato
        WHERE d.keep_row AND d.cd_origem NOT IN {INTERNAL_DRD_EXCLUDE}
    """)

    print(f"[ETL {year}] 5/5 agregando indicadores, sinais e rede...", flush=True)
    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE shared_sup_{year} AS
        SELECT cand_uf, cand_chapa, doc_forn
        FROM desp_clean_{year}
        WHERE dest_kind = 'EXT'
          AND cand_apto = TRUE
          AND {VALID_STR_EXPR.format(col='doc_forn')}
        GROUP BY cand_uf, cand_chapa, doc_forn
        HAVING COUNT(DISTINCT sq_candidato) >= 2
    """)

    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE std_desp_cands_{year} AS
        SELECT DISTINCT d.sq_candidato
        FROM desp_clean_{year} d
        JOIN (
            SELECT cand_uf, cand_p, doc_forn, dt_despesa, ROUND(vr, 2) AS vr2
            FROM desp_clean_{year}
            WHERE dest_kind = 'EXT'
              AND cand_apto = TRUE
              AND vr > 0
              AND {VALID_STR_EXPR.format(col='doc_forn')}
              AND {VALID_STR_EXPR.format(col='dt_despesa')}
            GROUP BY cand_uf, cand_p, doc_forn, dt_despesa, ROUND(vr, 2)
            HAVING COUNT(DISTINCT sq_candidato) >= 3
        ) grp
          ON d.cand_uf = grp.cand_uf
         AND d.cand_p = grp.cand_p
         AND d.doc_forn = grp.doc_forn
         AND d.dt_despesa = grp.dt_despesa
         AND ROUND(d.vr, 2) = grp.vr2
        WHERE d.dest_kind = 'EXT' AND d.cand_apto = TRUE
    """)

    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE desp_agg_{year} AS
        SELECT
            d.sq_candidato,
            ANY_VALUE(d.tp_conta) AS tp_conta_desp,
            SUM(d.vr) AS e,
            SUM(CASE WHEN d.dest_kind = 'PARTY' THEN d.vr ELSE 0.0 END) AS to_party,
            SUM(CASE WHEN d.dest_kind = 'CAND' AND d.recip_g = 'F' THEN d.vr ELSE 0.0 END) AS to_cand_f,
            SUM(CASE WHEN d.dest_kind = 'CAND' AND d.recip_g = 'M' THEN d.vr ELSE 0.0 END) AS to_cand_m,
            SUM(CASE WHEN d.dest_kind = 'CAND' AND COALESCE(d.recip_g, 'ND') NOT IN ('F', 'M') THEN d.vr ELSE 0.0 END) AS to_cand_u,
            SUM(CASE WHEN d.dest_kind = 'EXT' AND s.doc_forn IS NOT NULL THEN d.vr ELSE 0.0 END) AS to_shared,
            SUM(CASE WHEN d.dest_kind = 'EXT' AND s.doc_forn IS NULL THEN d.vr ELSE 0.0 END) AS to_excl
        FROM desp_clean_{year} d
        LEFT JOIN shared_sup_{year} s
          ON d.cand_uf = s.cand_uf AND d.cand_chapa = s.cand_chapa AND d.doc_forn = s.doc_forn
        GROUP BY d.sq_candidato
    """)

    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE std_pub_cands_{year} AS
        SELECT DISTINCT c.sq_candidato
        FROM cand_clean_{year} c
        JOIN rec_agg_{year} r ON c.sq_candidato = r.sq_candidato
        JOIN (
            SELECT c2.uf, c2.p, ROUND(r2.fefc, 2) AS fefc2, ROUND(r2.fp, 2) AS fp2
            FROM cand_clean_{year} c2
            JOIN rec_agg_{year} r2 ON c2.sq_candidato = r2.sq_candidato
            WHERE c2.apto = TRUE AND (r2.fefc > 0 OR r2.fp > 0)
            GROUP BY c2.uf, c2.p, ROUND(r2.fefc, 2), ROUND(r2.fp, 2)
            HAVING COUNT(DISTINCT c2.sq_candidato) >= 3
        ) grp
          ON c.uf = grp.uf AND c.p = grp.p
         AND ROUND(r.fefc, 2) = grp.fefc2 AND ROUND(r.fp, 2) = grp.fp2
        WHERE c.apto = TRUE
    """)

    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE cand_final_{year} AS
        SELECT
            ({start_cid - 1} + ROW_NUMBER() OVER (ORDER BY c.uf, c.cargo, c.sq_candidato))::INTEGER AS cid,
            c.sq_candidato,
            c.y,
            c.g,
            c.race,
            c.p,
            c.fed,
            c.chapa,
            c.uf,
            c.cargo,
            c.apto,
            c.el,
            c.v,
            c.v_nom,
            (r.sq_candidato IS NOT NULL)::BOOLEAN AS has_rec,
            (d.sq_candidato IS NOT NULL)::BOOLEAN AS has_desp,
            COALESCE(r.tp_conta, d.tp_conta_desp, 'AUSENTE') AS tp_conta,
            ROUND(COALESCE(r.r, 0.0), 2) AS r,
            ROUND(COALESCE(r.fefc, 0.0), 2) AS fefc,
            ROUND(COALESCE(r.fp, 0.0), 2) AS fp,
            ROUND(COALESCE(r.prop, 0.0), 2) AS prop,
            ROUND(COALESCE(r.priv, 0.0), 2) AS priv,
            ROUND(COALESCE(r.cand_rec, 0.0), 2) AS cand_rec,
            ROUND(COALESCE(d.e, 0.0), 2) AS e,
            ROUND(COALESCE(d.to_party, 0.0), 2) AS to_party,
            ROUND(COALESCE(d.to_cand_f, 0.0), 2) AS to_cand_f,
            ROUND(COALESCE(d.to_cand_m, 0.0), 2) AS to_cand_m,
            ROUND(COALESCE(d.to_cand_u, 0.0), 2) AS to_cand_u,
            ROUND(COALESCE(d.to_shared, 0.0), 2) AS to_shared,
            ROUND(COALESCE(d.to_excl, 0.0), 2) AS to_excl,
            ((r.sq_candidato IS NOT NULL OR d.sq_candidato IS NOT NULL)
             AND COALESCE(r.r, 0.0) = 0.0 AND COALESCE(d.e, 0.0) = 0.0)::BOOLEAN AS zero_fin,
            (sd.sq_candidato IS NOT NULL OR sp.sq_candidato IS NOT NULL)::BOOLEAN AS std_pkg,
            c.has_vot
        FROM cand_clean_{year} c
        LEFT JOIN rec_agg_{year} r ON c.sq_candidato = r.sq_candidato
        LEFT JOIN desp_agg_{year} d ON c.sq_candidato = d.sq_candidato
        LEFT JOIN std_desp_cands_{year} sd ON c.sq_candidato = sd.sq_candidato
        LEFT JOIN std_pub_cands_{year} sp ON c.sq_candidato = sp.sq_candidato
    """)

    rows_raw = con.execute(f"""
        SELECT
            cid, y, g, race, p, fed, chapa, uf, cargo,
            apto, el, v, v_nom, has_rec, has_desp, tp_conta,
            r, fefc, fp, prop, priv, cand_rec,
            e, to_party, to_cand_f, to_cand_m, to_cand_u, to_shared, to_excl,
            zero_fin, std_pkg
        FROM cand_final_{year}
        ORDER BY cid
    """).fetchall()

    candidates = [dict(zip(CANDIDATE_SCHEMA, row)) for row in rows_raw]

    hub_edges = con.execute(f"""
        WITH cand_sup AS (
            SELECT
                d.sq_candidato,
                d.cand_uf AS uf,
                d.cand_p AS p,
                d.doc_forn,
                ANY_VALUE(d.cd_tipo_forn) AS cd_tipo_forn,
                ANY_VALUE(d.ds_tipo_forn) AS ds_tipo_forn,
                ANY_VALUE(d.nm_forn) AS nm_forn,
                SUM(d.vr) AS val
            FROM desp_clean_{year} d
            WHERE d.dest_kind = 'EXT'
              AND d.cand_apto = TRUE
              AND d.vr > 0
              AND {VALID_STR_EXPR.format(col='d.doc_forn')}
            GROUP BY d.sq_candidato, d.cand_uf, d.cand_p, d.doc_forn
        ),
        cand_sup_share AS (
            SELECT
                cs.*,
                cf.cid,
                cf.g,
                cf.chapa,
                cf.cargo,
                cf.v,
                cf.e,
                CASE WHEN cf.e > 0 THEN cs.val / cf.e ELSE 0.0 END AS share
            FROM cand_sup cs
            JOIN cand_final_{year} cf ON cs.sq_candidato = cf.sq_candidato
        ),
        hubs AS (
            SELECT
                uf, p, doc_forn,
                ANY_VALUE(cd_tipo_forn) AS cd_tipo_forn,
                ANY_VALUE(ds_tipo_forn) AS ds_tipo_forn,
                ANY_VALUE(nm_forn) AS nm_forn,
                COUNT(DISTINCT cid) AS cands_n,
                COUNT(DISTINCT CASE WHEN v < 20 THEN cid END) AS low_vote_n,
                SUM(val) AS total_val
            FROM cand_sup_share
            GROUP BY uf, p, doc_forn
            HAVING COUNT(DISTINCT cid) >= 2
               AND MAX(CASE WHEN v < 20 AND share > 0.15 THEN 1 ELSE 0 END) = 1
        )
        SELECT
            h.uf, h.p, h.doc_forn, h.cd_tipo_forn, h.ds_tipo_forn, h.nm_forn,
            h.cands_n, h.low_vote_n, ROUND(h.total_val, 2) AS hub_total,
            css.cid, css.g, css.chapa, css.cargo, css.v, ROUND(css.e, 2) AS e,
            ROUND(css.val, 2) AS edge_val, ROUND(css.share, 4) AS share
        FROM hubs h
        JOIN cand_sup_share css
          ON h.uf = css.uf AND h.p = css.p AND h.doc_forn = css.doc_forn
        ORDER BY h.low_vote_n DESC, h.total_val DESC, css.cid
    """).fetchall()

    hub_map: dict[tuple[str, str, str], dict[str, Any]] = {}
    cand_node_map: dict[int, dict[str, Any]] = {}
    links: list[dict[str, Any]] = []

    for rec in hub_edges:
        uf, p, doc_forn, cd_tipo, ds_tipo, nm_forn, cands_n, low_n, hub_total, cid, g, chapa, cargo, v, e, val, share = rec
        hkey = (uf, p, doc_forn)
        if hkey not in hub_map:
            hid = f"H{year}_{len(hub_map) + 1}"
            # Nos CSVs reais do TSE, CD_TIPO_FORNECEDOR '1' = PESSOA JURÍDICA e '0' = PESSOA FÍSICA
            is_pj = (cd_tipo == "1") and ("JUR" in (ds_tipo or "").upper())
            label = nm_forn if (is_pj and nm_forn and nm_forn not in ("#NULO", "#NULO#")) else f"Fornecedor PF ({uf}) #{len(hub_map) + 1}"
            hub_map[hkey] = {
                "hid": hid,
                "y": year,
                "uf": uf,
                "p": p,
                "tipo": "PJ" if is_pj else "PF",
                "label": label,
                "candsN": int(cands_n),
                "lowVoteN": int(low_n),
                "totalVal": float(hub_total),
            }
        hid = hub_map[hkey]["hid"]
        if cid not in cand_node_map:
            cand_node_map[cid] = {
                "cid": int(cid),
                "y": year,
                "g": g,
                "p": p,
                "chapa": chapa,
                "uf": uf,
                "cargo": cargo,
                "v": int(v),
                "e": float(e),
            }
        links.append({
            "cid": int(cid),
            "hid": hid,
            "val": float(val),
            "share": float(share),
        })

    network_year = {
        "hubs": list(hub_map.values()),
        "candidates": list(cand_node_map.values()),
        "links": links,
    }

    cov_counts = con.execute(f"""
        WITH chapas AS (
            SELECT
                uf, cargo, chapa,
                COUNT(*) AS n_reg,
                SUM(CASE WHEN apto THEN 1 ELSE 0 END) AS n_apto
            FROM cand_final_{year}
            GROUP BY uf, cargo, chapa
        )
        SELECT
            (SELECT COUNT(*) FROM cand_final_{year}) AS total_cands,
            (SELECT COUNT(*) FROM cand_final_{year} WHERE apto) AS apto_cands,
            (SELECT COUNT(*) FROM cand_final_{year} WHERE NOT apto) AS inapto_cands,
            (SELECT COUNT(*) FROM cand_final_{year} WHERE g = 'F') AS g_f,
            (SELECT COUNT(*) FROM cand_final_{year} WHERE g = 'M') AS g_m,
            (SELECT COUNT(*) FROM cand_final_{year} WHERE g = 'ND') AS g_nd,
            (SELECT COUNT(*) FROM cand_final_{year} WHERE apto AND g = 'F') AS apto_g_f,
            (SELECT COUNT(*) FROM cand_final_{year} WHERE apto AND g = 'M') AS apto_g_m,
            (SELECT COUNT(*) FROM cand_final_{year} WHERE apto AND g = 'ND') AS apto_g_nd,
            (SELECT COUNT(*) FROM cand_final_{year} WHERE has_vot) AS matched_vot,
            (SELECT COUNT(*) FROM cand_final_{year} WHERE apto AND has_vot) AS apto_matched_vot,
            (SELECT COUNT(*) FROM cand_final_{year} WHERE has_rec) AS matched_rec,
            (SELECT COUNT(*) FROM cand_final_{year} WHERE apto AND has_rec) AS apto_matched_rec,
            (SELECT COUNT(*) FROM cand_final_{year} WHERE has_desp) AS matched_desp,
            (SELECT COUNT(*) FROM cand_final_{year} WHERE apto AND has_desp) AS apto_matched_desp,
            (SELECT COUNT(*) FROM cand_final_{year} WHERE zero_fin) AS zero_fin_all,
            (SELECT COUNT(*) FROM cand_final_{year} WHERE apto AND zero_fin) AS zero_fin_apto,
            (SELECT COUNT(*) FROM cand_final_{year} WHERE NOT has_rec) AS missing_rec_all,
            (SELECT COUNT(*) FROM cand_final_{year} WHERE apto AND NOT has_rec) AS missing_rec_apto,
            (SELECT COALESCE(SUM(v), 0) FROM cand_final_{year}) AS exported_v_val,
            (SELECT COALESCE(SUM(v_nom), 0) FROM cand_final_{year}) AS exported_v_nom,
            (SELECT ROUND(COALESCE(SUM(r), 0.0), 2) FROM cand_final_{year}) AS exported_r,
            (SELECT ROUND(COALESCE(SUM(fefc), 0.0), 2) FROM cand_final_{year}) AS exported_fefc,
            (SELECT ROUND(COALESCE(SUM(e), 0.0), 2) FROM cand_final_{year}) AS exported_e,
            (SELECT COUNT(*) FROM chapas) AS total_chapas_reg,
            (SELECT COUNT(*) FROM chapas WHERE n_reg < 4) AS micro_chapas_reg,
            (SELECT COALESCE(SUM(n_reg), 0) FROM chapas WHERE n_reg < 4) AS micro_cands_reg,
            (SELECT COUNT(*) FROM chapas WHERE n_apto > 0) AS total_chapas_apto,
            (SELECT COUNT(*) FROM chapas WHERE n_apto > 0 AND n_apto < 4) AS micro_chapas_apto,
            (SELECT COALESCE(SUM(n_apto), 0) FROM chapas WHERE n_apto > 0 AND n_apto < 4) AS micro_cands_apto
    """).fetchone()

    tp_dist = con.execute(f"""
        SELECT tp_conta, COUNT(*) AS n
        FROM cand_final_{year}
        GROUP BY tp_conta
        ORDER BY n DESC
    """).fetchall()

    tp_dist_apto = con.execute(f"""
        SELECT tp_conta, COUNT(*) AS n
        FROM cand_final_{year}
        WHERE apto
        GROUP BY tp_conta
        ORDER BY n DESC
    """).fetchall()

    coverage_year = {
        "year": year,
        "role": "baseline" if year == BASELINE_YEAR else ("comparison" if year == COMPARISON_YEAR else "auxiliary"),
        "dt_geracao": {
            "consulta_cand": cand_counts[3],
            "votacao": vot_stats[5],
            "receitas": rec_stats[5],
            "despesas_contratadas": desp_stats[5],
        },
        "sources": {
            "consulta_cand": {"raw_rows": int(cand_counts[0]), "cargo_6_7_rows": int(cand_counts[1]), "unique_sq": int(cand_counts[2])},
            "votacao": {"raw_rows": int(vot_stats[0]), "cargo_6_7_rows": int(vot_stats[1]), "unique_sq": int(vot_stats[2]), "sum_v_nom": int(vot_stats[3]), "sum_v_val": int(vot_stats[4])},
            "receitas": {"raw_rows": int(rec_stats[0]), "cargo_6_7_rows": int(rec_stats[1]), "unique_sq": int(rec_stats[2]), "sum_r": round(float(rec_stats[3]), 2), "sum_fefc": round(float(rec_stats[4]), 2)},
            "doador_originario": {
                "raw_rows": int(orig_stats[0]),
                "unique_sq_receita": int(orig_stats[1]),
                "matched_cargo_6_7_sq_receita": int(orig_stats[2]),
                "rec_transfer_sq": int(orig_stats[3]),
                "rec_transfer_matched_orig": int(orig_stats[4]),
            },
            "despesas_contratadas": {
                "raw_rows": int(desp_stats[0]),
                "cargo_6_7_rows": int(desp_stats[1]),
                "unique_sq": int(desp_stats[2]),
                "sum_e_efetivo": round(float(desp_stats[3]), 2),
                "sum_e_interno_excl": round(float(desp_stats[4]), 2),
            },
        },
        "population": {
            "total_cands": int(cov_counts[0]),
            "apto_cands": int(cov_counts[1]),
            "inapto_cands": int(cov_counts[2]),
            "gender_all": {"F": int(cov_counts[3]), "M": int(cov_counts[4]), "ND": int(cov_counts[5])},
            "gender_apto": {"F": int(cov_counts[6]), "M": int(cov_counts[7]), "ND": int(cov_counts[8])},
            "chapas_reg": {"total": int(cov_counts[24]), "micro_lt4": int(cov_counts[25]), "micro_cands": int(cov_counts[26])},
            "chapas_apto": {"total": int(cov_counts[27]), "micro_lt4": int(cov_counts[28]), "micro_cands": int(cov_counts[29])},
        },
        "matching": {
            "all": {
                "votacao": int(cov_counts[9]),
                "receitas": int(cov_counts[11]),
                "despesas_contratadas": int(cov_counts[13]),
                "zero_fin": int(cov_counts[15]),
                "missing_rec": int(cov_counts[17]),
            },
            "apto": {
                "votacao": int(cov_counts[10]),
                "receitas": int(cov_counts[12]),
                "despesas_contratadas": int(cov_counts[14]),
                "zero_fin": int(cov_counts[16]),
                "missing_rec": int(cov_counts[18]),
            },
        },
        "tp_prestacao_all": {k: int(v) for k, v in tp_dist},
        "tp_prestacao_apto": {k: int(v) for k, v in tp_dist_apto},
        "sanity": {
            "exported_v_val": int(cov_counts[19]),
            "exported_v_nom": int(cov_counts[20]),
            "exported_r": float(cov_counts[21]),
            "exported_fefc": float(cov_counts[22]),
            "exported_e": float(cov_counts[23]),
        },
        "hubs_summary": {
            "hubs_count": len(hub_map),
            "cand_nodes_count": len(cand_node_map),
            "links_count": len(links),
        },
    }

    # Libera tabelas temporárias do ano antes de seguir para o próximo
    for tbl in (
        f"cand_all_scan_{year}", f"vot_scan_agg_{year}", f"cand_clean_{year}",
        f"rec_all_scan_{year}", f"rec_filtered_{year}", f"rec_agg_{year}",
        f"orig_scan_{year}", f"desp_all_scan_{year}", f"desp_clean_{year}",
        f"shared_sup_{year}", f"std_desp_cands_{year}", f"desp_agg_{year}",
        f"std_pub_cands_{year}", f"cand_final_{year}",
    ):
        con.execute(f"DROP TABLE IF EXISTS {tbl}")

    return candidates, network_year, coverage_year


def _encode_candidates(candidates: list[dict[str, Any]]) -> tuple[dict[str, list[Any]], list[list[Any]]]:
    """Codifica strings repetidas em dicionários compactos mantendo ordem determinística."""
    dict_fields = ("race", "p", "fed", "chapa", "uf", "cargo", "tpConta")
    dictionaries: dict[str, dict[Any, int]] = {f: {} for f in dict_fields}
    encoded_rows: list[list[Any]] = []

    for c in candidates:
        row: list[Any] = []
        for k in CANDIDATE_SCHEMA:
            val = c[k]
            if k in dictionaries:
                d = dictionaries[k]
                if val not in d:
                    d[val] = len(d)
                row.append(d[val])
            else:
                row.append(val)
        encoded_rows.append(row)

    dict_lists = {f: [k for k, _ in sorted(d.items(), key=lambda kv: kv[1])] for f, d in dictionaries.items()}
    return dict_lists, encoded_rows


def build_all(years: tuple[int, ...] = DEFAULT_YEARS) -> None:
    """Executa o pipeline para os anos solicitados e grava os artefatos em data/ e docs/."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()

    all_candidates: list[dict[str, Any]] = []
    network_by_year: dict[str, Any] = {}
    coverage_by_year: dict[str, Any] = {}
    next_cid = 1

    for year in years:
        cands, net, cov = process_year(con, year, start_cid=next_cid)
        all_candidates.extend(cands)
        network_by_year[str(year)] = net
        coverage_by_year[str(year)] = cov
        next_cid += len(cands)

    dict_lists, encoded_rows = _encode_candidates(all_candidates)

    analytical_payload = {
        "meta": {
            "baselineYear": BASELINE_YEAR,
            "comparisonYear": COMPARISON_YEAR,
            "years": list(years),
            "cargos": ["6", "7"],
            "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
            "schema": CANDIDATE_SCHEMA,
            "sourcesDtGeracao": {str(y): coverage_by_year[str(y)]["dt_geracao"] for y in years},
        },
        "dict": dict_lists,
        "candidates": encoded_rows,
    }

    (DATA_DIR / "analytical_base.json").write_text(
        json.dumps(analytical_payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    (DATA_DIR / "network_hubs.json").write_text(
        json.dumps({"years": network_by_year}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    write_coverage_artifacts(coverage_by_year)
    print("[ETL] Concluído com sucesso!", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="ETL reprodutível do projeto Cota de Gênero (TSE).")
    parser.add_argument(
        "--years",
        nargs="+",
        type=int,
        default=list(DEFAULT_YEARS),
        help="Anos eleitorais a processar (padrão: 2022 2026).",
    )
    args = parser.parse_args()
    build_all(tuple(args.years))


if __name__ == "__main__":
    main()
