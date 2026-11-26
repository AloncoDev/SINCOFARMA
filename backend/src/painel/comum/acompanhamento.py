"""Acompanhamento dos atendimentos pela administração: quem cuidou de cada um e em que pé está.

A administração vê, de qualquer farmácia, o protocolo, a situação (desfecho e Red Flag), o
farmacêutico responsável, o médico do encaminhamento e a linha do tempo de quem fez o quê.
Nunca o paciente: nada de nome, CPF, queixa ou ficha clínica (LGPD, minimização). Das tabelas
clínicas só se leem campos de controle (ProjectionExpression), e cada consulta fica no
registro geral de auditoria.
"""

import os

from boto3.dynamodb.conditions import Key

from . import auditoria
from . import repositorio as repo
from . import tempo
from .http import HttpError

# quem age em cada passo (o papel aparece na linha do tempo)
ACTION_ROLE = {
    "create": "farmaceutico",
    "update": "farmaceutico",
    "referral_create": "farmaceutico",
    "referral_cancelled": "farmaceutico",
    "referral_read": "medico",
    "referral_answered": "medico",
    "referral_declined": "medico",
}
# campos de mudança que podem aparecer (situação, nunca conteúdo clínico)
SAFE_CHANGES = ("status", "urgent", "priority")
# campos de controle lidos (muitos nomes são reservados no DynamoDB: todos vão com "#")
REF_FIELDS = ("id", "code", "visitId", "status", "statusAt", "createdAt", "priority", "urgent", "healthUnit", "doctor", "from", "answeredUnit")
TRAIL_FIELDS = ("SK", "unit", "protocol", "action", "at", "actorSub", "actorUsername", "referral", "changes")


def _clinico():
    return repo._dynamodb.Table(os.environ["TABELA_CLINICO"])


def _summary(item: dict) -> dict:
    """Resumo do atendimento sem o paciente."""
    return {
        "id": item["id"],
        "protocol": item.get("protocol"),
        "at": item["at"],
        "time": item["time"],
        "status": item["status"],
        "urgent": bool(item.get("urgent")),
        "risk": item.get("risk"),
        "rt": item.get("rt") or "—",
        "rtCrf": item.get("rtCrf"),
        **({"source": item["source"]} if item.get("source") else {}),
    }


def _referral(ref: dict) -> dict:
    return {
        "id": ref["id"],
        "status": ref["status"],
        "statusAt": ref.get("statusAt"),
        "createdAt": ref.get("createdAt"),
        "priority": ref.get("priority"),
        "code": ref.get("code"),
        # destino: a unidade de saúde (nos antigos, o médico escolhido)
        "healthUnit": (ref.get("healthUnit") or {}).get("name"),
        # quem respondeu (nos antigos, o médico escolhido)
        "doctor": (ref.get("doctor") or {}).get("name"),
        "answeredUnit": ref.get("answeredUnit"),
        "from": (ref.get("from") or {}).get("name", "—"),
    }


def _referrals_by_id(ids: list[str]) -> dict[str, dict]:
    """Encaminhamentos completos, mas lendo só os campos de controle (a cópia da ficha fica de fora)."""
    table = os.environ["TABELA_CLINICO"]
    keys = [{"PK": f"REF#{i}", "SK": "REF"} for i in dict.fromkeys(ids)]
    found: dict[str, dict] = {}
    for start in range(0, len(keys), 100):
        request = {table: {
            "Keys": keys[start:start + 100],
            "ProjectionExpression": ", ".join(f"#{f}" for f in REF_FIELDS),
            "ExpressionAttributeNames": {f"#{f}": f for f in REF_FIELDS},
        }}
        while request:
            resp = repo._dynamodb.batch_get_item(RequestItems=request)
            for item in resp.get("Responses", {}).get(table, []):
                found[item["id"]] = item
            request = resp.get("UnprocessedKeys") or None
    return found


def _unit_names() -> dict[str, str]:
    return {u["id"]: u["name"] for u in repo.list_units()}


