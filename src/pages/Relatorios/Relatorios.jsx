import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowDown, ArrowUp, CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, Hospital, LayoutGrid, Printer,
  ShieldCheck, Store, Timer, TriangleAlert,
} from "lucide-react";
import Select from "../../components/Select";
import { repository } from "../../data";
import { useSearch, normalize } from "../../contexts/clinic";
import { monthKey, shiftMonth, isMonthKey, monthKeyLabel, fromDayKey } from "../../utils/dates";
import { downloadCsv } from "../../utils/download";
import { rise, press } from "../../utils/motion";
import { DailyChart, MonthlyChart, PaceCard } from "./Graficos";
import TabelaFarmacias from "./TabelaFarmacias";
import { num, pctLabel, ppChange, growth, triageMinutes, minLabel, projection, toCsv, CSV_COUNTS, csvCounts } from "./resumo";
import "./Relatorios.css";

const FIRST_MONTH = "2020-01";
const FIELDS = ["total", "done", "referred", "progress", "urgent", "durSum", "durCount"];
const sumOf = (list) => Object.fromEntries(FIELDS.map((f) => [f, list.reduce((a, c) => a + (c[f] ?? 0), 0)]));

/** Seletor de meses: os 24 mais recentes (o atual primeiro). */
function monthOptions(current) {
  return Array.from({ length: 24 }, (_, i) => {
    const value = shiftMonth(current, -i);
    return { value, label: monthKeyLabel(value) };
  });
}

