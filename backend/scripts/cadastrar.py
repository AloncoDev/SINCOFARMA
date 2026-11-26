"""Cadastro administrativo: unidades, usuários e seus papéis.

Papéis (somam): farmaceutico (exige unidade e CRF), medico e admin (gestão do Sincofarma,
sem unidade). O que cada papel pode fazer está em src/painel/comum/auth.py.
O usuário recebe por e-mail uma senha temporária (enviada pelo Cognito)
e define a senha definitiva no primeiro login do painel.

Exemplos:
  python scripts/cadastrar.py unidade --stack sincofarma-painel-dev \\
      --id asa-sul --nome "Drogaria Planalto - Asa Sul" --meta-mensal 525

  python scripts/cadastrar.py usuario --stack sincofarma-painel-dev --papel farmaceutico \\
      --unidade asa-sul --cpf 52998224725 --crf 4192 \\
      --nome "Dra. Ana Souza" --email ana@exemplo.com.br

  python scripts/cadastrar.py usuario --stack sincofarma-painel-dev --papel admin \\
      --cpf 11144477735 --nome "Gestor Sincofarma" --email gestor@exemplo.com.br

  # unidade de saúde (UBS, UPA, hospital...): destino dos encaminhamentos; liga médicos pelo grupo saude:<id>
  python scripts/cadastrar.py saude --stack sincofarma-painel-prod --id ubs-1-asa-sul \\
      --nome "UBS 1 Asa Sul" --tipo ubs --regiao "Plano Piloto / RA I"

  # lista inicial de unidades públicas do DF (não sobrescreve as que já existem; --simular só mostra)
  python scripts/cadastrar.py saude-lote --stack sincofarma-painel-prod --simular

  # médico ligado à unidade de saúde onde atende
  python scripts/cadastrar.py usuario --stack sincofarma-painel-prod --papel medico \\
      --saude ubs-1-asa-sul --cpf 39053344705 --nome "Dr. Paulo Lima" --email paulo@exemplo.com.br

  # dar ou tirar papel de quem já existe
  python scripts/cadastrar.py papel --stack sincofarma-painel-dev --cpf 52998224725 --adicionar admin
  python scripts/cadastrar.py papel --stack sincofarma-painel-dev --cpf 52998224725 --remover admin
"""

import argparse
import re
import sys

import boto3
from botocore.exceptions import ClientError

UNIT_PREFIX = "unidade:"
HEALTH_PREFIX = "saude:"
ROLE_PREFIX = "papel:"
# tipos aceitos (iguais a src/painel/comum/saude.py)
HEALTH_KINDS = ("ubs", "upa", "hospital", "policlinica", "caps", "outro")
UNIT_ID = re.compile(r"^[a-z0-9][a-z0-9-]{0,39}$")

# Lista inicial de unidades públicas do DF (confira os nomes; dá para renomear depois na tela
# Unidades de saúde, só o código não muda).
HEALTH_STARTER = [
    ("ubs-1-asa-sul", "UBS 1 Asa Sul", "ubs", "Plano Piloto / RA I"),
    ("upa-ceilandia", "UPA Ceilândia", "upa", "Ceilândia / RA IX"),
    ("upa-samambaia", "UPA Samambaia", "upa", "Samambaia / RA XII"),
    ("upa-nucleo-bandeirante", "UPA Núcleo Bandeirante", "upa", "Núcleo Bandeirante / RA VIII"),
    ("upa-recanto-das-emas", "UPA Recanto das Emas", "upa", "Recanto das Emas / RA XV"),
    ("upa-sao-sebastiao", "UPA São Sebastião", "upa", "São Sebastião / RA XIV"),
    ("hran", "Hospital Regional da Asa Norte (HRAN)", "hospital", "Plano Piloto / RA I"),
    ("hrt", "Hospital Regional de Taguatinga (HRT)", "hospital", "Taguatinga / RA III"),
]
ROLES = ("farmaceutico", "medico", "admin")
ROLE_NAMES = {"farmaceutico": "Farmacêutico", "medico": "Médico", "admin": "Administrador Sincofarma"}


def stack_outputs(cf, stack: str) -> dict[str, str]:
    resp = cf.describe_stacks(StackName=stack)
    return {o["OutputKey"]: o["OutputValue"] for o in resp["Stacks"][0].get("Outputs", [])}


