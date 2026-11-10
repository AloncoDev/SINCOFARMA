import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight, Store, TriangleAlert } from "lucide-react";
import SpotlightCard from "../../components/SpotlightCard";
import { monthKeyLabel, shiftMonth } from "../../utils/dates";
import { CsvButton } from "./Graficos";
import { num, pctLabel, share, triageMinutes, minLabel, growth } from "./resumo";

// coluna -> valor usado para ordenar
const SORTS = {
  name: (r) => r.name,
  total: (r) => r.total,
  goal: (r) => share(r.total, r.monthGoal) ?? -1,
  done: (r) => share(r.done, r.total) ?? -1,
  referred: (r) => share(r.referred, r.total) ?? -1,
  progress: (r) => share(r.progress, r.total) ?? -1,
  urgent: (r) => r.urgent,
  triage: (r) => triageMinutes(r) ?? Infinity,
};

const COLUMNS = [
  ["name", "FARMÁCIA"],
  ["total", "ATENDIMENTOS", "ta-right"],
  ["goal", "META", undefined, "Meta do mês"],
  ["done", "RESOLVIDOS", "ta-right"],
  ["referred", "ENCAMINH.", "ta-right", "Encaminhados SES-DF"],
  ["progress", "ACOMPANH.", "ta-right", "Acompanhamento Farmacote"],
  ["urgent", "RED FLAG", "ta-right"],
  ["triage", "TRIAGEM", "ta-right"],
];

/** Uma linha por farmácia no mês escolhido; clicar abre o relatório só dela. */
export default function TabelaFarmacias({ rows, totals, month, isCurrent, index, onPick, onCsv, filtered }) {
  const [sort, setSort] = useState({ key: "total", dir: -1 });
  const pick = SORTS[sort.key];
  const sorted = [...rows].sort((a, b) => {
    const va = pick(a);
    const vb = pick(b);
    return (typeof va === "string" ? va.localeCompare(vb, "pt-BR") : va - vb) * sort.dir;
  });
  const prevName = monthKeyLabel(shiftMonth(month, -1)).split(" ")[0].toLowerCase();

  function toggle(key) {
    setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: key === "name" || key === "triage" ? 1 : -1 }));
  }

  return (
    <SpotlightCard index={index} className="table-card rep-table-card">
      <header className="card-head">
        <div>
          <h2>Por farmácia</h2>
          <p>{monthKeyLabel(month)}{isCurrent ? " até hoje" : ""}. Clique numa farmácia para ver o relatório só dela.</p>
        </div>
        <CsvButton onClick={onCsv} label="Baixar números por farmácia (CSV)" />
      </header>
      <div className="table-scroll">
        <table className="visits rep-table">
          <thead>
            <tr>
              {COLUMNS.map(([key, label, cls, full]) => (
                <th key={key} className={cls} aria-sort={sort.key === key ? (sort.dir > 0 ? "ascending" : "descending") : undefined}>
                  <button type="button" className={`rep-sort${sort.key === key ? " is-active" : ""}`} onClick={() => toggle(key)} title={full} aria-label={full ? `Ordenar por ${full}` : undefined}>
                    {label}
                    {sort.key === key && (sort.dir > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </button>
                </th>
              ))}
              <th aria-label="Abrir" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const pct = r.monthGoal ? Math.round((r.total / r.monthGoal) * 100) : null;
              const tri = triageMinutes(r);
              const g = growth(r.total, r.previous.total);
              return (
                <tr
                  key={r.id}
                  className="visit-row"
                  tabIndex={0}
                  role="link"
                  aria-label={`Ver o relatório de ${r.name}`}
                  onClick={() => onPick(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPick(r.id);
                    }
                  }}
                >
                  <td>
                    <div className="rep-unit">
                      <span className="rep-unit-icon"><Store size={15} /></span>
                      <div>
                        <strong>{r.name}</strong>
                        <small className="mono">unidade:{r.id}</small>
                      </div>
                    </div>
                  </td>
                  <td className="ta-right">
                    <strong className="rep-num">{num(r.total)}</strong>
                    <small className="rep-sub">
                      {isCurrent || g == null ? `${prevName}: ${num(r.previous.total)}` : (
                        <span className={g >= 0 ? "is-good" : "is-bad"}>{g >= 0 ? "+" : ""}{g}% vs {prevName}</span>
                      )}
                    </small>
                  </td>
                  <td>
                    {pct == null ? <span className="rep-sub">sem meta</span> : (
                      <div className="rep-goal">
                        <span className="rep-goal-bar"><i style={{ width: `${Math.min(100, pct)}%` }} /></span>
                        <small>{pct}% de {num(r.monthGoal)}</small>
                      </div>
                    )}
                  </td>
                  <td className="ta-right">{pctLabel(r.done, r.total)}</td>
                  <td className="ta-right">{pctLabel(r.referred, r.total)}</td>
                  <td className="ta-right">{pctLabel(r.progress, r.total)}</td>
                  <td className="ta-right">
                    {r.urgent > 0 ? <span className="rep-flag"><TriangleAlert size={13} /> {num(r.urgent)}</span> : "0"}
                  </td>
                  <td className={`ta-right${tri != null && tri > r.triageGoalMin ? " rep-slow" : ""}`} title={`Meta: até ${r.triageGoalMin} min`}>
                    {minLabel(tri)}
                    <small className="rep-sub">meta {r.triageGoalMin} min</small>
                  </td>
                  <td className="ta-right"><ChevronRight size={16} className="row-chevron" /></td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="rep-empty">
                  {filtered ? "Nenhuma farmácia encontrada para essa busca." : "Nenhuma farmácia cadastrada."}
                </td>
              </tr>
            )}
          </tbody>
          {sorted.length > 1 && !filtered && (
            <tfoot>
              <tr>
                <td><strong>Rede inteira</strong></td>
                <td className="ta-right"><strong className="rep-num">{num(totals.total)}</strong></td>
                <td>{totals.monthGoal ? <small className="rep-sub">{Math.round((totals.total / totals.monthGoal) * 100)}% de {num(totals.monthGoal)}</small> : null}</td>
                <td className="ta-right">{pctLabel(totals.done, totals.total)}</td>
                <td className="ta-right">{pctLabel(totals.referred, totals.total)}</td>
                <td className="ta-right">{pctLabel(totals.progress, totals.total)}</td>
                <td className="ta-right">{num(totals.urgent)}</td>
                <td className="ta-right">{minLabel(triageMinutes(totals))}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </SpotlightCard>
  );
}

