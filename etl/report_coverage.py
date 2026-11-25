"""Gera data/coverage.json e docs/relatorio_cobertura_2022.md a partir das métricas do ETL."""

from __future__ import annotations

import json
from typing import Any

from etl.config import DATA_DIR, DOCS_DIR


def _pct(part: int | float, total: int | float) -> str:
    if not total:
        return "0,0%"
    return f"{(100.0 * part / total):.1f}%".replace(".", ",")


def _fmt_int(n: int) -> str:
    return f"{n:,}".replace(",", ".")


def _fmt_brl(v: float) -> str:
    s = f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {s}"


def _render_year_section(cov: dict[str, Any]) -> list[str]:
    y = cov["year"]
    role_lbl = {
        "baseline": "Baseline Principal",
        "comparison": "Comparativo Direto",
        "auxiliary": "Referência Auxiliar",
    }.get(cov["role"], cov["role"])

    pop = cov["population"]
    src = cov["sources"]
    m_all = cov["matching"]["all"]
    m_apto = cov["matching"]["apto"]
    san = cov["sanity"]
    dtg = cov["dt_geracao"]

    gen_all_den = pop["gender_all"]["F"] + pop["gender_all"]["M"]
    gen_apto_den = pop["gender_apto"]["F"] + pop["gender_apto"]["M"]

    lines: list[str] = [
        f"## Ano {y} — {role_lbl}",
        "",
        "### 1. Volumetria por Fonte Oficial (`*_BRASIL.csv`, Cargos 6 + 7)",
        "",
        "| Fonte | `DT_GERACAO` | Linhas Brutas | Linhas Cargos 6+7 | `SQ` Distintos | Observação |",
        "| :--- | :---: | ---: | ---: | ---: | :--- |",
        f"| `consulta_cand_{y}` | {dtg['consulta_cand']} | {_fmt_int(src['consulta_cand']['raw_rows'])} | {_fmt_int(src['consulta_cand']['cargo_6_7_rows'])} | {_fmt_int(src['consulta_cand']['unique_sq'])} | Chave única 1:1 (`rows == unique_sq`: {src['consulta_cand']['cargo_6_7_rows'] == src['consulta_cand']['unique_sq']}) |",
        f"| `votacao_munzona_{y}` | {dtg['votacao']} | {_fmt_int(src['votacao']['raw_rows'])} | {_fmt_int(src['votacao']['cargo_6_7_rows'])} | {_fmt_int(src['votacao']['unique_sq'])} | Agregada por `SQ_CANDIDATO` antes do join |",
        f"| `receitas_candidatos_{y}` | {dtg['receitas']} | {_fmt_int(src['receitas']['raw_rows'])} | {_fmt_int(src['receitas']['cargo_6_7_rows'])} | {_fmt_int(src['receitas']['unique_sq'])} | Prioriza maior precedência de `TP_PRESTACAO_CONTAS` |",
        f"| `despesas_contratadas_{y}` | {dtg['despesas_contratadas']} | {_fmt_int(src['despesas_contratadas']['raw_rows'])} | {_fmt_int(src['despesas_contratadas']['cargo_6_7_rows'])} | {_fmt_int(src['despesas_contratadas']['unique_sq'])} | Exclui contas internas `20330000`/`20340000` |",
        f"| `doador_originario_{y}` | {dtg.get('doador_originario', '—')} | {_fmt_int(src['doador_originario']['raw_rows'])} | — | {_fmt_int(src['doador_originario']['unique_sq_receita'])} (`SQ_RECEITA`) | {_fmt_int(src['doador_originario']['rec_transfer_matched_orig'])} / {_fmt_int(src['doador_originario']['rec_transfer_sq'])} recibos de transferência casados ({_pct(src['doador_originario']['rec_transfer_matched_orig'], src['doador_originario']['rec_transfer_sq'])}) |",
        "",
        "### 2. Universo Analítico, Elegibilidade e Micro-Chapas",
        f"- **Candidaturas registradas (Cargos 6+7):** **{_fmt_int(pop['total_cands'])}** → **{_fmt_int(pop['apto_cands'])} APTO** ({_pct(pop['apto_cands'], pop['total_cands'])}) e **{_fmt_int(pop['inapto_cands'])} INAPTO** ({_pct(pop['inapto_cands'], pop['total_cands'])}).",
        f"- **Impacto das candidaturas `INAPTO` ({_fmt_int(pop['inapto_cands'])}):** `{_fmt_int(pop['inapto_impact']['v_val'])}` votos válidos (`{_fmt_int(pop['inapto_impact']['v_nom'])}` nominais totais), `{_fmt_brl(pop['inapto_impact']['r'])}` em receita declarada (`{_fmt_brl(pop['inapto_impact']['fefc'])}` de FEFC), `{_fmt_brl(pop['inapto_impact']['e'])}` em despesa efetiva e `{_fmt_int(pop['inapto_impact']['elected'])}` eleito(s) no recorte `INAPTO`.",
        f"- **Gênero (Registradas, sobre F+M = {_fmt_int(gen_all_den)}):** Mulheres `{_fmt_int(pop['gender_all']['F'])}` ({_pct(pop['gender_all']['F'], gen_all_den)}), Homens `{_fmt_int(pop['gender_all']['M'])}` ({_pct(pop['gender_all']['M'], gen_all_den)}), Não divulgável `{_fmt_int(pop['gender_all']['ND'])}` (excluído dos denominadores de gênero).",
        f"- **Gênero (`APTO`, sobre F+M = {_fmt_int(gen_apto_den)}):** Mulheres `{_fmt_int(pop['gender_apto']['F'])}` ({_pct(pop['gender_apto']['F'], gen_apto_den)}), Homens `{_fmt_int(pop['gender_apto']['M'])}` ({_pct(pop['gender_apto']['M'], gen_apto_den)}), Não divulgável `{_fmt_int(pop['gender_apto']['ND'])}`.",
        f"- **Chapas (Registradas):** `{_fmt_int(pop['chapas_reg']['total'])}` chapas totais; **`{_fmt_int(pop['chapas_reg']['micro_lt4'])}` micro-chapas (`n < 4`)** somando **`{_fmt_int(pop['chapas_reg']['micro_cands'])}` candidaturas** (mantidas nos totais individuais e excluídas da distribuição percentual de H1/H7).",
        f"- **Chapas (`APTO`):** `{_fmt_int(pop['chapas_apto']['total'])}` chapas totais; `{_fmt_int(pop['chapas_apto']['micro_lt4'])}` micro-chapas (`n < 4`, `{_fmt_int(pop['chapas_apto']['micro_cands'])}` candidaturas).",
        "",
        "### 3. Taxa de Casamento (*Match Rate*) e Status da Prestação de Contas",
        "",
        "| Cruzamento / Status | Sobre Registradas | % Registradas | Sobre `APTO` | % `APTO` |",
        "| :--- | ---: | ---: | ---: | ---: |",
        f"| Presentes em `votacao` | {_fmt_int(m_all['votacao'])} | {_pct(m_all['votacao'], pop['total_cands'])} | {_fmt_int(m_apto['votacao'])} | {_pct(m_apto['votacao'], pop['apto_cands'])} |",
        f"| Presentes em `receitas` | {_fmt_int(m_all['receitas'])} | {_pct(m_all['receitas'], pop['total_cands'])} | {_fmt_int(m_apto['receitas'])} | {_pct(m_apto['receitas'], pop['apto_cands'])} |",
        f"| Presentes em `despesas_contratadas` | {_fmt_int(m_all['despesas_contratadas'])} | {_pct(m_all['despesas_contratadas'], pop['total_cands'])} | {_fmt_int(m_apto['despesas_contratadas'])} | {_pct(m_apto['despesas_contratadas'], pop['apto_cands'])} |",
        f"| Contas zeradas declaradas (`r=0` e `e=0`) | {_fmt_int(m_all['zero_fin'])} | {_pct(m_all['zero_fin'], pop['total_cands'])} | {_fmt_int(m_apto['zero_fin'])} | {_pct(m_apto['zero_fin'], pop['apto_cands'])} |",
        f"| Ausentes em `receitas` (sem linha) | {_fmt_int(m_all['missing_rec'])} | {_pct(m_all['missing_rec'], pop['total_cands'])} | {_fmt_int(m_apto['missing_rec'])} | {_pct(m_apto['missing_rec'], pop['apto_cands'])} |",
        "",
        "**Distribuição por `TP_PRESTACAO_CONTAS` (candidaturas `APTO`):**",
        "",
        "| Tipo de Prestação (`APTO`) | Candidaturas | % `APTO` |",
        "| :--- | ---: | ---: |",
    ]
    for tp, cnt in cov["tp_prestacao_apto"].items():
        lines.append(f"| `{tp}` | {_fmt_int(cnt)} | {_pct(cnt, pop['apto_cands'])} |")

    lines.extend([
        "",
        "### 4. Checagens de Sanidade (Zero Inflação em Joins 1:N)",
        "",
        "| Métrica | Soma Direta na Fonte Bruta (Cargos 6+7) | Soma na Base Analítica Exportada | Diferença |",
        "| :--- | ---: | ---: | ---: |",
        f"| Votos Nominais Válidos | {_fmt_int(src['votacao']['sum_v_val'])} | {_fmt_int(san['exported_v_val'])} | {_fmt_int(san['exported_v_val'] - src['votacao']['sum_v_val'])} |",
        f"| Votos Nominais Totais | {_fmt_int(src['votacao']['sum_v_nom'])} | {_fmt_int(san['exported_v_nom'])} | {_fmt_int(san['exported_v_nom'] - src['votacao']['sum_v_nom'])} |",
        f"| Receita Total Declarada | {_fmt_brl(src['receitas']['sum_r'])} | {_fmt_brl(san['exported_r'])} | {_fmt_brl(abs(san['exported_r'] - src['receitas']['sum_r']))} |",
        f"| FEFC (`CD_FONTE_RECEITA = 2`) | {_fmt_brl(src['receitas']['sum_fefc'])} | {_fmt_brl(san['exported_fefc'])} | {_fmt_brl(abs(san['exported_fefc'] - src['receitas']['sum_fefc']))} |",
        f"| Despesa Contratada Efetiva | {_fmt_brl(src['despesas_contratadas']['sum_e_efetivo'])} | {_fmt_brl(san['exported_e'])} | {_fmt_brl(abs(san['exported_e'] - src['despesas_contratadas']['sum_e_efetivo']))} |",
        "",
        f"- **Rede Bipartida (Fornecedores-Hub):** `{_fmt_int(cov['hubs_summary']['hubs_count'])}` fornecedores-hub, `{_fmt_int(cov['hubs_summary']['cand_nodes_count'])}` candidaturas anônimas ligadas e `{_fmt_int(cov['hubs_summary']['links_count'])}` arestas.",
        "",
    ])
    return lines


def write_coverage_artifacts(coverage_by_year: dict[str, Any]) -> None:
    """Escreve data/coverage.json e docs/relatorio_cobertura_2022.md."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    DOCS_DIR.mkdir(parents=True, exist_ok=True)

    (DATA_DIR / "coverage.json").write_text(
        json.dumps({"years": coverage_by_year}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    md_lines = [
        "# Relatório de Cobertura por Fonte — 2018 (Auxiliar), 2022 (Baseline) e 2026 (Comparativo)",
        "",
        "> Gerado automaticamente por `etl/build_dataset.py` (`etl/report_coverage.py`). Todos os números refletem os CSVs oficiais `*_BRASIL.csv` do TSE filtrados para `CD_CARGO IN ('6', '7')` e `CD_TIPO_ELEICAO = '2'`.",
        "",
    ]
    for y_key in sorted(coverage_by_year.keys()):
        md_lines.extend(_render_year_section(coverage_by_year[y_key]))

    (DOCS_DIR / "relatorio_cobertura_2022.md").write_text("\n".join(md_lines), encoding="utf-8")
