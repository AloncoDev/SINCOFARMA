"""Unidades de saúde (UBS, UPA, hospital...), geridas pela administração.

Cada unidade é o perfil `SAUDE#<id> / PROFILE` na tabela PAINEL (nome, tipo, região) mais o
grupo `saude:<id>` no Cognito, que liga os médicos a ela. Os encaminhamentos das farmácias vão
para a unidade, e qualquer médico dela lê e responde.
"""

import os

from boto3.dynamodb.conditions import Attr

from . import auditoria
from . import repositorio as repo
from . import tempo
from .auth import HEALTH_PREFIX
from .http import HttpError

def _pool() -> str:
    return os.environ["USER_POOL_ID"]


def _key(unit: str) -> dict:
    return {"PK": f"SAUDE#{unit}", "SK": "PROFILE"}


def _public(item: dict, doctors: dict | None = None) -> dict:
    out = {
        "id": item["PK"].removeprefix("SAUDE#"),
        "name": item.get("name") or item["PK"],
        "kind": item.get("kind", "outro"),
        "region": item.get("region") or "",
        "createdAt": item.get("createdAt"),
    }
    if doctors is not None:
        out["doctors"] = doctors
    return out


def _profiles() -> list[dict]:
    kwargs = {"FilterExpression": Attr("PK").begins_with("SAUDE#") & Attr("SK").eq("PROFILE")}
    items = []
    while True:
        resp = repo._painel().scan(**kwargs)
        items += resp.get("Items", [])
        if "LastEvaluatedKey" not in resp:
            return items
        kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]


def _doctors(unit: str) -> dict[str, int]:
    """Médicos ligados à unidade: ativos e aguardando o primeiro acesso."""
    active = pending = 0
    token = None
    while True:
        kw = {"UserPoolId": _pool(), "GroupName": f"{HEALTH_PREFIX}{unit}", "Limit": 60}
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


def list_all(*, with_doctors: bool) -> list[dict]:
    """Todas as unidades em ordem de nome. A administração vê também quantos médicos cada uma tem."""
    out = [_public(i, _doctors(i["PK"].removeprefix("SAUDE#")) if with_doctors else None) for i in _profiles()]
    return sorted(out, key=lambda u: repo._sem_acento(u["name"]))


def get(unit: str) -> dict | None:
    item = repo._painel().get_item(Key=_key(unit)).get("Item")
    return _public(item) if item else None


def _ensure_group(unit: str, name: str) -> None:
    try:
        repo._cognito.create_group(UserPoolId=_pool(), GroupName=f"{HEALTH_PREFIX}{unit}", Description=name)
    except repo._cognito.exceptions.GroupExistsException:
        repo._cognito.update_group(UserPoolId=_pool(), GroupName=f"{HEALTH_PREFIX}{unit}", Description=name)


def create(caller, data: dict) -> dict:
    item = {**_key(data["id"]), "name": data["name"], "kind": data["kind"], "region": data["region"], "createdAt": tempo.now().isoformat()}
    try:
        repo._client.transact_write_items(
            TransactItems=[
                {"Put": {"TableName": os.environ["TABELA_PAINEL"], "Item": item, "ConditionExpression": "attribute_not_exists(PK)"}},
                auditoria.put("health_create", caller, unit=None, target={"type": "health", "id": data["id"], "label": data["name"]},
                              details={"kind": data["kind"]}),
            ]
        )
    except repo._client.exceptions.TransactionCanceledException as exc:
        if "ConditionalCheckFailed" in [r.get("Code") for r in exc.response.get("CancellationReasons", [])]:
            raise HttpError(409, "Já existe uma unidade de saúde com este código.", {"fields": {"id": "Código em uso."}}) from exc
        raise
    _ensure_group(data["id"], data["name"])
    return _public(item, {"active": 0, "pending": 0})


def update(caller, unit: str, data: dict) -> dict:
    current = repo._painel().get_item(Key=_key(unit), ConsistentRead=True).get("Item")
    if not current:
        raise HttpError(404, "Unidade de saúde não encontrada.")
    changes = {k: v for k, v in data.items() if current.get(k) != v}
    if changes:
        names = {f"#f{i}": k for i, k in enumerate(changes)}
        values = {f":v{i}": v for i, v in enumerate(changes.values())}
        repo._client.transact_write_items(
            TransactItems=[
                {"Update": {
                    "TableName": os.environ["TABELA_PAINEL"],
                    "Key": _key(unit),
                    "UpdateExpression": "SET " + ", ".join(f"#f{i} = :v{i}" for i in range(len(changes))),
                    "ConditionExpression": "attribute_exists(PK)",
                    "ExpressionAttributeNames": names,
                    "ExpressionAttributeValues": values,
                }},
                auditoria.put("health_update", caller, unit=None, target={"type": "health", "id": unit, "label": data.get("name", current.get("name"))},
                              details={k: [current.get(k), v] for k, v in changes.items()}),
            ]
        )
        if "name" in changes:
            _ensure_group(unit, changes["name"])
    return _public({**current, **changes}, _doctors(unit))
