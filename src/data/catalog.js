/** Vocabulário do domínio (status, desfechos). Único lugar para esses rótulos. */

export const STATUS = {
  done: { label: "Concluído (MIP)", short: "Concluído", tone: "green" },
  referred: { label: "Encaminhado SES-DF", short: "Encaminhado", tone: "amber" },
  progress: { label: "Em Andamento", short: "Em andamento", tone: "blue" },
};

export const OUTCOME_META = {
  done: { label: "Resolvido no local", color: "var(--c-teal)" },
  referred: { label: "Encaminhado SES-DF", color: "var(--c-amber)" },
  progress: { label: "Acompanhamento Farmacote", color: "var(--c-blue)" },
};

export const WEEK_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export const WEEK_NAMES = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo",
];

/** Encaminhamentos a médico (backend/src/painel/comum/encaminhamentos.py). */
export const REFERRAL_STATUS = {
  sent: { label: "Aguardando leitura", short: "Enviado", tone: "blue" },
  read: { label: "Lido pelo médico", short: "Lido", tone: "blue" },
  answered: { label: "Respondido", short: "Respondido", tone: "green" },
  declined: { label: "Recusado pelo médico", short: "Recusado", tone: "amber" },
  cancelled: { label: "Cancelado pela farmácia", short: "Cancelado", tone: "gray" },
};
/** Ainda sem resposta: o médico pode responder e a farmácia, cancelar. */
export const REFERRAL_OPEN = ["sent", "read"];
export const PRIORITIES = {
  rotina: { label: "Rotina" },
  urgente: { label: "Urgente" },
};
