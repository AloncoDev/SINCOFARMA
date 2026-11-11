"""Relatórios da administração: contadores por dia, mês e farmácia (sem pacientes)."""

import copy

import boto3
import pytest

from conftest import REGION, VALID_CLINICAL, body_of, event

ADMIN = {"groups": "[papel:admin]", "user": "00000000191"}


def relatorio(api, query=None, **kw):
    return api.relatorios_atendimentos(event(path="/relatorios", query=query, **{**ADMIN, **kw}), None)


def _put(pk, **counts):
    boto3.resource("dynamodb", region_name=REGION).Table("painel-test").put_item(Item={"PK": pk, "SK": "#STATS", **counts})


@pytest.fixture
def rede(aws):
    """Segunda farmácia e contadores de outubro de 2025 (e setembro, para comparar)."""
    painel = boto3.resource("dynamodb", region_name=REGION).Table("painel-test")
    painel.put_item(Item={"PK": "UNIT#aguas-claras", "SK": "PROFILE", "name": "Bem Estar — Águas Claras", "monthGoal": 300, "triageGoalMin": 8})
    _put("UNIT#asa-sul#MONTH#2025-10", total=40, done=30, referred=6, progress=4, urgent=3, durSum=24000, durCount=40)
    _put("UNIT#asa-sul#MONTH#2025-09", total=32, done=20, referred=8, progress=4, urgent=1)
    _put("UNIT#aguas-claras#MONTH#2025-10", total=10, done=9, referred=1, progress=0, urgent=0, durSum=3000, durCount=10)
    _put("UNIT#asa-sul#DAY#2025-10-03", total=5, done=4, referred=1, progress=0, urgent=1)
    _put("UNIT#aguas-claras#DAY#2025-10-03", total=2, done=2, referred=0, progress=0, urgent=0)
    _put("UNIT#aguas-claras#DAY#2025-10-31", total=1, done=1, referred=0, progress=0, urgent=0)
    return aws


def test_so_admin_ve(aws):
    assert relatorio(aws, groups="[unidade:asa-sul papel:farmaceutico]")["statusCode"] == 403
    assert relatorio(aws, groups="[papel:medico]")["statusCode"] == 403


def test_mes_atual_com_atendimentos_de_hoje(aws):
    clin = copy.deepcopy(VALID_CLINICAL)
    aws.criar_visita(event("POST", "/visits", {"clinical": clin, "durationSec": 300}), None)
    aws.criar_visita(event("POST", "/visits", {"clinical": {**clin, "redFlags": ["Dor torácica"]}, "status": "referred", "urgent": True}), None)

    data = body_of(relatorio(aws))
    assert data["unit"] is None
    assert len(data["months"]) == 12 and data["months"][-1]["month"] == data["month"]
    assert data["days"][-1]["day"] == data["today"]  # mês atual vai até hoje
    assert data["days"][-1]["total"] == 2
    assert data["months"][-1]["total"] == 2
    asa = next(u for u in data["byUnit"] if u["id"] == "asa-sul")
    assert asa["total"] == 2 and asa["durSum"] == 300 and asa["durCount"] == 1
    assert data["units"][0] == {"id": "asa-sul", "name": "Drogaria Planalto — Asa Sul", "monthGoal": 525, "triageGoalMin": 10}
    # nenhum dado de paciente na resposta
    assert "Maria Teste" not in str(data) and "123.456" not in str(data)


def test_mes_passado_soma_a_rede(rede):
    data = body_of(relatorio(rede, {"mes": "2025-10"}))
    assert len(data["days"]) == 31  # mês fechado: todos os dias
    d3 = next(d for d in data["days"] if d["day"] == "2025-10-03")
    assert d3["total"] == 7 and d3["urgent"] == 1
    assert data["months"][-1] == {"month": "2025-10", "total": 50, "done": 39, "referred": 7, "progress": 4, "urgent": 3, "durSum": 27000, "durCount": 50}
    assert data["months"][-2]["total"] == 32 and data["months"][0]["month"] == "2024-11"
    asa = next(u for u in data["byUnit"] if u["id"] == "asa-sul")
    assert asa["total"] == 40 and asa["previous"]["total"] == 32
    # a ordem segue o nome sem acento: "Bem Estar" antes de "Drogaria"
    assert [u["id"] for u in data["units"]] == ["aguas-claras", "asa-sul"]


def test_uma_farmacia(rede):
    data = body_of(relatorio(rede, {"mes": "2025-10", "farmacia": "aguas-claras"}))
    assert data["unit"] == "aguas-claras"
    assert [u["id"] for u in data["byUnit"]] == ["aguas-claras"]
    assert data["months"][-1]["total"] == 10
    assert next(d for d in data["days"] if d["day"] == "2025-10-31")["total"] == 1
    # a lista completa continua vindo (para o seletor)
    assert len(data["units"]) == 2


@pytest.mark.parametrize("mes", ["2025-13", "2025-1", "outubro", "2019-12", "2999-01"])
def test_mes_invalido(aws, mes):
    assert relatorio(aws, {"mes": mes})["statusCode"] == 400


def test_farmacia_desconhecida(aws):
    assert relatorio(aws, {"farmacia": "nao-existe"})["statusCode"] == 404
    assert relatorio(aws, {"farmacia": "Asa Sul!"})["statusCode"] == 404


def test_virada_de_ano():
    from painel.comum.relatorios import shift_month

    assert shift_month("2026-01", -1) == "2025-12"
    assert shift_month("2025-12", 1) == "2026-01"
    assert shift_month("2026-03", -14) == "2025-01"
