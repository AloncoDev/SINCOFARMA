import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Printer,
  TriangleAlert,
  UserRound,
  MessageSquareText,
  Pill,
  HeartPulse,
  ShieldAlert,
  StickyNote,
  Send,
  Eye,
  CircleCheck,
  CircleX,
  Ban,
  FileText,
  Stethoscope,
} from "lucide-react";
import SpotlightCard from "../../components/SpotlightCard";
import { repository } from "../../data";
import { useAuth } from "../../contexts/auth";
import { useClinic } from "../../contexts/clinic";
import { pode, podeRota } from "../../services/permissoes";
import { REFERRAL_STATUS, REFERRAL_OPEN, PRIORITIES } from "../../data/catalog";
import { RISK, SEX, phone, cns, brDate, age, dateTime, vitalsOf } from "../Ficha/clinico";
import List from "../Ficha/FichaList";
import { rise, press } from "../../utils/motion";
import "../Ficha/Ficha.css";
import "./Encaminhamentos.css";

/** Encaminhamento aberto: a ficha enviada, a linha do tempo e o que cada perfil pode fazer. */
export default function Encaminhamento() {
  const { id } = useParams();
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    // abrir pelo médico marca como lido (no servidor)
    repository.getReferral(id).then(
      (ref) => setState({ status: "ready", ref }),
      (err) => setState({ status: "error", error: err.message || "Não foi possível abrir o encaminhamento." })
    );
  }, [id]);

  if (state.status !== "ready") {
    return (
      <main className="dash-content">
        <Link to="/encaminhamentos" className="link-arrow ficha-back"><ArrowLeft size={14} /> Encaminhamentos</Link>
        {state.status === "loading" ? (
          <p className="muted">Abrindo o encaminhamento…</p>
        ) : (
          <div className="load-error" role="alert"><TriangleAlert size={18} /><span>{state.error}</span></div>
        )}
      </main>
    );
  }

  return <Detalhe data={state.ref} onChange={(ref) => setState({ status: "ready", ref })} />;
}

