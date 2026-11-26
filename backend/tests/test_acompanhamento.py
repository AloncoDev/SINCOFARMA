"""Acompanhamento pela administração: quem cuidou de cada atendimento e a situação, sem o paciente."""

import copy

import boto3

from conftest import REGION, VALID_CLINICAL, body_of, doctor_sub, event
from test_api import post_visit
from test_encaminhamentos import PAULO, abrir, as_doctor, mudar, send

ADMIN = {"groups": "[papel:admin]", "user": "00000000191"}
PACIENTE = ("Maria Teste", "123.456.789-09", "Cefaleia", "Dipirona", "Observação confidencial", "Paciente pode seguir")


def lista(api, unidade="asa-sul", dia=None, **kw):
    query = {"unidade": unidade, **({"dia": dia} if dia else {})}
    return api.acompanhar_atendimentos(event(path="/gestao/atendimentos", query=query, **{**ADMIN, **kw}), None)


def detalhe(api, visit_id, **kw):
    return api.acompanhar_atendimento(event(path=f"/gestao/atendimentos/{visit_id}", path_params={"id": visit_id}, **{**ADMIN, **kw}), None)


def _sem_paciente(data):
    texto = str(data)
    for dado in PACIENTE:
        assert dado not in texto, dado


def _ana():
    # sub real do Cognito: a linha do tempo acha o nome de quem agiu por ele
    return {"sub": doctor_sub("52998224725")}


def _atendimento_encaminhado_e_respondido(api):
    body = {"clinical": copy.deepcopy(VALID_CLINICAL)}
    visit = body_of(api.criar_visita(event("POST", "/visits", body, **_ana()), None))
    ref = body_of(send(api, visit["id"], **_ana()))
    abrir(api, ref["id"], **as_doctor(PAULO))
    mudar(api, ref["id"], {"status": "answered", "response": "Paciente pode seguir com analgesia."}, **as_doctor(PAULO))
    return visit, ref


def test_so_admin_acompanha(aws):
    visit = body_of(post_visit(aws))
    for groups in ("[unidade:asa-sul papel:farmaceutico]", "[papel:medico]"):
        assert lista(aws, groups=groups)["statusCode"] == 403
        assert detalhe(aws, visit["id"], groups=groups)["statusCode"] == 403


def test_lista_do_dia_com_farmaceutico_e_medico(aws):
    visit, ref = _atendimento_encaminhado_e_respondido(aws)
    body_of(post_visit(aws))  # outro, sem encaminhamento

    resp = lista(aws)
    assert resp["statusCode"] == 200
    data = body_of(resp)
    assert data["unitName"] == "Drogaria Planalto — Asa Sul"
    assert len(data["visits"]) == 2
    enc = next(v for v in data["visits"] if v["id"] == visit["id"])
    assert enc["rt"] == "Dra. Ana Souza" and enc["protocol"].startswith("SIN-")
    assert enc["referrals"] == [{
        "id": ref["id"], "status": "answered", "statusAt": enc["referrals"][0]["statusAt"], "createdAt": ref["createdAt"],
        "priority": "urgente", "code": ref["code"], "healthUnit": "UBS 1 Asa Sul", "doctor": "Dr. Paulo Lima",
        "answeredUnit": "UBS 1 Asa Sul", "from": "Dra. Ana Souza",
    }]
    assert next(v for v in data["visits"] if v["id"] != visit["id"])["referrals"] == []
    _sem_paciente(data)


def test_linha_do_tempo_com_quem_fez_o_que(aws):
    visit, _ = _atendimento_encaminhado_e_respondido(aws)
    resp = aws.atualizar_visita(event("PATCH", f"/visits/{visit['id']}", {"status": "done"}, path_params={"id": visit["id"]}, **_ana()), None)
    assert resp["statusCode"] == 200, resp["body"]

    data = body_of(detalhe(aws, visit["id"]))
    assert data["unit"] == "asa-sul" and data["visit"]["status"] == "done"
    passos = [(t["action"], t["actor"], t["role"]) for t in data["timeline"]]
    assert passos == [
        ("create", "Dra. Ana Souza", "farmaceutico"),
        ("referral_create", "Dra. Ana Souza", "farmaceutico"),
        ("referral_read", "Dr. Paulo Lima", "medico"),
        ("referral_answered", "Dr. Paulo Lima", "medico"),
        ("update", "Dra. Ana Souza", "farmaceutico"),
    ]
    assert data["timeline"][1]["destination"] == "UBS 1 Asa Sul"
    assert data["referrals"][0]["status"] == "answered"
    _sem_paciente(data)


def test_consultas_ficam_na_auditoria(aws):
    visit = body_of(post_visit(aws))
    lista(aws)
    detalhe(aws, visit["id"])
    items = boto3.resource("dynamodb", region_name=REGION).Table("painel-test").scan()["Items"]
    acoes = sorted(i["action"] for i in items if i["PK"].startswith("AUDIT#") and i["action"].endswith("_track"))
    assert acoes == ["visit_track", "visits_track"]


def test_validacoes(aws):
    assert lista(aws, unidade="nao-existe")["statusCode"] == 404
    assert lista(aws, unidade="Asa Sul!")["statusCode"] == 400
    assert lista(aws, dia="2999-01-01")["statusCode"] == 400
    assert lista(aws, dia="2026-02-30")["statusCode"] == 400
    assert detalhe(aws, "1700000000000-deadbeef")["statusCode"] == 404
    assert detalhe(aws, "x")["statusCode"] == 404
