"""Encaminhamentos: farmacêutico envia, médico lê e responde; cada um só vê o que é seu."""

import boto3

from conftest import REGION, body_of, doctor_sub, event
from test_api import clinico_items, post_visit

PAULO, CARLA = "39053344705", "71428793860"
UBS, UPA = "ubs-1-asa-sul", "upa-ceilandia"
# cada médico atende numa unidade de saúde
UNIDADE_DO_MEDICO = {PAULO: UBS, CARLA: UPA}
OUTRO_FARMACEUTICO = {"user": "11144477735"}  # mesma farmácia


def as_doctor(username, unit=None):
    unit = unit or UNIDADE_DO_MEDICO[username]
    return {"user": username, "groups": f"[papel:medico saude:{unit}]", "sub": doctor_sub(username)}


def send(api, visit_id, health=UBS, **kw):
    body = {"visitId": visit_id, "healthUnitId": health, "reason": "Avaliar dor torácica atípica", "priority": "urgente", "patientInformed": True}
    return api.criar_encaminhamento(event("POST", "/encaminhamentos", body, **kw), None)


def listar(api, **kw):
    return body_of(api.listar_encaminhamentos(event(path="/encaminhamentos", **kw), None))["referrals"]


def abrir(api, ref_id, **kw):
    return api.ver_encaminhamento(event(path=f"/encaminhamentos/{ref_id}", path_params={"id": ref_id}, **kw), None)


def mudar(api, ref_id, body, **kw):
    return api.atualizar_encaminhamento(event("PATCH", f"/encaminhamentos/{ref_id}", body, path_params={"id": ref_id}, **kw), None)


def buscar(api, body, **kw):
    return api.localizar_guia(event("POST", "/guias/busca", body, **kw), None)


def new_referral(api, health=UBS):
    visit = body_of(post_visit(api))
    resp = send(api, visit["id"], health)
    assert resp["statusCode"] == 201, resp["body"]
    return body_of(resp)


# ---------------------------------------------------------------- envio

def test_farmaceutico_lista_unidades_de_saude(aws):
    resp = aws.listar_unidades_saude(event(path="/unidades-saude"), None)
    assert resp["statusCode"] == 200
    units = body_of(resp)["units"]
    assert [u["name"] for u in units] == ["UBS 1 Asa Sul", "UPA Ceilândia"]
    assert "doctors" not in units[0]  # quantos médicos: só a administração vê
    # as unidades de saúde não aparecem como farmácias
    farmacias = body_of(aws.listar_unidades(event(path="/unidades", groups="[papel:admin]"), None))["units"]
    assert [u["id"] for u in farmacias] == ["asa-sul"]


def test_envia_para_a_unidade_com_guia_e_cpf_mascarado(aws):
    ref = new_referral(aws)
    assert ref["status"] == "sent"
    assert ref["healthUnit"] == {"id": UBS, "name": "UBS 1 Asa Sul", "kind": "ubs"}
    assert ref["doctor"] is None  # ninguém respondeu ainda
    assert ref["code"].startswith("ENC-") and len(ref["code"]) == 13
    assert ref["from"]["name"] == "Dra. Ana Souza" and ref["from"]["crf"] == "4192"
    assert ref["patient"]["name"] == "Maria Teste"
    assert ref["patient"]["cpf"] == "***.***.***-09"
    assert ref["clinical"]["history"]["allergies"] == ["Dipirona"]
    assert ref["urgent"] is True
    audit = [i["action"] for i in clinico_items() if i["SK"].startswith("AUDIT#")]
    assert "referral_create" in audit


def test_validacao_do_envio(aws):
    visit = body_of(post_visit(aws))
    body = {"visitId": visit["id"], "healthUnitId": "X!", "reason": "ok"}
    resp = aws.criar_encaminhamento(event("POST", "/encaminhamentos", body), None)
    assert resp["statusCode"] == 422
    assert set(body_of(resp)["details"]["fields"]) == {"healthUnitId", "reason", "patientInformed"}