/** Administração: atendimentos da rede ou de uma farmácia, por dia, mês e farmácia (só números). */
export default function Relatorios() {
  const [params, setParams] = useSearchParams();
  const { query } = useSearch();
  const current = monthKey();
  const asked = params.get("mes");
  const month = isMonthKey(asked) && asked <= current && asked >= FIRST_MONTH ? asked : current;
  const unit = params.get("farmacia") || "";
  const key = `${month}|${unit}`;

  const [state, setState] = useState({ key: null, data: null, error: null });
  const load = useCallback(() => {
    repository.report(month, unit || null).then(
      (data) => setState({ key, data, error: null }),
      (err) => setState((s) => ({ ...s, key, error: err.message || "Não foi possível carregar o relatório." }))
    );
  }, [month, unit, key]);
  useEffect(load, [load]);

  const loading = state.key !== key;
  const data = state.data;
  const error = !loading && state.error;

  function go(change) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(change)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    // o mês atual é o padrão: não precisa ficar na URL
    if (next.get("mes") === current) next.delete("mes");
    setParams(next, { replace: true });
  }

  const view = useMemo(() => {
    if (!data) return null;
    const units = new Map(data.units.map((u) => [u.id, u]));
    const rows = data.byUnit.map((r) => ({ ...units.get(r.id), ...r }));
    const cur = data.months.at(-1);
    const prev = data.months.at(-2);
    const goal = rows.reduce((a, r) => a + (r.monthGoal || 0), 0);
    const one = data.unit ? units.get(data.unit) : null;
    const slow = rows.filter((r) => {
      const t = triageMinutes(r);
      return t != null && t > r.triageGoalMin;
    }).length;
    return { units, rows, cur, prev, goal, one, slow, totals: { ...sumOf(rows), monthGoal: goal } };
  }, [data]);

  const isCurrent = month === current;
  const shownMonth = data?.month ?? month;
  const scopeName = view?.one ? view.one.name : "Rede inteira";
  const q = normalize(query.trim());
  const tableRows = view ? view.rows.filter((r) => !q || normalize(r.name).includes(q) || r.id.includes(q)) : [];

  /* ---------- CSV ---------- */
  const fileBase = `sincofarma-relatorio-${shownMonth}-${data?.unit || "rede"}`;
  function csvDays() {
    const rows = data.days.map((d) => [fromDayKey(d.day).toLocaleDateString("pt-BR"), ...csvCounts(d)]);
    downloadCsv(`${fileBase}-por-dia.csv`, toCsv(["Dia", ...CSV_COUNTS], rows));
  }
  function csvMonths() {
    const rows = data.months.map((m) => [monthKeyLabel(m.month), ...csvCounts(m)]);
    downloadCsv(`${fileBase}-12-meses.csv`, toCsv(["Mês", ...CSV_COUNTS], rows));
  }
  function csvUnits() {
    const rows = view.rows.map((r) => [r.name, r.id, ...csvCounts(r), r.monthGoal, r.triageGoalMin, r.previous.total]);
    downloadCsv(`${fileBase}-por-farmacia.csv`, toCsv(["Farmácia", "Código", ...CSV_COUNTS, "Meta do mês", "Meta de triagem (min)", "Atendimentos no mês anterior"], rows));
  }

  const unitOptions = [
    { value: "", label: `Rede inteira${data ? ` (${data.units.length} farmácias)` : ""}` },
    ...(data?.units ?? []).map((u) => ({ value: u.id, label: u.name })),
  ];

  return (
    <main className="dash-content rep-page">
      <section className="page-head">
        <div>
          <motion.nav className="crumbs" aria-label="Trilha" {...rise(0)}>
            <b>SINCOFARMA</b>
            <span>/</span>
            <span>Gestão</span>
          </motion.nav>
          <motion.h1 {...rise(1)}>Relatórios</motion.h1>
          <motion.p className="hello" {...rise(2)}>Atendimentos por dia, por mês e por farmácia, com metas e tendência.</motion.p>
        </div>
        <motion.div className="page-actions no-print" {...rise(2)}>
          <motion.button type="button" className="btn btn--ghost" onClick={() => window.print()} disabled={!data} {...press}>
            <Printer size={16} /> Imprimir
          </motion.button>
        </motion.div>
      </section>

      {/* cabeçalho que só aparece no papel */}
      <p className="print-only rep-print-head">
        Relatório Sincofarma · {monthKeyLabel(shownMonth)}{isCurrent ? " (até hoje)" : ""} · {scopeName} · emitido em {new Date().toLocaleString("pt-BR")}
      </p>

      <motion.section className="rep-bar card no-print" aria-label="Período e farmácia" {...rise(3)}>
        <div className="rep-month">
          <button type="button" className="rep-step" onClick={() => go({ mes: shiftMonth(month, -1) })} disabled={month <= FIRST_MONTH} aria-label="Mês anterior">
            <ChevronLeft size={18} />
          </button>
          <Select className="btn-filter rep-month-select" icon={CalendarDays} label="Mês" value={month} onChange={(v) => go({ mes: v })} options={monthOptions(current)} />
          <button type="button" className="rep-step" onClick={() => go({ mes: shiftMonth(month, 1) })} disabled={isCurrent} aria-label="Mês seguinte">
            <ChevronRight size={18} />
          </button>
          {isCurrent ? (
            <span className="rep-live"><i aria-hidden="true" /> Mês em andamento</span>
          ) : (
            <button type="button" className="btn btn--ghost rep-today" onClick={() => go({ mes: null })}>Voltar para o mês atual</button>
          )}
        </div>
        <Select
          className={`btn-filter rep-unit-select${unit ? " is-filtered" : ""}`}
          icon={Store}
          label="Farmácia"
          value={unit}
          onChange={(v) => go({ farmacia: v })}
          options={unitOptions}
        />
      </motion.section>

      <motion.div className="data-hidden rep-note no-print" role="note" {...rise(4)}>
        <ShieldCheck size={18} aria-hidden="true" />
        <span>Os relatórios usam só contadores (quantos atendimentos, desfechos e tempos). Nenhum nome, CPF ou ficha de paciente passa por aqui.</span>
      </motion.div>

      {error && (
        <div className="load-error" role="alert">
          <TriangleAlert size={18} />
          <span>{error}</span>
          {unit ? (
            <button type="button" className="btn btn--ghost" onClick={() => go({ farmacia: null })}>Ver a rede inteira</button>
          ) : (
            <button type="button" className="btn btn--ghost" onClick={load}>Tentar de novo</button>
          )}
        </div>
      )}

      {view && (
        <div className={`rep-body${loading ? " is-loading" : ""}`} aria-busy={loading}>
          <Kpis view={view} data={data} isCurrent={data.today.startsWith(data.month)} />

          <DailyChart key={`d-${state.key}`} data={data} index={6} onCsv={csvDays} />

          <div className="rep-row">
            <MonthlyChart key={`m-${state.key}`} data={data} goal={view.goal} index={7} onPick={(m) => go({ mes: m })} onCsv={csvMonths} />
            <PaceCard data={data} goal={view.goal} index={8} />
          </div>

          {!data.unit && (
            <TabelaFarmacias
              rows={tableRows}
              totals={view.totals}
              month={data.month}
              isCurrent={data.today.startsWith(data.month)}
              index={9}
              filtered={!!q}
              onPick={(id) => go({ farmacia: id })}
              onCsv={csvUnits}
            />
          )}
        </div>
      )}

      {!view && !error && (
        <div className="rep-skeleton" aria-busy="true">
          <span className="sr-only">Carregando relatório…</span>
          {[0, 1, 2].map((i) => <div key={i} className="rep-skel" />)}
        </div>
      )}
    </main>
  );
}