def digits(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def cpf_of(value: str) -> str:
    cpf = digits(value)
    if len(cpf) != 11:
        raise ValueError("CPF deve ter 11 dígitos.")
    return cpf


def ensure_role_group(idp, pool: str, role: str) -> str:
    group = f"{ROLE_PREFIX}{role}"
    try:
        idp.create_group(UserPoolId=pool, GroupName=group, Description=ROLE_NAMES[role])
    except idp.exceptions.GroupExistsException:
        pass  # idempotente
    return group


def cmd_unidade(session, args) -> None:
    outputs = stack_outputs(session.client("cloudformation"), args.stack)
    table = session.resource("dynamodb").Table(outputs["TabelaPainel"])
    table.put_item(
        Item={
            "PK": f"UNIT#{args.id}",
            "SK": "PROFILE",
            "name": args.nome,
            "monthGoal": args.meta_mensal,
            "triageGoalMin": args.meta_triagem,
        }
    )
    idp = session.client("cognito-idp")
    group = f"{UNIT_PREFIX}{args.id}"
    try:
        idp.create_group(UserPoolId=outputs["UserPoolId"], GroupName=group, Description=args.nome)
    except idp.exceptions.GroupExistsException:
        pass  # idempotente: rodar de novo só atualiza o perfil
    print(f"Unidade '{args.id}' pronta (grupo {group}).")


def _put_health(table, idp, pool: str, unit: str, name: str, kind: str, region: str, *, overwrite: bool) -> bool:
    """Perfil SAUDE#<id> + grupo saude:<id>. Sem overwrite, não mexe na que já existe (devolve False)."""
    if not UNIT_ID.match(unit):
        raise ValueError(f"Código inválido: {unit!r} (letras minúsculas, números e hífen).")
    if kind not in HEALTH_KINDS:
        raise ValueError(f"Tipo inválido: {kind!r} (use {', '.join(HEALTH_KINDS)}).")
    item = {"PK": f"SAUDE#{unit}", "SK": "PROFILE", "name": name, "kind": kind, "region": region or ""}
    try:
        if overwrite:
            table.put_item(Item=item)
        else:
            table.put_item(Item=item, ConditionExpression="attribute_not_exists(PK)")
    except ClientError as err:
        if err.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False
        raise
    try:
        idp.create_group(UserPoolId=pool, GroupName=f"{HEALTH_PREFIX}{unit}", Description=name)
    except idp.exceptions.GroupExistsException:
        idp.update_group(UserPoolId=pool, GroupName=f"{HEALTH_PREFIX}{unit}", Description=name)
    return True


def cmd_saude(session, args) -> None:
    outputs = stack_outputs(session.client("cloudformation"), args.stack)
    table = session.resource("dynamodb").Table(outputs["TabelaPainel"])
    _put_health(table, session.client("cognito-idp"), outputs["UserPoolId"], args.id, args.nome, args.tipo, args.regiao, overwrite=True)
    print(f"Unidade de saúde '{args.id}' pronta (grupo {HEALTH_PREFIX}{args.id}).")


def cmd_saude_lote(session, args) -> None:
    if args.simular:
        for unit, name, kind, region in HEALTH_STARTER:
            print(f"  [simulação] {unit:24} {kind:9} {name} — {region}")
        print(f"{len(HEALTH_STARTER)} unidades. Rode sem --simular para cadastrar.")
        return
    outputs = stack_outputs(session.client("cloudformation"), args.stack)
    table = session.resource("dynamodb").Table(outputs["TabelaPainel"])
    idp = session.client("cognito-idp")
    created = 0
    for unit, name, kind, region in HEALTH_STARTER:
        if _put_health(table, idp, outputs["UserPoolId"], unit, name, kind, region, overwrite=False):
            created += 1
            print(f"  + {name} ({HEALTH_PREFIX}{unit})")
        else:
            print(f"  = {name}: já existia, não mexi")
    print(f"{created} unidades de saúde cadastradas.")


def cmd_usuario(session, args) -> None:
    cpf = cpf_of(args.cpf)
    roles = sorted(set(args.papel))
    crf = digits(args.crf)
    if "medico" in roles and not args.saude:
        raise ValueError("Médico precisa de --saude (código da unidade de saúde).")
    if "farmaceutico" in roles:
        if not args.unidade:
            raise ValueError("Farmacêutico precisa de --unidade.")
        if not crf:
            raise ValueError("Farmacêutico precisa de --crf com números.")

    outputs = stack_outputs(session.client("cloudformation"), args.stack)
    pool = outputs["UserPoolId"]
    idp = session.client("cognito-idp")
    groups = [ensure_role_group(idp, pool, r) for r in roles]
    if args.unidade:
        unit_group = f"{UNIT_PREFIX}{args.unidade}"
        try:
            idp.get_group(UserPoolId=pool, GroupName=unit_group)
        except idp.exceptions.ResourceNotFoundException as exc:
            raise ValueError(f"Unidade '{args.unidade}' não existe. Crie com o comando 'unidade'.") from exc
        groups.append(unit_group)
    if args.saude:
        health_group = f"{HEALTH_PREFIX}{args.saude}"
        try:
            idp.get_group(UserPoolId=pool, GroupName=health_group)
        except idp.exceptions.ResourceNotFoundException as exc:
            raise ValueError(f"Unidade de saúde '{args.saude}' não existe. Crie com o comando 'saude'.") from exc
        groups.append(health_group)

    attributes = [
        {"Name": "name", "Value": args.nome},
        {"Name": "email", "Value": args.email},
        {"Name": "email_verified", "Value": "true"},
    ]
    if crf:
        attributes += [
            {"Name": "preferred_username", "Value": f"crf{crf}"},  # login também pelo CRF
            {"Name": "custom:crf", "Value": crf},
        ]
    idp.admin_create_user(
        UserPoolId=pool,
        Username=cpf,  # login pelo CPF
        UserAttributes=attributes,
        DesiredDeliveryMediums=["EMAIL"],  # Cognito envia a senha temporária
    )
    for group in groups:
        idp.admin_add_user_to_group(UserPoolId=pool, Username=cpf, GroupName=group)
    where = f" na unidade '{args.unidade}'" if args.unidade else ""
    print(f"Usuário {args.nome} ({', '.join(roles)}) criado{where}. A senha temporária foi enviada para {args.email}.")


def cmd_papel(session, args) -> None:
    cpf = cpf_of(args.cpf)
    outputs = stack_outputs(session.client("cloudformation"), args.stack)
    pool = outputs["UserPoolId"]
    idp = session.client("cognito-idp")
    for role in args.adicionar or []:
        idp.admin_add_user_to_group(UserPoolId=pool, Username=cpf, GroupName=ensure_role_group(idp, pool, role))
    for role in args.remover or []:
        idp.admin_remove_user_from_group(UserPoolId=pool, Username=cpf, GroupName=f"{ROLE_PREFIX}{role}")
    current = idp.admin_list_groups_for_user(UserPoolId=pool, Username=cpf)["Groups"]
    print(f"Grupos de {cpf}: {', '.join(sorted(g['GroupName'] for g in current)) or '(nenhum)'}")
    print("Vale a partir do próximo login (ou da próxima renovação do token).")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--profile", help="perfil da AWS CLI (opcional)")
    parser.add_argument("--region", default="sa-east-1")
    sub = parser.add_subparsers(dest="cmd", required=True)

    u = sub.add_parser("unidade", help="cria ou atualiza uma unidade")
    u.add_argument("--stack", required=True)
    u.add_argument("--id", required=True, help="identificador curto, ex. asa-sul")
    u.add_argument("--nome", required=True)
    u.add_argument("--meta-mensal", type=int, default=0)
    u.add_argument("--meta-triagem", type=int, default=10, help="minutos")

    p = sub.add_parser("usuario", help="cria um usuário com um ou mais papéis")
    p.add_argument("--stack", required=True)
    p.add_argument("--papel", required=True, action="append", choices=ROLES, help="repita para somar papéis")
    p.add_argument("--unidade", help="obrigatória para farmacêutico")
    p.add_argument("--saude", help="unidade de saúde (obrigatória para médico)")
    p.add_argument("--cpf", required=True)
    p.add_argument("--crf", default="", help="obrigatório para farmacêutico")
    p.add_argument("--nome", required=True)
    p.add_argument("--email", required=True)

    h = sub.add_parser("saude", help="cria ou atualiza uma unidade de saúde (UBS, UPA, hospital...)")
    h.add_argument("--stack", required=True)
    h.add_argument("--id", required=True, help="código curto, ex. ubs-1-asa-sul (não muda depois)")
    h.add_argument("--nome", required=True)
    h.add_argument("--tipo", required=True, choices=HEALTH_KINDS)
    h.add_argument("--regiao", default="")

    hl = sub.add_parser("saude-lote", help="cadastra a lista inicial de unidades de saúde do DF")
    hl.add_argument("--stack", required=True)
    hl.add_argument("--simular", action="store_true", help="só mostra a lista, sem gravar")

    r = sub.add_parser("papel", help="dá ou tira papéis de um usuário existente")
    r.add_argument("--stack", required=True)
    r.add_argument("--cpf", required=True)
    r.add_argument("--adicionar", action="append", choices=ROLES)
    r.add_argument("--remover", action="append", choices=ROLES)

    args = parser.parse_args()
    if args.cmd == "papel" and not (args.adicionar or args.remover):
        parser.error("informe --adicionar e/ou --remover")
    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    try:
        commands = {"unidade": cmd_unidade, "usuario": cmd_usuario, "papel": cmd_papel, "saude": cmd_saude, "saude-lote": cmd_saude_lote}
        commands[args.cmd](session, args)
        return 0
    except ValueError as err:
        print(f"Erro: {err}", file=sys.stderr)
        return 2
    except ClientError as err:
        print(f"Erro da AWS: {err}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