def test_unidade_de_saude_inexistente(aws):
    visit = body_of(post_visit(aws))
    assert send(aws, visit["id"], "ubs-que-nao-existe")["statusCode"] == 422


def test_atendimento_de_outra_farmacia_nao_encontra(aws):
    visit = body_of(post_visit(aws))
    resp = send(aws, visit["id"], groups="[unidade:taguatinga papel:farmaceutico]")
    assert resp["statusCode"] == 404


def test_so_farmaceutico_envia(aws):
    visit = body_of(post_visit(aws))
    assert send(aws, visit["id"], **as_doctor(PAULO))["statusCode"] == 403
    assert send(aws, visit["id"], groups="[papel:admin]")["statusCode"] == 403


# ---------------------------------------------------------------- quem vê o quê

def test_caixa_da_unidade_de_saude(aws):
    para_ubs = new_referral(aws, UBS)
    para_upa = new_referral(aws, UPA)

    caixa = listar(aws, **as_doctor(PAULO))
    assert [r["id"] for r in caixa] == [para_ubs["id"]]
    assert caixa[0]["healthUnitName"] == "UBS 1 Asa Sul" and caixa[0]["code"] == para_ubs["code"]
    assert "clinical" not in caixa[0]  # lista só com resumo
    assert [r["id"] for r in listar(aws, **as_doctor(CARLA))] == [para_upa["id"]]


def test_medico_sem_unidade_tem_caixa_vazia(aws):
    new_referral(aws, UBS)
    sem_unidade = {"user": PAULO, "groups": "[papel:medico]", "sub": doctor_sub(PAULO)}
    assert listar(aws, **sem_unidade) == []


def test_medico_de_outra_unidade_abre_pela_guia(aws):
    """O paciente pode chegar com a guia a outra unidade: ela acha e abre (fica registrado)."""
    ref = new_referral(aws, UBS)
    resp = abrir(aws, ref["id"], **as_doctor(CARLA))
    assert resp["statusCode"] == 200
    assert body_of(resp)["mine"] is False


def test_farmacia_ve_os_que_enviou(aws):
    new_referral(aws, UBS)
    new_referral(aws, UPA)
    assert len(listar(aws, **OUTRO_FARMACEUTICO)) == 2
    assert listar(aws, groups="[unidade:taguatinga papel:farmaceutico]") == []


def test_admin_nao_ve_encaminhamentos(aws):
    new_referral(aws)
    assert aws.listar_encaminhamentos(event(path="/encaminhamentos", groups="[papel:admin]"), None)["statusCode"] == 403


# ---------------------------------------------------------------- guia: busca pelo código ou CPF

def test_busca_pelo_codigo_em_qualquer_formato(aws):
    ref = new_referral(aws)
    raw = ref["code"].replace("ENC-", "").replace("-", "")
    for typed in (ref["code"], ref["code"].lower(), raw, f"enc {raw[:4]} {raw[4:]}"):
        found = body_of(buscar(aws, {"code": typed}, **as_doctor(CARLA)))["referrals"]
        assert [r["id"] for r in found] == [ref["id"]], typed


def test_busca_pelo_cpf(aws):
    a = new_referral(aws, UBS)
    b = new_referral(aws, UPA)
    found = body_of(buscar(aws, {"cpf": "123.456.789-09"}, **as_doctor(PAULO)))["referrals"]
    assert {r["id"] for r in found} == {a["id"], b["id"]}
    assert body_of(buscar(aws, {"cpf": "52998224725"}, **as_doctor(PAULO)))["referrals"] == []


def test_farmacia_so_acha_as_dela(aws):
    ref = new_referral(aws)
    assert len(body_of(buscar(aws, {"code": ref["code"]}))["referrals"]) == 1
    outra = body_of(buscar(aws, {"code": ref["code"]}, groups="[unidade:taguatinga papel:farmaceutico]"))
    assert outra["referrals"] == []


