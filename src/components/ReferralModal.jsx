import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, SquareArrowOutUpRight, AlertCircle, TriangleAlert } from "lucide-react";
import Select from "./Select";
import { repository } from "../data";
import { useClinic } from "../contexts/clinic";
import { PRIORITIES } from "../data/catalog";
import { useFocusTrap, useModalBackdrop } from "../hooks/useFocusTrap";

/** Encaminha um atendimento a um médico da rede (POST /encaminhamentos). */
export default function ReferralModal({ visit, onClose }) {
  return (
    <AnimatePresence>
      {visit && <ReferralDialog key={visit.id} visit={visit} onClose={onClose} />}
    </AnimatePresence>
  );
}

function ReferralDialog({ visit, onClose }) {
  const { notify } = useClinic();
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState(null); // null = carregando
  const [form, setForm] = useState({ doctorId: "", priority: visit.urgent ? "urgente" : "rotina", reason: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useFocusTrap(ref, true, { onClose, initialFocus: ".modal-head h2" });
  useModalBackdrop(true, ".overlay, .toasts");

  useEffect(() => {
    repository.listDoctors().then(
      (list) => setDoctors(list),
      (err) => {
        setDoctors([]);
        notify(err.message || "Não foi possível carregar os médicos.", "error");
      }
    );
  }, [notify]);

  async function submit(e) {
    e.preventDefault();
    const reason = form.reason.trim();
    const errs = {};
    if (!form.doctorId) errs.doctorId = "Escolha o médico.";
    if (reason.length < 5) errs.reason = "Explique o motivo (mínimo 5 caracteres).";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const created = await repository.createReferral({ visitId: visit.id, doctorId: form.doctorId, reason, priority: form.priority });
      notify(`Encaminhado para ${created.doctor?.name ?? "o médico"}.`, "success");
      onClose();
      navigate(`/encaminhamentos/${created.id}`);
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
            <h2 id="ref-modal-title" tabIndex={-1}>Encaminhar a médico</h2>
            <p>{visit.name} · {visit.complaint}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </header>

        <div className="modal-body">
          <div className={`field${errors.doctorId ? " has-error" : ""}`}>
            <label htmlFor="ref-doctor">MÉDICO</label>
            <Select
              className="sel--field"
              id="ref-doctor"
              value={form.doctorId}
              onChange={(v) => setForm((f) => ({ ...f, doctorId: v }))}
              placeholder={doctors === null ? "Carregando médicos…" : doctors.length ? "Escolha o médico" : "Nenhum médico cadastrado"}
              disabled={!doctors?.length}
              options={(doctors ?? []).map((d) => ({ value: d.id, label: d.name }))}
            />
            {errors.doctorId && <small className="field-error"><AlertCircle size={12} /> {errors.doctorId}</small>}
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

          <p className="ref-modal-note">
            O médico recebe uma cópia da ficha deste atendimento (com o CPF mascarado) e responde pelo painel.
          </p>
        </div>

        <footer className="modal-foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn--primary" disabled={busy || !doctors?.length}>
            {busy ? "Encaminhando…" : "Encaminhar"}
          </button>
        </footer>
      </motion.form>
    </motion.div>
  );
}
