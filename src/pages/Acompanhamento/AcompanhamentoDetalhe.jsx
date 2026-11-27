import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck, Stethoscope, PillBottle, Store, TriangleAlert, Clock } from "lucide-react";
import SpotlightCard from "../../components/SpotlightCard";
import { repository } from "../../data";
import { STATUS, REFERRAL_STATUS, PRIORITIES } from "../../data/catalog";
import { RISK } from "../Ficha/clinico";
import { rise } from "../../utils/motion";
import "./Acompanhamento.css";

const ROLE = {
  farmaceutico: { label: "Farmacêutico(a)", icon: PillBottle },
  medico: { label: "Médico(a)", icon: Stethoscope },
};

/** "24/11/2026 às 14:32" */
const when = (iso) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};

/** Texto curto para uma mudança de situação ("Em andamento → Concluído"). */
function changeText(changes) {
  const parts = [];
  if (changes.status) {
    const [a, b] = changes.status;
    const name = (s) => STATUS[s]?.short ?? REFERRAL_STATUS[s]?.short ?? s;
    parts.push(`${name(a)} → ${name(b)}`);
  }
  if (changes.urgent) parts.push(changes.urgent[1] ? "Red Flag marcada" : "Red Flag retirada");
  return parts.join(" · ");
}

/** Administração: um atendimento, com quem cuidou dele e o que aconteceu (sem o paciente). */
export default function AcompanhamentoDetalhe() {
  const { id } = useParams();
  const { state: nav } = useLocation();
  const back = nav?.back ?? "/atendimentos";
  const [state, setState] = useState({ id: null, data: null, error: null });

  const load = useCallback(() => {
    repository.trackVisit(id).then(
      (data) => setState({ id, data, error: null }),
      (err) => setState({ id, data: null, error: err.message || "Não foi possível abrir o atendimento." })
    );
  }, [id]);
  useEffect(load, [load]);

  const loading = state.id !== id;
  const data = !loading ? state.data : null;
  const v = data?.visit;
  const st = v && STATUS[v.status];
  const risk = v && RISK[v.risk];
  // pessoas envolvidas: cada nome uma vez, com o papel
  const people = data
    ? [...new Map(data.timeline.filter((t) => t.role).map((t) => [`${t.role}|${t.actor}`, { name: t.actor, role: t.role }])).values()]
    : [];

  return (
    <main className="dash-content">
      <section className="page-head">
        <div>
          <motion.nav className="crumbs" aria-label="Trilha" {...rise(0)}>
            <b>SINCOFARMA</b>
            <span>/</span>
            <Link to={back}>Atendimentos</Link>
            <span>/</span>
            <span>{v?.protocol ?? "…"}</span>
          </motion.nav>
          <motion.h1 {...rise(1)}>Atendimento <span className="mono">{v?.protocol ?? ""}</span></motion.h1>
          <motion.p className="hello" {...rise(2)}>{data ? `${data.unitName} · ${when(v.at)}` : "Carregando…"}</motion.p>
        </div>
        <motion.div className="page-actions" {...rise(2)}>
          <Link to={back} className="btn btn--ghost"><ArrowLeft size={16} /> Voltar</Link>
        </motion.div>
      </section>

      {state.error && !loading && (
        <div className="load-error" role="alert">
          <TriangleAlert size={18} />
          <span>{state.error}</span>
          <button type="button" className="btn btn--ghost" onClick={load}>Tentar de novo</button>
        </div>
      )}

      {data && (
        <div className="track-detail">
          <div className="track-side">
            <SpotlightCard index={3} className="track-card">
              <h2>Situação</h2>
              <div className="track-situation">
                <span className={`status status--${st.tone}`}><i />{st.label}</span>
                {v.urgent && <span className="track-flag"><TriangleAlert size={12} /> Red Flag</span>}
              </div>
              <dl className="track-facts">
                <div><dt>Farmácia</dt><dd><Store size={14} aria-hidden="true" /> {data.unitName}</dd></div>
                <div><dt>Registrado</dt><dd><Clock size={14} aria-hidden="true" /> {when(v.at)}</dd></div>
                {risk && <div><dt>Classificação de risco</dt><dd><span className={`track-risk track-risk--${risk.id}`}>{risk.label}</span></dd></div>}
              </dl>
            </SpotlightCard>

            <SpotlightCard index={4} className="track-card">
              <h2>Quem cuidou</h2>
              <ul className="track-people">
                {people.map((p) => {
                  const R = ROLE[p.role];
                  return (
                    <li key={`${p.role}|${p.name}`}>
                      <span className={`track-avatar track-avatar--${p.role}`}><R.icon size={16} aria-hidden="true" /></span>
                      <div>
                        <strong>{p.name}</strong>
                        <small>{R.label}{p.role === "farmaceutico" && p.name === v.rt ? " · fez o atendimento" : ""}</small>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </SpotlightCard>

            {data.referrals.length > 0 && (
              <SpotlightCard index={5} className="track-card">
                <h2>Encaminhamento{data.referrals.length > 1 ? "s" : ""} à unidade de saúde</h2>
                <ul className="track-refs">
                  {data.referrals.map((r) => (
                    <li key={r.id}>
                      <div className="track-ref-head">
                        <strong>{r.healthUnit ?? r.doctor}</strong>
                        <span className={`status status--${REFERRAL_STATUS[r.status].tone}`}><i />{REFERRAL_STATUS[r.status].short}</span>
                      </div>
                      <small>
                        {r.code && <>Guia <b className="mono">{r.code}</b> · </>}
                        {PRIORITIES[r.priority]?.label ?? r.priority} · enviado por {r.from} em {when(r.createdAt)}
                        {r.healthUnit && r.doctor ? ` · respondido por ${r.doctor}${r.answeredUnit && r.answeredUnit !== r.healthUnit ? ` (${r.answeredUnit})` : ""}` : ""}
                        {r.statusAt && r.status !== "sent" ? ` · ${REFERRAL_STATUS[r.status].label.toLowerCase()} em ${when(r.statusAt)}` : ""}
                      </small>
                    </li>
                  ))}
                </ul>
              </SpotlightCard>
            )}
          </div>

          <SpotlightCard index={4} className="track-card track-timeline-card">
            <h2>Linha do tempo</h2>
            <ol className="track-timeline">
              {data.timeline.map((t, i) => {
                const R = ROLE[t.role];
                const to = t.destination ?? t.doctor;
                const extra = [changeText(t.changes), to ? `para ${to}` : ""].filter(Boolean).join(" · ");
                return (
                  <motion.li key={`${t.at}-${i}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.06 }}>
                    <span className={`track-dot track-dot--${t.role ?? "none"}`} aria-hidden="true">{R ? <R.icon size={13} /> : null}</span>
                    <div>
                      <strong>{t.label}</strong>
                      {extra && <span className="track-change">{extra}</span>}
                      <small>
                        {t.actor}{R ? ` · ${R.label}` : ""} · {when(t.at)}
                      </small>
                    </div>
                  </motion.li>
                );
              })}
            </ol>
          </SpotlightCard>
        </div>
      )}

      <div className="data-hidden track-note" role="note">
        <ShieldCheck size={18} aria-hidden="true" />
        <span>Dados do paciente (nome, CPF, queixa e ficha) não aparecem para a administração. Esta consulta fica registrada na Auditoria.</span>
      </div>
    </main>
  );
}
