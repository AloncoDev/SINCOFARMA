"""Regras legais e regulatórias: responsável legal de menor, orientação farmacêutica (RDC 44/2009),
prazo de guarda (TTL de 20 anos), paciente informado do encaminhamento, exportação ligada a um
pedido do paciente e aceite dos termos de uso."""

import copy
from datetime import datetime

import boto3

from conftest import REGION, VALID_CLINICAL, body_of, doctor_sub, event
from test_api import clinico_items, painel_items, post_visit

ADMIN = {"groups": "[papel:admin]", "user": "00000000191", "sub": "11111111-2222-3333-4444-555555555555"}
ANOS_20 = 20 * 365 * 86400


def menor(**guardian):
    clin = copy.deepcopy(VALID_CLINICAL)
    clin["patient"]["birthDate"] = f"10/05/{datetime.now().year - 10}"
    if guardian:
        clin["guardian"] = guardian
    return clin


def encaminhar(api, visit_id, **extra):
    body = {"visitId": visit_id, "healthUnitId": "ubs-1-asa-sul", "reason": "Avaliar cefaleia", "priority": "rotina", **extra}
    return api.criar_encaminhamento(event("POST", "/encaminhamentos", body), None)


# ---------------------------------------------------------------- menor de idade

def test_menor_exige_responsavel_legal(aws):
    resp = post_visit(aws, menor())
    assert resp["statusCode"] == 422
    assert {"responsavelNome", "responsavelCpf", "responsavelParentesco"} <= set(body_of(resp)["details"]["fields"])


def test_responsavel_nao_pode_ter_o_cpf_do_paciente(aws):
    resp = post_visit(aws, menor(name="João Teste", cpf="123.456.789-09", relation="pai"))
    assert resp["statusCode"] == 422
    assert "responsavelCpf" in body_of(resp)["details"]["fields"]


def test_menor_com_responsavel_vai_para_a_ficha_e_o_encaminhamento(aws):
    resp = post_visit(aws, menor(name="João Teste", cpf="529.982.247-25", relation="pai"))
    assert resp["statusCode"] == 201
    record = next(i for i in clinico_items() if i["SK"] == "RECORD")
    assert record["guardian"] == {"name": "João Teste", "cpf": "52998224725", "relation": "pai"}
    ref = body_of(encaminhar(aws, body_of(resp)["id"], patientInformed=True))
    # a unidade de saúde vê quem acompanha o paciente, com o CPF mascarado
    assert ref["patient"]["guardian"]["name"] == "João Teste"
    assert ref["patient"]["guardian"]["cpf"] != "52998224725"


def test_adulto_nao_precisa_de_responsavel(aws):
    assert post_visit(aws)["statusCode"] == 201
    record = next(i for i in clinico_items() if i["SK"] == "RECORD")
    assert record["guardian"] is None


# ---------------------------------------------------------------- declaração de serviço farmacêutico

def test_orientacao_farmaceutica_fica_na_ficha(aws):
    clin = {**copy.deepcopy(VALID_CLINICAL), "guidance": "Hidratação e retorno se a dor piorar."}
    assert post_visit(aws, clin)["statusCode"] == 201
    record = next(i for i in clinico_items() if i["SK"] == "RECORD")
    assert record["guidance"] == "Hidratação e retorno se a dor piorar."
    resp = post_visit(aws, {**copy.deepcopy(VALID_CLINICAL), "guidance": "x" * 1001})
    assert resp["statusCode"] == 422


def test_farmacia_com_cnpj_endereco_e_telefone(aws):
    nova = {"id": "taguatinga", "name": "Drogaria Central", "monthGoal": 300, "triageGoalMin": 12}
    assert aws.criar_farmacia(event("POST", "/farmacias", {**nova, "cnpj": "11.222.333/0001-00"}, **ADMIN), None)["statusCode"] == 422
    resp = aws.criar_farmacia(event("POST", "/farmacias", {**nova, "cnpj": "11.222.333/0001-81", "address": "QNA 10, Taguatinga", "phone": "(61) 3333-4444"}, **ADMIN), None)
    assert resp["statusCode"] == 201
    farm = body_of(resp)
    assert (farm["cnpj"], farm["address"], farm["phone"]) == ("11222333000181", "QNA 10, Taguatinga", "6133334444")
    patch = event("PATCH", "/farmacias/taguatinga", {"address": "QNA 12, Taguatinga"}, path_params={"id": "taguatinga"}, **ADMIN)
    assert body_of(aws.atualizar_farmacia(patch, None))["address"] == "QNA 12, Taguatinga"


# ---------------------------------------------------------------- prazo de guarda

def test_fichas_e_encaminhamentos_expiram_em_20_anos(aws):
    visit = body_of(post_visit(aws))
    ref = body_of(encaminhar(aws, visit["id"], patientInformed=True))
    assert "expiraEm" not in ref
    agora = datetime.now().timestamp()
    pessoais = [i for i in clinico_items() + painel_items()
                if i["PK"].startswith(("VISIT#", "PAC#", "REF#", "SAUDE#", "GUIA#")) or "#DAY#" in i["PK"] and i["SK"].startswith("VISIT#")
                or i["PK"].endswith("#REF")]
    pessoais = [i for i in pessoais if i["SK"] != "PROFILE"]
    assert len(pessoais) >= 8
    for item in pessoais:
        assert abs(int(item["expiraEm"]) - agora - ANOS_20) < 10 * 86400, item["PK"]
    # contadores e perfis ficam
    assert all("expiraEm" not in i for i in painel_items() if i["SK"] in ("#STATS", "PROFILE"))


