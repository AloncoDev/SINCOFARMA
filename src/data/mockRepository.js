// Repositório simulado: mesma interface do apiRepository, dados no localStorage.
// Usado quando VITE_API_URL não está definida.
import { seedVisits, rndsQueue, baseline, weekBase, historicAverage, unit, archivePool, archiveRts, referralSeeds, demoPharmacies } from "./mockData";
import { isVisit, countBy } from "./stats";
import { timeLabel, dayKey, fromDayKey } from "../utils/dates";

const KEY = "sinco:clinic";
const SCHEMA = 2;
const LATENCY = 350;

// encaminhamentos de demonstração: mesma forma que a API devolve
const DEMO_DOCTORS = [
  { id: "demo-medico-1", name: "Dr. Paulo Lima" },
  { id: "demo-medico-2", name: "Dra. Carla Nunes" },
];
let referrals = seedReferrals();
// farmácias criadas ou editadas na demonstração (em memória)
let pharmacies = demoPharmacies.map((p) => ({ ...p }));
// pedidos de privacidade (LGPD) da demonstração
let privacyRequests = [];
let demoUsers = [
  { id: "demo-1", name: "Dra. Ana Souza", email: "ana@exemplo.com.br", cpf: "***.982.247-**", crf: "4192", roles: ["farmaceutico"], unit: "demo", enabled: true, pending: false },
  { id: "demo-2", name: "Dr. Paulo Lima", email: "paulo@exemplo.com.br", cpf: "***.533.447-**", crf: null, roles: ["medico"], unit: null, enabled: true, pending: true },
  { id: "demo-3", name: "Gestor Sincofarma", email: "gestor@exemplo.com.br", cpf: "***.444.777-**", crf: null, roles: ["admin"], unit: null, enabled: true, pending: false },
];
const referralSummary = (r) => ({
  id: r.id,
  createdAt: r.createdAt,
  status: r.status,
  statusAt: r.statusAt,
  priority: r.priority,
  urgent: r.urgent,
  risk: r.clinical.risk,
  patientName: r.patient.name,
  complaint: r.clinical.complaint.text,
  protocol: r.protocol,
  unit: r.unit,
  unitName: r.unitName,
  fromName: r.from.name,
  doctorName: r.doctor.name,
});

