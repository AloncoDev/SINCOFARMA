import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer, TriangleAlert } from "lucide-react";
import { repository } from "../../data";
import { HEALTH_KINDS, PRIORITIES, REFERRAL_STATUS } from "../../data/catalog";
import { RISK, SEX, cns, brDate, age, dateTime } from "../Ficha/clinico";
import { guideUrl } from "../../utils/guia";
import logo from "../../assets/logo-sincofarma.webp";
import "./Guia.css";

/**
 * Guia de encaminhamento para imprimir e entregar ao paciente: data, código do atendimento,
 * farmacêutico responsável, paciente (CPF mascarado), unidade de destino, prioridade, motivo,
 * risco e o QR code. Na unidade de saúde, o médico lê o QR (ou digita o código) no painel.
 */
export default function Guia() {
  const { id } = useParams();
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let alive = true;
    repository
      .getReferral(id)
      .then(async (ref) => {
        const QRCode = await import("qrcode");
        const qr = ref.code ? await QRCode.toDataURL(guideUrl(ref.code), { margin: 1, width: 360, errorCorrectionLevel: "M" }) : null;
        if (alive) setState({ status: "ready", ref, qr });
      })
      .catch((err) => alive && setState({ status: "error", error: err.message || "Não foi possível abrir a guia." }));
    return () => {
      alive = false;
    };
  }, [id]);

  if (state.status !== "ready") {
    return (
      <main className="dash-content">
        <Link to={`/encaminhamentos/${id}`} className="link-arrow"><ArrowLeft size={14} /> Encaminhamento</Link>
        {state.status === "loading" ? (
          <p className="muted">Preparando a guia…</p>
        ) : (
          <div className="load-error" role="alert"><TriangleAlert size={18} /><span>{state.error}</span></div>
        )}
      </main>
    );
  }

  const { ref: r, qr } = state;
  const p = r.patient ?? {};
  const c = r.clinical ?? {};
  const risk = RISK[c.risk];
  const years = age(p.birthDate);
  const kind = HEALTH_KINDS[r.healthUnit?.kind];
  const closed = !["sent", "read"].includes(r.status);
  // guias antigas não têm `attendedBy`: vale quem encaminhou
  const attended = r.attendedBy ?? r.from ?? {};

  return (
    <main className="dash-content guia-page">
      <div className="guia-actions no-print">
        <Link to={`/encaminhamentos/${r.id}`} className="link-arrow"><ArrowLeft size={14} /> Voltar ao encaminhamento</Link>
        <button type="button" className="btn btn--primary" onClick={() => window.print()}>
          <Printer size={16} /> Imprimir guia
        </button>
      </div>
      {closed && (
        <p className="data-hidden guia-closed no-print" role="note">
          <TriangleAlert size={16} aria-hidden="true" /> Este encaminhamento está como “{REFERRAL_STATUS[r.status].label}”. A guia continua válida para consulta.
        </p>
      )}

      <article className="guia-sheet" aria-label="Guia de encaminhamento">
        <header className="guia-head">
          <img src={logo} alt="Sincofarma DF" className="guia-logo" />
          <div className="guia-title">
            <h1>Guia de encaminhamento</h1>
            <p>Farmácia → unidade de saúde</p>
          </div>
          <div className="guia-code">
            <span>Código da guia</span>
            <strong className="mono">{r.code}</strong>
          </div>
        </header>

        <section className="guia-grid">
          <div className="guia-qr">
            {qr && <img src={qr} alt={`QR code da guia ${r.code}`} />}
            <small>Leia no painel Sincofarma: Encaminhamentos › Localizar guia</small>
          </div>

          <dl className="guia-dl">
            <div><dt>Data do encaminhamento</dt><dd>{dateTime(r.createdAt)}</dd></div>
            <div><dt>Código do atendimento</dt><dd className="mono">{r.protocol ?? "—"}</dd></div>
            <div>
              <dt>Farmacêutico(a) que atendeu</dt>
              <dd>{attended.name}{attended.crf && ` · CRF-DF ${attended.crf}`}</dd>
            </div>
            {r.from?.name && r.from.name !== attended.name && (
              <div><dt>Encaminhado por</dt><dd>{r.from.name}{r.from.crf && ` · CRF-DF ${r.from.crf}`}</dd></div>
            )}
            <div><dt>Farmácia</dt><dd>{r.unitName}</dd></div>
            <div className="guia-dest">
              <dt>Unidade de saúde de destino</dt>
              <dd>{kind && <b>{kind} · </b>}{r.healthUnit?.name ?? r.doctor?.name ?? "—"}</dd>
            </div>
            <div>
              <dt>Prioridade</dt>
              <dd className={r.priority === "urgente" ? "guia-urgent" : undefined}>
                {r.priority === "urgente" && <TriangleAlert size={14} aria-hidden="true" />} {PRIORITIES[r.priority]?.label ?? r.priority}
              </dd>
            </div>
            {risk && <div><dt>Classificação de risco</dt><dd><span className={`guia-risk guia-risk--${risk.id}`}>{risk.label}</span> {risk.hint}</dd></div>}
          </dl>
        </section>

        <section className="guia-block">
          <h2>Paciente</h2>
          <dl className="guia-dl guia-dl--row">
            <div><dt>Nome</dt><dd>{p.name}</dd></div>
            <div><dt>CPF</dt><dd className="mono">{p.cpf ?? "—"}</dd></div>
            <div><dt>Nascimento</dt><dd>{brDate(p.birthDate) ?? "—"}{years != null && ` (${years} anos)`}</dd></div>
            <div><dt>Sexo</dt><dd>{SEX[p.sex] ?? "—"}</dd></div>
            {p.cns && <div><dt>Cartão SUS</dt><dd className="mono">{cns(p.cns)}</dd></div>}
            {p.guardian && <div><dt>Responsável legal</dt><dd>{p.guardian.name}</dd></div>}
          </dl>
        </section>

        <section className="guia-block">
          <h2>Motivo do encaminhamento</h2>
          <p className="guia-text">{r.reason}</p>
          {c.complaint?.text && <p className="guia-sub"><b>Queixa principal:</b> {c.complaint.text}</p>}
          {c.redFlags?.length > 0 && <p className="guia-sub guia-urgent"><b>Sinais de alerta:</b> {c.redFlags.join(", ")}</p>}
        </section>

        <footer className="guia-foot">
          <div className="guia-sign">
            <span />
            <small>{attended.name}{attended.crf && ` · CRF-DF ${attended.crf}`}</small>
            <small>Assinatura e carimbo do(a) farmacêutico(a)</small>
          </div>
          <p>
            Para a unidade de saúde: leia o QR code ou digite o código <b className="mono">{r.code}</b> no painel
            Sincofarma para ver a ficha enviada pela farmácia; a unidade de destino registra a resposta. Para o paciente:
            qualquer unidade de saúde da rede pode consultar esta guia quando você a apresentar. Documento com dados
            pessoais de saúde: guarde com você e não deixe à vista.
          </p>
        </footer>
      </article>
    </main>
  );
}
