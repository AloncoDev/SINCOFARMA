"""Relatórios da administração: atendimentos por dia, por mês e por farmácia.

Tudo sai dos contadores de dia e mês (`#STATS`), os mesmos do dashboard: só números agregados,
nenhum dado de paciente. Um mês de referência traz:
- `days`: cada dia do mês até hoje (soma das farmácias do escopo);
- `months`: os 12 meses que terminam nele (tendência);
- `byUnit`: cada farmácia do escopo no mês e no mês anterior (comparação).
"""

import calendar
from datetime import date

from . import farmacias
from . import repositorio as repo
from . import tempo
from .http import HttpError

TREND_MONTHS = 12
FIELDS = ("total", "done", "referred", "progress", "urgent", "durSum", "durCount")


def shift_month(month: str, n: int) -> str:
    """'2026-01' + (-1) -> '2025-12'."""
    year, mon = map(int, month.split("-"))
    idx = year * 12 + (mon - 1) + n
    return f"{idx // 12:04d}-{idx % 12 + 1:02d}"


def _days_of(month: str, today: str) -> list[str]:
    """Dias do mês até hoje (mês passado: todos; mês atual: até hoje)."""
    year, mon = map(int, month.split("-"))
    last = calendar.monthrange(year, mon)[1]
    days = [date(year, mon, d).isoformat() for d in range(1, last + 1)]
    return [d for d in days if d <= today]


def _counts(item: dict | None) -> dict[str, int]:
    item = item or {}
    return {f: int(item.get(f, 0)) for f in FIELDS}


def _sum(items: list[dict]) -> dict[str, int]:
    out = dict.fromkeys(FIELDS, 0)
    for item in items:
        for f in FIELDS:
            out[f] += item[f]
    return out


def report(month: str, unit: str | None) -> dict:
    today = tempo.day_key(tempo.now())
    if month > today[:7]:
        raise HttpError(400, "Mês inválido.")
    all_units = farmacias.profiles()
    units = [
        {
            "id": i["PK"].removeprefix("UNIT#"),
            "name": i.get("name") or i["PK"],
            "monthGoal": int(i.get("monthGoal") or 0),
            "triageGoalMin": int(i.get("triageGoalMin") or 10),
        }
        for i in all_units
    ]
    units.sort(key=lambda u: repo._sem_acento(u["name"]))
    if unit and unit not in {u["id"] for u in units}:
        raise HttpError(404, "Farmácia não encontrada.")
    scope = [u["id"] for u in units if not unit or u["id"] == unit]

    days = _days_of(month, today)
    months = [shift_month(month, -i) for i in range(TREND_MONTHS - 1, -1, -1)]  # do mais antigo ao escolhido
    previous = months[-2]
    stats = repo.stats_by_pk(
        [repo.pk_day(u, d) for u in scope for d in days] + [repo.pk_month(u, m) for u in scope for m in months]
    ) if scope else {}

    def total_for(pk_of, key):
        return _sum([_counts(stats.get(pk_of(u, key))) for u in scope])

    return {
        "month": month,
        "today": today,
        "unit": unit,
        "units": units,
        "days": [{"day": d, **total_for(repo.pk_day, d)} for d in days],
        "months": [{"month": m, **total_for(repo.pk_month, m)} for m in months],
        "byUnit": [
            {
                "id": u,
                **_counts(stats.get(repo.pk_month(u, month))),
                "previous": _counts(stats.get(repo.pk_month(u, previous))),
            }
            for u in scope
        ],
    }
