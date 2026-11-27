// Constantes da triagem clínica.

export const RISK_LEVELS = [
  { id: "azul", label: "Azul", hint: "Não urgente" },
  { id: "verde", label: "Verde", hint: "Pouco urgente" },
  { id: "amarelo", label: "Amarelo", hint: "Urgente" },
  { id: "laranja", label: "Laranja", hint: "Muito urgente" },
  { id: "vermelho", label: "Vermelho", hint: "Imediato" },
];

/** Classificações que tornam o atendimento urgente. */
export const URGENT_RISKS = new Set(["laranja", "vermelho"]);

export const RED_FLAGS = ["Dor torácica", "Dispneia", "Déficit neurológico", "Síncope"];

/* Apenas exemplo. Trocar por uma busca real. */
export const CODE_SUGGESTIONS = [
  "CIAP-2 A03 · Febre",
  "CIAP-2 N01 · Cefaleia",
  "CIAP-2 R05 · Tosse",
  "CIAP-2 R02 · Dispneia",
];

export const OBS_LIMIT = 500;
export const GUIDANCE_LIMIT = 1000;

/** Abaixo disso o atendimento exige o responsável legal presente (ECA; LGPD, art. 14). */
export const MAIORIDADE = 18;

/** Parentesco de quem acompanha o menor (mesmos códigos do servidor). */
export const GUARDIAN_RELATIONS = [
  { value: "mae", label: "Mãe" },
  { value: "pai", label: "Pai" },
  { value: "avo", label: "Avó ou avô" },
  { value: "tutor", label: "Tutor(a) ou guardião legal" },
  { value: "outro", label: "Outro responsável legal" },
];

/* faixas plausíveis para aferição em farmácia (fora disso é erro de digitação) */
export const RANGES = {
  paSis: [60, 260],
  paDia: [30, 160],
  fc: [20, 250],
  spo2: [50, 100],
  temp: [30, 45],
  peso: [1, 400],
  altura: [30, 250],
};

export const INITIAL = {
  cpf: "", cns: "", nome: "", nascimento: "", sexo: "", telefone: "",
  respNome: "", respCpf: "", respParentesco: "",
  queixa: "", codigo: "", inicioSintomas: "",
  alergias: [], comorbidades: [], medicamentos: [],
  paSis: "", paDia: "", fc: "", spo2: "", temp: "", peso: "", altura: "",
  risco: "", redFlags: [], orientacao: "", observacoes: "",
};

export const STEP_STATUS_LABEL = { done: "Concluída", active: "Ativa", pending: "Pendente", optional: "Opcional" };
