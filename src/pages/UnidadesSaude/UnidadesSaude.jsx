import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Hospital, Plus, Pencil, TriangleAlert, SearchX, Stethoscope, Info } from "lucide-react";
import SpotlightCard from "../../components/SpotlightCard";
import { repository } from "../../data";
import { useSearch, normalize } from "../../contexts/clinic";
import { HEALTH_KINDS } from "../../data/catalog";
import { rise, press } from "../../utils/motion";
import HealthUnitModal from "./HealthUnitModal";
import "./UnidadesSaude.css";

/** Administração: UBS, UPA, hospitais... que recebem os encaminhamentos das farmácias. */
export default function UnidadesSaude() {
  const { query } = useSearch();
  const [state, setState] = useState({ status: "loading", units: [] });
  const [editing, setEditing] = useState(null); // null fechado | "new" | unidade

  const load = useCallback(() => {
    repository.listHealthUnits().then(
      (res) => setState({ status: "ready", units: res.units }),
      (err) => setState({ status: "error", units: [], error: err.message || "Não foi possível carregar as unidades de saúde." })
    );
  }, []);
  useEffect(load, [load]);

  const q = normalize(query.trim());
  const units = state.units.filter((u) => !q || [u.name, u.id, u.region, HEALTH_KINDS[u.kind]].some((t) => normalize(t || "").includes(q)));
  const loading = state.status === "loading";
  const doctors = state.units.reduce((a, u) => a + (u.doctors?.active ?? 0), 0);

  function saved(unit, created) {
    setState((s) => ({
      ...s,
      units: (created ? [...s.units, unit] : s.units.map((u) => (u.id === unit.id ? { ...u, ...unit } : u))).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    }));
  }

  return (
    <main className="dash-content">
      <section className="page-head">
        <div>
          <motion.nav className="crumbs" aria-label="Trilha" {...rise(0)}>
            <b>SINCOFARMA</b>
            <span>/</span>
            <span>Gestão</span>
          </motion.nav>
          <motion.h1 {...rise(1)}>Unidades de saúde</motion.h1>
          <motion.p className="hello" {...rise(2)}>
            UBS, UPA e hospitais que recebem os encaminhamentos. {loading ? "" : `${state.units.length} unidades · ${doctors} médicos com acesso.`}
          </motion.p>
        </div>
        <motion.div className="page-actions" {...rise(2)}>
          <motion.button type="button" className="btn btn--primary" onClick={() => setEditing("new")} {...press}>
            <span className="btn-shine" aria-hidden="true" />
            <Plus size={16} /> Nova unidade
          </motion.button>
        </motion.div>
      </section>

      <motion.div className="data-hidden hu-note" role="note" {...rise(3)}>
        <Info size={18} aria-hidden="true" />
        <span>
          A farmácia escolhe a unidade ao encaminhar; qualquer médico ligado a ela lê e responde. Para ligar um médico,
          edite o usuário em <b>Usuários</b> e escolha a unidade de saúde.
        </span>
      </motion.div>

      {state.status === "error" && (
        <div className="load-error" role="alert">
          <TriangleAlert size={18} />
          <span>{state.error}</span>
          <button type="button" className="btn btn--ghost" onClick={load}>Tentar de novo</button>
        </div>
      )}

      <SpotlightCard index={4} className={`table-card${loading ? " is-loading" : ""}`} aria-busy={loading}>
        <div className="table-scroll">
          <table className="visits hu-table">
            <thead>
              <tr>
                <th>UNIDADE</th>
                <th>TIPO</th>
                <th>REGIÃO</th>
                <th>MÉDICOS</th>
                <th aria-label="Editar" />
              </tr>
            </thead>
            <tbody>
              {units.map((u) => {
                const noDoctor = !u.doctors?.active;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="hu-name">
                        <span className={`hu-icon hu-icon--${u.kind}`}><Hospital size={16} /></span>
                        <div>
                          <strong>{u.name}</strong>
                          <small className="mono">saude:{u.id}</small>
                        </div>
                      </div>
                    </td>
                    <td><span className={`hu-kind hu-kind--${u.kind}`}>{HEALTH_KINDS[u.kind] ?? u.kind}</span></td>
                    <td>{u.region || "—"}</td>
                    <td>
                      <span className={`hu-doctors${noDoctor ? " is-empty" : ""}`}>
                        <Stethoscope size={14} aria-hidden="true" /> {u.doctors?.active ?? 0}
                        {u.doctors?.pending > 0 && <small> +{u.doctors.pending} convite</small>}
                      </span>
                      {noDoctor && <small className="hu-warn">Sem médico: ninguém recebe os encaminhamentos</small>}
                    </td>
                    <td className="ta-center">
                      <button type="button" className="icon-btn" onClick={() => setEditing(u)} aria-label={`Editar ${u.name}`} title="Editar nome, tipo e região">
                        <Pencil size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && units.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">
                    <SearchX size={20} />
                    <span>{q ? "Nenhuma unidade encontrada para essa busca." : "Nenhuma unidade de saúde cadastrada ainda."}</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SpotlightCard>

      <HealthUnitModal open={editing !== null} unit={editing === "new" ? null : editing} taken={state.units.map((u) => u.id)} onClose={() => setEditing(null)} onSaved={saved} />
    </main>
  );
}
