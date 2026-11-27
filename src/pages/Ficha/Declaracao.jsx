import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer, TriangleAlert } from "lucide-react";
import { repository } from "../../data";
import { GUARDIAN_RELATIONS } from "../NovaTriagem/constants";
import { phone, brDate, age, dateTime } from "./clinico";
import "../Encaminhamentos/Guia.css";
import "./Declaracao.css";

const RELATION = Object.fromEntries(GUARDIAN_RELATIONS.map((r) => [r.value, r.label]));

const cnpj = (v) => String(v ?? "").replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
const dec = (v) => String(v).replace(".", ",");

/**
 * Parâmetros aferidos, com o valor de referência que a RDC 44/2009 manda informar.
 * Referências para adultos (Diretrizes Brasileiras de Hipertensão 2020 e OMS).
 */
const PARAMS = [
  ["Pressão arterial", (v) => v.systolic != null && v.diastolic != null && `${v.systolic}/${v.diastolic} mmHg`, "Abaixo de 120/80 mmHg (ótima); 140/90 mmHg ou mais é pressão alta"],
  ["Frequência cardíaca", (v) => v.heartRate != null && `${v.heartRate} bpm`, "60 a 100 bpm em repouso"],
  ["Saturação de oxigênio (SpO₂)", (v) => v.spo2 != null && `${v.spo2}%`, "95% ou mais"],
  ["Temperatura axilar", (v) => v.temperature != null && `${dec(v.temperature)} °C`, "35,5 a 37,4 °C; 37,8 °C ou mais é febre"],
  ["Peso", (v) => v.weightKg != null && `${dec(v.weightKg)} kg`, "—"],
  ["Altura", (v) => v.heightCm != null && `${v.heightCm} cm`, "—"],
  ["IMC", (v) => v.bmi != null && `${dec(v.bmi)} kg/m²`, "18,5 a 24,9 kg/m²"],
];

/**
 * Declaração de Serviço Farmacêutico (RDC 44/2009, art. 81 e 82): entregue ao paciente
 * depois do atendimento, em duas vias (a segunda fica arquivada na farmácia). Traz a
 * farmácia, o paciente (ou o responsável), o serviço prestado, os valores aferidos com a
 * referência, a orientação farmacêutica e o farmacêutico com o CRF. Não traz diagnóstico.
 */
