"""Unidades de saúde pela administração e o médico ligado a uma delas."""

import os

import boto3

from conftest import REGION, body_of, event

ADMIN = {"groups": "[papel:admin]", "user": "00000000191"}
NOVA = {"id": "ubs-2-guara", "name": "UBS 2 Guará", "kind": "ubs", "region": "Guará / RA X"}


def listar(api, **kw):
    return api.listar_unidades_saude(event(path="/unidades-saude", **{**ADMIN, **kw}), None)


def criar(api, body, **kw):
    return api.criar_unidade_saude(event("POST", "/unidades-saude", body, **{**ADMIN, **kw}), None)


def mudar(api, unit, body, **kw):
    return api.atualizar_unidade_saude(event("PATCH", f"/unidades-saude/{unit}", body, path_params={"id": unit}, **{**ADMIN, **kw}), None)


def criar_usuario(api, body):
    return api.criar_usuario(event("POST", "/usuarios", body, **ADMIN), None)


def test_quem_ve_e_quem_gerencia(aws):
    assert listar(aws, groups="[papel:medico saude:ubs-1-asa-sul]")["statusCode"] == 403
    assert listar(aws, groups="[unidade:asa-sul papel:farmaceutico]")["statusCode"] == 200
    assert criar(aws, NOVA, groups="[unidade:asa-sul papel:farmaceutico]")["statusCode"] == 403
    assert mudar(aws, "ubs-1-asa-sul", {"name": "X X X"}, groups="[papel:medico]")["statusCode"] == 403


def test_admin_cadastra_com_grupo_e_auditoria(aws):
    resp = criar(aws, NOVA)
    assert resp["statusCode"] == 201
    assert body_of(resp)["doctors"] == {"active": 0, "pending": 0}
    groups = [g["GroupName"] for g in boto3.client("cognito-idp", region_name=REGION).list_groups(UserPoolId=os.environ["USER_POOL_ID"])["Groups"]]
    assert "saude:ubs-2-guara" in groups
    nomes = [u["name"] for u in body_of(listar(aws))["units"]]
    assert nomes == ["UBS 1 Asa Sul", "UBS 2 Guará", "UPA Ceilândia"]
    assert criar(aws, NOVA)["statusCode"] == 409
    items = boto3.resource("dynamodb", region_name=REGION).Table("painel-test").scan()["Items"]
    assert [i["action"] for i in items if i["PK"].startswith("AUDIT#")] == ["health_create"]


def test_validacao(aws):
    resp = criar(aws, {"id": "UBS 2!", "name": "x", "kind": "posto"})
    assert resp["statusCode"] == 422
    assert set(body_of(resp)["details"]["fields"]) == {"id", "name", "kind"}
    assert mudar(aws, "ubs-1-asa-sul", {"id": "outro"})["statusCode"] == 422
    assert mudar(aws, "nao-existe", {"name": "Qualquer"})["statusCode"] == 404


def test_ajusta_nome_e_tipo(aws):
    resp = mudar(aws, "ubs-1-asa-sul", {"name": "UBS 1 da Asa Sul", "kind": "policlinica"})
    assert resp["statusCode"] == 200
    assert body_of(resp)["name"] == "UBS 1 da Asa Sul" and body_of(resp)["kind"] == "policlinica"


def test_medico_e_cadastrado_com_unidade_de_saude(aws):
    base = {"cpf": "123.456.789-09", "name": "Dra. Joana Prado", "email": "joana@x.com", "roles": ["medico"]}
    resp = criar_usuario(aws, base)
    assert resp["statusCode"] == 422
    assert "healthUnit" in body_of(resp)["details"]["fields"]
    assert criar_usuario(aws, {**base, "healthUnit": "nao-existe"})["statusCode"] == 422

    resp = criar_usuario(aws, {**base, "healthUnit": "upa-ceilandia"})
    assert resp["statusCode"] == 201, resp["body"]
    assert body_of(resp)["healthUnit"] == "upa-ceilandia"
    upa = next(u for u in body_of(listar(aws))["units"] if u["id"] == "upa-ceilandia")
    assert upa["doctors"] == {"active": 0, "pending": 1}  # convite enviado, ainda sem primeiro acesso
