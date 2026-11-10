import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Store, Plus, TriangleAlert, UsersRound, Timer, LayoutGrid, Pencil, ShieldCheck, SearchX } from "lucide-react";
import SpotlightCard from "../../components/SpotlightCard";
import { repository } from "../../data";
import { useClinic, useSearch, normalize } from "../../contexts/clinic";
import { OUTCOME_META } from "../../data/catalog";
import { monthLabel } from "../../utils/dates";
import { rise, press } from "../../utils/motion";
import PharmacyModal from "./PharmacyModal";
import "./Farmacias.css";

const nf = new Intl.NumberFormat("pt-BR");
const minutes = (m) => (m == null ? "—" : `${String(m).replace(".", ",")} min`);

/** Administração: a rede de farmácias, com metas e números agregados (nenhum dado de paciente). */
export default function Farmacias() {
  const navigate = useNavigate();
  const { chooseUnit, refreshUnits } = useClinic();
  const { query } = useSearch();
  const [state, setState] = useState({ status: "loading", units: [], month: null });
  const [editing, setEditing] = useState(null); // null fechado | "new" | farmácia

  const load = useCallback(() => {
    repository.listPharmacies().then(
      (res) => setState({ status: "ready", units: res.units, month: res.month }),
      (err) => setState({ status: "error", units: [], month: null, error: err.message || "Não foi possível carregar as farmácias." })
    );
  }, []);
  useEffect(load, [load]);

  const q = normalize(query.trim());
  const units = state.units.filter((u) => !q || normalize(u.name).includes(q) || u.id.includes(q));

  // números da rede inteira
  const net = useMemo(() => {
    const sum = (f) => state.units.reduce((acc, u) => acc + f(u), 0);
    const goal = sum((u) => u.monthGoal);
    const total = sum((u) => u.month.total);
    const timed = state.units.filter((u) => u.month.triageMinutes != null && u.month.total > 0);
    const weight = timed.reduce((a, u) => a + u.month.total, 0);
    return {
      count: state.units.length,
      total,
      goal,
      pct: goal ? Math.round((total / goal) * 100) : 0,
      today: sum((u) => u.today.total),
      people: sum((u) => u.pharmacists.active),
      pending: sum((u) => u.pharmacists.pending),
      triage: weight ? Math.round((timed.reduce((a, u) => a + u.month.triageMinutes * u.month.total, 0) / weight) * 10) / 10 : null,
    };
  }, [state.units]);

  function saved(unit, created) {
    setState((s) => ({
      ...s,
      units: (created ? [...s.units, unit] : s.units.map((u) => (u.id === unit.id ? unit : u))).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    }));
    refreshUnits();
  }

  function openDashboard(id) {
    chooseUnit(id);
    navigate("/dashboard");
  }

  const loading = state.status === "loading";
  const month = state.month ? monthLabel(new Date(`${state.month}-15T12:00:00`)) : "";

  return (
    <main className="dash-content">
      <section className="page-head">
        <div>
          <motion.nav className="crumbs" aria-label="Trilha" {...rise(0)}>
            <b>SINCOFARMA</b>
            <span>/</span>
            <span>Gestão</span>
          </motion.nav>
          <motion.h1 {...rise(1)}>Farmácias</motion.h1>
          <motion.p className="hello" {...rise(2)}>Farmácias da rede, metas e o andamento de {month || "este mês"}.</motion.p>
        </div>
        <motion.div className="page-actions" {...rise(2)}>
          <motion.button type="button" className="btn btn--primary" onClick={() => setEditing("new")} {...press}>
            <span className="btn-shine" aria-hidden="true" />
            <Plus size={16} /> Nova farmácia
          </motion.button>
        </motion.div>
      </section>

      <motion.div className="data-hidden pharm-note" role="note" {...rise(3)}>
        <ShieldCheck size={18} aria-hidden="true" />
        <span>Aqui aparecem só números. Nomes e fichas de pacientes ficam com os farmacêuticos de cada farmácia (LGPD).</span>
      </motion.div>

      <motion.section className="net-stats" aria-label="Rede" {...rise(4)}>
        <div className="net-stat">
          <span><Store size={14} /> Farmácias</span>
          <strong>{loading ? "–" : net.count}</strong>
        </div>
        <div className="net-stat">
          <span><LayoutGrid size={14} /> Atendimentos no mês</span>
          <strong>{loading ? "–" : nf.format(net.total)}</strong>
          <small>{loading ? "" : `${net.pct}% da meta da rede (${nf.format(net.goal)}) · ${nf.format(net.today)} hoje`}</small>
        </div>
        <div className="net-stat">
          <span><Timer size={14} /> Tempo médio de triagem</span>
          <strong>{loading ? "–" : minutes(net.triage)}</strong>
          <small>média ponderada pelo volume</small>
        </div>
        <div className="net-stat">
          <span><UsersRound size={14} /> Farmacêuticos</span>
          <strong>{loading ? "–" : net.people}</strong>
          <small>{!loading && net.pending ? `+ ${net.pending} aguardando o primeiro acesso` : "com acesso ativo"}</small>
        </div>
      </motion.section>

      {state.status === "error" && (
        <div className="load-error" role="alert">
          <TriangleAlert size={18} />
          <span>{state.error}</span>
          <button type="button" className="btn btn--ghost" onClick={load}>Tentar de novo</button>
        </div>
      )}

      <div className="pharm-grid" aria-busy={loading}>
        {units.map((u, i) => (
          <PharmacyCard key={u.id} unit={u} index={5 + i} onEdit={() => setEditing(u)} onDashboard={() => openDashboard(u.id)} />
        ))}
        {!loading && units.length === 0 && (
          <div className="pharm-empty">
            <SearchX size={20} />
            <span>{q ? "Nenhuma farmácia encontrada para essa busca." : "Nenhuma farmácia cadastrada ainda."}</span>
          </div>
        )}
      </div>

      <PharmacyModal
        open={editing !== null}
        unit={editing === "new" ? null : editing}
        taken={state.units.map((u) => u.id)}
        onClose={() => setEditing(null)}
        onSaved={saved}
      />
    </main>
  );
}

