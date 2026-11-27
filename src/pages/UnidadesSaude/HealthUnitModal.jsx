import { cloneElement, useId, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Hospital, AlertCircle } from "lucide-react";
import Select from "../../components/Select";
import { repository } from "../../data";
import { useClinic } from "../../contexts/clinic";
import { HEALTH_KINDS } from "../../data/catalog";
import { useFocusTrap, useModalBackdrop } from "../../hooks/useFocusTrap";
import { slug } from "../../utils/slug";

/** Cadastro (unit = null) ou edição de nome, tipo e região de uma unidade de saúde. */
export default function HealthUnitModal({ open, unit, taken, onClose, onSaved }) {
  return (
    <AnimatePresence>
      {open && <Dialog key={unit?.id ?? "new"} unit={unit} taken={taken} onClose={onClose} onSaved={onSaved} />}
    </AnimatePresence>
  );
}

function Dialog({ unit, taken, onClose, onSaved }) {
  const { notify } = useClinic();
  const creating = !unit;
  const [form, setForm] = useState(() => ({ name: unit?.name ?? "", id: unit?.id ?? "", kind: unit?.kind ?? "ubs", region: unit?.region ?? "" }));
  // o código acompanha o nome até a pessoa mexer nele
  const [idTouched, setIdTouched] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useFocusTrap(ref, true, { onClose, initialFocus: ".modal-head h2" });
  useModalBackdrop(true, ".overlay, .toasts");

  function setName(name) {
    setForm((f) => ({ ...f, name, ...(creating && !idTouched ? { id: slug(name) } : {}) }));
  }

  function check() {
    const e = {};
    if (form.name.trim().length < 3) e.name = "Informe o nome da unidade.";
    if (creating) {
      if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(form.id)) e.id = "Letras minúsculas, números e hífen (ex.: ubs-1-asa-sul).";
      else if (taken.includes(form.id)) e.id = "Já existe uma unidade com este código.";
    }
    if (!HEALTH_KINDS[form.kind]) e.kind = "Escolha o tipo.";
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function submit(e) {
    e.preventDefault();
    if (!check()) return;
    const data = { name: form.name.trim(), kind: form.kind, region: form.region.trim() };
    // na edição manda só o que mudou
    const change = creating ? { id: form.id, ...data } : Object.fromEntries(Object.entries(data).filter(([k, v]) => (unit[k] ?? "") !== v));
    if (!creating && !Object.keys(change).length) return onClose();
    setBusy(true);
    try {
      const result = creating ? await repository.createHealthUnit(change) : await repository.updateHealthUnit(unit.id, change);
      onSaved(result, creating);
      notify(creating ? `${result.name} cadastrada. Agora vincule os médicos em Usuários.` : "Unidade atualizada.", "success");
      onClose();
    } catch (err) {
      setErrors(err.data?.details?.fields ?? {});
      notify(err.message || "Não foi possível salvar.", "error");
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
        aria-labelledby="health-modal-title"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        noValidate
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
      >
        <header className="modal-head">
          <span className="modal-icon"><Hospital size={18} /></span>
          <div>
            <h2 id="health-modal-title" tabIndex={-1}>{creating ? "Nova unidade de saúde" : unit.name}</h2>
            <p>{creating ? "Depois de cadastrar, vincule os médicos em Usuários." : `Código saude:${unit.id} (não muda)`}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </header>

        <div className="modal-body">
          <Field label="NOME DA UNIDADE" error={errors.name}>
            <input value={form.name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: UBS 1 Asa Sul" autoComplete="off" />
          </Field>
          {creating && (
            <Field label="CÓDIGO" error={errors.id} hint="Liga os médicos à unidade. Não pode ser alterado depois.">
              <input
                value={form.id}
                onChange={(e) => {
                  setIdTouched(true);
                  setForm((f) => ({ ...f, id: e.target.value.toLowerCase() }));
                }}
                className="mono"
                placeholder="ubs-1-asa-sul"
                autoComplete="off"
              />
            </Field>
          )}
          <div className="form-grid">
            <div className={`field${errors.kind ? " has-error" : ""}`}>
              <label htmlFor="health-kind">TIPO</label>
              <Select
                className="sel--field"
                id="health-kind"
                value={form.kind}
                onChange={(v) => setForm((f) => ({ ...f, kind: v }))}
                options={Object.entries(HEALTH_KINDS).map(([value, label]) => ({ value, label }))}
              />
              {errors.kind && <small className="field-error"><AlertCircle size={12} /> {errors.kind}</small>}
            </div>
            <Field label="REGIÃO (OPCIONAL)" error={errors.region}>
              <input value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} placeholder="Ex.: Asa Sul / RA I" autoComplete="off" maxLength={80} />
            </Field>
          </div>
        </div>

        <footer className="modal-foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? "Salvando…" : creating ? "Cadastrar unidade" : "Salvar"}
          </button>
        </footer>
      </motion.form>
    </motion.div>
  );
}

function Field({ label, error, hint, children }) {
  const id = useId();
  return (
    <div className={`field${error ? " has-error" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id, "aria-invalid": !!error || undefined })}
      {error ? (
        <small className="field-error"><AlertCircle size={12} /> {error}</small>
      ) : (
        hint && <small className="field-hint">{hint}</small>
      )}
    </div>
  );
}
