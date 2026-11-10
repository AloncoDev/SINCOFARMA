// Formatação da ficha clínica: usada pela Ficha do atendimento e pelo Encaminhamento
// (que mostra a cópia da ficha enviada ao médico).
import { RISK_LEVELS } from "../NovaTriagem/constants";

export const RISK = Object.fromEntries(RISK_LEVELS.map((r) => [r.id, r]));
export const SEX = { F: "Feminino", M: "Masculino" };

// o servidor guarda só os dígitos; aqui volta ao formato de leitura
const onlyDigits = (v) => String(v ?? "").replace(/\D/g, "");
export function phone(v) {
  const d = onlyDigits(v);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v || null;
}
export const cns = (v) => onlyDigits(v).replace(/(\d{3})(\d{4})(\d{4})(\d{4})/, "$1 $2 $3 $4") || null;

export function brDate(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : null;
}

export function age(iso) {
  if (!iso) return null;
  const b = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a -= 1;
  return Number.isFinite(a) ? a : null;
}

export const dateTime = (iso) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const VITALS = [
  ["PA", (v) => (v.systolic != null && v.diastolic != null ? `${v.systolic}/${v.diastolic} mmHg` : null)],
  ["FC", (v) => (v.heartRate != null ? `${v.heartRate} bpm` : null)],
  ["SpO₂", (v) => (v.spo2 != null ? `${v.spo2}%` : null)],
  ["Temperatura", (v) => (v.temperature != null ? `${String(v.temperature).replace(".", ",")} °C` : null)],
  ["Peso", (v) => (v.weightKg != null ? `${String(v.weightKg).replace(".", ",")} kg` : null)],
  ["Altura", (v) => (v.heightCm != null ? `${v.heightCm} cm` : null)],
  ["IMC", (v) => (v.bmi != null ? String(v.bmi).replace(".", ",") : null)],
];

/** Sinais vitais preenchidos, já formatados: [[rótulo, valor], ...] */
export const vitalsOf = (v) => VITALS.map(([label, fmt]) => [label, fmt(v ?? {})]).filter(([, x]) => x);
