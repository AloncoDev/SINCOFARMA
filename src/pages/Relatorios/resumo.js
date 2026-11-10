// Contas dos relatórios a partir dos contadores { total, done, referred, progress, urgent, durSum, durCount }.
import { daysInMonth } from "../../utils/dates";

const nf = new Intl.NumberFormat("pt-BR");
export const num = (n) => nf.format(n);

/** Tempo médio de triagem em minutos, com uma casa (null sem medição). */
export const triageMinutes = (c) => (c?.durCount ? Math.round(c.durSum / c.durCount / 6) / 10 : null);

/** Parte do total em %, sem arredondar (null sem total). */
export const share = (part, total) => (total ? (part / total) * 100 : null);

/** "74%" (ou "—" sem total). */
export const pctLabel = (part, total) => (total ? `${Math.round((part / total) * 100)}%` : "—");

/** "8,4 min" (ou "—"). */
export const minLabel = (m) => (m == null ? "—" : `${String(m).replace(".", ",")} min`);

/** Variação percentual de `prev` para `cur` (null se não há base). */
export const growth = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 100) : null);

/** Diferença em pontos percentuais entre duas participações (null se falta uma). */
export function ppChange(part, total, prevPart, prevTotal) {
  const a = share(part, total);
  const b = share(prevPart, prevTotal);
  return a == null || b == null ? null : Math.round((a - b) * 10) / 10;
}

/**
 * Projeção para o mês em andamento: média dos dias já fechados (sem hoje) vezes os dias do mês.
 * Null com menos de 3 dias fechados (pouca base) ou para mês já encerrado.
 */
export function projection(days, month, today) {
  if (!today.startsWith(month)) return null;
  const closed = days.filter((d) => d.day < today);
  if (closed.length < 3) return null;
  const avg = closed.reduce((a, d) => a + d.total, 0) / closed.length;
  return Math.round(avg * daysInMonth(month));
}

/** Acumulado dia a dia (para o ritmo contra a meta). */
export function cumulative(days) {
  let acc = 0;
  return days.map((d) => (acc += d.total));
}

/** Valor "redondo" para o topo do eixo (1, 2, 2,5 ou 5 × 10ⁿ acima do máximo). */
export function niceMax(value) {
  if (value <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= value);
  return step * pow;
}

/** Linhas para CSV: separador ";" e vírgula decimal (abre direto no Excel em português). */
export function toCsv(header, rows) {
  const cell = (v) => {
    const s = v == null ? "" : typeof v === "number" ? String(v).replace(".", ",") : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
}

/** Colunas comuns dos CSVs (contadores de um dia, mês ou farmácia). */
export const CSV_COUNTS = ["Atendimentos", "Resolvidos no local", "Encaminhados SES-DF", "Acompanhamento", "Red Flag", "Triagem média (min)"];
export const csvCounts = (c) => [c.total, c.done, c.referred, c.progress, c.urgent, triageMinutes(c)];
