"""Farmácias pela administração: lista com números agregados, cadastro e ajuste de metas."""

import copy
import os

import boto3

from conftest import REGION, VALID_CLINICAL, body_of, event

ADMIN = {"groups": "[papel:admin]", "user": "00000000191"}
NOVA = {"id": "taguatinga", "name": "Drogaria Central — Taguatinga", "monthGoal": 300, "triageGoalMin": 12}


def listar(api, **kw):
    return api.listar_farmacias(event(path="/farmacias", **{**ADMIN, **kw}), None)


def criar(api, body, **kw):
    return api.criar_farmacia(event("POST", "/farmacias", body, **{**ADMIN, **kw}), None)


def mudar(api, unit, body, **kw):
    return api.atualizar_farmacia(event("PATCH", f"/farmacias/{unit}", body, path_params={"id": unit}, **{**ADMIN, **kw}), None)


def audit_actions():
    items = boto3.resource("dynamodb", region_name=REGION).Table("painel-test").scan()["Items"]
    return sorted(i["action"] for i in items if i["PK"].startswith("AUDIT#") and i["action"].startswith("unit_"))


def test_so_admin_gerencia(aws):
    assert listar(aws, groups="[unidade:asa-sul papel:farmaceutico]")["statusCode"] == 403
    assert listar(aws, groups="[papel:medico]")["statusCode"] == 403
    assert criar(aws, NOVA, groups="[unidade:asa-sul papel:farmaceutico]")["statusCode"] == 403
    assert mudar(aws, "asa-sul", {"monthGoal": 1}, groups="[papel:medico]")["statusCode"] == 403


def test_lista_com_numeros_do_mes_sem_pacientes(aws):
    clin = copy.deepcopy(VALID_CLINICAL)
    aws.criar_visita(event("POST", "/visits", {"clinical": clin, "durationSec": 360}), None)
    aws.criar_visita(event("POST", "/visits", {"clinical": clin, "status": "done", "durationSec": 240}), None)

    data = body_of(listar(aws))
    asa = next(u for u in data["units"] if u["id"] == "asa-sul")
    assert asa["name"] == "Drogaria Planalto — Asa Sul"
    assert asa["monthGoal"] == 525
    assert asa["today"]["total"] == 2
    assert asa["month"]["total"] == 2
    assert asa["month"]["done"] == 1 and asa["month"]["progress"] == 1
    assert asa["month"]["triageMinutes"] == 5.0  # (360 + 240) / 2 / 60
    # nenhum dado de paciente na resposta
    assert "Maria Teste" not in str(data)


def test_cadastra_farmacia_e_grupo(aws):
    resp = criar(aws, NOVA)
    assert resp["statusCode"] == 201
    created = body_of(resp)
    assert created["id"] == "taguatinga" and created["month"]["total"] == 0
    groups = [g["GroupName"] for g in boto3.client("cognito-idp", region_name=REGION).list_groups(UserPoolId=os.environ["USER_POOL_ID"])["Groups"]]
    assert "unidade:taguatinga" in groups
    assert any(u["id"] == "taguatinga" for u in body_of(listar(aws))["units"])
    assert audit_actions() == ["unit_create"]


def test_codigo_repetido_recusado(aws):
    criar(aws, NOVA)
    resp = criar(aws, {**NOVA, "name": "Outra"})
    assert resp["statusCode"] == 409
    assert body_of(resp)["details"]["fields"]["id"]


def test_validacao_do_cadastro(aws):
    resp = criar(aws, {"id": "Asa Sul!", "name": "x", "monthGoal": -1, "triageGoalMin": 0})
    assert resp["statusCode"] == 422
    assert set(body_of(resp)["details"]["fields"]) == {"id", "name", "monthGoal", "triageGoalMin"}


def test_ajusta_nome_e_metas_com_auditoria(aws):
    resp = mudar(aws, "asa-sul", {"name": "Drogaria Planalto — Asa Sul 2", "monthGoal": 600})
    assert resp["statusCode"] == 200
    data = body_of(resp)
    assert data["name"] == "Drogaria Planalto — Asa Sul 2" and data["monthGoal"] == 600 and data["triageGoalMin"] == 10
    assert audit_actions() == ["unit_update"]
    # o dashboard já usa a meta nova
    assert body_of(aws.dashboard(event(), None))["baseline"]["monthGoal"] == 600


def test_ajuste_sem_mudanca_nao_audita(aws):
    assert mudar(aws, "asa-sul", {"monthGoal": 525})["statusCode"] == 200
    assert audit_actions() == []


def test_ajuste_recusa_codigo_e_farmacia_inexistente(aws):
    assert mudar(aws, "asa-sul", {"id": "outra"})["statusCode"] == 422
    assert mudar(aws, "nao-existe", {"monthGoal": 10})["statusCode"] == 404
    assert mudar(aws, "../x", {"monthGoal": 10})["statusCode"] == 404
