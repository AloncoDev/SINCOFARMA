import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { TriangleAlert, SearchX, ChevronRight, Info } from "lucide-react";
import SpotlightCard from "../../components/SpotlightCard";
import { repository } from "../../data";
import { useAuth } from "../../contexts/auth";
import { useSearch, normalize } from "../../contexts/clinic";
import { pode } from "../../services/permissoes";
import { REFERRAL_STATUS, REFERRAL_OPEN, PRIORITIES } from "../../data/catalog";
import { RISK } from "../Ficha/clinico";
import { initials } from "../../utils/initials";
import { rise } from "../../utils/motion";
import "./Encaminhamentos.css";

// cartões do resumo; cada um filtra a lista
const PICKS = [
  { key: "open", label: "Aguardando resposta", tone: "blue", match: (r) => REFERRAL_OPEN.includes(r.status) },
  { key: "answered", label: "Respondidos", tone: "green", match: (r) => r.status === "answered" },
  { key: "declined", label: "Recusados", tone: "amber", match: (r) => r.status === "declined" },
  { key: "cancelled", label: "Cancelados", tone: "gray", match: (r) => r.status === "cancelled" },
  { key: "all", label: "Todos", tone: "navy", match: () => true },
];
const PICK = Object.fromEntries(PICKS.map((p) => [p.key, p]));

/** "hoje, 14:32" · "ontem, 09:10" · "07/11, 16:05" */
function when(iso, now = new Date()) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const days = Math.round((new Date(now).setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 864e5);
  if (days === 0) return `hoje, ${time}`;
  if (days === 1) return `ontem, ${time}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}, ${time}`;
}

const matches = (r, q) =>
  !q || [r.patientName, r.complaint, r.protocol, r.doctorName, r.fromName, r.unitName].some((f) => normalize(f ?? "").includes(q));

/**
 * Farmacêutico: encaminhamentos enviados pela farmácia (acompanha resposta, pode cancelar).
 * Médico: a caixa de entrada dele (abre, responde ou recusa). Quem vê o quê é o servidor que decide.
 */
