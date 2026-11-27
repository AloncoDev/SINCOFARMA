import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, SquareArrowOutUpRight, AlertCircle, TriangleAlert } from "lucide-react";
import Select from "./Select";
import { repository } from "../data";
import { useClinic } from "../contexts/clinic";
import { PRIORITIES, HEALTH_KINDS } from "../data/catalog";
import { useFocusTrap, useModalBackdrop } from "../hooks/useFocusTrap";

/** Encaminha um atendimento a uma unidade de saúde (POST /encaminhamentos) e gera a guia. */
export default function ReferralModal({ visit, onClose }) {
  return (
    <AnimatePresence>
      {visit && <ReferralDialog key={visit.id} visit={visit} onClose={onClose} />}
    </AnimatePresence>
  );
}

function ReferralDialog({ visit, onClose }) {
  const { notify, reload } = useClinic();
  const navigate = useNavigate();
  const [units, setUnits] = useState(null); // null = carregando
  const [form, setForm] = useState({ healthUnitId: "", priority: visit.urgent ? "urgente" : "rotina", reason: "", informed: false });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useFocusTrap(ref, true, { onClose, initialFocus: ".modal-head h2" });
  useModalBackdrop(true, ".overlay, .toasts");

  useEffect(() => {
    repository.listHealthUnits().then(
      (res) => setUnits(res.units),
      (err) => {
        setUnits([]);
        notify(err.message || "Não foi possível carregar as unidades de saúde.", "error");
      }
    );
  }, [notify]);

  async function submit(e) {
    e.preventDefault();
    const reason = form.reason.trim();
    const errs = {};
    if (!form.healthUnitId) errs.healthUnitId = "Escolha a unidade de saúde.";
    if (reason.length < 5) errs.reason = "Explique o motivo (mínimo 5 caracteres).";
    if (!form.informed) errs.patientInformed = "Confirme que o paciente foi informado.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const created = await repository.createReferral({
        visitId: visit.id,
        healthUnitId: form.healthUnitId,
        reason,
        priority: form.priority,
        patientInformed: form.informed,
      });
      notify(`Encaminhado para ${created.healthUnit?.name ?? "a unidade de saúde"}. Guia ${created.code} pronta para imprimir.`, "success");
      // o atendimento passou a "Encaminhado" no servidor
      reload();
      onClose();
      // abre direto a guia para imprimir e entregar ao paciente
      navigate(`/encaminhamentos/${created.id}/guia`);
    } catch (err) {
      setErrors(err.data?.details?.fields ?? {});
      notify(err.message || "Não foi possível encaminhar.", "error");
      setBusy(false);
    }
  }

  return (
    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.form
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ref-modal-title"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        noValidate
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
      >
        <header className="modal-head">
          <span className="modal-icon"><SquareArrowOutUpRight size={18} /></span>
          <div>
            <h2 id="ref-modal-title" tabIndex={-1}>Encaminhar à unidade de saúde</h2>
            <p>{visit.name} · {visit.complaint}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </header>

        <div className="modal-body">
          <div className={`field${errors.healthUnitId ? " has-error" : ""}`}>
            <label htmlFor="ref-unit">UNIDADE DE SAÚDE</label>
            <Select
              className="sel--field"
              id="ref-unit"
              value={form.healthUnitId}
              onChange={(v) => setForm((f) => ({ ...f, healthUnitId: v }))}
              placeholder={units === null ? "Carregando unidades…" : units.length ? "Escolha a UBS, UPA ou hospital" : "Nenhuma unidade cadastrada"}
              disabled={!units?.length}
              options={(units ?? []).map((u) => ({ value: u.id, label: `${HEALTH_KINDS[u.kind] ?? ""} · ${u.name}${u.region ? ` (${u.region})` : ""}` }))}
            />
            {errors.healthUnitId && <small className="field-error"><AlertCircle size={12} /> {errors.healthUnitId}</small>}
          </div>

          <fieldset className="field">
            <legend>PRIORIDADE</legend>
            <div className="segmented ref-priority">
              {Object.entries(PRIORITIES).map(([key, p]) => (
                <button
                  type="button"
                  key={key}
                  className={`seg${form.priority === key ? " is-active" : ""}${key === "urgente" ? " seg--red" : ""}`}
                  onClick={() => setForm((f) => ({ ...f, priority: key }))}
                  aria-pressed={form.priority === key}
                >
                  {form.priority === key && (
                    <motion.span layoutId="seg-ref-priority" className="seg-bg" transition={{ type: "spring", stiffness: 500, damping: 35 }} />
                  )}
                  <span className="seg-label">
                    {key === "urgente" && <TriangleAlert size={13} />}
                    {p.label}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className={`field${errors.reason ? " has-error" : ""}`}>
            <label htmlFor="ref-reason">MOTIVO DO ENCAMINHAMENTO</label>
            <textarea
              id="ref-reason"
              rows={4}
              maxLength={1000}
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="O que você observou e o que espera do médico (avaliação, exame, ajuste de tratamento…)."
              aria-invalid={!!errors.reason || undefined}
            />
            {errors.reason && <small className="field-error"><AlertCircle size={12} /> {errors.reason}</small>}
          </div>

          <div className={`field${errors.patientInformed ? " has-error" : ""}`}>
            <label className="ref-consent">
              <input
                type="checkbox"
                checked={form.informed}
                onChange={(e) => setForm((f) => ({ ...f, informed: e.target.checked }))}
                aria-invalid={!!errors.patientInformed || undefined}
              />
              <span>
                Expliquei ao paciente (ou ao responsável) para onde ele está sendo encaminhado, que a unidade de
                destino recebe a ficha deste atendimento e que qualquer unidade de saúde da rede pode consultar a guia quando ele a
                apresentar.
              </span>
            </label>
            {errors.patientInformed && <small className="field-error"><AlertCircle size={12} /> {errors.patientInformed}</small>}
          </div>

          <p className="ref-modal-note">
            Gera a guia de encaminhamento (com código e QR code) para o paciente levar. Os médicos da unidade de destino recebem uma cópia da ficha (CPF mascarado) e respondem pelo painel.
          </p>
        </div>

        <footer className="modal-foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn--primary" disabled={busy || !units?.length}>
            {busy ? "Encaminhando…" : "Encaminhar e gerar guia"}
          </button>
        </footer>
      </motion.form>
    </motion.div>
  );
}
