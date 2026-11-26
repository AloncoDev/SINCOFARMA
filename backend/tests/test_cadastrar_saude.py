"""scripts/cadastrar.py: unidades de saúde (uma ou a lista inicial), sem sobrescrever as existentes."""

import importlib.util
import os
from argparse import Namespace
from pathlib import Path

import boto3

from conftest import HEALTH_UNITS, REGION

_spec = importlib.util.spec_from_file_location("cadastrar", Path(__file__).resolve().parents[1] / "scripts" / "cadastrar.py")
cadastrar = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(cadastrar)


def _session(monkeypatch):
    # o script lê tabela e pool das saídas do stack; aqui vêm do ambiente de teste
    monkeypatch.setattr(cadastrar, "stack_outputs", lambda cf, stack: {"TabelaPainel": "painel-test", "UserPoolId": os.environ["USER_POOL_ID"]})
    return boto3.Session(region_name=REGION)


def _profiles():
    items = boto3.resource("dynamodb", region_name=REGION).Table("painel-test").scan()["Items"]
    return {i["PK"]: i for i in items if i["PK"].startswith("SAUDE#")}


def _groups():
    idp = boto3.client("cognito-idp", region_name=REGION)
    return {g["GroupName"] for g in idp.list_groups(UserPoolId=os.environ["USER_POOL_ID"])["Groups"]}


def test_lista_inicial_cadastra_e_nao_sobrescreve(aws, monkeypatch, capsys):
    session = _session(monkeypatch)
    # a do ambiente de teste já existe com outro nome: o lote não mexe nela
    antes = _profiles()["SAUDE#ubs-1-asa-sul"]["name"]

    cadastrar.cmd_saude_lote(session, Namespace(stack="x", simular=False))
    perfis = _profiles()
    ja_existiam = {u for u, *_ in HEALTH_UNITS}
    novos = [u for u, *_ in cadastrar.HEALTH_STARTER if u not in ja_existiam]
    assert len(novos) == 6
    assert all(f"SAUDE#{u}" in perfis for u in novos)
    assert perfis["SAUDE#ubs-1-asa-sul"]["name"] == antes
    assert perfis["SAUDE#hran"]["kind"] == "hospital"
    assert {f"saude:{u}" for u in novos} <= _groups()

    # rodar de novo não cadastra nada
    cadastrar.cmd_saude_lote(session, Namespace(stack="x", simular=False))
    assert capsys.readouterr().out.strip().endswith("0 unidades de saúde cadastradas.")
    # e a API passa a listar todas
    resp = aws.listar_unidades_saude(__import__("conftest").event(path="/unidades-saude"), None)
    assert resp["statusCode"] == 200


def test_uma_unidade_e_simulacao(aws, monkeypatch, capsys):
    session = _session(monkeypatch)
    cadastrar.cmd_saude(session, Namespace(stack="x", id="caps-ad-guara", nome="CAPS AD Guará", tipo="caps", regiao="Guará / RA X"))
    assert _profiles()["SAUDE#caps-ad-guara"]["name"] == "CAPS AD Guará"
    assert "saude:caps-ad-guara" in _groups()

    antes = len(_profiles())
    cadastrar.cmd_saude_lote(session, Namespace(stack="x", simular=True))
    assert len(_profiles()) == antes  # simulação não grava
    assert "simulação" in capsys.readouterr().out
