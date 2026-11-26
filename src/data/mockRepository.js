// Repositório simulado: mesma interface do apiRepository, dados no localStorage.
// Usado quando VITE_API_URL não está definida.
import { seedVisits, rndsQueue, baseline, weekBase, historicAverage, unit, archivePool, archiveRts, referralSeeds, demoPharmacies, demoHealthUnits } from "./mockData";
import { isVisit, countBy } from "./stats";
import { timeLabel, dayKey, fromDayKey } from "../utils/dates";
import { seeded, buildReport, pharmacyDays, sumCounts } from "./mockReport";
import { CODE_ALPHABET, normalizeCode } from "../utils/guia";
import { trackDay, trackVisit } from "./mockAcompanhamento";

const KEY = "sinco:clinic";
const SCHEMA = 2;
const LATENCY = 350;

// encaminhamentos de demonstração: mesma forma que a API devolve
const DEMO_DOCTORS = [
  { id: "demo-medico-1", name: "Dr. Paulo Lima" },
  { id: "demo-medico-2", name: "Dra. Carla Nunes" },
];
// unidades de saúde criadas ou editadas na demonstração (em memória)
let healthUnits = demoHealthUnits.map((u) => ({ ...u }));
// farmácias criadas ou editadas na demonstração (em memória)
let pharmacies = demoPharmacies.map((p) => ({ ...p }));
// pedidos de privacidade (LGPD) da demonstração
let privacyRequests = [];
let demoUsers = [
  { id: "demo-1", name: "Dra. Ana Souza", email: "ana@exemplo.com.br", cpf: "***.982.247-**", crf: "4192", roles: ["farmaceutico"], unit: "demo", enabled: true, pending: false },
  { id: "demo-2", name: "Dr. Paulo Lima", email: "paulo@exemplo.com.br", cpf: "***.533.447-**", crf: null, roles: ["medico"], unit: null, healthUnit: "ubs-1-asa-sul", enabled: true, pending: true },
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
  code: r.code,
  healthUnitId: r.healthUnit?.id ?? null,
  healthUnitName: r.healthUnit?.name ?? r.doctor?.name,
  doctorName: r.doctor?.name ?? null,
});

/** Código da guia na demonstração: ENC-XXXX-XXXX, sempre igual para a mesma semente. */
function demoCode(seed) {
  const rand = seeded(`guia:${seed}`);
  const raw = Array.from({ length: 8 }, () => CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)]).join("");
  return `ENC-${raw.slice(0, 4)}-${raw.slice(4)}`;
}

// depois do código da guia (seedReferrals usa demoCode)
let referrals = seedReferrals();

/** Quem está usando a demonstração (o médico da demo atende na UBS 1 Asa Sul). */
function viewer() {
  try {
    return JSON.parse(localStorage.getItem("user")) ?? {};
  } catch {
    return {};
  }
}