def test_busca_validada_e_registrada_sem_cpf(aws):
    assert buscar(aws, {"code": "ENC-0000-1111"})["statusCode"] == 422  # 0 e 1 não existem no código
    assert buscar(aws, {"cpf": "111.111.111-11"})["statusCode"] == 422
    assert buscar(aws, {})["statusCode"] == 422
    assert buscar(aws, {"cpf": "123.456.789-09"}, groups="[papel:admin]")["statusCode"] == 403
    buscar(aws, {"cpf": "123.456.789-09"})
    items = boto3.resource("dynamodb", region_name=REGION).Table("painel-test").scan()["Items"]
    buscas = [i for i in items if i["PK"].startswith("AUDIT#") and i["action"] == "referral_search"]
    assert len(buscas) == 1 and buscas[0]["details"]["by"] == "cpf"
    assert "12345678909" not in str(buscas)


# ---------------------------------------------------------------- ciclo de vida

def test_medico_abre_responde_e_farmacia_ve_a_resposta(aws):
    ref = new_referral(aws)

    aberto = body_of(abrir(aws, ref["id"], **as_doctor(PAULO)))
    assert aberto["status"] == "read"
    assert aberto["clinical"]["vitals"]["spo2"] == 98

    assert aberto["readBy"] == {"id": doctor_sub(PAULO), "name": "Dr. Paulo Lima", "unit": "UBS 1 Asa Sul"}

    resp = mudar(aws, ref["id"], {"status": "answered", "response": "Paciente pode seguir com analgesia; retorno se piorar."}, **as_doctor(PAULO))
    assert resp["statusCode"] == 200
    respondido = body_of(resp)
    assert respondido["status"] == "answered"
    assert respondido["doctor"]["name"] == "Dr. Paulo Lima" and respondido["answeredUnit"] == "UBS 1 Asa Sul"
    assert listar(aws, **as_doctor(PAULO))[0]["doctorName"] == "Dr. Paulo Lima"  # resumo mostra quem respondeu

    da_farmacia = body_of(abrir(aws, ref["id"]))
    assert da_farmacia["response"].startswith("Paciente pode seguir")
    assert listar(aws, query={"status": "answered"})[0]["status"] == "answered"  # resumo acompanha

    audit = sorted(i["action"] for i in clinico_items() if i.get("referral") == ref["id"])
    assert audit == ["referral_answered", "referral_create", "referral_read"]


def test_farmacia_abrir_nao_marca_como_lido(aws):
    ref = new_referral(aws)
    assert body_of(abrir(aws, ref["id"]))["status"] == "sent"


def test_resposta_exige_texto(aws):
    ref = new_referral(aws)
    assert mudar(aws, ref["id"], {"status": "answered"}, **as_doctor(PAULO))["statusCode"] == 422


def test_farmacia_nao_responde_e_medico_nao_cancela(aws):
    ref = new_referral(aws)
    assert mudar(aws, ref["id"], {"status": "answered", "response": "ok ok"})["statusCode"] == 403
    assert mudar(aws, ref["id"], {"status": "cancelled"}, **as_doctor(PAULO))["statusCode"] == 403


def test_farmacia_cancela_e_depois_nada_muda(aws):
    ref = new_referral(aws)
    assert body_of(mudar(aws, ref["id"], {"status": "cancelled"}, **OUTRO_FARMACEUTICO))["status"] == "cancelled"
    resp = mudar(aws, ref["id"], {"status": "answered", "response": "tarde demais"}, **as_doctor(PAULO))
    assert resp["statusCode"] == 409


def test_recusa_com_motivo(aws):
    ref = new_referral(aws)
    resp = mudar(aws, ref["id"], {"status": "declined", "response": "Fora da minha especialidade."}, **as_doctor(PAULO))
    assert body_of(resp)["status"] == "declined"