export default function Encaminhamentos() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { query } = useSearch();
  const [params, setParams] = useSearchParams();
  // médico: a caixa de entrada é o que importa; farmácia: abre já nos que aguardam
  const doctorView = pode(user, "responder_encaminhamento") && !pode(user, "criar_encaminhamento");
  const filter = PICK[params.get("status")] ? params.get("status") : "open";
  const [state, setState] = useState({ status: "loading", list: [] });

  const load = useCallback(() => {
    repository.listReferrals().then(
      (list) => setState({ status: "ready", list }),
      (err) => setState({ status: "error", list: [], error: err.message || "Não foi possível carregar os encaminhamentos." })
    );
  }, []);
  useEffect(load, [load]);

  const counts = useMemo(() => Object.fromEntries(PICKS.map((p) => [p.key, state.list.filter(p.match).length])), [state.list]);
  const q = normalize(query.trim());
  const shown = state.list.filter(PICK[filter].match).filter((r) => matches(r, q));
  const loading = state.status === "loading";

  function pick(key) {
    setParams(key === "open" ? {} : { status: key }, { replace: true });
  }
  const open = (id) => navigate(`/encaminhamentos/${id}`);

  return (
    <main className="dash-content">
      <section className="page-head">
        <div>
          <motion.nav className="crumbs" aria-label="Trilha" {...rise(0)}>
            <b>SINCOFARMA</b>
            <span>/</span>
            <span>Encaminhamentos</span>
          </motion.nav>
          <motion.h1 {...rise(1)}>{doctorView ? "Casos encaminhados a você" : "Encaminhamentos"}</motion.h1>
          <motion.p className="hello" {...rise(2)}>
            {doctorView
              ? "Farmácias da rede pedem sua avaliação. Abra o caso, leia a ficha e responda com a conduta."
              : "Casos que a farmácia enviou a médicos da rede e as respostas de cada um."}
          </motion.p>
        </div>
      </section>

      {!doctorView && (
        <motion.div className="data-hidden ref-note" role="note" {...rise(3)}>
          <Info size={18} aria-hidden="true" />
          <span>
            Para encaminhar, abra o atendimento (em <b>Atendimentos</b> ou no Dashboard) e use <b>Encaminhar a médico</b>.
            O médico recebe uma cópia da ficha naquele momento, com o CPF mascarado.
          </span>
        </motion.div>
      )}

      <motion.section className="pick-stats" aria-label="Resumo" {...rise(4)}>
        {PICKS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`pick-stat pick-stat--${p.tone}${filter === p.key ? " is-active" : ""}`}
            aria-pressed={filter === p.key}
            onClick={() => pick(p.key)}
          >
            <span className="pick-stat-label">
              <i aria-hidden="true" />
              {p.label}
            </span>
            <strong>{loading ? "–" : counts[p.key]}</strong>
          </button>
        ))}
      </motion.section>

      {state.status === "error" && (
        <div className="load-error" role="alert">
          <TriangleAlert size={18} />
          <span>{state.error}</span>
          <button type="button" className="btn btn--ghost" onClick={load}>Tentar de novo</button>
        </div>
      )}

      <SpotlightCard index={5} className={`table-card${loading ? " is-loading" : ""}`} aria-busy={loading}>
        <header className="card-head">
          <div>
            <h2>{PICK[filter].label}</h2>
            <p>{doctorView ? "Mais recentes primeiro. Os urgentes aparecem destacados." : "Mais recentes primeiro. Clique para ver a ficha enviada e a resposta."}</p>
          </div>
        </header>

        <div className="table-scroll">
          <table className="visits ref-table">
            <thead>
              <tr>
                <th>PACIENTE / PROTOCOLO</th>
                <th>QUEIXA &amp; RISCO</th>
                <th>{doctorView ? "FARMÁCIA" : "MÉDICO"}</th>
                <th>ENVIADO</th>
                <th className="ta-right">SITUAÇÃO</th>
                <th aria-label="Abrir" />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const st = REFERRAL_STATUS[r.status];
                const risk = RISK[r.risk];
                const unread = doctorView && r.status === "sent";
                return (
                  <tr
                    key={r.id}
                    className={`visit-row${r.urgent ? " is-urgent" : ""}${unread ? " is-unread" : ""}`}
                    onClick={() => open(r.id)}
                    tabIndex={0}
                    role="link"
                    aria-label={`Abrir encaminhamento de ${r.patientName}${r.urgent ? ", urgente" : ""}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        open(r.id);
                      }
                    }}
                  >
                    <td>
                      <div className="patient">
                        <span className={`avatar avatar--${r.urgent ? "red" : st.tone === "gray" ? "blue" : st.tone}`}>{initials(r.patientName)}</span>
                        <div>
                          <strong>
                            {r.patientName}
                            {r.urgent && (
                              <>
                                <TriangleAlert size={14} className="urgent-icon" aria-hidden="true" />
                                <span className="sr-only">Urgente</span>
                              </>
                            )}
                          </strong>
                          <small className="mono">{r.protocol ?? "—"}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="complaint">
                        <strong>{r.complaint}</strong>
                        <small className="ref-tags">
                          {risk && <span className={`ref-risk ficha-risk--${risk.id}`}>{risk.label}</span>}
                          {r.priority === "urgente" && <span className="ref-prio">{PRIORITIES.urgente.label}</span>}
                        </small>
                      </div>
                    </td>
                    <td>
                      {doctorView ? (
                        <div className="complaint">
                          <strong>{r.unitName}</strong>
                          <small>por {r.fromName}</small>
                        </div>
                      ) : (
                        r.doctorName
                      )}
                    </td>
                    <td className="mono ref-when">{when(r.createdAt)}</td>
                    <td className="ta-right">
                      <span className={`status status--${st.tone}`}>
                        <i />
                        {unread ? "Novo" : st.short}
                      </span>
                    </td>
                    <td className="ta-center">
                      <ChevronRight size={18} className="ref-go" aria-hidden="true" />
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    <SearchX size={20} />
                    <span>
                      {loading
                        ? "Carregando encaminhamentos..."
                        : q
                          ? "Nenhum encaminhamento encontrado para essa busca."
                          : filter === "open"
                            ? doctorView
                              ? "Nenhum caso aguardando sua resposta."
                              : "Nenhum encaminhamento aguardando resposta."
                            : "Nada por aqui ainda."}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {state.list.length >= 100 && (
          <div className="table-more">Mostrando os 100 mais recentes.</div>
        )}
      </SpotlightCard>
    </main>
  );
}