export default function Declaracao() {
  const { id } = useParams();
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let alive = true;
    repository.getVisitRecord(id).then(
      (data) => alive && setState({ status: "ready", data }),
      (err) => alive && setState({ status: "error", error: err.message || "Não foi possível abrir o atendimento." })
    );
    return () => {
      alive = false;
    };
  }, [id]);

  if (state.status !== "ready") {
    return (
      <main className="dash-content">
        <Link to={`/ficha/${id}`} className="link-arrow"><ArrowLeft size={14} /> Ficha do atendimento</Link>
        {state.status === "loading" ? (
          <p className="muted">Preparando a declaração…</p>
        ) : (
          <div className="load-error" role="alert"><TriangleAlert size={18} /><span>{state.error}</span></div>
        )}
      </main>
    );
  }

  const { visit, record, pharmacy = {} } = state.data;
  const p = record.patient ?? {};
  const g = record.guardian;
  const years = age(p.birthDate);
  const measured = PARAMS.map(([label, fmt, ref]) => [label, fmt(record.vitals ?? {}), ref]).filter(([, value]) => value);
  const missing = ["cnpj", "address", "phone"].filter((k) => !pharmacy[k]);

  return (
    <main className="dash-content guia-page">
      <div className="guia-actions no-print">
        <Link to={`/ficha/${visit.id}`} className="link-arrow"><ArrowLeft size={14} /> Voltar à ficha</Link>
        <button type="button" className="btn btn--primary" onClick={() => window.print()}>
          <Printer size={16} /> Imprimir 2 vias
        </button>
      </div>
      {missing.length > 0 && (
        <p className="data-hidden guia-closed no-print" role="note">
          <TriangleAlert size={16} aria-hidden="true" /> Faltam dados da farmácia ({missing.map((k) => ({ cnpj: "CNPJ", address: "endereço", phone: "telefone" })[k]).join(", ")}).
          Peça à administração para completar em Farmácias.
        </p>
      )}

      {[1, 2].map((via) => (
        <article key={via} className={`guia-sheet decl-sheet${via === 2 ? " decl-via2" : ""}`} aria-label={`Declaração de serviço farmacêutico, ${via}ª via`}>
          <header className="guia-head">
            <div className="guia-title">
              <h1>Declaração de serviço farmacêutico</h1>
              <p>RDC Anvisa nº 44/2009 · {via === 1 ? "1ª via: paciente" : "2ª via: arquivo da farmácia"}</p>
            </div>
            <div className="guia-code">
              <span>Atendimento</span>
              <strong className="mono">{visit.protocol ?? "—"}</strong>
            </div>
          </header>

          <section className="guia-block decl-first">
            <h2>Estabelecimento</h2>
            <dl className="guia-dl guia-dl--row">
              <div><dt>Farmácia</dt><dd>{pharmacy.name ?? "—"}</dd></div>
              <div><dt>CNPJ</dt><dd className="mono">{pharmacy.cnpj ? cnpj(pharmacy.cnpj) : "—"}</dd></div>
              <div><dt>Telefone</dt><dd>{phone(pharmacy.phone) ?? "—"}</dd></div>
              <div className="decl-wide"><dt>Endereço</dt><dd>{pharmacy.address || "—"}</dd></div>
            </dl>
          </section>

          <section className="guia-block">
            <h2>Paciente</h2>
            <dl className="guia-dl guia-dl--row">
              <div><dt>Nome</dt><dd>{p.name ?? visit.name}</dd></div>
              <div><dt>CPF</dt><dd className="mono">{visit.cpf ?? "—"}</dd></div>
              <div><dt>Nascimento</dt><dd>{brDate(p.birthDate) ?? "—"}{years != null && ` (${years} anos)`}</dd></div>
              {g && <div><dt>Responsável legal</dt><dd>{g.name} ({RELATION[g.relation] ?? g.relation})</dd></div>}
            </dl>
          </section>

          <section className="guia-block">
            <h2>Serviço farmacêutico prestado</h2>
            <p className="guia-text">
              Atenção farmacêutica com acolhimento{measured.length > 0 && " e aferição de parâmetros fisiológicos"}, em {dateTime(visit.at)}.
              {record.complaint?.text && <> Motivo da procura: {record.complaint.text}.</>}
            </p>
            {measured.length > 0 && (
              <table className="decl-table">
                <thead>
                  <tr><th scope="col">Parâmetro</th><th scope="col">Valor aferido</th><th scope="col">Referência (adultos)</th></tr>
                </thead>
                <tbody>
                  {measured.map(([label, value, ref]) => (
                    <tr key={label}><th scope="row">{label}</th><td className="mono">{value}</td><td>{ref}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="guia-block">
            <h2>Orientação farmacêutica</h2>
            <p className="guia-text">{record.guidance || "Sem orientação registrada."}</p>
            {visit.status === "referred" && (
              <p className="guia-sub">Paciente encaminhado a uma unidade de saúde (ver a guia de encaminhamento).</p>
            )}
          </section>

          <footer className="guia-foot">
            <div className="decl-signs">
              <div className="guia-sign">
                <span />
                <small>{visit.rt || "—"}{visit.rtCrf && ` · CRF-DF ${visit.rtCrf}`}</small>
                <small>Assinatura e carimbo do(a) farmacêutico(a)</small>
              </div>
              {via === 2 && (
                <div className="guia-sign">
                  <span />
                  <small>Recebi a 1ª via: paciente{g ? " ou responsável legal" : ""}</small>
                </div>
              )}
            </div>
            <p>
              Os valores aferidos e a orientação acima não constituem diagnóstico. Em caso de piora ou dúvida, procure
              uma unidade de saúde.{via === 1 && " Documento com dados pessoais de saúde: guarde com você."}
            </p>
          </footer>
        </article>
      ))}
    </main>
  );
}