/** Variação contra o mês anterior. `better`: qual direção é boa ("up", "down" ou nenhuma). */
function Delta({ value, suffix, better, prevName }) {
  if (value == null) return null;
  const tone = value === 0 || !better ? "neutral" : (value > 0) === (better === "up") ? "good" : "bad";
  const text = `${value > 0 ? "+" : ""}${String(value).replace(".", ",")}${suffix}`;
  return (
    <span className={`rep-delta is-${tone}`} title={`Comparado a ${prevName}`}>
      {value > 0 ? <ArrowUp size={12} /> : value < 0 ? <ArrowDown size={12} /> : null}
      {text}
    </span>
  );
}

function Kpis({ view, data, isCurrent }) {
  const { cur, prev, goal, one, slow, rows } = view;
  const prevName = monthKeyLabel(prev.month).split(" ")[0].toLowerCase();
  const proj = projection(data.days, data.month, data.today);
  const triage = triageMinutes(cur);
  const triageGoal = one?.triageGoalMin;
  const pp = (k) => ppChange(cur[k], cur.total, prev[k], prev.total);

  return (
    <motion.section className="net-stats rep-kpis" aria-label="Resumo do mês" {...rise(5)}>
      <div className="net-stat">
        <span><LayoutGrid size={14} /> Atendimentos</span>
        <strong>{num(cur.total)}</strong>
        <small>
          {isCurrent
            ? proj != null
              ? `Ritmo para ~${num(proj)} no mês${goal ? ` (${Math.round((proj / goal) * 100)}% da meta)` : ""}`
              : `até hoje${goal ? ` · meta ${num(goal)}` : ""}`
            : <>{goal ? `${Math.round((cur.total / goal) * 100)}% da meta · ` : ""}<Delta value={growth(cur.total, prev.total)} suffix="%" better="up" prevName={prevName} /> vs {prevName}</>}
        </small>
      </div>
      <div className="net-stat">
        <span><ClipboardCheck size={14} /> Resolvidos no local</span>
        <strong>{pctLabel(cur.done, cur.total)}</strong>
        <small>{num(cur.done)} atendimentos <Delta value={pp("done")} suffix=" p.p." better="up" prevName={prevName} /></small>
      </div>
      <div className="net-stat">
        <span><Hospital size={14} /> Encaminhados SES-DF</span>
        <strong>{pctLabel(cur.referred, cur.total)}</strong>
        <small>{num(cur.referred)} atendimentos <Delta value={pp("referred")} suffix=" p.p." prevName={prevName} /></small>
      </div>
      <div className="net-stat">
        <span><TriangleAlert size={14} /> Red Flag</span>
        <strong>{num(cur.urgent)}</strong>
        <small>{pctLabel(cur.urgent, cur.total)} dos atendimentos <Delta value={pp("urgent")} suffix=" p.p." prevName={prevName} /></small>
      </div>
      <div className={`net-stat${triageGoal && triage > triageGoal ? " is-slow" : ""}`}>
        <span><Timer size={14} /> Triagem média</span>
        <strong>{minLabel(triage)}</strong>
        <small>
          {one
            ? `meta: até ${triageGoal} min`
            : slow
              ? `${slow} de ${rows.length} farmácia${rows.length === 1 ? "" : "s"} acima da meta`
              : "todas dentro da meta"}{" "}
          <Delta
            value={triage != null && triageMinutes(prev) != null ? Math.round((triage - triageMinutes(prev)) * 10) / 10 : null}
            suffix=" min"
            better="down"
            prevName={prevName}
          />
        </small>
      </div>
    </motion.section>
  );
}
