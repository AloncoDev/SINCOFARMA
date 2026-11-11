// Dados simulados (usados só pelo mockRepository, quando não há API).
import { countBy } from "./stats";

export const unit = "Drogaria Planalto — Unidade Asa Sul / RA I";

// triagens por dia da semana (segunda = 0); hoje soma os novos cadastros
export const weekBase = [15, 18, 21, 26, 18, 14, 9];
export const historicAverage = 17;

export const seedVisits = [
  { id: "v1", name: "Maria da Silva Santos", cpf: "***.***.***-01", complaint: "Cefaleia tensional e Febre leve", signs: "Tax 37.8 °C · PA 120/80 mmHg", time: "09:30", rt: "Dra. Ana Souza", status: "done" },
  { id: "v2", name: "João Carlos Pereira", cpf: "***.***.***-55", complaint: "Dor torácica e Falta de ar", signs: "PA 170/110 mmHg · SpO2 94%", time: "10:15", rt: "Dra. Ana Souza", status: "referred", urgent: true },
  { id: "v3", name: "Ana Beatriz Oliveira", cpf: "***.***.***-22", complaint: "Tosse persistente e Coriza", signs: "Ausculta em triagem · Escore clínico", time: "11:00", rt: "Dr. Rafael Mendes", status: "progress" },
  { id: "v4", name: "Carlos Eduardo Lima", cpf: "***.***.***-90", complaint: "Dor lombar crônica mecânica", signs: "Sem sinais de alerta neurológico", time: "14:30", rt: "Dra. Ana Souza", status: "done" },
  { id: "v5", name: "Mariana Costa Ribeiro", cpf: "***.***.***-18", complaint: "Erupção cutânea, Coceira intensa", signs: "Quadro alérgico leve sem edema facial", time: "16:00", rt: "Dra. Ana Souza", status: "done" },
  { id: "v6", name: "Pedro Henrique Alves", cpf: "***.***.***-63", complaint: "Dor de garganta e Rouquidão", signs: "Tax 37.2 °C · Sem placas amigdalianas", time: "08:45", rt: "Dr. Rafael Mendes", status: "done" },
  { id: "v7", name: "Lúcia Fernandes Rocha", cpf: "***.***.***-12", complaint: "Controle pressórico de rotina", signs: "PA 148/92 mmHg · Adesão parcial", time: "08:10", rt: "Dra. Ana Souza", status: "progress" },
];

// Registros que a "RNDS" entrega a cada sincronização (um por vez).
export const rndsQueue = [
  { name: "Rafael Nogueira Dias", cpf: "***.***.***-88", complaint: "Retorno: crise asmática leve", signs: "SpO2 96% · Sibilos discretos", rt: "Dr. Rafael Mendes", status: "progress" },
  { name: "Helena Martins Prado", cpf: "***.***.***-04", complaint: "Renovação de receita contínua", signs: "Hipotireoidismo controlado", rt: "Dra. Ana Souza", status: "done" },
];

/**
 * Totais do mês já consolidados (no mundo real, vêm do servidor).
 * `outcomes` já inclui os seedVisits; `seedCounts/seedCount` permitem
 * somar só o que foi cadastrado além deles.
 */
export const baseline = {
  outcomes: { done: 357, referred: 77, progress: 48 },
  referralsToday: 18,
  triageMinutes: 8,
  triageGoal: "< 10 min",
  monthGoal: 525,
  seedCounts: countBy(seedVisits),
  seedCount: seedVisits.length,
};

