import { cloneElement, useId, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Store, AlertCircle } from "lucide-react";
import { repository } from "../../data";
import { useClinic } from "../../contexts/clinic";
import { useFocusTrap, useModalBackdrop } from "../../hooks/useFocusTrap";
import { slug } from "../../utils/slug";
import { applyMask, digits, isValidCnpj, maskCnpj } from "../../utils/cpf";

const maskPhone = (v) => applyMask(v, digits(v).length > 10 ? "(##) #####-####" : "(##) ####-#####");

/** Cadastro (unit = null) ou edição de nome, metas e identificação (CNPJ, endereço, telefone) de uma farmácia. */
export default function PharmacyModal({ open, unit, taken, onClose, onSaved }) {
  return (
    <AnimatePresence>
      {open && <PharmacyDialog key={unit?.id ?? "new"} unit={unit} taken={taken} onClose={onClose} onSaved={onSaved} />}
    </AnimatePresence>
  );
}

function PharmacyDialog({ unit, taken, onClose, onSaved }) {
  const { notify } = useClinic();
  const creating = !unit;
  const [form, setForm] = useState(() => ({
    name: unit?.name ?? "",
    id: unit?.id ?? "",
    monthGoal: String(unit?.monthGoal ?? 300),
    triageGoalMin: String(unit?.triageGoalMin ?? 10),
    // vão na Declaração de Serviço Farmacêutico entregue ao paciente
    cnpj: maskCnpj(unit?.cnpj ?? ""),
    address: unit?.address ?? "",
    phone: maskPhone(unit?.phone ?? ""),
  }));
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
    const month = Number(form.monthGoal);
    const triage = Number(form.triageGoalMin);
    if (form.name.trim().length < 3) e.name = "Informe o nome da farmácia.";
    if (creating) {
      if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(form.id)) e.id = "Letras minúsculas, números e hífen (ex.: asa-sul).";
      else if (taken.includes(form.id)) e.id = "Já existe uma farmácia com este código.";
    }
    if (!Number.isInteger(month) || month < 0 || month > 100000) e.monthGoal = "Número inteiro de 0 a 100.000.";
    if (!Number.isInteger(triage) || triage < 1 || triage > 120) e.triageGoalMin = "Número inteiro de 1 a 120.";
    if (form.cnpj && !isValidCnpj(form.cnpj)) e.cnpj = "CNPJ inválido. Confira os 14 dígitos.";
    if (form.phone && ![10, 11].includes(digits(form.phone).length)) e.phone = "Telefone com DDD.";
    if (form.address.trim().length > 200) e.address = "Use no máximo 200 caracteres.";
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function submit(e) {
    e.preventDefault();
    if (!check()) return;
    const data = {
      name: form.name.trim(),
      monthGoal: Number(form.monthGoal),
      triageGoalMin: Number(form.triageGoalMin),
      cnpj: digits(form.cnpj),
      address: form.address.trim(),
      phone: digits(form.phone),
    };
    // na edição manda só o que mudou
    const change = creating ? { id: form.id, ...data } : Object.fromEntries(Object.entries(data).filter(([k, v]) => (unit[k] ?? "") !== v));
    if (!creating && !Object.keys(change).length) return onClose();
    setBusy(true);
    try {
      const result = creating ? await repository.createPharmacy(change) : await repository.updatePharmacy(unit.id, change);
      onSaved(result, creating);
      notify(creating ? `${result.name} cadastrada. Agora vincule os farmacêuticos em Usuários.` : "Farmácia atualizada.", "success");
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
        aria-labelledby="pharm-modal-title"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        noValidate
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
      >
        <header className="modal-head">
          <span className="modal-icon"><Store size={18} /></span>
          <div>
            <h2 id="pharm-modal-title" tabIndex={-1}>{creating ? "Nova farmácia" : unit.name}</h2>
            <p>{creating ? "Depois de cadastrar, vincule os farmacêuticos em Usuários." : `Código unidade:${unit.id} (não muda)`}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </header>

        <div className="modal-body">
          <Field label="NOME DA FARMÁCIA" error={errors.name}>
            <input value={form.name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Drogaria Vida — Ceilândia Norte / RA IX" autoComplete="off" />
          </Field>
          {creating && (
            <Field label="CÓDIGO" error={errors.id} hint="Liga os usuários à farmácia. Não pode ser alterado depois.">
              <input
                value={form.id}
                onChange={(e) => {
                  setIdTouched(true);
                  setForm((f) => ({ ...f, id: e.target.value.toLowerCase() }));
                }}
                className="mono"
                placeholder="ceilandia-norte"
                autoComplete="off"
              />
            </Field>
          )}
          <div className="form-grid">
            <Field label="META MENSAL (ATENDIMENTOS)" error={errors.monthGoal}>
              <input value={form.monthGoal} onChange={(e) => setForm((f) => ({ ...f, monthGoal: e.target.value.replace(/\D/g, "") }))} inputMode="numeric" />
            </Field>
            <Field label="META DE TRIAGEM (MINUTOS)" error={errors.triageGoalMin}>
              <input value={form.triageGoalMin} onChange={(e) => setForm((f) => ({ ...f, triageGoalMin: e.target.value.replace(/\D/g, "") }))} inputMode="numeric" />
            </Field>
          </div>
          <div className="form-grid">
            <Field label="CNPJ" error={errors.cnpj}>
              <input value={form.cnpj} onChange={(e) => setForm((f) => ({ ...f, cnpj: maskCnpj(e.target.value) }))} inputMode="numeric" className="mono" placeholder="00.000.000/0000-00" autoComplete="off" />
            </Field>
            <Field label="TELEFONE" error={errors.phone}>
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: maskPhone(e.target.value) }))} inputMode="numeric" type="tel" placeholder="(61) 3333-0000" autoComplete="off" />
            </Field>
          </div>
          <Field label="ENDEREÇO" error={errors.address} hint="CNPJ, telefone e endereço saem na declaração entregue ao paciente (RDC 44/2009).">
            <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} maxLength={200} placeholder="Quadra, bloco, loja, bairro, cidade" autoComplete="off" />
          </Field>
        </div>

        <footer className="modal-foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? "Salvando…" : creating ? "Cadastrar farmácia" : "Salvar"}
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
