/** Utilitários de data centralizados (pt-BR). */

export function isSameDay(iso, ref = new Date()) {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

export function timeLabel(date = new Date()) {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** "Novembro 2025" */
export function monthLabel(date = new Date()) {
  const s = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.replace(/^(\w)/, (c) => c.toUpperCase()).replace(" de ", " ");
}

/** "dd/mm/aaaa" -> Date (ou null se inválida ou inexistente no calendário) */
export function parseBrDate(masked) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(masked)) return null;
  const [dd, mm, yyyy] = masked.split("/").map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  const valid = d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd;
  return valid ? d : null;
}

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Dia local no formato da API: "aaaa-mm-dd" */
export function dayKey(date = new Date()) {
  const d = new Date(date);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "aaaa-mm-dd" -> Date à meia-noite local (ou null se inválido) */
export function fromDayKey(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key ?? "")) return null;
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

/** Soma `n` dias a um "aaaa-mm-dd" */
export function shiftDay(key, n) {
  const d = fromDayKey(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** "Hoje", "Ontem" ou "Sexta-feira, 7 de novembro" (com o ano se não for o atual) */
export function dayLabel(key, now = new Date()) {
  const today = dayKey(now);
  if (key === today) return "Hoje";
  if (key === shiftDay(today, -1)) return "Ontem";
  const d = fromDayKey(key);
  const s = d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Mês local no formato da API: "aaaa-mm" */
export const monthKey = (date = new Date()) => dayKey(date).slice(0, 7);

/** Soma `n` meses a um "aaaa-mm" ("2026-01" − 1 = "2025-12") */
export function shiftMonth(key, n) {
  const [y, m] = key.split("-").map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${String(Math.floor(idx / 12)).padStart(4, "0")}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

/** Quantos dias tem o mês "aaaa-mm" */
export function daysInMonth(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/** "aaaa-mm" válido? */
export const isMonthKey = (key) => /^\d{4}-(0[1-9]|1[0-2])$/.test(key ?? "");

/** "2026-11" -> "Novembro 2026"; com `short`: "nov/26" */
export function monthKeyLabel(key, { short = false } = {}) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1, 15);
  if (!short) return monthLabel(d);
  return `${d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}/${String(y).slice(2)}`;
}