function PharmacyCard({ unit: u, index, onEdit, onDashboard }) {
  const pct = u.monthGoal ? Math.min(100, Math.round((u.month.total / u.monthGoal) * 100)) : 0;
  const slow = u.month.triageMinutes != null && u.month.triageMinutes > u.triageGoalMin;
  const parts = ["done", "referred", "progress"].map((k) => ({ k, n: u.month[k], ...OUTCOME_META[k] }));
  const noTeam = u.pharmacists.active === 0;
  return (
    <SpotlightCard index={Math.min(index, 12)} className="pharm-card">
      <header className="pharm-head">
        <span className="pharm-icon"><Store size={18} /></span>
        <div>
          <h2>{u.name}</h2>
          <small className="mono">unidade:{u.id}</small>
        </div>
        <button type="button" className="icon-btn" onClick={onEdit} aria-label={`Editar ${u.name}`} title="Editar nome e metas">
          <Pencil size={16} />
        </button>
      </header>

      <div className="pharm-goal">
        <div className="pharm-goal-row">
          <span>Meta do mês</span>
          <b>{nf.format(u.month.total)} / {nf.format(u.monthGoal)}</b>
        </div>
        <div className="pharm-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Meta do mês: ${pct}%`}>
          <motion.span initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }} />
        </div>
        {u.month.total > 0 && (
          <div className="pharm-split" aria-label="Desfechos do mês">
            {parts.map((p) => p.n > 0 && <i key={p.k} style={{ flexGrow: p.n, background: p.color }} title={`${p.label}: ${p.n}`} />)}
          </div>
        )}
      </div>

      <dl className="pharm-facts">
        <div>
          <dt>Hoje</dt>
          <dd>
            {u.today.total}
            {u.today.urgent > 0 && <span className="pharm-flag"><TriangleAlert size={12} /> {u.today.urgent}</span>}
          </dd>
        </div>
        <div className={slow ? "is-slow" : undefined}>
          <dt>Triagem</dt>
          <dd title={`Meta: até ${u.triageGoalMin} min`}>{minutes(u.month.triageMinutes)}<small> / {u.triageGoalMin} min</small></dd>
        </div>
        <div className={noTeam ? "is-slow" : undefined}>
          <dt>Equipe</dt>
          <dd>
            {u.pharmacists.active}
            {u.pharmacists.pending > 0 && <small> +{u.pharmacists.pending} conv.</small>}
          </dd>
        </div>
      </dl>

      <footer className="pharm-foot">
        <button type="button" className="link-arrow link-btn" onClick={onDashboard}>
          <LayoutGrid size={14} /> Ver no dashboard
        </button>
        {noTeam && <span className="pharm-warn">Sem farmacêutico ativo</span>}
      </footer>
    </SpotlightCard>
  );
}
