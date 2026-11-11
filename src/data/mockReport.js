// Números da rede na demonstração (telas Farmácias e Relatórios). Mesmo formato dos contadores
// `#STATS` do backend. Cada farmácia tem um perfil em mockData (volume, mistura de desfechos,
// tempo de triagem); dias e meses saem de sementes fixas, então são sempre iguais para a mesma data.
// A farmácia da demo usa os atendimentos do navegador no dia de hoje.
import { dayKey, daysInMonth, fromDayKey, shiftMonth } from "../utils/dates";

export const FIELDS = ["total", "done", "referred", "progress", "urgent", "durSum", "durCount"];
export const zero = () => Object.fromEntries(FIELDS.map((f) => [f, 0]));
const OUTCOMES = ["done", "referred", "progress"];
// movimento por dia da semana (getDay: domingo = 0)
const WEEKDAY = [0.3, 1.12, 1.05, 1, 1.02, 0.98, 0.7];

/** Número de 0 a 1 sempre igual para a mesma semente. */
export function seeded(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** Divide `total` em inteiros proporcionais aos pesos (maiores restos). */
function apportion(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (w / sum) * total);
  const out = raw.map(Math.floor);
  let rest = total - out.reduce((a, b) => a + b, 0);
  raw
    .map((r, i) => [r - Math.floor(r), i])
    .sort((a, b) => b[0] - a[0])
    .forEach(([, i]) => {
      if (rest-- > 0) out[i] += 1;
    });
  return out;
}

function shuffle(list, rand) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

const monthDayKeys = (month) => Array.from({ length: daysInMonth(month) }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);

// meses já gerados (o perfil não muda durante a sessão); devolve cópias porque pharmacyDays ajusta "hoje"
const cache = new Map();
function monthDays(p, month, current) {
  const key = `${p.id}|${month}|${current}`;
  if (!cache.has(key)) cache.set(key, generateMonth(p, month, current));
  return cache.get(key).map((d) => ({ ...d }));
}

/** Contadores de cada dia de um mês cheio da farmácia (sem considerar "hoje"). */
function generateMonth(p, month, current) {
  const back = (Number(current.slice(0, 4)) * 12 + Number(current.slice(5))) - (Number(month.slice(0, 4)) * 12 + Number(month.slice(5)));
  const { volume, history, mix, urgent, minutes } = p.profile;
  const keys = monthDayKeys(month);
  if (back >= history) return keys.map((day) => ({ day, ...zero() }));

  const rand = seeded(`${p.id}:${month}`);
  const age = history - back - 1; // 0 = primeiro mês aberta
  const ramp = [0.35, 0.6, 0.85][age] ?? 1;
  // leve sazonalidade (mais movimento no inverno seco de Brasília) e crescimento de ~1% ao mês
  const season = 1 + 0.07 * Math.cos(((Number(month.slice(5)) - 8) / 12) * 2 * Math.PI);
  const total = Math.round(volume * ramp * season * (1 - back * 0.01) * (0.9 + rand() * 0.18));
  // meses mais antigos: um pouco menos resolvido no local e triagem mais lenta (curva de aprendizado)
  const doneShare = Math.max(0.5, mix[0] - back * 0.004 + (rand() - 0.5) * 0.03);
  const rest = 1 - doneShare;
  const parts = apportion(total, [doneShare, (rest * mix[1]) / (mix[1] + mix[2]), (rest * mix[2]) / (mix[1] + mix[2])]);
  const pool = shuffle(OUTCOMES.flatMap((k, i) => Array(parts[i]).fill(k)), rand);
  const flags = shuffle(Array.from({ length: total }, (_, i) => i < Math.round(total * urgent * (0.8 + rand() * 0.4))), rand);
  const pace = minutes + back * 0.12 + (rand() - 0.5) * 0.6;

  const perDay = apportion(total, keys.map((d) => WEEKDAY[fromDayKey(d).getDay()] * (0.75 + rand() * 0.5)));
  let at = 0;
  return keys.map((day, i) => {
    const n = perDay[i];
    const c = { day, ...zero(), total: n };
    for (let k = at; k < at + n; k++) {
      c[pool[k]] += 1;
      if (flags[k]) c.urgent += 1;
    }
    at += n;
    c.durCount = n;
    c.durSum = Math.round(n * pace * 60);
    return c;
  });
}

/**
 * Dias do mês até hoje. Hoje: a farmácia da demo usa `live` (contadores dos atendimentos do
 * navegador); as outras, a parte do dia já passada (8h às 20h).
 */
export function pharmacyDays(p, month, now = new Date(), live = null) {
  if (!p.profile) return [];
  const today = dayKey(now);
  const days = monthDays(p, month, today.slice(0, 7)).filter((d) => d.day <= today);
  const last = days.at(-1);
  if (last?.day === today) {
    if (live) {
      Object.assign(last, live);
    } else {
      const share = Math.min(1, Math.max(0, (now.getHours() + now.getMinutes() / 60 - 8) / 12));
      const keep = (n) => Math.round(n * share);
      Object.assign(last, Object.fromEntries(FIELDS.map((f) => [f, keep(last[f])])));
      last.total = last.done + last.referred + last.progress;
      last.durCount = last.total;
    }
  }
  return days;
}

export function sumCounts(list) {
  const out = zero();
  for (const c of list) for (const f of FIELDS) out[f] += c[f] ?? 0;
  return out;
}

/** Mesmo formato de GET /relatorios. */
export function buildReport(pharmacies, month, unit, now = new Date(), live = null) {
  const today = dayKey(now);
  if (month > today.slice(0, 7)) throw new Error("Mês inválido.");
  const units = pharmacies
    .map(({ id, name, monthGoal, triageGoalMin }) => ({ id, name, monthGoal, triageGoalMin }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  if (unit && !units.some((u) => u.id === unit)) throw new Error("Farmácia não encontrada.");
  const scope = pharmacies.filter((p) => !unit || p.id === unit);
  const liveOf = (p) => (p.id === "demo" ? live : null);

  const months = Array.from({ length: 12 }, (_, i) => shiftMonth(month, i - 11));
  const monthTotals = (p, m) => sumCounts(pharmacyDays(p, m, now, liveOf(p)));
  const dayList = monthDayKeys(month).filter((d) => d <= today);
  const daysByUnit = scope.map((p) => new Map(pharmacyDays(p, month, now, liveOf(p)).map((d) => [d.day, d])));

  return {
    month,
    today,
    unit: unit || null,
    units,
    days: dayList.map((day) => ({ day, ...sumCounts(daysByUnit.map((byDay) => byDay.get(day) ?? zero())) })),
    months: months.map((m) => ({ month: m, ...sumCounts(scope.map((p) => monthTotals(p, m))) })),
    byUnit: scope.map((p) => ({ id: p.id, ...monthTotals(p, month), previous: monthTotals(p, months[10]) })),
  };
}