function Detalhe({ data: r, onChange }) {
  const { user } = useAuth();
  const st = REFERRAL_STATUS[r.status];
  const risk = RISK[r.clinical?.risk];
  const p = r.patient ?? {};
  const c = r.clinical ?? {};
  const vitals = vitalsOf(c.vitals);
  const years = age(p.birthDate);
  const isOpen = REFERRAL_OPEN.includes(r.status);
  // o servidor também confere: médico que recebeu responde; a farmácia que enviou cancela
  const canAnswer = isOpen && pode(user, "responder_encaminhamento") && r.mine !== false && !pode(user, "criar_encaminhamento");
  const canCancel = isOpen && pode(user, "criar_encaminhamento");

  return (
    <main className="dash-content ficha">
      <div className="ficha-top no-print">
        <Link to="/encaminhamentos" className="link-arrow ficha-back"><ArrowLeft size={14} /> Encaminhamentos</Link>
        <button type="button" className="btn btn--ghost" onClick={() => window.print()}>
          <Printer size={16} /> Imprimir / PDF
        </button>
      </div>

      <section className="page-head">
        <div>
          <motion.nav className="crumbs" aria-label="Trilha" {...rise(0)}>
            <b>SINCOFARMA</b>
            <span>/</span>
            <span>Encaminhamento</span>
          </motion.nav>
          <motion.h1 {...rise(1)}>{p.name}</motion.h1>
          <motion.p className="hello" {...rise(2)}>
            {r.protocol && <>Protocolo <b className="mono">{r.protocol}</b> · </>}
            {r.unitName} · para {r.doctor?.name}
          </motion.p>
        </div>
        <motion.div className="ficha-tags" {...rise(2)}>
          <span className={`ficha-tag ref-status--${st.tone}`}>{st.label}</span>
          {r.priority === "urgente" && <span className="ficha-tag ficha-tag--red"><TriangleAlert size={13} /> {PRIORITIES.urgente.label}</span>}
          {risk && <span className={`ficha-tag ficha-risk--${risk.id}`}>Risco {risk.label} · {risk.hint}</span>}
        </motion.div>
      </section>

      <Timeline r={r} />

      <div className="ref-grid">
        <SpotlightCard index={2} className={`ficha-card ref-reason${r.urgent ? " is-urgent" : ""}`}>
          <h2><Send size={17} /> Motivo do encaminhamento</h2>
          <p className="ficha-text">{r.reason}</p>
          <p className="ref-from">
            {r.from?.name}
            {r.from?.crf && <> · CRF-DF {r.from.crf}</>} · {dateTime(r.createdAt)}
          </p>
          {podeRota(user, "/ficha") && r.visitId && (
            <Link to={`/ficha/${r.visitId}`} className="link-arrow no-print">
              <FileText size={14} /> Ficha original do atendimento
            </Link>
          )}
        </SpotlightCard>

        <Resposta r={r} canAnswer={canAnswer} canCancel={canCancel} onChange={onChange} />
      </div>

      <h2 className="ref-section">Ficha enviada ao médico</h2>
      <div className="ficha-grid">
        <SpotlightCard index={4} className="ficha-card">
          <h2><UserRound size={17} /> Paciente</h2>
          <dl className="ficha-dl">
            <div><dt>CPF</dt><dd className="mono">{p.cpf ?? "—"}</dd></div>
            {p.cns && <div><dt>CNS</dt><dd className="mono">{cns(p.cns)}</dd></div>}
            <div><dt>Nascimento</dt><dd>{brDate(p.birthDate) ?? "—"}{years != null && ` (${years} anos)`}</dd></div>
            <div><dt>Sexo</dt><dd>{SEX[p.sex] ?? "—"}</dd></div>
            <div><dt>Telefone</dt><dd>{phone(p.phone) ?? "—"}</dd></div>
          </dl>
        </SpotlightCard>

        <SpotlightCard index={5} className="ficha-card">
          <h2><MessageSquareText size={17} /> Queixa principal</h2>
          <p className="ficha-text">{c.complaint?.text ?? "—"}</p>
          <dl className="ficha-dl">
            {c.complaint?.code && <div><dt>CID / CIAP</dt><dd>{c.complaint.code}</dd></div>}
            {c.complaint?.onset && <div><dt>Início</dt><dd>{brDate(c.complaint.onset)}</dd></div>}
          </dl>
        </SpotlightCard>

        <SpotlightCard index={6} className="ficha-card">
          <h2><Pill size={17} /> Histórico clínico</h2>
          <dl className="ficha-dl ficha-dl--stack">
            <div><dt>Alergias</dt><dd><List items={c.history?.allergies} /></dd></div>
            <div><dt>Comorbidades</dt><dd><List items={c.history?.comorbidities} /></dd></div>
            <div><dt>Medicamentos em uso</dt><dd><List items={c.history?.medications} /></dd></div>
          </dl>
        </SpotlightCard>

        <SpotlightCard index={7} className="ficha-card">
          <h2><HeartPulse size={17} /> Sinais vitais</h2>
          {vitals.length ? (
            <dl className="ficha-vitals">
              {vitals.map(([label, value]) => (
                <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
              ))}
            </dl>
          ) : (
            <span className="muted">Não registrados</span>
          )}
        </SpotlightCard>

        <SpotlightCard index={8} className="ficha-card">
          <h2><ShieldAlert size={17} /> Classificação e alertas</h2>
          <dl className="ficha-dl ficha-dl--stack">
            <div><dt>Classificação de risco</dt><dd>{risk ? `${risk.label} — ${risk.hint}` : "—"}</dd></div>
            <div><dt>Sinais de alerta (Red Flags)</dt><dd><List items={c.redFlags} /></dd></div>
          </dl>
        </SpotlightCard>

        <SpotlightCard index={9} className="ficha-card">
          <h2><StickyNote size={17} /> Observações</h2>
          <p className="ficha-text">{c.notes || <span className="muted">Sem observações</span>}</p>
        </SpotlightCard>
      </div>
    </main>
  );
}

/** Enviado → lido → respondido / recusado / cancelado */
function Timeline({ r }) {
  const closed = !REFERRAL_OPEN.includes(r.status);
  const read = r.status !== "sent" && r.status !== "cancelled" ? true : r.status === "cancelled" ? null : false;
  const last = {
    answered: { icon: CircleCheck, label: "Respondido", tone: "green" },
    declined: { icon: CircleX, label: "Recusado", tone: "amber" },
    cancelled: { icon: Ban, label: "Cancelado", tone: "gray" },
  }[r.status] ?? { icon: Stethoscope, label: "Resposta do médico", tone: "todo" };
  const steps = [
    { icon: Send, label: "Enviado", at: r.createdAt, tone: "done" },
    // cancelado antes da leitura: a etapa "lido" não aconteceu
    ...(read === null ? [] : [{ icon: Eye, label: "Lido pelo médico", at: read ? (closed ? null : r.statusAt) : null, tone: read ? "done" : "todo" }]),
    { icon: last.icon, label: last.label, at: closed ? r.answeredAt ?? r.statusAt : null, tone: closed ? last.tone : "todo" },
  ];
  return (
    <motion.ol className="ref-steps card" aria-label="Situação do encaminhamento" {...rise(3)}>
      {steps.map((s, i) => (
        <li key={s.label} className={`ref-step ref-step--${s.tone}`}>
          <span className="ref-step-icon"><s.icon size={16} /></span>
          <div>
            <strong>{s.label}</strong>
            <small>{s.at ? dateTime(s.at) : s.tone === "todo" ? "pendente" : "—"}</small>
          </div>
          {i < steps.length - 1 && <i className="ref-step-line" aria-hidden="true" />}
        </li>
      ))}
    </motion.ol>
  );
}

