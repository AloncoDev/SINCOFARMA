"""Encaminhamentos: o farmacêutico envia um atendimento a uma unidade de saúde (UBS, UPA...),
e qualquer médico da unidade lê e responde. Cada encaminhamento gera uma guia com código
(ENC-XXXX-XXXX) e QR code, que o paciente leva; a guia é achada pelo código ou pelo CPF.

Tudo na tabela CLINICO (dados de saúde, chave KMS própria):
  REF#<id>             REF                  encaminhamento completo + cópia da ficha no envio
  SAUDE#<u>#REF        REF#<criado>#<id>    caixa de entrada da unidade de saúde (resumo)
  MED#<sub do médico>  REF#<criado>#<id>    caixa de um médico (encaminhamentos antigos, de antes das unidades)
  UNIT#<u>#REF         REF#<criado>#<id>    encaminhamentos da farmácia (resumo)
  GUIA#<código>        REF                  código da guia -> encaminhamento
  VISIT#<id>           AUDIT#...            auditoria, junto à do atendimento
  PAC#<cpf>            REF#<id>             índice do paciente (busca da guia pelo CPF e pedidos da LGPD)

O médico recebe a ficha copiada no momento do envio: lê só o que foi encaminhado, nunca o
registro clínico da farmácia. Estados: sent -> read -> answered | declined; cancelled pela
farmácia enquanto não houver resposta.
"""

import json
import os
import re
import secrets

from boto3.dynamodb.conditions import Key

from . import auditoria
from . import repositorio as repo
from . import saude
from . import tempo
from .http import HttpError
from .validacao import anonymize_cpf

OPEN = ("sent", "read")  # ainda sem resposta
LIST_LIMIT = 100
SEARCH_LIMIT = 30
# código da guia: sem letras e números que se confundem (0/O, 1/I/L, U/V)
CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTWXYZ"
CODE_RE = re.compile(rf"^(?:ENC)?([{CODE_ALPHABET}]{{8}})$")


def _clinico():
    return repo._dynamodb.Table(os.environ["TABELA_CLINICO"])


def _attrs(user: dict) -> dict:
    return {a["Name"]: a["Value"] for a in user.get("Attributes", user.get("UserAttributes", []))}


def new_code() -> str:
    """ENC-XXXX-XXXX: 29^8 combinações, fácil de ditar e digitar."""
    raw = "".join(secrets.choice(CODE_ALPHABET) for _ in range(8))
    return f"ENC-{raw[:4]}-{raw[4:]}"


def normalize_code(text: str) -> str | None:
    """Aceita "enc-7k3q 9m2x", "ENC7K3Q9M2X" ou só "7K3Q9M2X"; devolve "ENC-7K3Q-9M2X" (ou None)."""
    m = CODE_RE.match(re.sub(r"[^A-Z0-9]", "", (text or "").upper()))
    return f"ENC-{m.group(1)[:4]}-{m.group(1)[4:]}" if m else None


def _destination(ref: dict) -> str:
    """Nome de quem recebe: a unidade de saúde (ou o médico, nos encaminhamentos antigos)."""
    if ref.get("healthUnit"):
        return ref["healthUnit"]["name"]
    return (ref.get("doctor") or {}).get("name", "—")


def _summary(ref: dict) -> dict:
    """O que as listas mostram (nunca a ficha)."""
    return {
        "id": ref["id"],
        "createdAt": ref["createdAt"],
        "status": ref["status"],
        "statusAt": ref["statusAt"],
        "priority": ref["priority"],
        "urgent": ref["urgent"],
        "risk": ref["clinical"]["risk"],
        "patientName": ref["patient"]["name"],
        "complaint": ref["clinical"]["complaint"]["text"],
        "protocol": ref["protocol"],
        "unit": ref["unit"],
        "unitName": ref["unitName"],
        "fromName": ref["from"]["name"],
        "code": ref.get("code"),
        "healthUnitId": (ref.get("healthUnit") or {}).get("id"),
        "healthUnitName": _destination(ref),
        # quem respondeu (ou o médico escolhido, nos antigos)
        "doctorName": (ref.get("doctor") or {}).get("name"),
    }


def _keys(ref: dict) -> list[dict]:
    """Completo, caixa de quem recebe (unidade de saúde ou, nos antigos, o médico) e lista da farmácia."""
    sk = f"REF#{ref['createdAt']}#{ref['id']}"
    inbox = f"SAUDE#{ref['healthUnit']['id']}#REF" if ref.get("healthUnit") else f"MED#{ref['doctor']['id']}"
    return [
        {"PK": f"REF#{ref['id']}", "SK": "REF"},
        {"PK": inbox, "SK": sk},
        {"PK": f"UNIT#{ref['unit']}#REF", "SK": sk},
    ]