/** Encaminhamentos de demonstração, com datas relativas a agora. */
function seedReferrals() {
  const now = Date.now();
  const iso = (hours) => new Date(now - hours * 3600e3).toISOString();
  return referralSeeds.map((r, i) => {
    const createdAt = iso(r.hoursAgo);
    const answeredAt = r.answeredAfter ? iso(r.hoursAgo - r.answeredAfter) : null;
    const statusAt = answeredAt ?? (r.status === "sent" ? createdAt : iso(r.hoursAgo - 1));
    const health = healthUnits[r.healthUnit] ?? healthUnits[0];
    const answered = ["answered", "declined"].includes(r.status);
    const who = DEMO_DOCTORS[r.doctor];
    return {
      id: `ref-demo-${i + 1}`,
      code: demoCode(`ref-demo-${i + 1}`),
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
      healthUnit: { id: health.id, name: health.name, kind: health.kind },
      // quem leu e quem respondeu (médicos da unidade)
      readBy: r.status === "sent" || r.status === "cancelled" ? null : { name: who.name, unit: health.name },
      doctor: answered ? who : null,
      answeredUnit: answered ? health.name : null,
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

/** Contadores de hoje da farmácia da demo (atendimentos do navegador), no formato `#STATS`. */
function liveCounts() {
  const today = current().visits;
  const c = countBy(today);
  return {
    total: today.length,
    done: c.done,
    referred: c.referred,
    progress: c.progress,
    urgent: today.filter((v) => v.urgent).length,
    durSum: today.length * baseline.triageMinutes * 60,
    durCount: today.length,
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
  async listReferrals(status) {
    await wait(LATENCY / 2);
    // médico: a caixa da unidade de saúde dele; farmácia: todos os da demo
    const mine = viewer().healthUnit;
    return referrals
      .filter((r) => !mine || r.healthUnit?.id === mine)
      .filter((r) => !status || r.status === status)
      .map(referralSummary);
  },

  /** Guia pelo código ou pelo CPF. A demonstração só guarda CPFs mascarados: compara os 2 últimos dígitos. */
  async findGuides({ code, cpf } = {}) {
    await wait(LATENCY / 2);
    if (code) {
      const norm = normalizeCode(code);
      if (!norm) throw Object.assign(new Error("Código da guia inválido."), { data: { details: { fields: { code: "Use o código impresso na guia (ex.: ENC-7K3Q-9M2X)." } } } });
      return referrals.filter((r) => r.code === norm).map(referralSummary);
    }
    const digits = String(cpf ?? "").replace(/\D/g, "");
    if (digits.length !== 11) throw Object.assign(new Error("CPF inválido."), { data: { details: { fields: { cpf: "Confira os 11 dígitos." } } } });
    return referrals.filter((r) => String(r.patient?.cpf ?? "").replace(/\D/g, "").slice(-2) === digits.slice(-2)).map(referralSummary);
  },

  /* ---------- unidades de saúde (em memória) ---------- */
  async listHealthUnits() {
    await wait(LATENCY / 2);
    return { units: [...healthUnits].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) };
  },

  async createHealthUnit({ id, name, kind, region = "" }) {
    await wait(LATENCY);
    if (healthUnits.some((u) => u.id === id)) {
      throw Object.assign(new Error("Já existe uma unidade de saúde com este código."), { data: { details: { fields: { id: "Código em uso." } } } });
    }
    const created = { id, name, kind, region, doctors: { active: 0, pending: 0 } };
    healthUnits = [...healthUnits, created];
    return created;
  },

  async updateHealthUnit(id, change) {
    await wait(LATENCY / 2);
    if (!healthUnits.some((u) => u.id === id)) throw new Error("Unidade de saúde não encontrada.");
    healthUnits = healthUnits.map((u) => (u.id === id ? { ...u, ...change } : u));
    return healthUnits.find((u) => u.id === id);
  },

  async getReferral(id) {
    await wait(LATENCY / 2);
    const found = referrals.find((r) => r.id === id);
    if (!found) throw new Error("Encaminhamento não encontrado.");
    return found;
  },

  async createReferral({ visitId, healthUnitId, reason, priority = "rotina" }) {
    await wait(LATENCY);
    const old = archiveDay(visitId);
    const visit = current().visits.find((v) => v.id === visitId) ?? (old ? archiveFor(old) : []).find((v) => v.id === visitId);
    const health = healthUnits.find((u) => u.id === healthUnitId);
    if (!visit || !health) throw new Error("Atendimento ou unidade de saúde não encontrado.");
    const now = new Date().toISOString();
    const id = `ref${Date.now()}`;
    const ref = {
      id,
      code: demoCode(id),
      visitId,
      // atendimentos de exemplo não têm protocolo: o mesmo que o acompanhamento da administração mostra
      protocol: visit.protocol ?? `SIN-${now.slice(0, 4)}-${String(4100 + Number(String(visitId).replace(/\D/g, "") || 0)).padStart(6, "0")}`,
      unit: "demo",
      unitName: unit,
      createdAt: now,
      status: "sent",
      statusAt: now,
      priority,
      urgent: priority === "urgente" || !!visit.urgent,
      reason,
      from: { name: "Dra. Ana Souza", crf: "4192" },
      healthUnit: { id: health.id, name: health.name, kind: health.kind },
      readBy: null,
      doctor: null,
      answeredUnit: null,
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
    // resposta do médico da demonstração (Dr. Paulo Lima, UBS 1 Asa Sul)
    const answer = response ? { response, answeredAt: now, doctor: DEMO_DOCTORS[0], answeredUnit: healthUnits.find((u) => u.id === viewer().healthUnit)?.name ?? null } : {};
    const updated = { ...found, status, statusAt: now, ...answer };
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
    const now = new Date();
    const live = liveCounts();
    const units = pharmacies
      .map(({ profile, ...p }) => {
        const days = pharmacyDays({ ...p, profile }, dayKey(now).slice(0, 7), now, p.id === "demo" ? live : null);
        const m = sumCounts(days);
        const t = days.at(-1)?.day === dayKey(now) ? days.at(-1) : { total: 0, urgent: 0 };
        return {
          ...p,
          today: { total: t.total, urgent: t.urgent },
          month: {
            total: m.total,
            done: m.done,
            referred: m.referred,
            progress: m.progress,
            urgent: m.urgent,
            triageMinutes: m.durCount ? Math.round((m.durSum / m.durCount / 60) * 10) / 10 : null,
          },
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return { month: dayKey(now).slice(0, 7), units };
  },

  /* ---------- acompanhamento dos atendimentos (administração; sem pacientes) ---------- */
  async trackVisits(unitId, day) {
    await wait(LATENCY);
    return trackDay(pharmacies, unitId, day, { todayVisits: current().visits, referrals });
  },

  async trackVisit(id) {
    await wait(LATENCY);
    return trackVisit(pharmacies, id, { todayVisits: current().visits, referrals });
  },

  /* ---------- relatórios (administração; números gerados em mockReport) ---------- */
  async report(month, unit) {
    await wait(LATENCY);
    return buildReport(pharmacies, month, unit, new Date(), liveCounts());
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

  async createUser({ cpf, name, email, roles, unit: unitId = null, healthUnit = null, crf = null }) {
    await wait(LATENCY);
    const masked = `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
    const user = { id: `demo-${Date.now()}`, name, email, cpf: masked, crf, roles, unit: unitId, healthUnit, enabled: true, pending: true };
    demoUsers = [...demoUsers, user].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return user;
  },

  async updateUser(id, change) {
    await wait(LATENCY / 2);
    // reset do MFA e reenvio do convite não têm efeito na demonstração
    const patch = Object.fromEntries(Object.entries(change).filter(([k]) => ["roles", "unit", "healthUnit", "enabled"].includes(k)));
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
