import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ShieldCheck, Store, TriangleAlert, SearchX, Stethoscope, PillBottle } from "lucide-react";
import Select from "../../components/Select";
import SpotlightCard from "../../components/SpotlightCard";
import { repository } from "../../data";
import { useClinic, useSearch, normalize } from "../../contexts/clinic";
import { STATUS, REFERRAL_STATUS } from "../../data/catalog";
import { dayKey, fromDayKey, shiftDay, dayLabel } from "../../utils/dates";
import { rise } from "../../utils/motion";
import "../Atendimentos/Atendimentos.css";
import "./Acompanhamento.css";

const STATS = [
  { key: "all", label: "Atendimentos", tone: "navy" },
  { key: "done", label: STATUS.done.short, tone: "green" },
  { key: "referred", label: STATUS.referred.short, tone: "amber" },
  { key: "progress", label: STATUS.progress.short, tone: "blue" },
  { key: "urgent", label: "Red Flag", tone: "red" },
  { key: "doctor", label: "Com médico", tone: "gray" },
];
const FILTERS = new Set(STATS.map((s) => s.key));

const match = (v, f) =>
  f === "all" ? true : f === "urgent" ? v.urgent : f === "doctor" ? v.referrals.length > 0 : v.status === f;

/**
 * Administração: atendimentos de uma farmácia num dia, com quem cuidou de cada um
 * (farmacêutico e médico) e a situação. Sem nada do paciente: nome, CPF e queixa ficam
 * com a farmácia. Farmácia, dia e filtro ficam na URL (?unidade=&dia=&filtro=).
 */