def _audit(ref: dict, caller, action: str, changes: dict) -> dict:
    at = tempo.now().isoformat()
    item = {
        "PK": f"VISIT#{ref['visitId']}",
        "SK": f"AUDIT#{at}#{secrets.token_hex(3)}",
        "action": action,
        "at": at,
        "actorSub": caller.sub,
        "unit": ref["unit"],
        "referral": ref["id"],
        "changes": changes,
    }
    repo.log.info(json.dumps({"evento": "auditoria", "acao": action, "encaminhamento": ref["id"], "usuario": caller.sub, "unidade": ref["unit"]}))
    return {"Put": {"TableName": os.environ["TABELA_CLINICO"], "Item": item}}


def _target(ref: dict) -> dict:
    """Alvo no registro geral: protocolo, guia e destino, nunca o paciente."""
    return {"type": "referral", "id": ref["id"], "label": ref.get("protocol"), "code": ref.get("code"), "destination": _destination(ref)}


def public(ref: dict, caller) -> dict:
    """Encaminhamento completo para quem pode vê-lo (sem chaves internas)."""
    out = {k: v for k, v in ref.items() if k not in ("PK", "SK")}
    doctor = ref.get("doctor")
    out["doctor"] = {"id": doctor["id"], "name": doctor["name"]} if doctor else None
    out["mine"] = caller.sub == ref["from"]["sub"] or (
        caller.pode("responder_encaminhamento") and _for_my_unit(ref, caller)
    )
    return out


def _for_my_unit(ref: dict, caller) -> bool:
    """O encaminhamento é para a unidade de saúde de quem vê (ou, nos antigos, para o próprio médico)."""
    if ref.get("healthUnit"):
        return bool(caller.health_unit) and ref["healthUnit"]["id"] == caller.health_unit
    return (ref.get("doctor") or {}).get("id") == caller.sub


# ---------------------------------------------------------------- escrita

def create(caller, data: dict) -> dict:
    visit_id = data["visitId"]
    at_visit = repo.visit_instant(visit_id)
    visit = repo._painel().get_item(
        Key={"PK": repo.pk_day(caller.unit_id, tempo.day_key(at_visit)), "SK": f"VISIT#{visit_id}"}
    ).get("Item")
    record = _clinico().get_item(Key={"PK": f"VISIT#{visit_id}", "SK": "RECORD"}).get("Item")
    if not visit or not record or record.get("unit") != caller.unit_id:
        # inexistente ou de outra farmácia: mesma resposta
        raise HttpError(404, "Atendimento não encontrado.")

    health = saude.get(data["healthUnitId"])
    if not health:
        raise HttpError(422, "Unidade de saúde não encontrada.", {"fields": {"healthUnitId": "Escolha uma unidade da lista."}})
    sender = repo.pharmacist(caller.username)
    now = tempo.now()
    patient = record["patient"]
    ref = {
        "id": repo.new_visit_id(now),
        "code": new_code(),
        "visitId": visit_id,
        "protocol": visit.get("protocol"),
        "unit": caller.unit_id,
        "unitName": repo.unit_profile(caller.unit_id)["name"],
        "createdAt": now.isoformat(),
        "status": "sent",
        "statusAt": now.isoformat(),
        "priority": data["priority"],
        "urgent": data["priority"] == "urgente" or bool(visit.get("urgent")),
        "reason": data["reason"],
        "from": {"sub": caller.sub, "name": sender["name"], "crf": sender.get("crf")},
        "healthUnit": {"id": health["id"], "name": health["name"], "kind": health["kind"]},
        # quem respondeu (preenchido na resposta)
        "doctor": None,
        # só o necessário para o médico atender: CPF mascarado, sem endereço
        "patient": {
            "name": patient["name"],
            "birthDate": patient.get("birthDate"),
            "sex": patient.get("sex"),
            "phone": patient.get("phone"),
            "cns": patient.get("cns"),
            "cpf": anonymize_cpf(patient.get("cpf")),
        },
        "clinical": {k: record.get(k) for k in ("complaint", "history", "vitals", "risk", "redFlags", "notes")},
        "response": None,
        "answeredAt": None,
    }
    table = os.environ["TABELA_CLINICO"]
    for attempt in range(3):
        full, inbox, unit = _keys(ref)
        summary = _summary(ref)
        try:
            repo._client.transact_write_items(
                TransactItems=[
                    {"Put": {"TableName": table, "Item": {**full, **ref}, "ConditionExpression": "attribute_not_exists(PK)"}},
                    {"Put": {"TableName": table, "Item": {**inbox, **summary}}},
                    {"Put": {"TableName": table, "Item": {**unit, **summary}}},
                    # o código da guia é único: se já existir (raríssimo), sorteia outro
                    {"Put": {"TableName": table, "Item": {"PK": f"GUIA#{ref['code']}", "SK": "REF", "refId": ref["id"]},
                             "ConditionExpression": "attribute_not_exists(PK)"}},
                    _audit(ref, caller, "referral_create", {"healthUnit": health["id"], "priority": ref["priority"]}),
                    repo.patient_index(patient["cpf"], "REF", ref["id"], ref["unit"], ref["createdAt"]),
                    auditoria.put("referral_create", caller, unit=ref["unit"], target=_target(ref), details={"priority": ref["priority"]}),
                ]
            )
            break
        except repo._client.exceptions.TransactionCanceledException as exc:
            reasons = [r.get("Code") for r in exc.response.get("CancellationReasons", [])]
            if attempt < 2 and len(reasons) > 3 and reasons[3] == "ConditionalCheckFailed":
                ref["code"] = new_code()
                continue
            raise
    return public(ref, caller)