# ---------------------------------------------------------------- encaminhamento

def test_encaminhar_exige_paciente_informado(aws):
    visit = body_of(post_visit(aws))
    resp = encaminhar(aws, visit["id"])
    assert resp["statusCode"] == 422
    assert "patientInformed" in body_of(resp)["details"]["fields"]
    ok = encaminhar(aws, visit["id"], patientInformed=True)
    assert ok["statusCode"] == 201
    assert body_of(ok)["patientInformed"] is True


# ---------------------------------------------------------------- exportação de paciente

def test_exportacao_exige_o_pedido_e_registra_hmac_do_cpf(aws, monkeypatch):
    kms = boto3.client("kms", region_name=REGION)
    key = kms.create_key(KeySpec="HMAC_256", KeyUsage="GENERATE_VERIFY_MAC")["KeyMetadata"]["KeyId"]
    monkeypatch.setenv("CHAVE_AUDITORIA", key)
    post_visit(aws)

    sem_pedido = aws.exportar_paciente(event("POST", "/lgpd/pacientes", {"cpf": "123.456.789-09"}, **ADMIN), None)
    assert sem_pedido["statusCode"] == 422
    assert set(body_of(sem_pedido)["details"]["fields"]) == {"channel", "reference"}

    def exportar(cpf):
        body = {"cpf": cpf, "channel": "presencial", "reference": "Pedido assinado no balcão, 20/11/2026"}
        return aws.exportar_paciente(event("POST", "/lgpd/pacientes", body, **ADMIN), None)

    assert exportar("123.456.789-09")["statusCode"] == 200
    assert exportar("12345678909")["statusCode"] == 200
    eventos = [i for i in painel_items() if i["PK"].startswith("AUDIT#") and i["action"] == "lgpd_export_patient"]
    assert len(eventos) == 2
    assert eventos[0]["details"]["pedido"] == "Pedido assinado no balcão, 20/11/2026"
    assert eventos[0]["details"]["canal"] == "presencial"
    # mesma pessoa, mesma impressão digital; o CPF não aparece
    assert eventos[0]["target"]["cpfHmac"] and eventos[0]["target"]["cpfHmac"] == eventos[1]["target"]["cpfHmac"]
    assert "12345678909" not in str(eventos)


# ---------------------------------------------------------------- termos de uso

def termos(api, method="GET", body=None, **kw):
    return api.termos(event(method, "/me/termos", body, **kw), None)


def test_aceite_dos_termos_fica_registrado(aws):
    ana = {"sub": doctor_sub("52998224725")}
    assert body_of(termos(aws, **ana)) == {"accepted": None}
    assert termos(aws, "POST", {"version": "26/11/2026"}, **ana)["statusCode"] == 422
    assert termos(aws, "POST", {"version": "2026-02-30"}, **ana)["statusCode"] == 422

    assert termos(aws, "POST", {"version": "2026-11-01"}, **ana)["statusCode"] == 201
    assert termos(aws, "POST", {"version": "2026-11-26"}, **ana)["statusCode"] == 201
    assert body_of(termos(aws, **ana))["accepted"]["version"] == "2026-11-26"

    acoes = [i["action"] for i in painel_items() if i["PK"].startswith("AUDIT#")]
    assert acoes.count("terms_accept") == 2
    dados = body_of(aws.meus_dados(event(path="/me/dados", **ana), None))
    assert [a["versao"] for a in dados["aceitesDosTermos"]] == ["2026-11-01", "2026-11-26"]
    # cada um só vê o próprio aceite
    assert body_of(termos(aws, user="11144477735", sub="outro-sub"))["accepted"] is None


def test_script_marca_o_prazo_dos_registros_antigos(aws, monkeypatch):
    import os
    import sys

    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
    import marcar_expiracao

    visit = body_of(post_visit(aws))
    assert encaminhar(aws, visit["id"], patientInformed=True)["statusCode"] == 201
    # como os registros de antes do TTL: sem prazo
    ddb = boto3.resource("dynamodb", region_name=REGION)
    for nome in ("clinico-test", "painel-test"):
        tabela = ddb.Table(nome)
        for item in tabela.scan()["Items"]:
            if "expiraEm" in item:
                tabela.update_item(Key={"PK": item["PK"], "SK": item["SK"]}, UpdateExpression="REMOVE expiraEm")

    monkeypatch.setattr(marcar_expiracao, "stack_outputs", lambda _cf, _stack: {"TabelaClinico": "clinico-test", "TabelaPainel": "painel-test"})
    sessao = boto3.Session(region_name=REGION)  # o script cria a própria sessão (perfil da AWS CLI)
    monkeypatch.setattr(marcar_expiracao.boto3, "Session", lambda **_kw: sessao)
    monkeypatch.setattr(sys, "argv", ["marcar_expiracao.py", "--stack", "teste"])
    assert marcar_expiracao.main() == 0

    agora = datetime.now().timestamp()
    itens = clinico_items() + painel_items()
    marcados = [i for i in itens if "expiraEm" in i]
    assert {i["PK"].split("#")[0] for i in marcados} >= {"VISIT", "PAC", "REF", "SAUDE", "GUIA", "UNIT"}
    assert all(abs(int(i["expiraEm"]) - agora - ANOS_20) < 10 * 86400 for i in marcados)
    # contadores, perfis e o registro geral de auditoria não expiram
    assert not [i for i in marcados if i["SK"] in ("#STATS", "PROFILE") or i["PK"].startswith("AUDIT#")]
