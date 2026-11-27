import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileCheck2, LogOut, ExternalLink } from "lucide-react";
import { repository } from "../data";
import { TERMOS } from "../config/app";
import { useFocusTrap, useModalBackdrop } from "../hooks/useFocusTrap";

const brDate = (iso) => iso.split("-").reverse().join("/");

/**
 * Aceite dos termos de uso: no primeiro acesso e sempre que a versão (data de atualização)
 * muda. O aceite fica registrado no servidor (quem, qual versão, quando) e na auditoria.
 * Se a consulta falhar (sem conexão), não trava o painel: pergunta de novo no próximo acesso.
 */
export default function TermsGate({ userId, enabled, onLeave }) {
  const [state, setState] = useState("checking"); // checking | pending | ok
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef(null);
  const open = enabled && state === "pending";
  useFocusTrap(ref, open, { initialFocus: ".terms-gate h2" });
  useModalBackdrop(open, ".terms-overlay, .toasts");

  useEffect(() => {
    let alive = true;
    repository.getTermsAcceptance().then(
      (accepted) => alive && setState(accepted?.version === TERMOS.atualizadosEm ? "ok" : "pending"),
      () => alive && setState("ok")
    );
    return () => {
      alive = false;
    };
    // outro usuário: o layout remonta este componente (key)
  }, [userId]);

  async function accept() {
    setBusy(true);
    setError("");
    try {
      await repository.acceptTerms(TERMOS.atualizadosEm);
      setState("ok");
    } catch (err) {
      setError(err.message || "Não foi possível registrar o aceite. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="overlay terms-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            ref={ref}
            className="modal terms-gate"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="terms-title"
            aria-describedby="terms-desc"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          >
            <span className="idle-icon" aria-hidden="true"><FileCheck2 size={26} /></span>
            <h2 id="terms-title" tabIndex={-1}>Termos de uso do painel</h2>
            <p id="terms-desc">
              Os termos de uso e a política de privacidade foram atualizados em {brDate(TERMOS.atualizadosEm)}. Para
              continuar, leia e aceite. O aceite fica registrado com a data.
            </p>
            <div className="terms-links">
              <a href="/termos" target="_blank" rel="noopener noreferrer"><ExternalLink size={14} aria-hidden="true" /> Termos de uso</a>
              <a href="/privacidade" target="_blank" rel="noopener noreferrer"><ExternalLink size={14} aria-hidden="true" /> Política de privacidade</a>
            </div>
            <label className="ref-consent terms-check">
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
              <span>Li e aceito os termos de uso e a política de privacidade do Painel Clínico Sincofarma.</span>
            </label>
            {error && <p className="lgpd-error" role="alert">{error}</p>}
            <div className="idle-actions">
              <button type="button" className="btn btn--ghost" onClick={onLeave}>
                <LogOut size={16} /> Sair
              </button>
              <button type="button" className="btn btn--primary" onClick={accept} disabled={!checked || busy}>
                {busy ? "Registrando…" : "Aceitar e continuar"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