def _load_visible(caller, ref_id: str) -> dict:
    ref = _clinico().get_item(Key={"PK": f"REF#{ref_id}", "SK": "REF"}, ConsistentRead=True).get("Item")
    # médico: de qualquer unidade (o paciente pode chegar com a guia a outra unidade); farmácia: só as dela
    visible = ref and (
        caller.pode("responder_encaminhamento")
        or (caller.pode("criar_encaminhamento") and ref["unit"] == caller.unit_id)
    )
    if not visible:
        # de outra farmácia: mesma resposta de inexistente
        raise HttpError(404, "Encaminhamento não encontrado.")
    return ref


def _set_status(ref: dict, caller, new: dict, action: str) -> dict:
    """Atualiza o completo e os dois resumos de uma vez, só se ninguém mudou antes."""
    table = os.environ["TABELA_CLINICO"]
    names = {"#st": "status"}
    values = {":old": ref["status"]}
    sets = []
    for i, (k, v) in enumerate(new.items()):
        names[f"#f{i}"] = k
        values[f":v{i}"] = v
        sets.append(f"#f{i} = :v{i}")
    update = "SET " + ", ".join(sets)
    summary_fields = {k: v for k, v in new.items() if k in ("status", "statusAt")}
    if "doctor" in new:  # quem respondeu aparece nas listas
        summary_fields["doctorName"] = new["doctor"]["name"]
    s_names = {f"#s{i}": k for i, k in enumerate(summary_fields)} | {"#st": "status"}
    s_values = {f":s{i}": v for i, v in enumerate(summary_fields.values())} | {":old": ref["status"]}
    s_update = "SET " + ", ".join(f"#s{i} = :s{i}" for i in range(len(summary_fields)))
    full, inbox, unit = _keys(ref)
    try:
        repo._client.transact_write_items(
            TransactItems=[
                {"Update": {"TableName": table, "Key": full, "UpdateExpression": update, "ConditionExpression": "#st = :old",
                            "ExpressionAttributeNames": names, "ExpressionAttributeValues": values}},
                *[
                    {"Update": {"TableName": table, "Key": key, "UpdateExpression": s_update, "ConditionExpression": "#st = :old",
                                "ExpressionAttributeNames": s_names, "ExpressionAttributeValues": s_values}}
                    for key in (inbox, unit)
                ],
                _audit(ref, caller, action, {"status": [ref["status"], new["status"]]}),
                auditoria.put(action, caller, unit=ref["unit"], target=_target(ref), details={"status": [ref["status"], new["status"]]}),
            ]
        )
    except repo._client.exceptions.TransactionCanceledException as exc:
        if "ConditionalCheckFailed" in [r.get("Code") for r in exc.response.get("CancellationReasons", [])]:
            raise HttpError(409, "O encaminhamento foi alterado por outra pessoa. Recarregue.") from exc
        raise
    return {**ref, **new}


def _who(caller) -> dict:
    """Médico que agiu e a unidade de saúde dele (o nome aparece para a farmácia)."""
    unit = saude.get(caller.health_unit) if caller.health_unit else None
    return {"id": caller.sub, "name": repo.name_of_sub(caller.sub), "unit": unit["name"] if unit else None}


