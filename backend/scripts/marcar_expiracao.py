"""Marca o prazo de guarda (`expiraEm`) nos registros gravados antes do TTL existir.

Os registros novos já saem com `expiraEm` = registro + 20 anos (src/painel/comum/tempo.py),
e o TTL do DynamoDB apaga sozinho depois disso. Este script é de uso único, depois do
deploy, para os antigos: fichas, trilhas, índice do paciente, encaminhamentos, caixas,
guias e o resumo de cada atendimento no painel. Contadores, perfis e o registro geral de
auditoria (sem pacientes) não expiram. Pode rodar mais de uma vez: só marca quem não tem.

  python scripts/marcar_expiracao.py --stack sincofarma-painel-prod --profile sincofarma --simular
  python scripts/marcar_expiracao.py --stack sincofarma-painel-prod --profile sincofarma
"""

import argparse
import sys
from datetime import datetime, timedelta, timezone

import boto3

from cadastrar import stack_outputs

ANOS = 20  # prontuário de saúde (Lei 13.787/2018)


def expira_em(iso: str, anos: int = ANOS) -> int:
    at = datetime.fromisoformat(iso)
    try:
        fim = at.replace(year=at.year + anos)
    except ValueError:  # 29/02
        fim = at.replace(year=at.year + anos, day=28)
    return int(fim.timestamp())


def varrer(table, **kw):
    start = None
    while True:
        resp = table.scan(**kw, **({"ExclusiveStartKey": start} if start else {}))
        yield from resp.get("Items", [])
        start = resp.get("LastEvaluatedKey")
        if not start:
            return


def sem_prazo(table):
    return varrer(
        table,
        FilterExpression="attribute_not_exists(expiraEm)",
        ProjectionExpression="PK, SK, #a, createdAt, refId",
        ExpressionAttributeNames={"#a": "at"},
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--stack", required=True)
    parser.add_argument("--profile", help="perfil da AWS CLI (opcional)")
    parser.add_argument("--region", default="sa-east-1")
    parser.add_argument("--simular", action="store_true", help="só conta, não grava nada")
    args = parser.parse_args()

    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    outputs = stack_outputs(session.client("cloudformation"), args.stack)
    ddb = session.resource("dynamodb")
    clinico, painel = ddb.Table(outputs["TabelaClinico"]), ddb.Table(outputs["TabelaPainel"])

    marcar: list[tuple[object, dict, int]] = []
    guias, criado_em = [], {}

    for it in sem_prazo(clinico):
        pk, sk = it["PK"], it["SK"]
        quando = it.get("createdAt") or it.get("at")
        if pk.startswith("GUIA#"):
            guias.append(it)  # o prazo vem do encaminhamento
            continue
        if pk.startswith(("VISIT#", "PAC#", "REF#")) or (sk.startswith("REF#") and pk.endswith("#REF")) or pk.startswith("MED#"):
            if quando:
                marcar.append((clinico, {"PK": pk, "SK": sk}, expira_em(quando)))
        if pk.startswith("REF#") and sk == "REF" and it.get("createdAt"):
            criado_em[pk[len("REF#"):]] = it["createdAt"]

    # encaminhamentos que já tinham prazo (não vieram na varredura acima)
    faltam = {g["refId"] for g in guias if g.get("refId") not in criado_em}
    for ref_id in faltam:
        ref = clinico.get_item(Key={"PK": f"REF#{ref_id}", "SK": "REF"}, ProjectionExpression="createdAt").get("Item")
        if ref:
            criado_em[ref_id] = ref["createdAt"]
    for g in guias:
        if g.get("refId") in criado_em:
            marcar.append((clinico, {"PK": g["PK"], "SK": g["SK"]}, expira_em(criado_em[g["refId"]])))

    # painel: o resumo de cada atendimento (nome do paciente); contadores e perfis ficam
    agora = datetime.now(timezone.utc)
    for it in sem_prazo(painel):
        pk, sk = it["PK"], it["SK"]
        if "#DAY#" in pk and sk.startswith("VISIT#") and it.get("at"):
            marcar.append((painel, {"PK": pk, "SK": sk}, expira_em(it["at"])))
        elif pk.startswith("LIMITE#"):
            marcar.append((painel, {"PK": pk, "SK": sk}, int((agora + timedelta(days=2)).timestamp())))

    por_tabela = {}
    for table, _, _ in marcar:
        por_tabela[table.name] = por_tabela.get(table.name, 0) + 1
    print(f"{len(marcar)} itens sem prazo: " + (", ".join(f"{n} em {t}" for t, n in por_tabela.items()) or "nenhum"))
    if args.simular:
        print("Simulação: nada foi gravado.")
        return 0
    for table, key, fim in marcar:
        try:
            table.update_item(
                Key=key,
                UpdateExpression="SET expiraEm = :fim",
                ConditionExpression="attribute_exists(PK) AND attribute_not_exists(expiraEm)",
                ExpressionAttributeValues={":fim": fim},
            )
        except table.meta.client.exceptions.ConditionalCheckFailedException:
            pass  # apagado ou marcado no meio do caminho
    print("Prazo de guarda marcado.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