def list_day(caller, unit: str, day: str) -> dict:
    """Atendimentos de uma farmácia num dia, com farmacêutico e encaminhamentos (sem pacientes)."""
    names = _unit_names()
    if unit not in names:
        raise HttpError(404, "Farmácia não encontrada.")
    items = repo._painel().query(
        KeyConditionExpression=Key("PK").eq(repo.pk_day(unit, day)) & Key("SK").begins_with("VISIT#"),
        ScanIndexForward=False,
    ).get("Items", [])
    visits = [_summary(i) for i in items]

    # encaminhamentos da farmácia criados a partir do dia (só esses podem ser destes atendimentos)
    ids, kwargs = [], {
        "KeyConditionExpression": Key("PK").eq(f"UNIT#{unit}#REF") & Key("SK").gte(f"REF#{day}"),
        "ProjectionExpression": "#id",
        "ExpressionAttributeNames": {"#id": "id"},
    }
    if visits:
        while True:
            resp = _clinico().query(**kwargs)
            ids += [i["id"] for i in resp.get("Items", [])]
            if "LastEvaluatedKey" not in resp:
                break
            kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]
    by_visit: dict[str, list[dict]] = {}
    for ref in sorted(_referrals_by_id(ids).values(), key=lambda r: r.get("createdAt", "")):
        by_visit.setdefault(ref.get("visitId"), []).append(_referral(ref))
    for v in visits:
        v["referrals"] = by_visit.get(v["id"], [])

    auditoria.record("visits_track", caller, unit=unit, target={"type": "unit", "id": unit, "label": names[unit]}, details={"day": day})
    return {"unit": unit, "unitName": names[unit], "day": day, "visits": visits}


def detail(caller, visit_id: str) -> dict:
    """Um atendimento: situação, pessoas envolvidas e a linha do tempo (sem o paciente)."""
    items = _clinico().query(
        KeyConditionExpression=Key("PK").eq(f"VISIT#{visit_id}"),
        # do registro clínico só a farmácia e o protocolo; da trilha, os campos de controle
        ProjectionExpression=", ".join(f"#{f}" for f in TRAIL_FIELDS),
        ExpressionAttributeNames={f"#{f}": f for f in TRAIL_FIELDS},
    ).get("Items", [])
    record = next((i for i in items if i["SK"] == "RECORD"), None)
    if not record:
        raise HttpError(404, "Atendimento não encontrado.")
    unit = record["unit"]
    at = repo.visit_instant(visit_id)
    visit = repo._painel().get_item(Key={"PK": repo.pk_day(unit, tempo.day_key(at)), "SK": f"VISIT#{visit_id}"}).get("Item")
    if not visit:
        raise HttpError(404, "Atendimento não encontrado.")

    trail = sorted((i for i in items if i["SK"].startswith("AUDIT#")), key=lambda i: i["at"])
    refs = _referrals_by_id([i["referral"] for i in trail if i.get("referral")])
    timeline = []
    for h in trail:
        changes = {k: v for k, v in (h.get("changes") or {}).items() if k in SAFE_CHANGES}
        ref = refs.get(h.get("referral")) if h.get("referral") else None
        timeline.append({
            "at": h["at"],
            "action": h["action"],
            "label": repo.ACTION_LABELS.get(h["action"], h["action"]),
            "actor": repo._actor_name(h),
            "role": ACTION_ROLE.get(h["action"]),
            "changes": changes,
            **({"destination": (ref.get("healthUnit") or ref.get("doctor") or {}).get("name")} if ref and h["action"] == "referral_create" else {}),
        })

    names = _unit_names()
    auditoria.record("visit_track", caller, unit=unit, target={"type": "visit", "id": visit_id, "label": record.get("protocol")})
    return {
        "visit": _summary(visit),
        "unit": unit,
        "unitName": names.get(unit, unit),
        "referrals": [_referral(r) for r in sorted(refs.values(), key=lambda r: r.get("createdAt", ""))],
        "timeline": timeline,
    }