def open_one(caller, ref_id: str) -> dict:
    """Detalhe; a primeira leitura por um médico marca como lido (e registra quem leu)."""
    ref = _load_visible(caller, ref_id)
    if ref["status"] == "sent" and caller.pode("responder_encaminhamento"):
        ref = _set_status(ref, caller, {"status": "read", "statusAt": tempo.now().isoformat(), "readBy": _who(caller)}, "referral_read")
    elif caller.pode("responder_encaminhamento") and not _for_my_unit(ref, caller):
        # médico de outra unidade abrindo (achou pela guia): fica no registro geral
        auditoria.record("referral_open", caller, unit=ref["unit"], target=_target(ref))
    return public(ref, caller)


def change(caller, ref_id: str, data: dict) -> dict:
    ref = _load_visible(caller, ref_id)
    status = data["status"]
    if status in ("answered", "declined"):
        # qualquer médico ligado a uma unidade de saúde (o paciente pode ter ido a outra unidade)
        if not caller.pode("responder_encaminhamento") or not (caller.health_unit or _for_my_unit(ref, caller)):
            raise HttpError(403, "Só médicos ligados a uma unidade de saúde respondem encaminhamentos.")
    elif not (caller.pode("criar_encaminhamento") and ref["unit"] == caller.unit_id):
        raise HttpError(403, "Só a farmácia que encaminhou pode cancelar.")
    if ref["status"] not in OPEN:
        raise HttpError(409, "Este encaminhamento já foi encerrado.")
    now = tempo.now().isoformat()
    new = {"status": status, "statusAt": now}
    if status in ("answered", "declined"):
        who = _who(caller)
        new |= {"response": data["response"], "answeredAt": now, "doctor": {"id": who["id"], "name": who["name"]}, "answeredUnit": who["unit"]}
    return public(_set_status(ref, caller, new, f"referral_{status}"), caller)


# ---------------------------------------------------------------- leitura

def list_for(caller, status: str | None = None) -> list[dict]:
    """Médico: a caixa da unidade de saúde dele (e os antigos, endereçados a ele). Farmacêutico: os da farmácia."""
    if caller.pode("responder_encaminhamento") and not caller.pode("criar_encaminhamento"):
        pks = ([f"SAUDE#{caller.health_unit}#REF"] if caller.health_unit else []) + [f"MED#{caller.sub}"]
    elif caller.pode("criar_encaminhamento"):
        pks = [f"UNIT#{caller.unit_id}#REF"]
    else:
        raise HttpError(403, "Seu perfil não tem acesso a esta função.")
    items = []
    for pk in pks:
        items += _clinico().query(
            KeyConditionExpression=Key("PK").eq(pk) & Key("SK").begins_with("REF#"),
            ScanIndexForward=False,
            Limit=LIST_LIMIT,
        ).get("Items", [])
    items.sort(key=lambda i: i["SK"], reverse=True)
    items = [{k: v for k, v in i.items() if k not in ("PK", "SK")} for i in items[:LIST_LIMIT]]
    return [i for i in items if status is None or i["status"] == status]


def _full(ids: list[str]) -> list[dict]:
    table = os.environ["TABELA_CLINICO"]
    keys = [{"PK": f"REF#{i}", "SK": "REF"} for i in dict.fromkeys(ids)]
    found = []
    for start in range(0, len(keys), 100):
        request = {table: {"Keys": keys[start:start + 100]}}
        while request:
            resp = repo._dynamodb.batch_get_item(RequestItems=request)
            found += resp.get("Responses", {}).get(table, [])
            request = resp.get("UnprocessedKeys") or None
    return found


def search(caller, by: str, value: str) -> list[dict]:
    """Guia pelo código (ENC-XXXX-XXXX) ou pelo CPF do paciente. Médico: de qualquer unidade;
    farmácia: só as dela. A busca fica no registro geral, sem o CPF."""
    if by == "code":
        item = _clinico().get_item(Key={"PK": f"GUIA#{value}", "SK": "REF"}).get("Item")
        ids = [item["refId"]] if item else []
    else:
        resp = _clinico().query(
            KeyConditionExpression=Key("PK").eq(f"PAC#{value}") & Key("SK").begins_with("REF#"),
            ScanIndexForward=False,
            Limit=SEARCH_LIMIT,
        )
        ids = [i["SK"].removeprefix("REF#") for i in resp.get("Items", [])]
    refs = [r for r in _full(ids) if caller.pode("responder_encaminhamento") or r["unit"] == caller.unit_id]
    refs.sort(key=lambda r: r["createdAt"], reverse=True)
    auditoria.record("referral_search", caller, unit=caller.unit_id, target={"type": "search", "label": "código" if by == "code" else "CPF"},
                     details={"by": by, "found": len(refs)})
    return [_summary(r) for r in refs]