export default function Acompanhamento() {
  const navigate = useNavigate();
  const { units, viewUnit } = useClinic();
  const { query } = useSearch();
  const [params, setParams] = useSearchParams();
  const today = dayKey();
  const asked = params.get("dia");
  const day = asked && fromDayKey(asked) && asked <= today ? asked : today;
  // padrão: a farmácia escolhida no dashboard
  const unit = params.get("unidade") || viewUnit || units[0]?.id || "";
  const filter = FILTERS.has(params.get("filtro")) ? params.get("filtro") : "all";
  const key = `${unit}|${day}`;

  const [state, setState] = useState({ key: null, data: null, error: null });
  const load = useCallback(() => {
    if (!unit) return;
    repository.trackVisits(unit, day).then(
      (data) => setState({ key, data, error: null }),
      (err) => setState({ key, data: null, error: err.message || "Não foi possível carregar os atendimentos." })
    );
  }, [unit, day, key]);
  useEffect(load, [load]);

  const loading = state.key !== key;
  const visits = useMemo(() => (!loading && state.data ? state.data.visits : []), [loading, state.data]);

  function go(change) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(change)) {
      if (v && !(k === "dia" && v === today) && !(k === "filtro" && v === "all")) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  }

  const counts = useMemo(() => Object.fromEntries(STATS.map((s) => [s.key, visits.filter((v) => match(v, s.key)).length])), [visits]);
  const q = normalize(query.trim());
  const shown = visits.filter(
    (v) =>
      match(v, filter) &&
      (!q || [v.protocol, v.rt, ...v.referrals.map((r) => r.doctor)].some((t) => normalize(t || "").includes(q)))
  );

  const open = (id) => navigate(`/atendimentos/${encodeURIComponent(id)}`, { state: { back: `/atendimentos?${params}` } });
  const label = dayLabel(day);

  return (
    <main className="dash-content">
      <section className="page-head">
        <div>
          <motion.nav className="crumbs" aria-label="Trilha" {...rise(0)}>
            <b>SINCOFARMA</b>
            <span>/</span>
            <span>Atendimentos</span>
          </motion.nav>
          <motion.h1 {...rise(1)}>Atendimentos da rede</motion.h1>
          <motion.p className="hello" {...rise(2)}>Quem cuidou de cada atendimento, farmacêutico e médico, e em que situação ele está.</motion.p>
        </div>
      </section>

      <motion.section className="day-nav card track-bar" aria-label="Farmácia e dia" {...rise(3)}>
        <Select
          className="btn-filter track-unit"
          icon={Store}
          label="Farmácia"
          value={unit}
          onChange={(v) => go({ unidade: v })}
          options={units.map((u) => ({ value: u.id, label: u.name }))}
        />
        <div className="track-day">
          <button type="button" className="day-step" onClick={() => go({ dia: shiftDay(day, -1) })} aria-label="Dia anterior">
            <ChevronLeft size={18} />
          </button>
          <div className="day-title" aria-live="polite">
            <strong>{label}</strong>
            <small>{fromDayKey(day).toLocaleDateString("pt-BR")}</small>
          </div>
          <button type="button" className="day-step" onClick={() => go({ dia: shiftDay(day, 1) })} disabled={day === today} aria-label="Dia seguinte">
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="day-tools">
          {day !== today && (
            <button type="button" className="btn btn--ghost day-today" onClick={() => go({ dia: null })}>Voltar para hoje</button>
          )}
          <label className="day-pick">
            <span className="sr-only">Ir para o dia</span>
            <input type="date" value={day} max={today} onChange={(e) => fromDayKey(e.target.value) && e.target.value <= today && go({ dia: e.target.value })} />
          </label>
        </div>
      </motion.section>

      <motion.div className="data-hidden track-note" role="note" {...rise(4)}>
        <ShieldCheck size={18} aria-hidden="true" />
        <span>Aparecem protocolo, situação e as pessoas que cuidaram do atendimento. Nome, CPF e queixa do paciente ficam só com a farmácia (LGPD). Cada consulta fica na Auditoria.</span>
      </motion.div>

      <motion.section className="pick-stats track-stats" aria-label="Resumo do dia" {...rise(5)}>
        {STATS.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`pick-stat pick-stat--${s.tone}${filter === s.key ? " is-active" : ""}`}
            aria-pressed={filter === s.key}
            onClick={() => go({ filtro: filter === s.key ? "all" : s.key })}
          >
            <span className="pick-stat-label">
              {s.key === "urgent" ? <TriangleAlert size={13} aria-hidden="true" /> : s.key === "doctor" ? <Stethoscope size={13} aria-hidden="true" /> : <i aria-hidden="true" />}
              {s.label}
            </span>
            <strong>{loading ? "–" : counts[s.key]}</strong>
          </button>
        ))}
      </motion.section>

      {state.error && !loading && (
        <div className="load-error" role="alert">
          <TriangleAlert size={18} />
          <span>{state.error}</span>
          <button type="button" className="btn btn--ghost" onClick={load}>Tentar de novo</button>
        </div>
      )}

      <SpotlightCard index={6} className={`table-card${loading ? " is-loading" : ""}`} aria-busy={loading}>
        <header className="card-head">
          <div>
            <h2>{state.data?.unitName ?? "Atendimentos"}</h2>
            <p>{label} · mais recentes primeiro. Clique para ver a linha do tempo.</p>
          </div>
        </header>
        <div className="table-scroll">
          <table className="visits track-table">
            <thead>
              <tr>
                <th>PROTOCOLO</th>
                <th>SITUAÇÃO</th>
                <th>FARMACÊUTICO(A)</th>
                <th>MÉDICO(A) · ENCAMINHAMENTO</th>
                <th aria-label="Abrir" />
              </tr>
            </thead>
            <tbody>
              {shown.map((v) => {
                const st = STATUS[v.status];
                const ref = v.referrals.at(-1);
                const rst = ref && REFERRAL_STATUS[ref.status];
                return (
                  <tr
                    key={v.id}
                    className={`visit-row${v.urgent ? " is-urgent" : ""}`}
                    tabIndex={0}
                    role="link"
                    aria-label={`Ver o atendimento ${v.protocol}`}
                    onClick={() => open(v.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        open(v.id);
                      }
                    }}
                  >
                    <td>
                      <div className="track-proto">
                        <strong className="mono">{v.protocol}</strong>
                        <small>{v.time}</small>
                      </div>
                    </td>
                    <td>
                      <div className="track-status">
                        <span className={`status status--${st.tone}`}><i />{st.label}</span>
                        {v.urgent && <span className="track-flag"><TriangleAlert size={12} /> Red Flag</span>}
                      </div>
                    </td>
                    <td>
                      <span className="track-person track-person--rt"><PillBottle size={14} aria-hidden="true" />{v.rt}</span>
                    </td>
                    <td>
                      {ref ? (
                        <div className="track-ref">
                          <span className="track-person track-person--md"><Stethoscope size={14} aria-hidden="true" />{ref.doctor}</span>
                          <span className={`status status--${rst.tone}`}><i />{rst.short}</span>
                          {v.referrals.length > 1 && <small>+{v.referrals.length - 1} anterior</small>}
                        </div>
                      ) : (
                        <span className="track-none">Sem encaminhamento a médico</span>
                      )}
                    </td>
                    <td className="ta-center"><ChevronRight size={18} className="track-go" aria-hidden="true" /></td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">
                    <SearchX size={20} />
                    <span>
                      {loading ? "Carregando atendimentos..." : q || filter !== "all" ? "Nenhum atendimento com esse filtro." : "Nenhum atendimento registrado neste dia."}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SpotlightCard>
    </main>
  );
}