/** Resposta do médico, ou o formulário para ele responder, ou o cancelamento pela farmácia. */
function Resposta({ r, canAnswer, canCancel, onChange }) {
  const { notify } = useClinic();
  const [text, setText] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function send(status) {
    const response = text.trim();
    if (status !== "cancelled" && response.length < 2) {
      setError(status === "declined" ? "Explique o motivo da recusa para a farmácia." : "Escreva a conduta ou orientação.");
      return;
    }
    setBusy(status);
    setError(null);
    try {
      const updated = await repository.updateReferral(r.id, status === "cancelled" ? { status } : { status, response });
      onChange({ ...r, ...updated });
      notify(
        status === "answered" ? "Resposta enviada à farmácia." : status === "declined" ? "Encaminhamento recusado." : "Encaminhamento cancelado.",
        status === "answered" ? "success" : "info"
      );
    } catch (err) {
      notify(err.message || "Não foi possível salvar.", "error");
    } finally {
      setBusy(null);
      setConfirmCancel(false);
    }
  }

  if (r.response) {
    const declined = r.status === "declined";
    return (
      <SpotlightCard index={3} className={`ficha-card ref-answer${declined ? " is-declined" : ""}`}>
        <h2>{declined ? <CircleX size={17} /> : <CircleCheck size={17} />} {declined ? "Recusado pelo médico" : "Resposta do médico"}</h2>
        <p className="ficha-text">{r.response}</p>
        <p className="ref-from">{r.doctor?.name} · {r.answeredAt ? dateTime(r.answeredAt) : ""}</p>
      </SpotlightCard>
    );
  }

  if (canAnswer) {
    return (
      <SpotlightCard index={3} className="ficha-card ref-form no-print">
        <h2><Stethoscope size={17} /> Sua resposta</h2>
        <div className={`field${error ? " has-error" : ""}`}>
          <label htmlFor="ref-response">CONDUTA / ORIENTAÇÃO PARA A FARMÁCIA</label>
          <textarea
            id="ref-response"
            rows={5}
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ex.: avaliar na UBS em até 48 h; manter losartana; retornar se dor torácica."
            aria-invalid={!!error || undefined}
          />
          {error && <small className="field-error">{error}</small>}
        </div>
        <div className="ref-actions">
          <button type="button" className="btn btn--ghost btn--danger" onClick={() => send("declined")} disabled={!!busy}>
            <CircleX size={16} /> {busy === "declined" ? "Recusando…" : "Recusar"}
          </button>
          <motion.button type="button" className="btn btn--primary" onClick={() => send("answered")} disabled={!!busy} {...press}>
            <Send size={16} /> {busy === "answered" ? "Enviando…" : "Enviar resposta"}
          </motion.button>
        </div>
      </SpotlightCard>
    );
  }

  return (
    <SpotlightCard index={3} className="ficha-card ref-waiting">
      <h2><Eye size={17} /> {r.status === "cancelled" ? "Encaminhamento cancelado" : "Aguardando resposta"}</h2>
      <p className="ficha-text">
        {r.status === "cancelled"
          ? "A farmácia cancelou este encaminhamento antes da resposta do médico."
          : r.status === "read"
            ? `${r.doctor?.name} já abriu o caso. A resposta aparece aqui assim que for enviada.`
            : `${r.doctor?.name} ainda não abriu o caso.`}
      </p>
      {canCancel && (
        <div className="ref-actions no-print">
          <AnimatePresence mode="wait" initial={false}>
            {confirmCancel ? (
              <motion.span key="confirm" className="confirm-pair" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <button type="button" className="btn btn--ghost" onClick={() => setConfirmCancel(false)}>Voltar</button>
                <button type="button" className="btn btn--danger-solid" onClick={() => send("cancelled")} disabled={!!busy}>
                  {busy ? "Cancelando…" : "Confirmar cancelamento"}
                </button>
              </motion.span>
            ) : (
              <motion.button key="ask" type="button" className="btn btn--ghost btn--danger" onClick={() => setConfirmCancel(true)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Ban size={16} /> Cancelar encaminhamento
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}
    </SpotlightCard>
  );
}
