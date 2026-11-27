// Repositório real: fala com a API via src/services/api.js.
// Contrato esperado do backend (ajustar quando ele existir):
//   GET   /dashboard[?unidade=] -> { visits, todaySummary, lastSync, rndsPending, baseline, week, historicAverage, unit }
//                                  (administração: `?unidade=` e `visits` vazio, só números)
//   GET   /unidades             -> { units: [{ id, name }] } (só administração)
//   GET   /visits[?dia=aaaa-mm-dd] -> { day, visits, summary: { total, done, referred, progress, urgent }, truncated }
//                                  (só a própria farmácia; padrão: hoje)
//   POST  /visits               { ...summary, clinical } -> visit (resumo) criado
//   PATCH /visits/:id           -> visit atualizado
//   GET   /visits/:id           -> { visit, record (ficha clínica), history } (farmácia do atendimento)
//   POST  /rnds/sync            -> { imported, lastSync, rndsPending }
// Encaminhamentos (detalhes e permissões em backend/README.md):
//   GET   /unidades-saude              -> { units: [{ id, name, kind, region, doctors? }] } (farmacêutico; admin vê médicos)
//   POST  /unidades-saude              { id, name, kind, region } -> unidade      (administração)
//   PATCH /unidades-saude/:id          { name?, kind?, region? } -> unidade      (administração)
//   POST  /encaminhamentos             { visitId, healthUnitId, reason, priority } -> encaminhamento (com `code` da guia)
//   POST  /guias/busca                 { code } ou { cpf } -> { referrals: [resumo] } (farmácia: as dela; médico: todas)
//   GET   /encaminhamentos[?status=]   -> { referrals: [resumo] }               (farmácia ou caixa do médico)
//   GET   /encaminhamentos/:id         -> encaminhamento com a ficha (médico abrindo: vira "read")
//   PATCH /encaminhamentos/:id         { status: answered|declined|cancelled, response? } -> encaminhamento
// Usuários (administração):
//   GET   /usuarios       -> { users: [{ id, name, email, cpf (mascarado), crf, roles, unit, enabled, pending }], units }
//   POST  /usuarios       { cpf, name, email, roles, unit?, crf? } -> usuário (convite por e-mail)
//   PATCH /usuarios/:id   { roles?, unit?, enabled?, resetMfa?, resendInvite? } -> usuário
// Farmácias (administração; só números agregados, sem pacientes):
//   GET   /farmacias          -> { month, units: [{ id, name, monthGoal, triageGoalMin, pharmacists: { active, pending },
//                                  today: { total, urgent }, month: { total, done, referred, progress, urgent, triageMinutes } }] }
//   POST  /farmacias          { id, name, monthGoal, triageGoalMin } -> farmácia
//   PATCH /farmacias/:id      { name?, monthGoal?, triageGoalMin? } -> farmácia
// Acompanhamento (administração; sem dados do paciente):
//   GET   /gestao/atendimentos?unidade=&dia= -> { unit, unitName, day, visits: [{ id, protocol, at, time, status, urgent,
//                                  risk, rt, rtCrf, referrals: [{ id, status, statusAt, createdAt, priority, doctor, from }] }] }
//   GET   /gestao/atendimentos/:id -> { visit, unit, unitName, referrals, timeline: [{ at, action, label, actor, role, changes, doctor? }] }
// Relatórios (administração; só contadores agregados):
//   GET   /relatorios?mes=aaaa-mm[&farmacia=] -> { month, today, unit, units: [{ id, name, monthGoal, triageGoalMin }],
//                                  days: [{ day, ...contadores }], months: [{ month, ...contadores }] (12, até `mes`),
//                                  byUnit: [{ id, ...contadores, previous: contadores }] }
//                                  contadores = { total, done, referred, progress, urgent, durSum, durCount }
//   GET   /auditoria[?mes=aaaa-mm&inicio=] -> { month, events, next, units } (administração; sem dados de paciente)
// LGPD (direitos do titular):
//   GET   /me/dados                -> tudo o que o painel guarda sobre quem pede (JSON para baixar)
//   GET   /me/pedidos              -> { requests }            (os próprios pedidos)
//   POST  /me/pedidos              { type: correcao|exclusao, details } -> pedido
//   GET   /lgpd/pedidos[?status=]  -> { requests }            (administração)
//   PATCH /lgpd/pedidos/:id        { status: concluido|recusado, response } -> pedido (concluir exclusão anonimiza a conta)
//   POST  /lgpd/pacientes          { cpf, channel, reference } -> dados do paciente (administração; CPF no corpo,
//                                  nunca na URL; canal e referência do pedido do paciente vão para a auditoria)
//   GET   /me/termos               -> { accepted: { version, acceptedAt } | null }
//   POST  /me/termos               { version } -> registra o aceite dos termos de uso
import { api } from "../services/api";

