// Acompanhamento dos atendimentos pela administração, na demonstração (mesmo formato de
// GET /gestao/atendimentos). Só o que a administração vê: protocolo, situação, farmacêutico,
// médico e a linha do tempo; nunca o paciente.
// A farmácia da demo, no dia de hoje, usa os atendimentos e encaminhamentos do navegador;
// os outros dias e farmácias são gerados com sementes fixas (sempre iguais para o mesmo dia).
import { seeded } from "./mockReport";
import { dayKey, fromDayKey } from "../utils/dates";

const DOCTORS = ["Dr. Paulo Lima", "Dra. Carla Nunes"];
// farmacêuticos fictícios por farmácia (a demo usa os mesmos nomes da tela de Atendimentos)
const RT_POOL = ["Dra. Beatriz Campos", "Dr. Marcos Vieira", "Dra. Helena Duarte", "Dr. Thiago Moreira", "Dra. Juliana Freitas", "Dr. André Pacheco", "Dra. Camila Rocha", "Dr. Felipe Andrade"];
const WEEKDAY = [0.3, 1.12, 1.05, 1, 1.02, 0.98, 0.7];
const RISKS = ["azul", "verde", "verde", "verde", "amarelo", "amarelo", "laranja"];

function rtsOf(unitId) {
  if (unitId === "demo") return ["Dra. Ana Souza", "Dra. Ana Souza", "Dr. Rafael Mendes"];
  const rand = seeded(`rts:${unitId}`);
  const pool = [...RT_POOL].sort(() => rand() - 0.5);
  return pool.slice(0, 2 + Math.floor(rand() * 2));
}

const pick = (list, rand) => list[Math.floor(rand() * list.length)];
const addMin = (iso, min) => new Date(new Date(iso).getTime() + min * 60e3).toISOString();

/** Atendimentos gerados de uma farmácia num dia (com o encaminhamento, se houver). */
function generated(pharmacy, day, now) {
  const p = pharmacy.profile;
  if (!p || !p.history) return [];
  const rand = seeded(`track:${pharmacy.id}:${day}`);
  const date = fromDayKey(day);
  const perDay = (p.volume / 26) * WEEKDAY[date.getDay()];
  const count = Math.max(0, Math.round(perDay * (0.75 + rand() * 0.5)));
  const isToday = day === dayKey(now);
  const rts = rtsOf(pharmacy.id);
  const list = [];
  for (let i = 0; i < count; i++) {
    const at = new Date(date);
    at.setHours(8, 0, 0, 0);
    at.setMinutes(Math.round(((i + rand() * 0.8) / count) * 600)); // 8h às 18h
    if (isToday && at > now) break; // hoje: só o que já aconteceu
    const r = rand();
    const status = r < p.mix[0] ? "done" : r < p.mix[0] + p.mix[1] ? "referred" : "progress";
    const urgent = rand() < p.urgent * 3 && status !== "done";
    const iso = at.toISOString();
    const visit = {
      id: `t~${pharmacy.id}~${day}~${i}`,
      protocol: `SIN-${day.slice(0, 4)}-${String(Math.floor(rand() * 900000) + 1000).padStart(6, "0")}`,
      at: iso,
      time: at.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      status,
      urgent,
      risk: urgent ? "laranja" : pick(RISKS, rand),
      rt: pick(rts, rand),
      referrals: [],
    };
    // parte dos encaminhados à SES-DF também vai a um médico pelo painel
    if (status === "referred" && rand() < 0.6) {
      const sentAt = addMin(iso, 6 + Math.round(rand() * 20));
      const age = (now - new Date(sentAt)) / 60e3; // minutos desde o envio
      const s = rand();
      const final = age < 50 ? "sent" : age < 140 ? "read" : s < 0.8 ? "answered" : s < 0.92 ? "declined" : "cancelled";
      visit.referrals.push({
        id: `${visit.id}~r`,
        status: final,
        createdAt: sentAt,
        statusAt: final === "sent" ? sentAt : addMin(sentAt, final === "read" ? 45 : 120),
        priority: urgent ? "urgente" : "rotina",
        doctor: pick(DOCTORS, rand),
        from: visit.rt,
      });
    }
    list.push(visit);
  }
  return list.reverse(); // mais recentes primeiro
}

/** Atendimentos de hoje da farmácia da demo, só com o que a administração vê. */
function live(todayVisits, referrals) {
  return todayVisits.map((v) => ({
    id: v.id,
    protocol: v.protocol ?? `SIN-${v.at.slice(0, 4)}-${String(4100 + Number(String(v.id).replace(/\D/g, "") || 0)).padStart(6, "0")}`,
    at: v.at,
    time: v.time,
    status: v.status,
    urgent: !!v.urgent,
    risk: v.risk,
    rt: v.rt || "Dra. Ana Souza",
    referrals: referrals
      .filter((r) => r.visitId === v.id)
      .map((r) => ({ id: r.id, status: r.status, createdAt: r.createdAt, statusAt: r.statusAt, priority: r.priority, doctor: r.doctor.name, from: r.from.name })),
  }));
}

/** GET /gestao/atendimentos?unidade=&dia= */
export function trackDay(pharmacies, unitId, day, { todayVisits, referrals, now = new Date() }) {
  const pharmacy = pharmacies.find((p) => p.id === unitId);
  if (!pharmacy) throw new Error("Farmácia não encontrada.");
  const visits = unitId === "demo" && day === dayKey(now) ? live(todayVisits, referrals) : generated(pharmacy, day, now);
  return { unit: unitId, unitName: pharmacy.name, day, visits };
}

/** GET /gestao/atendimentos/:id — situação, pessoas e linha do tempo. */
export function trackVisit(pharmacies, visitId, ctx) {
  let unitId = "demo";
  let day = dayKey(ctx.now ?? new Date());
  if (String(visitId).startsWith("t~")) [, unitId, day] = visitId.split("~");
  const data = trackDay(pharmacies, unitId, day, ctx);
  const visit = data.visits.find((v) => v.id === visitId);
  if (!visit) throw new Error("Atendimento não encontrado.");

  const timeline = [{ at: visit.at, action: "create", label: "Atendimento registrado", actor: visit.rt, role: "farmaceutico", changes: {} }];
  for (const r of visit.referrals) {
    timeline.push({ at: r.createdAt, action: "referral_create", label: "Encaminhado a médico", actor: r.from, role: "farmaceutico", changes: {}, doctor: r.doctor });
    if (r.status !== "sent" && r.status !== "cancelled") {
      timeline.push({ at: r.status === "read" ? r.statusAt : addMin(r.createdAt, 40), action: "referral_read", label: "Encaminhamento lido pelo médico", actor: r.doctor, role: "medico", changes: { status: ["sent", "read"] } });
    }
    if (["answered", "declined"].includes(r.status)) {
      const label = r.status === "answered" ? "Médico respondeu o encaminhamento" : "Médico recusou o encaminhamento";
      timeline.push({ at: r.statusAt, action: `referral_${r.status}`, label, actor: r.doctor, role: "medico", changes: { status: ["read", r.status] } });
    }
    if (r.status === "cancelled") {
      timeline.push({ at: r.statusAt, action: "referral_cancelled", label: "Encaminhamento cancelado", actor: r.from, role: "farmaceutico", changes: { status: ["sent", "cancelled"] } });
    }
  }
  timeline.sort((a, b) => a.at.localeCompare(b.at));
  const { referrals, ...summary } = visit;
  return { visit: summary, unit: unitId, unitName: data.unitName, referrals, timeline };
}
