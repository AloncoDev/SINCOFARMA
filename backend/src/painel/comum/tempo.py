"""Datas no fuso da unidade (dia de atendimento e mes de referencia)."""

import os
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

TZ = ZoneInfo(os.environ.get("TZ_UNIDADE", "America/Sao_Paulo"))

# fichas, encaminhamentos e suas trilhas: prazo do prontuário de saúde (Lei 13.787/2018, art. 6º)
RETENCAO_ANOS = 20


def now() -> datetime:
    return datetime.now(TZ)


def from_epoch_ms(ms: int) -> datetime:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).astimezone(TZ)


def day_key(dt: datetime) -> str:
    return dt.astimezone(TZ).strftime("%Y-%m-%d")


def month_key(dt: datetime) -> str:
    return dt.astimezone(TZ).strftime("%Y-%m")


def time_label(dt: datetime) -> str:
    return dt.astimezone(TZ).strftime("%H:%M")


def week_days(ref: datetime) -> list[date]:
    """Segunda a domingo da semana de `ref`."""
    monday = ref.astimezone(TZ).date() - timedelta(days=ref.astimezone(TZ).weekday())
    return [monday + timedelta(days=i) for i in range(7)]


def previous_days(ref: datetime, n: int) -> list[date]:
    """Os `n` dias anteriores a `ref` (sem incluir o proprio dia)."""
    today = ref.astimezone(TZ).date()
    return [today - timedelta(days=i) for i in range(1, n + 1)]


def valid_day(text: str) -> bool:
    """'aaaa-mm-dd' existe no calendário?"""
    try:
        date.fromisoformat(text)
        return True
    except (TypeError, ValueError):
        return False


def expira_em(at: datetime | str, anos: int = RETENCAO_ANOS) -> int:
    """Instante (epoch, segundos) em que o DynamoDB apaga o item sozinho (TTL `expiraEm`)."""
    if isinstance(at, str):
        at = datetime.fromisoformat(at)
    try:
        fim = at.replace(year=at.year + anos)
    except ValueError:  # 29/02 em ano que não é bissexto
        fim = at.replace(year=at.year + anos, day=28)
    return int(fim.timestamp())


def age(birth: date, on: date) -> int:
    """Idade completa em `on`."""
    return on.year - birth.year - ((on.month, on.day) < (birth.month, birth.day))


def parse_br_date(text: str) -> date | None:
    """'dd/mm/aaaa' -> date, ou None se invalida."""
    try:
        return datetime.strptime(text, "%d/%m/%Y").date()
    except (TypeError, ValueError):
        return None