/** Encaminhamentos de demonstração, com datas relativas a agora. */
function seedReferrals() {
  const now = Date.now();
  const iso = (hours) => new Date(now - hours * 3600e3).toISOString();
  return referralSeeds.map((r, i) => {
    const createdAt = iso(r.hoursAgo);
    const answeredAt = r.answeredAfter ? iso(r.hoursAgo - r.answeredAfter) : null;
    const statusAt = answeredAt ?? (r.status === "sent" ? createdAt : iso(r.hoursAgo - 1));
    return {
      id: `ref-demo-${i + 1}`,
      // os dois primeiros são atendimentos de hoje da demonstração; os outros, sem ficha para abrir
      visitId: r.visitId ?? null,
      protocol: `DF-2026-${String(4180 + i).padStart(6, "0")}`,
      unit: "demo",
      unitName: unit,
      createdAt,
      status: r.status,
      statusAt,
      priority: r.priority,
      urgent: r.priority === "urgente" || r.clinical.redFlags.length > 0,
      reason: r.reason,
      from: { name: "Dra. Ana Souza", crf: "4192" },
      doctor: DEMO_DOCTORS[r.doctor],
      patient: r.patient,
      clinical: r.clinical,
      response: r.response ?? null,
      answeredAt,
      mine: true,
    };
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function seedsForToday() {
  const today = new Date();
  return seedVisits.map((v) => {
    const [h, m] = v.time.split(":").map(Number);
    const at = new Date(today);
    at.setHours(h, m, 0, 0);
    return { ...v, at: at.toISOString() };
  });
}

/** Número de 0 a 1 sempre igual para a mesma semente (dias anteriores estáveis). */
function seeded(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** Atendimentos fictícios de um dia anterior: leitura só (não foram registrados por quem vê). */
function archiveFor(key) {
  const day = fromDayKey(key);
  const rand = seeded(key);
  const weekday = (day.getDay() + 6) % 7; // segunda = 0
  const count = Math.max(2, Math.round(weekBase[weekday] / 3 + rand() * 3));
  const pool = [...archivePool].sort(() => rand() - 0.5);
  const visits = Array.from({ length: count }, (_, i) => {
    const base = pool[i % pool.length];
    const at = new Date(day);
    at.setHours(8, 0, 0, 0);
    at.setMinutes(Math.round(((i + rand() * 0.8) / count) * 600)); // 8h às 18h
    return {
      ...base,
      id: `a${key.replaceAll("-", "")}-${i}`,
      cpf: `***.***.***-${String(Math.floor(rand() * 90) + 10)}`,
      rt: archiveRts[Math.floor(rand() * archiveRts.length)],
      at: at.toISOString(),
      time: timeLabel(at),
      redFlags: base.redFlags ?? [],
      mine: false,
    };
  });
  return visits.reverse(); // mais recentes primeiro, como a API
}

/** Dia de um atendimento fictício ("a20261107-3" -> "2026-11-07"). */
function archiveDay(id) {
  const m = /^a(\d{4})(\d{2})(\d{2})-/.exec(id);
  return m && fromDayKey(`${m[1]}-${m[2]}-${m[3]}`) ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function fresh() {
  return { schema: SCHEMA, visits: seedsForToday(), rndsIndex: 0, lastSync: null };
}

function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (!saved || saved.schema !== SCHEMA || !Array.isArray(saved.visits)) return fresh();
    return {
      schema: SCHEMA,
      visits: saved.visits.filter(isVisit).map((v) => ({
        ...v,
        at: typeof v.at === "string" && !Number.isNaN(Date.parse(v.at)) ? v.at : new Date().toISOString(),
      })),
      rndsIndex: Number.isInteger(saved.rndsIndex) ? Math.min(saved.rndsIndex, rndsQueue.length) : 0,
      lastSync: typeof saved.lastSync === "string" ? saved.lastSync : null,
    };
  } catch {
    return fresh();
  }
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* sem espaço / modo privado: fica só em memória nesta sessão */
  }
}

// carregado sob demanda: importar este módulo não grava nada no navegador
// (com a API ligada ele nem chega a ser usado)
let loaded = null;
function current() {
  if (!loaded) {
    loaded = read();
    write(loaded); // normaliza o formato salvo (migração de schema)
  }
  return loaded;
}

export const mockRepository = {
  name: "mock",

  // a demonstração tem uma farmácia só; `unit` é ignorado
  async listUnits() {
    await wait(LATENCY);
    return pharmacies.map((p) => ({ id: p.id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  },

  async loadDashboard() {
    await wait(LATENCY);
    return {
      visits: current().visits,
      lastSync: current().lastSync,
      rndsPending: rndsQueue.length - current().rndsIndex,
      baseline,
      week: weekBase,
      historicAverage,
      unit,
    };
  },

  /** Atendimentos de um dia ("aaaa-mm-dd"). Hoje: os do navegador; antes: fictícios e estáveis. */
  async listVisits(day) {
    await wait(LATENCY);
    const visits = day === dayKey() ? current().visits : archiveFor(day);
    return {
      day,
      visits,
      summary: { total: visits.length, ...countBy(visits), urgent: visits.filter((v) => v.urgent).length },
      truncated: false,
    };
  },

  // `clinical` (dados pessoais e clínicos completos) é descartado de propósito:
  // em modo demonstração nada além do resumo fica no navegador.
  // eslint-disable-next-line no-unused-vars
  async createVisit(data, clinical) {
    await wait(LATENCY);
    const now = new Date();
    const visit = { ...data, id: `v${now.getTime()}`, at: now.toISOString(), time: timeLabel(now), isNew: true };
    loaded = { ...current(), visits: [visit, ...current().visits] };
    write(loaded);
    return visit;
  },

  async updateVisit(id, patch) {
    await wait(LATENCY / 2);
    const found = current().visits.find((v) => v.id === id);
    if (!found) throw new Error("Atendimento não encontrado.");
    const updated = { ...found, ...patch };
    loaded = { ...current(), visits: current().visits.map((v) => (v.id === id ? updated : v)) };
    write(loaded);
    return updated;
  },

  async syncRnds() {
    await wait(1400);
    const st = current();
    const next = rndsQueue[st.rndsIndex];
    const now = new Date();
    const lastSync = now.toISOString();
    let imported = null;
    if (next) {
      imported = { ...next, id: `r${now.getTime()}`, at: lastSync, time: timeLabel(now), isNew: true, source: "RNDS" };
      loaded = { ...st, visits: [imported, ...st.visits], rndsIndex: st.rndsIndex + 1, lastSync };
    } else {
      loaded = { ...st, lastSync };
    }
    write(loaded);
    return { imported, lastSync, rndsPending: rndsQueue.length - loaded.rndsIndex };
  },

  /* ---------- encaminhamentos (em memória; some ao recarregar) ---------- */
  async listDoctors() {
    await wait(LATENCY / 2);
    return DEMO_DOCTORS;
  },

  async listReferrals(status) {
    await wait(LATENCY / 2);
    return referrals.filter((r) => !status || r.status === status).map(referralSummary);
  },

  async getReferral(id) {
    await wait(LATENCY / 2);
    const found = referrals.find((r) => r.id === id);
    if (!found) throw new Error("Encaminhamento não encontrado.");
    return found;
  },

  async createReferral({ visitId, doctorId, reason, priority = "rotina" }) {
    await wait(LATENCY);
    const old = archiveDay(visitId);
    const visit = current().visits.find((v) => v.id === visitId) ?? (old ? archiveFor(old) : []).find((v) => v.id === visitId);
    const doctor = DEMO_DOCTORS.find((d) => d.id === doctorId);
    if (!visit || !doctor) throw new Error("Atendimento ou médico não encontrado.");
    const now = new Date().toISOString();
    const ref = {
      id: `ref${Date.now()}`,
      visitId,
      protocol: visit.protocol,
      unit: "demo",
      unitName: unit,
      createdAt: now,
      status: "sent",
      statusAt: now,
      priority,
      urgent: priority === "urgente" || !!visit.urgent,
      reason,
      from: { name: "Dra. Ana Souza", crf: "4192" },
      doctor,
      // a demonstração não guarda a ficha completa: só o resumo do atendimento
      patient: { name: visit.name, cpf: visit.cpf },
      clinical: { complaint: { text: visit.complaint }, risk: visit.risk, redFlags: visit.redFlags ?? [], notes: visit.signs },
      response: null,
      answeredAt: null,
      mine: true,
    };
    referrals = [ref, ...referrals];
    return ref;
  },

  async updateReferral(id, { status, response = null }) {
    await wait(LATENCY / 2);
    const found = referrals.find((r) => r.id === id);
    if (!found) throw new Error("Encaminhamento não encontrado.");
    if (!["sent", "read"].includes(found.status)) throw new Error("Este encaminhamento já foi encerrado.");
    const now = new Date().toISOString();
    const updated = { ...found, status, statusAt: now, ...(response ? { response, answeredAt: now } : {}) };
    referrals = referrals.map((r) => (r.id === id ? updated : r));
    return updated;
  },

  /** Ficha do atendimento: a demonstração só guarda o resumo, então a ficha sai parcial. */
  async getVisitRecord(id) {
    await wait(LATENCY);
    const old = archiveDay(id);
    const visit = current().visits.find((v) => v.id === id) ?? (old ? archiveFor(old) : []).find((v) => v.id === id);
    if (!visit) throw new Error("Atendimento não encontrado.");
    return {
      visit,
      record: {
        protocol: visit.protocol,
        at: visit.at,
        patient: { name: visit.name, cpf: visit.cpf },
        complaint: { text: visit.complaint },
        history: { allergies: [], comorbidities: [], medications: [] },
        vitals: {},
        risk: visit.risk ?? null,
        redFlags: visit.redFlags ?? [],
        notes: visit.signs || null,
      },
      history: [{ at: visit.at, action: "create", label: "Atendimento registrado", actor: visit.rt || "Dra. Ana Souza", changes: {} }],
    };
  },

  async listAudit(month) {
    await wait(LATENCY);
    return { month, events: [], next: null, units: [{ id: "demo", name: unit }] };
  },

  /* ---------- farmácias (administração; em memória) ---------- */
  async listPharmacies() {
    await wait(LATENCY);
    // a farmácia da demonstração usa os atendimentos do navegador; as outras, números fixos
    const today = current().visits;
    const c = countBy(today);
    const live = {
      today: { total: today.length, urgent: today.filter((v) => v.urgent).length },
      month: {
        total: baseline.outcomes.done + baseline.outcomes.referred + baseline.outcomes.progress + today.length - baseline.seedCount,
        done: baseline.outcomes.done + c.done - baseline.seedCounts.done,
        referred: baseline.outcomes.referred + c.referred - baseline.seedCounts.referred,
        progress: baseline.outcomes.progress + c.progress - baseline.seedCounts.progress,
        urgent: 23,
        triageMinutes: baseline.triageMinutes,
      },
    };
    const empty = { today: { total: 0, urgent: 0 }, month: { total: 0, done: 0, referred: 0, progress: 0, urgent: 0, triageMinutes: null } };
    const units = pharmacies
      .map((p) => (p.id === "demo" ? { ...p, ...live } : { ...empty, ...p }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return { month: dayKey().slice(0, 7), units };
  },

  async createPharmacy({ id, name, monthGoal, triageGoalMin }) {
    await wait(LATENCY);
    if (pharmacies.some((p) => p.id === id)) {
      throw Object.assign(new Error("Já existe uma farmácia com este código."), { data: { details: { fields: { id: "Código em uso." } } } });
    }
    const created = { id, name, monthGoal, triageGoalMin, pharmacists: { active: 0, pending: 0 } };
    pharmacies = [...pharmacies, created];
    return (await this.listPharmacies()).units.find((p) => p.id === id);
  },

  async updatePharmacy(id, change) {
    await wait(LATENCY / 2);
    if (!pharmacies.some((p) => p.id === id)) throw new Error("Farmácia não encontrada.");
    pharmacies = pharmacies.map((p) => (p.id === id ? { ...p, ...change } : p));
    return (await this.listPharmacies()).units.find((p) => p.id === id);
  },

  /* ---------- usuários (administração; em memória) ---------- */
  async listUsers() {
    await wait(LATENCY);
    return { users: demoUsers, units: [{ id: "demo", name: unit }] };
  },

  async createUser({ cpf, name, email, roles, unit: unitId = null, crf = null }) {
    await wait(LATENCY);
    const masked = `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
    const user = { id: `demo-${Date.now()}`, name, email, cpf: masked, crf, roles, unit: unitId, enabled: true, pending: true };
    demoUsers = [...demoUsers, user].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return user;
  },

  async updateUser(id, change) {
    await wait(LATENCY / 2);
    // reset do MFA e reenvio do convite não têm efeito na demonstração
    const patch = Object.fromEntries(Object.entries(change).filter(([k]) => ["roles", "unit", "enabled"].includes(k)));
    const found = demoUsers.find((u) => u.id === id);
    if (!found) throw new Error("Usuário não encontrado.");
    const updated = { ...found, ...patch };
    demoUsers = demoUsers.map((u) => (u.id === id ? updated : u));
    return updated;
  },

  /* ---------- LGPD (em memória) ---------- */
  async getMyData() {
    await wait(LATENCY);
    return {
      geradoEm: new Date().toISOString(),
      titular: "usuario",
      conta: { nome: "Dra. Ana Souza", email: "ana@exemplo.com.br", cpf: "(demonstração)", crf: "4192", perfis: ["Farmacêutico"], farmacia: unit },
      atividade: [],
      pedidosDePrivacidade: privacyRequests,
      observacoes: ["Arquivo de demonstração: dados fictícios."],
    };
  },

  async listMyRequests() {
    await wait(LATENCY / 2);
    return privacyRequests;
  },

  async createMyRequest({ type, details = "" }) {
    await wait(LATENCY);
    if (privacyRequests.some((p) => p.type === type && p.status === "aberto")) {
      throw new Error("Você já tem um pedido deste tipo em análise.");
    }
    const req = {
      id: `demo-${Date.now()}`,
      at: new Date().toISOString(),
      type,
      details,
      status: "aberto",
      response: null,
      resolvedAt: null,
      subject: { kind: "user", sub: "demo-1", name: "Dra. Ana Souza" },
    };
    privacyRequests = [req, ...privacyRequests];
    return req;
  },

  async listPrivacyRequests(status) {
    await wait(LATENCY / 2);
    return status ? privacyRequests.filter((p) => p.status === status) : privacyRequests;
  },

  async answerPrivacyRequest(id, { status, response }) {
    await wait(LATENCY);
    const found = privacyRequests.find((p) => p.id === id);
    if (!found) throw new Error("Pedido não encontrado.");
    const updated = { ...found, status, response, resolvedAt: new Date().toISOString() };
    privacyRequests = privacyRequests.map((p) => (p.id === id ? updated : p));
    return updated;
  },

  async exportPatient() {
    await wait(LATENCY);
    throw new Error("Na demonstração não há pacientes reais para exportar.");
  },

  async reset() {
    loaded = fresh();
    write(loaded);
    return this.loadDashboard();
  },

  /** Apaga o cache local (chamado no logout). */
  clear() {
    loaded = null;
    referrals = seedReferrals();
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignora */
    }
  },
};