// Dias anteriores na demonstração: montados a partir deste conjunto, sempre
// iguais para o mesmo dia (ver archiveFor no mockRepository).
export const archivePool = [
  { name: "Roberto Alves Cunha", complaint: "Pico hipertensivo assintomático", signs: "PA 162/98 mmHg · Sem cefaleia", status: "referred", risk: "amarelo" },
  { name: "Fernanda Lopes Vieira", complaint: "Dor de garganta e Febre", signs: "Tax 38.1 °C · Placas amigdalianas", status: "referred", risk: "verde" },
  { name: "Sebastião Ramos Filho", complaint: "Controle glicêmico de rotina", signs: "Glicemia capilar 132 mg/dL", status: "done", risk: "azul" },
  { name: "Juliana Moreira Castro", complaint: "Cólica menstrual intensa", signs: "Dor 7/10 · Sem sinais de alarme", status: "done", risk: "verde" },
  { name: "Antônio Batista Neves", complaint: "Dor torácica em aperto", signs: "PA 158/96 mmHg · Sudorese", status: "referred", risk: "laranja", urgent: true, redFlags: ["Dor torácica"] },
  { name: "Camila Duarte Freitas", complaint: "Rinite alérgica sazonal", signs: "Espirros e prurido nasal", status: "done", risk: "azul" },
  { name: "Gustavo Henrique Prado", complaint: "Entorse leve de tornozelo", signs: "Edema discreto · Deambula sem ajuda", status: "done", risk: "verde" },
  { name: "Rita de Cássia Monteiro", complaint: "Revisão de medicamentos contínuos", signs: "6 medicamentos em uso", status: "progress", risk: "azul" },
  { name: "Marcos Vinícius Teles", complaint: "Diarreia aguda", signs: "Hidratado · Sem sangue nas fezes", status: "done", risk: "verde" },
  { name: "Patrícia Gomes Arruda", complaint: "Cefaleia com visão turva", signs: "PA 174/112 mmHg", status: "referred", risk: "laranja", urgent: true, redFlags: ["PA ≥ 180/110 ou sintomas"] },
  { name: "Eduardo Sampaio Reis", complaint: "Tosse seca há 5 dias", signs: "SpO2 97% · Sem febre", status: "progress", risk: "verde" },
  { name: "Luciana Barros Quintela", complaint: "Queimadura solar leve", signs: "Eritema sem bolhas", status: "done", risk: "azul" },
  { name: "Francisco das Chagas Lima", complaint: "Acompanhamento de anticoagulante", signs: "Sem sangramentos", status: "progress", risk: "azul" },
  { name: "Beatriz Cardoso Paiva", complaint: "Conjuntivite", signs: "Secreção clara · Sem dor ocular", status: "done", risk: "verde" },
];
export const archiveRts = ["Dra. Ana Souza", "Dra. Ana Souza", "Dr. Rafael Mendes"];

// Encaminhamentos de demonstração (horas atrás de "agora"), um em cada situação.
export const referralSeeds = [
  {
    hoursAgo: 1.5,
    visitId: "v2",
    status: "sent",
    priority: "urgente",
    doctor: 0,
    reason: "Dor torácica em aperto com PA elevada e SpO2 94%. Encaminho para avaliação médica imediata; paciente orientado a procurar a UPA se a dor piorar.",
    patient: { name: "João Carlos Pereira", cpf: "***.***.***-55", birthDate: "1961-03-14", sex: "M", phone: "61998812233" },
    clinical: {
      complaint: { text: "Dor torácica e Falta de ar" },
      history: { allergies: [], comorbidities: ["Hipertensão"], medications: ["Losartana 50 mg"] },
      vitals: { systolic: 170, diastolic: 110, heartRate: 104, spo2: 94, temperature: 36.6 },
      risk: "laranja",
      redFlags: ["Dor torácica", "PA ≥ 180/110 ou sintomas"],
      notes: "Dor há 40 minutos, irradiando para o braço esquerdo.",
    },
  },
  {
    hoursAgo: 5,
    visitId: "v3",
    status: "read",
    priority: "rotina",
    doctor: 1,
    reason: "Tosse persistente há 3 semanas, sem febre. Peço avaliação para investigar a causa e decidir sobre exame de imagem.",
    patient: { name: "Ana Beatriz Oliveira", cpf: "***.***.***-22", birthDate: "1988-07-02", sex: "F", phone: "61991234567" },
    clinical: {
      complaint: { text: "Tosse persistente e Coriza" },
      history: { allergies: ["Dipirona"], comorbidities: [], medications: [] },
      vitals: { systolic: 118, diastolic: 76, heartRate: 82, spo2: 97, temperature: 36.9 },
      risk: "verde",
      redFlags: [],
      notes: "Ex-tabagista há 2 anos.",
    },
  },
  {
    hoursAgo: 26,
    status: "answered",
    priority: "rotina",
    doctor: 0,
    reason: "Pico hipertensivo assintomático em paciente sem acompanhamento. Solicito avaliação para início de tratamento.",
    patient: { name: "Roberto Alves Cunha", cpf: "***.***.***-46", birthDate: "1970-11-23", sex: "M", phone: "61993344556" },
    clinical: {
      complaint: { text: "Pico hipertensivo assintomático" },
      history: { allergies: [], comorbidities: [], medications: [] },
      vitals: { systolic: 162, diastolic: 98, heartRate: 78, spo2: 98 },
      risk: "amarelo",
      redFlags: [],
      notes: "Sem cefaleia ou alteração visual.",
    },
    response: "Avaliado na UBS 1 da Asa Sul. Iniciada losartana 50 mg/dia; retorno em 30 dias com MAPA. Farmácia pode acompanhar a PA semanalmente.",
    answeredAfter: 3,
  },
  {
    hoursAgo: 50,
    status: "declined",
    priority: "rotina",
    doctor: 1,
    reason: "Renovação de receita de levotiroxina, paciente sem consulta há 1 ano.",
    patient: { name: "Helena Martins Prado", cpf: "***.***.***-04", birthDate: "1955-05-09", sex: "F", phone: "61990001122" },
    clinical: {
      complaint: { text: "Renovação de receita contínua" },
      history: { allergies: [], comorbidities: ["Hipotireoidismo"], medications: ["Levotiroxina 75 mcg"] },
      vitals: { systolic: 128, diastolic: 82 },
      risk: "azul",
      redFlags: [],
      notes: null,
    },
    response: "Renovação de receita exige consulta presencial com exames recentes (TSH). Orientar agendamento na UBS de referência.",
    answeredAfter: 20,
  },
  {
    hoursAgo: 74,
    status: "cancelled",
    priority: "rotina",
    doctor: 0,
    reason: "Entorse de tornozelo com edema. Avaliação para imobilização.",
    patient: { name: "Gustavo Henrique Prado", cpf: "***.***.***-54", birthDate: "1996-01-30", sex: "M", phone: "61995556677" },
    clinical: {
      complaint: { text: "Entorse leve de tornozelo" },
      history: { allergies: [], comorbidities: [], medications: [] },
      vitals: {},
      risk: "verde",
      redFlags: [],
      notes: "Paciente foi atendido no pronto-socorro antes da resposta.",
    },
  },
];