def test_ficha_do_encaminhamento_nao_muda_com_o_atendimento(aws):
    """A cópia é do momento do envio: o médico vê o que foi encaminhado."""
    ref = new_referral(aws)
    table = boto3.resource("dynamodb", region_name=REGION).Table("clinico-test")
    table.update_item(Key={"PK": f"VISIT#{ref['visitId']}", "SK": "RECORD"}, UpdateExpression="SET notes = :n", ExpressionAttributeValues={":n": "mudou"})
    assert body_of(abrir(aws, ref["id"], **as_doctor(PAULO)))["clinical"]["notes"] == "Observação confidencial"


def test_outra_unidade_consulta_mas_nao_responde_nem_marca_lido(aws):
    """Outra unidade acha a guia e lê a ficha, mas quem responde é a unidade de destino."""
    ref = new_referral(aws, UBS)
    assert body_of(abrir(aws, ref["id"], **as_doctor(CARLA)))["status"] == "sent"
    resp = mudar(aws, ref["id"], {"status": "answered", "response": "Atendido na UPA; liberado com orientações."}, **as_doctor(CARLA))
    assert resp["statusCode"] == 403
    # a abertura por outra unidade fica no registro geral
    items = boto3.resource("dynamodb", region_name=REGION).Table("painel-test").scan()["Items"]
    assert "referral_open" in [i.get("action") for i in items if i["PK"].startswith("AUDIT#")]


def test_encaminhar_muda_o_desfecho_e_os_contadores(aws):
    visit = body_of(post_visit(aws))  # sai como "em andamento"
    assert visit["status"] == "progress"
    ref = body_of(send(aws, visit["id"]))
    lista = body_of(aws.listar_visitas(event(path="/visits"), None))
    assert next(v for v in lista["visits"] if v["id"] == visit["id"])["status"] == "referred"
    assert lista["summary"]["referred"] == 1 and lista["summary"]["progress"] == 0
    stats = [i for i in boto3.resource("dynamodb", region_name=REGION).Table("painel-test").scan()["Items"] if i["SK"] == "#STATS"]
    assert all(int(s.get("referred", 0)) == 1 and int(s.get("progress", 0)) == 0 for s in stats)
    # a guia leva quem fez o atendimento
    assert ref["attendedBy"] == {"name": "Dra. Ana Souza", "crf": "4192"}


def test_medico_sem_unidade_nao_busca_nem_abre(aws):
    ref = new_referral(aws, UBS)
    sem_unidade = {"user": PAULO, "groups": "[papel:medico]", "sub": doctor_sub(PAULO)}
    assert buscar(aws, {"code": ref["code"]}, **sem_unidade)["statusCode"] == 403
    assert abrir(aws, ref["id"], **sem_unidade)["statusCode"] == 404


def test_filtro_por_situacao_nao_perde_os_antigos(aws, monkeypatch):
    import painel.comum.encaminhamentos as enc_mod

    monkeypatch.setattr(enc_mod, "LIST_LIMIT", 2)
    antigo = new_referral(aws)  # o mais antigo, ainda sem leitura
    for _ in range(3):
        r = new_referral(aws)
        mudar(aws, r["id"], {"status": "cancelled"})
    enviados = listar(aws, query={"status": "sent"}, **as_doctor(PAULO))
    assert [r["id"] for r in enviados] == [antigo["id"]]


def test_limite_diario_de_buscas(aws, monkeypatch):
    monkeypatch.setattr(aws, "LIMITE_BUSCAS_GUIA", 2)
    for _ in range(2):
        assert buscar(aws, {"cpf": "123.456.789-09"}, **as_doctor(PAULO))["statusCode"] == 200
    resp = buscar(aws, {"cpf": "123.456.789-09"}, **as_doctor(PAULO))
    assert resp["statusCode"] == 429
    # é por usuário: outro médico continua buscando
    assert buscar(aws, {"cpf": "123.456.789-09"}, **as_doctor(CARLA))["statusCode"] == 200
