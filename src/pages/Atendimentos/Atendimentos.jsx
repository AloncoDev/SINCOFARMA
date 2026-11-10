import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Stethoscope, TriangleAlert, Info } from "lucide-react";
import VisitsTable from "../../components/VisitsTable";
import { useAuth } from "../../contexts/auth";
import { useClinic } from "../../contexts/clinic";
import { pode } from "../../services/permissoes";
import { STATUS } from "../../data/catalog";
import { countBy } from "../../data/stats";
import { dayKey, fromDayKey, shiftDay, dayLabel } from "../../utils/dates";
import { rise, press } from "../../utils/motion";
import "./Atendimentos.css";

const MotionLink = motion.create(Link);

// cartões do resumo do dia; cada um filtra a tabela
const STATS = [
  { key: "all", label: "Atendimentos", tone: "navy" },
  { key: "done", label: STATUS.done.short, tone: "green" },
  { key: "referred", label: STATUS.referred.short, tone: "amber" },
  { key: "progress", label: STATUS.progress.short, tone: "blue" },
  { key: "urgent", label: "Red Flag", tone: "red" },
];
const FILTER_KEYS = new Set(STATS.map((s) => s.key));
const NONE = [];

/** "07/11/2026" */
const shortDate = (key) => fromDayKey(key).toLocaleDateString("pt-BR");

/**
 * Atendimentos da farmácia, um dia por vez (hoje por padrão).
 * Dia e filtro ficam na URL (?dia=aaaa-mm-dd&desfecho=...): voltar e compartilhar o link funcionam.
 * Hoje usa a lista viva do dashboard; dias anteriores vêm de GET /visits?dia=.
 */
export default function Atendimentos() {
  const { user } = useAuth();
  const { visits: todayVisits, status: todayStatus, loadError, reload, unit, day, loadDay } = useClinic();
  const [params, setParams] = useSearchParams();
  const today = dayKey();
  const asked = params.get("dia");
  // dia inválido ou futuro na URL: mostra hoje
  const key = asked && fromDayKey(asked) && asked <= today ? asked : today;
  const isToday = key === today;
  const filter = FILTER_KEYS.has(params.get("desfecho")) ? params.get("desfecho") : "all";

  useEffect(() => {
    if (!isToday) loadDay(key);
  }, [key, isToday, loadDay]);

  const shown = isToday ? todayVisits : day.key === key ? day.visits : NONE;
  const loading = isToday ? todayStatus === "loading" : day.key !== key || day.status === "loading";
  const error = isToday ? (todayStatus === "error" ? loadError : null) : day.key === key && day.status === "error" ? day.error : null;
  const retry = isToday ? reload : () => loadDay(key);

  const counts = useMemo(() => {
    const c = countBy(shown);
    return { all: shown.length, ...c, urgent: shown.filter((v) => v.urgent).length };
  }, [shown]);

  /** Troca dia e/ou filtro na URL (hoje e "todos" não aparecem no link). */
  function go({ to = key, desfecho = filter } = {}) {
    const next = new URLSearchParams();
    if (to !== today) next.set("dia", to);
    if (desfecho !== "all") next.set("desfecho", desfecho);
    setParams(next, { replace: to === key });
  }

  const label = dayLabel(key);

  return (
    <main className="dash-content">
      <section className="page-head">
        <div>
          <motion.nav className="crumbs" aria-label="Trilha" {...rise(0)}>
            <b>SINCOFARMA</b>
            <span>/</span>
            <span>Atendimentos</span>
          </motion.nav>
          <motion.h1 {...rise(1)}>Atendimentos</motion.h1>
          <motion.p className="unit" {...rise(2)}>{unit}</motion.p>
        </div>
        {pode(user, "criar_triagem") && (
          <motion.div className="page-actions" {...rise(2)}>
            <MotionLink to="/nova-triagem" className="btn btn--primary" {...press}>
              <span className="btn-shine" aria-hidden="true" />
              <Stethoscope size={16} />
              + Nova Triagem
            </MotionLink>
          </motion.div>
        )}
      </section>

      <motion.section className="day-nav card" aria-label="Escolher o dia" {...rise(3)}>
        <button type="button" className="day-step" onClick={() => go({ to: shiftDay(key, -1) })} aria-label="Dia anterior">
          <ChevronLeft size={18} />
        </button>
        <div className="day-title" aria-live="polite">
          <strong>{label}</strong>
          <small>{label === "Hoje" || label === "Ontem" ? shortDate(key) : "Registros do dia"}</small>
        </div>
        <button
          type="button"
          className="day-step"
          onClick={() => go({ to: shiftDay(key, 1) })}
          disabled={isToday}
          aria-label="Dia seguinte"
        >
          <ChevronRight size={18} />
        </button>

        <div className="day-tools">
          {!isToday && (
            <button type="button" className="btn btn--ghost day-today" onClick={() => go({ to: today })}>
              Voltar para hoje
            </button>
          )}
          <label className="day-pick">
            <span className="sr-only">Ir para o dia</span>
            <input
              type="date"
              value={key}
              max={today}
              onChange={(e) => fromDayKey(e.target.value) && e.target.value <= today && go({ to: e.target.value })}
            />
          </label>
        </div>
      </motion.section>

      <motion.section className="day-stats" aria-label="Resumo do dia" {...rise(4)}>
        {STATS.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`day-stat day-stat--${s.tone}${filter === s.key ? " is-active" : ""}`}
            aria-pressed={filter === s.key}
            onClick={() => go({ desfecho: filter === s.key && s.key !== "all" ? "all" : s.key })}
          >
            <span className="day-stat-label">
              {s.key === "urgent" ? <TriangleAlert size={13} aria-hidden="true" /> : <i aria-hidden="true" />}
              {s.label}
            </span>
            <strong>{loading ? "–" : counts[s.key]}</strong>
          </button>
        ))}
      </motion.section>

      {error && (
        <div className="load-error" role="alert">
          <TriangleAlert size={18} />
          <span>{error}</span>
          <button type="button" className="btn btn--ghost" onClick={retry}>Tentar de novo</button>
        </div>
      )}

      {!isToday && day.key === key && day.truncated && (
        <div className="data-hidden day-note" role="note">
          <Info size={18} aria-hidden="true" />
          <span>Este dia tem muitos registros: aparecem os 300 mais recentes.</span>
        </div>
      )}

      <VisitsTable
        key={key}
        title={isToday ? "Atendimentos de hoje" : `Atendimentos de ${shortDate(key)}`}
        subtitle={isToday ? "Registros do dia, mais recentes primeiro" : `${label} · mais recentes primeiro`}
        visits={shown}
        filter={filter}
        onFilterChange={(f) => go({ desfecho: f })}
        loading={loading}
        emptyText={isToday ? "Nenhum atendimento registrado hoje ainda." : "Nenhum atendimento registrado neste dia."}
        delay={5}
      />
    </main>
  );
}