// Rede de farmácias da demonstração (telas Farmácias e Relatórios, administração). A primeira é a da demo.
// Os números saem de `mockReport.js` a partir de `profile` (sempre iguais para o mesmo dia):
//   volume: atendimentos num mês cheio · history: meses de funcionamento (0 = recém-aberta)
//   mix: [resolvidos, encaminhados, acompanhamento] · urgent: fração com Red Flag · minutes: triagem média
export const demoPharmacies = [
  { id: "demo", name: unit, monthGoal: 525, triageGoalMin: 10, pharmacists: { active: 2, pending: 0 },
    profile: { volume: 470, history: 30, mix: [0.74, 0.16, 0.1], urgent: 0.045, minutes: 8 } },
  { id: "taguatinga-centro", name: "Farmácia Popular do Servidor — Taguatinga Centro / RA III", monthGoal: 420, triageGoalMin: 10,
    pharmacists: { active: 3, pending: 1 }, profile: { volume: 330, history: 30, mix: [0.75, 0.15, 0.1], urgent: 0.034, minutes: 9.2 } },
  { id: "ceilandia-norte", name: "Drogaria Vida — Ceilândia Norte / RA IX", monthGoal: 600, triageGoalMin: 12,
    pharmacists: { active: 4, pending: 0 }, profile: { volume: 590, history: 30, mix: [0.76, 0.15, 0.09], urgent: 0.035, minutes: 13.4 } },
  { id: "aguas-claras", name: "Farmácia Bem Estar — Águas Claras / RA XX", monthGoal: 300, triageGoalMin: 8,
    pharmacists: { active: 1, pending: 1 }, profile: { volume: 230, history: 4, mix: [0.82, 0.09, 0.09], urgent: 0.02, minutes: 7.1 } },
  { id: "sobradinho", name: "Drogaria São Lucas — Sobradinho / RA V", monthGoal: 250, triageGoalMin: 10,
    pharmacists: { active: 0, pending: 1 }, profile: { volume: 200, history: 0, mix: [0.75, 0.15, 0.1], urgent: 0.03, minutes: 10 } },
];
