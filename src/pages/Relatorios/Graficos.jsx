import { useState } from "react";
import { Download } from "lucide-react";
import SpotlightCard from "../../components/SpotlightCard";
import { OUTCOME_META } from "../../data/catalog";
import { daysInMonth, fromDayKey, monthKeyLabel } from "../../utils/dates";
import { num, niceMax, cumulative, projection } from "./resumo";

const ORDER = ["done", "referred", "progress"];
const ZERO = { total: 0, done: 0, referred: 0, progress: 0, urgent: 0, durSum: 0, durCount: 0 };
const pad = (n) => String(n).padStart(2, "0");

/** "Sexta-feira, 7 de novembro" */
function longDay(key) {
  const s = fromDayKey(key).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Legenda das cores (desfechos). */
export function Legend() {
  return (
    <ul className="rep-legend" aria-label="Legenda">
      {ORDER.map((k) => (
        <li key={k}>
          <i style={{ background: OUTCOME_META[k].color }} />
          {OUTCOME_META[k].label}
        </li>
      ))}
    </ul>
  );
}

/** Botão discreto de baixar CSV no cabeçalho de cada cartão. */
export function CsvButton({ onClick, label }) {
  return (
    <button type="button" className="btn btn--ghost rep-csv no-print" onClick={onClick} aria-label={label} title={label}>
      <Download size={15} /> CSV
    </button>
  );
}

/** Linha que descreve a coluna sob o mouse (ou o resumo do gráfico). */
function Readout({ item, fallback }) {
  if (!item) return <p className="rep-readout">{fallback}</p>;
  const c = item.counts;
  return (
    <p className="rep-readout" aria-live="polite">
      <b>{item.title}:</b> {num(c.total)} atendimento{c.total === 1 ? "" : "s"}
      {c.total > 0 && (
        <>
          {ORDER.map((k) => (
            <span key={k} className="rep-readout-part">
              <i style={{ background: OUTCOME_META[k].color }} />
              {num(c[k])}
            </span>
          ))}
          {c.urgent > 0 && <span className="rep-readout-flag">{num(c.urgent)} Red Flag</span>}
        </>
      )}
    </p>
  );
}

/**
 * Colunas empilhadas por desfecho. `items`: [{ key, short, title, counts, future?, today?, weekend?, selected? }].
 * `refLine`: linha tracejada (média ou meta). `onPick`: torna a coluna clicável.
 */
function Columns({ items, label, refLine, refLabel, onPick, hover, setHover, dense }) {
  const top = niceMax(Math.max(1, refLine ?? 0, ...items.map((i) => i.counts.total)));
  return (
    <div className={`rep-chart${dense ? " is-dense" : ""}`}>
      <div className="rep-grid" aria-hidden="true">
        {[top, top / 2, 0].map((t) => (
          <div key={t} className="rep-tick" style={{ "--y": t / top }}>
            <span>{num(t)}</span>
          </div>
        ))}
        {refLine > 0 && (
          <div className="rep-ref" style={{ "--y": refLine / top }}>
            <span>{refLabel}</span>
          </div>
        )}
      </div>
      <div className="rep-cols" role="group" aria-label={label} style={{ "--n": items.length }}>
        {items.map((it, idx) => {
          const cls = [
            "rep-col",
            it.future && "is-future",
            it.today && "is-today",
            it.weekend && "is-weekend",
            it.selected && "is-selected",
            it.partial && "is-partial",
            hover && hover !== it.key && "is-dim",
            onPick && "is-pickable",
          ].filter(Boolean).join(" ");
          const aria = it.future
            ? `${it.title}: ainda não aconteceu`
            : `${it.title}: ${it.counts.total} atendimentos, ${ORDER.map((k) => `${it.counts[k]} ${OUTCOME_META[k].label}`).join(", ")}, ${it.counts.urgent} Red Flag`;
          return (
            <button
              type="button"
              key={it.key}
              className={cls}
              disabled={it.future}
              aria-label={aria}
              aria-pressed={onPick ? !!it.selected : undefined}
              onMouseEnter={() => setHover(it.key)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(it.key)}
              onBlur={() => setHover(null)}
              onClick={onPick ? () => onPick(it.key) : undefined}
            >
              <span className="rep-track">
                <span className="rep-stack" style={{ "--h": it.counts.total / top, "--d": `${120 + idx * 14}ms` }}>
                  {ORDER.map((k) => it.counts[k] > 0 && <i key={k} style={{ flexGrow: it.counts[k], background: OUTCOME_META[k].color }} />)}
                </span>
              </span>
              <span className="rep-x">{it.short}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Atendimentos de cada dia do mês (dias que ainda não chegaram ficam vazios). */
export function DailyChart({ data, index, onCsv }) {
  const [hover, setHover] = useState(null);
  const byDay = new Map(data.days.map((d) => [d.day, d]));
  const items = Array.from({ length: daysInMonth(data.month) }, (_, i) => {
    const day = `${data.month}-${pad(i + 1)}`;
    const wd = fromDayKey(day).getDay();
    return {
      key: day,
      short: String(i + 1),
      title: day === data.today ? `Hoje, ${longDay(day).split(", ")[1]}` : longDay(day),
      counts: byDay.get(day) ?? ZERO,
      future: !byDay.has(day),
      today: day === data.today,
      weekend: wd === 0 || wd === 6,
    };
  });
  const total = data.days.reduce((a, d) => a + d.total, 0);
  // média dos dias fechados (hoje ainda está acontecendo)
  const closed = data.days.filter((d) => d.day < data.today);
  const avg = closed.length ? closed.reduce((a, d) => a + d.total, 0) / closed.length : 0;
  const peak = data.days.reduce((best, d) => (d.total > (best?.total ?? 0) ? d : best), null);
  const fallback = total
    ? `Média de ${num(Math.round(avg))} por dia${peak ? ` · pico de ${num(peak.total)} em ${longDay(peak.day).toLowerCase()}` : ""}.`
    : "Nenhum atendimento registrado neste mês.";

  return (
    <SpotlightCard index={index} className="rep-card rep-card--wide">
      <header className="card-head">
        <div>
          <h2>Atendimentos por dia</h2>
          <p>{monthKeyLabel(data.month)}, separados pelo desfecho. Passe o mouse num dia para ver os números.</p>
        </div>
        <div className="rep-head-tools">
          <Legend />
          <CsvButton onClick={onCsv} label="Baixar atendimentos por dia (CSV)" />
        </div>
      </header>
      <Readout item={items.find((i) => i.key === hover)} fallback={fallback} />
      <Columns
        items={items}
        label={`Atendimentos por dia em ${monthKeyLabel(data.month)}`}
        refLine={Math.round(avg)}
        refLabel={`média ${num(Math.round(avg))}`}
        hover={hover}
        setHover={setHover}
        dense
      />
    </SpotlightCard>
  );
}

/** Os 12 meses até o escolhido; clicar num mês abre o relatório dele. */
export function MonthlyChart({ data, goal, index, onPick, onCsv }) {
  const [hover, setHover] = useState(null);
  const current = data.today.slice(0, 7);
  const items = data.months.map((m) => ({
    key: m.month,
    short: monthKeyLabel(m.month, { short: true }),
    title: `${monthKeyLabel(m.month)}${m.month === current ? " (até hoje)" : ""}`,
    counts: m,
    selected: m.month === data.month,
    partial: m.month === current,
  }));
  const active = data.months.filter((m) => m.total > 0);
  const best = active.filter((m) => m.month !== current).reduce((b, m) => (m.total > (b?.total ?? 0) ? m : b), null);
  const sum = data.months.reduce((a, m) => a + m.total, 0);
  const fallback = sum
    ? `${num(sum)} atendimentos em 12 meses${best ? ` · melhor mês fechado: ${monthKeyLabel(best.month).toLowerCase()} (${num(best.total)})` : ""}.`
    : "Sem atendimentos nos últimos 12 meses.";

  return (
    <SpotlightCard index={index} className="rep-card">
      <header className="card-head">
        <div>
          <h2>Últimos 12 meses</h2>
          <p>Clique num mês para abrir o relatório dele.{goal ? " A linha tracejada é a meta mensal atual." : ""}</p>
        </div>
        <CsvButton onClick={onCsv} label="Baixar os 12 meses (CSV)" />
      </header>
      <Readout item={items.find((i) => i.key === hover)} fallback={fallback} />
      <Columns
        items={items}
        label="Atendimentos por mês"
        refLine={goal}
        refLabel={`meta ${num(goal)}`}
        onPick={onPick}
        hover={hover}
        setHover={setHover}
      />
    </SpotlightCard>
  );
}

const W = 320;
const H = 170;
const PAD = { l: 8, r: 8, t: 12, b: 8 };

/** Ritmo do mês: atendimentos acumulados contra a linha da meta. */
export function PaceCard({ data, goal, index }) {
  const n = daysInMonth(data.month);
  const acc = cumulative(data.days);
  const proj = projection(data.days, data.month, data.today);
  const isCurrent = data.today.startsWith(data.month);
  const closed = isCurrent ? data.days.filter((d) => d.day < data.today).length : n;
  const doneClosed = closed ? acc[closed - 1] : 0;
  const expected = goal ? Math.round((goal * closed) / n) : 0;
  const final = acc.at(-1) ?? 0;
  const top = niceMax(Math.max(goal, final, proj ?? 0, 1));
  const x = (i) => PAD.l + (i / n) * (W - PAD.l - PAD.r);
  const y = (v) => H - PAD.b - (v / top) * (H - PAD.t - PAD.b);
  const line = [`${x(0)},${y(0)}`, ...acc.map((v, i) => `${x(i + 1)},${y(v)}`)].join(" ");
  const area = `${line} ${x(acc.length)},${y(0)}`;

  let verdict;
  if (!goal) verdict = <>Sem meta mensal definida para {data.unit ? "esta farmácia" : "a rede"}.</>;
  else if (!isCurrent) {
    const pct = Math.round((final / goal) * 100);
    verdict = <>Fechou com <b>{num(final)}</b> de {num(goal)} ({pct}% da meta).</>;
  } else if (closed === 0) verdict = <>O mês acabou de começar.</>;
  else {
    const diff = doneClosed - expected;
    verdict = (
      <>
        Até ontem: <b>{num(doneClosed)}</b> para {num(expected)} esperados,{" "}
        <b className={diff >= 0 ? "is-good" : "is-bad"}>{diff >= 0 ? `${num(diff)} à frente` : `${num(-diff)} abaixo`}</b> da meta.
        {proj != null && <> No ritmo atual, o mês fecha perto de <b>{num(proj)}</b>.</>}
      </>
    );
  }

  return (
    <SpotlightCard index={index} className="rep-card rep-pace">
      <header className="card-head">
        <div>
          <h2>Ritmo contra a meta</h2>
          <p>Atendimentos somados dia a dia{goal ? `; meta de ${num(goal)} no mês` : ""}.</p>
        </div>
      </header>
      <svg viewBox={`0 0 ${W} ${H}`} className="rep-pace-svg" role="img" aria-label={`Acumulado do mês: ${final} atendimentos${goal ? ` para meta de ${goal}` : ""}`}>
        <defs>
          <linearGradient id="rep-pace-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--c-teal)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--c-teal)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={x(0)} x2={x(n)} y1={y(0)} y2={y(0)} className="rep-pace-base" />
        {goal > 0 && <line x1={x(0)} y1={y(0)} x2={x(n)} y2={y(goal)} className="rep-pace-goal" />}
        {proj != null && acc.length > 0 && <line x1={x(acc.length)} y1={y(final)} x2={x(n)} y2={y(proj)} className="rep-pace-proj" />}
        {acc.length > 0 && (
          <>
            <polygon points={area} fill="url(#rep-pace-fill)" />
            <polyline points={line} className="rep-pace-line" />
            <circle cx={x(acc.length)} cy={y(final)} r="4" className="rep-pace-dot" />
          </>
        )}
      </svg>
      <ul className="rep-pace-key" aria-hidden="true">
        <li><i className="k-real" />Realizado</li>
        {goal > 0 && <li><i className="k-goal" />Meta</li>}
        {proj != null && <li><i className="k-proj" />Projeção</li>}
      </ul>
      <p className="rep-pace-verdict">{verdict}</p>
    </SpotlightCard>
  );
}