export const apiRepository = {
  name: "api",
  loadDashboard: (unit) => api(unit ? `/dashboard?unidade=${encodeURIComponent(unit)}` : "/dashboard"),
  listUnits: () => api("/unidades").then((r) => r.units),
  listVisits: (day) => api(`/visits?${new URLSearchParams({ dia: day })}`),
  createVisit: (summary, clinical) => api("/visits", { method: "POST", body: JSON.stringify({ ...summary, clinical }) }),
  updateVisit: (id, patch) => api(`/visits/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) }),
  syncRnds: () => api("/rnds/sync", { method: "POST" }),
  listHealthUnits: () => api("/unidades-saude"),
  createHealthUnit: (data) => api("/unidades-saude", { method: "POST", body: JSON.stringify(data) }),
  updateHealthUnit: (id, change) => api(`/unidades-saude/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(change) }),
  // o CPF vai no corpo, nunca na URL
  findGuides: (query) => api("/guias/busca", { method: "POST", body: JSON.stringify(query) }).then((r) => r.referrals),
  listReferrals: (status) => api(status ? `/encaminhamentos?status=${encodeURIComponent(status)}` : "/encaminhamentos").then((r) => r.referrals),
  getReferral: (id) => api(`/encaminhamentos/${encodeURIComponent(id)}`),
  createReferral: (data) => api("/encaminhamentos", { method: "POST", body: JSON.stringify(data) }),
  updateReferral: (id, change) => api(`/encaminhamentos/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(change) }),
  getVisitRecord: (id) => api(`/visits/${encodeURIComponent(id)}`),
  listAudit: (month, start) =>
    api(`/auditoria?${new URLSearchParams({ mes: month, ...(start ? { inicio: start } : {}) })}`),
  listPharmacies: () => api("/farmacias"),
  createPharmacy: (data) => api("/farmacias", { method: "POST", body: JSON.stringify(data) }),
  updatePharmacy: (id, change) => api(`/farmacias/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(change) }),
  trackVisits: (unit, day) => api(`/gestao/atendimentos?${new URLSearchParams({ unidade: unit, dia: day })}`),
  trackVisit: (id) => api(`/gestao/atendimentos/${encodeURIComponent(id)}`),
  report: (month, unit) => api(`/relatorios?${new URLSearchParams({ mes: month, ...(unit ? { farmacia: unit } : {}) })}`),
  listUsers: () => api("/usuarios"),
  createUser: (data) => api("/usuarios", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id, change) => api(`/usuarios/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(change) }),
  getMyData: () => api("/me/dados", { timeout: 30000 }),
  listMyRequests: () => api("/me/pedidos").then((r) => r.requests),
  createMyRequest: (data) => api("/me/pedidos", { method: "POST", body: JSON.stringify(data) }),
  listPrivacyRequests: (status) => api(status ? `/lgpd/pedidos?status=${encodeURIComponent(status)}` : "/lgpd/pedidos").then((r) => r.requests),
  answerPrivacyRequest: (id, change) =>
    api(`/lgpd/pedidos/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(change), timeout: 60000 }),
  exportPatient: (cpf, request) => api("/lgpd/pacientes", { method: "POST", body: JSON.stringify({ cpf, ...request }), timeout: 30000 }),
  getTermsAcceptance: () => api("/me/termos").then((r) => r.accepted),
  acceptTerms: (version) => api("/me/termos", { method: "POST", body: JSON.stringify({ version }) }),
  reset: () => Promise.reject(new Error("Indisponível com backend real.")),
  clear: () => {},
};
