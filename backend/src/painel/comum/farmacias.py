"""Farmácias da rede, geridas pela administração.

Cada farmácia é o perfil `UNIT#<id> / PROFILE` na tabela PAINEL (nome e metas) mais o grupo
`unidade:<id>` no Cognito, que liga farmacêuticos a ela. Os números da lista vêm dos contadores
de dia e mês (`#STATS`): só agregados, nenhum dado de paciente.
"""

import os

from boto3.dynamodb.conditions import Attr

from . import auditoria
from . import repositorio as repo
from . import tempo
from .auth import UNIT_PREFIX
from .http import HttpError

def _pool() -> str:
    return os.environ["USER_POOL_ID"]


def profiles() -> list[dict]:
    """Perfis completos de todas as farmácias (mesma varredura de list_units)."""
    kwargs = {"FilterExpression": Attr("SK").eq("PROFILE")}
    items = []
    while True:
        resp = repo._painel().scan(**kwargs)
        items += resp.get("Items", [])
        if "LastEvaluatedKey" not in resp:
            return items
        kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]


def _stats(units: list[str], day: str, month: str) -> dict[str, dict]:
    """Contadores de hoje e do mês de várias farmácias numa leitura em lote. Chave = PK."""
    return repo.stats_by_pk([repo.pk_day(u, day) for u in units] + [repo.pk_month(u, month) for u in units])


def _pharmacists(unit: str) -> dict[str, int]:
    """Farmacêuticos ativos ligados à farmácia (o grupo pode ainda não existir)."""
    active = pending = 0
    token = None
    while True:
        kw = {"UserPoolId": _pool(), "GroupName": f"{UNIT_PREFIX}{unit}", "Limit": 60}
        if token:
            kw["NextToken"] = token
        try:
            resp = repo._cognito.list_users_in_group(**kw)
        except repo._cognito.exceptions.ResourceNotFoundException:
            return {"active": 0, "pending": 0}
        for u in resp.get("Users", []):
            if not u.get("Enabled", True):
                continue
            if u.get("UserStatus") == "FORCE_CHANGE_PASSWORD":
                pending += 1
            else:
                active += 1
        token = resp.get("NextToken")
        if not token:
            return {"active": active, "pending": pending}


def _public(item: dict, stats: dict[str, dict], day: str, month: str, people: dict[str, int]) -> dict:
    unit = item["PK"].removeprefix("UNIT#")
    m = stats.get(repo.pk_month(unit, month), {})
    d = stats.get(repo.pk_day(unit, day), {})
    dur_count = int(m.get("durCount", 0))
    return {
        "id": unit,
        "name": item.get("name") or unit,
        "monthGoal": int(item.get("monthGoal") or 0),
        "triageGoalMin": int(item.get("triageGoalMin") or 10),
        "createdAt": item.get("createdAt"),
        "pharmacists": people,
        "today": {"total": int(d.get("total", 0)), "urgent": int(d.get("urgent", 0))},
        "month": {
            "total": int(m.get("total", 0)),
            **{k: int(m.get(k, 0)) for k in ("done", "referred", "progress", "urgent")},
            # tempo médio de triagem em minutos (None sem medição)
            "triageMinutes": round(int(m.get("durSum", 0)) / dur_count / 60, 1) if dur_count else None,
        },
    }


def list_all() -> dict:
    now = tempo.now()
    day, month = tempo.day_key(now), tempo.month_key(now)
    items = profiles()
    units = [i["PK"].removeprefix("UNIT#") for i in items]
    stats = _stats(units, day, month) if units else {}
    out = [_public(i, stats, day, month, _pharmacists(u)) for i, u in zip(items, units)]
    return {"month": month, "units": sorted(out, key=lambda u: repo._sem_acento(u["name"]))}


def _ensure_group(unit: str, name: str) -> None:
    try:
        repo._cognito.create_group(UserPoolId=_pool(), GroupName=f"{UNIT_PREFIX}{unit}", Description=name)
    except repo._cognito.exceptions.GroupExistsException:
        repo._cognito.update_group(UserPoolId=_pool(), GroupName=f"{UNIT_PREFIX}{unit}", Description=name)


def create(caller, data: dict) -> dict:
    now = tempo.now()
    item = {
        "PK": f"UNIT#{data['id']}",
        "SK": "PROFILE",
        "name": data["name"],
        "monthGoal": data["monthGoal"],
        "triageGoalMin": data["triageGoalMin"],
        "createdAt": now.isoformat(),
    }
    try:
        repo._client.transact_write_items(
            TransactItems=[
                {"Put": {"TableName": os.environ["TABELA_PAINEL"], "Item": item, "ConditionExpression": "attribute_not_exists(PK)"}},
                auditoria.put("unit_create", caller, unit=data["id"], target={"type": "unit", "id": data["id"], "label": data["name"]},
                              details={"monthGoal": data["monthGoal"], "triageGoalMin": data["triageGoalMin"]}),
            ]
        )
    except repo._client.exceptions.TransactionCanceledException as exc:
        if "ConditionalCheckFailed" in [r.get("Code") for r in exc.response.get("CancellationReasons", [])]:
            raise HttpError(409, "Já existe uma farmácia com este código.", {"fields": {"id": "Código em uso."}}) from exc
        raise
    _ensure_group(data["id"], data["name"])
    return _public(item, {}, tempo.day_key(now), tempo.month_key(now), {"active": 0, "pending": 0})


def update(caller, unit: str, data: dict) -> dict:
    current = repo._painel().get_item(Key={"PK": f"UNIT#{unit}", "SK": "PROFILE"}, ConsistentRead=True).get("Item")
    if not current:
        raise HttpError(404, "Farmácia não encontrada.")
    changes = {k: v for k, v in data.items() if current.get(k) != v}
    if changes:
        names = {f"#f{i}": k for i, k in enumerate(changes)}
        values = {f":v{i}": v for i, v in enumerate(changes.values())}
        repo._client.transact_write_items(
            TransactItems=[
                {"Update": {
                    "TableName": os.environ["TABELA_PAINEL"],
                    "Key": {"PK": f"UNIT#{unit}", "SK": "PROFILE"},
                    "UpdateExpression": "SET " + ", ".join(f"#f{i} = :v{i}" for i in range(len(changes))),
                    "ConditionExpression": "attribute_exists(PK)",
                    "ExpressionAttributeNames": names,
                    "ExpressionAttributeValues": values,
                }},
                auditoria.put("unit_update", caller, unit=unit, target={"type": "unit", "id": unit, "label": data.get("name", current.get("name"))},
                              details={k: [_plain(current.get(k)), v] for k, v in changes.items()}),
            ]
        )
        if "name" in changes:
            _ensure_group(unit, changes["name"])
    item = {**current, **changes}
    now = tempo.now()
    day, month = tempo.day_key(now), tempo.month_key(now)
    return _public(item, _stats([unit], day, month), day, month, _pharmacists(unit))


def _plain(v):
    """Decimal do DynamoDB -> int, para o detalhe da auditoria."""
    return int(v) if v is not None and not isinstance(v, str) else v

