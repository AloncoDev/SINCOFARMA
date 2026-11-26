import { lazy, Suspense, useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ScanSearch, AlertCircle, Hash, IdCard, QrCode, ChevronRight, SearchX, TriangleAlert } from "lucide-react";
import { repository } from "../../data";
import { REFERRAL_STATUS } from "../../data/catalog";
import { useFocusTrap, useModalBackdrop } from "../../hooks/useFocusTrap";
import { isValidCpf } from "../../utils/cpf";
import { codeFromQr, normalizeCode } from "../../utils/guia";

// a câmera e o jsQR só carregam quando alguém abre a aba do QR
const QrScanner = lazy(() => import("../../components/QrScanner"));

const TABS = [
  { key: "code", label: "Código da guia", icon: Hash },
  { key: "cpf", label: "CPF do paciente", icon: IdCard },
  { key: "qr", label: "Ler QR code", icon: QrCode },
];

/** "000.000.000-00" enquanto digita */
function maskCpf(v) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1-$2");
}

const when = (iso) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * Localiza uma guia de encaminhamento pelo código, pelo CPF (vai no corpo da requisição,
 * nunca na URL) ou lendo o QR code impresso. Achou uma só pelo código/QR: abre direto.
 */
export default function GuiaBusca({ open, onClose, onOpen }) {
  return <AnimatePresence>{open && <Dialog onClose={onClose} onOpen={onOpen} />}</AnimatePresence>;
}

function Dialog({ onClose, onOpen }) {
  const [tab, setTab] = useState("code");
  const [code, setCode] = useState("");
  const [cpf, setCpf] = useState("");
  const [error, setError] = useState("");
  const [state, setState] = useState({ status: "idle", list: [] }); // idle | busy | done | error
  const ref = useRef(null);
  useFocusTrap(ref, true, { onClose, initialFocus: ".modal-head h2" });
  useModalBackdrop(true, ".overlay, .toasts");

  const search = useCallback(
    async (query, { openSingle }) => {
      setState({ status: "busy", list: [] });
      try {
        const list = await repository.findGuides(query);
        if (openSingle && list.length === 1) {
          onClose();
          onOpen(list[0].id);
          return;
        }
        setState({ status: "done", list });
      } catch (err) {
        setState({ status: "error", list: [], error: err.message || "Não foi possível buscar a guia." });
      }
    },
    [onClose, onOpen]
  );

  function submit(e) {
    e.preventDefault();
    setError("");
    if (tab === "code") {
      const norm = normalizeCode(code);
      if (!norm) return setError("Use o código impresso na guia, no formato ENC-XXXX-XXXX.");
      setCode(norm);
      search({ code: norm }, { openSingle: true });
    } else if (tab === "cpf") {
      if (!isValidCpf(cpf)) return setError("CPF inválido. Confira os 11 dígitos.");
      search({ cpf: cpf.replace(/\D/g, "") }, { openSingle: false });
    }
  }

  // o leitor chama uma vez por QR lido
  const onQr = useCallback(
    (text) => {
      const norm = codeFromQr(text);
      if (!norm) {
        setTab("code");
        setError("O QR code lido não é de uma guia Sincofarma.");
        return;
      }
      setCode(norm);
      setTab("code");
      search({ code: norm }, { openSingle: true });
    },
    [search]
  );

  function pickTab(key) {
    setTab(key);
    setError("");
    setState({ status: "idle", list: [] });
  }

  return (
    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.form
        ref={ref}
        className="modal guia-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guia-busca-title"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        noValidate
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
      >
        <header className="modal-head">
          <span className="modal-icon"><ScanSearch size={18} /></span>
          <div>
            <h2 id="guia-busca-title" tabIndex={-1}>Localizar guia de encaminhamento</h2>
            <p>Pelo código impresso, pelo CPF do paciente ou lendo o QR code da guia.</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </header>

        <div className="modal-body">
          <div className="segmented guia-tabs" role="tablist" aria-label="Como localizar">
            {TABS.map((t) => (
              <button
                type="button"
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                className={`seg${tab === t.key ? " is-active" : ""}`}
                onClick={() => pickTab(t.key)}
              >
                {tab === t.key && <motion.span layoutId="seg-guia-tab" className="seg-bg" transition={{ type: "spring", stiffness: 500, damping: 35 }} />}
                <span className="seg-label"><t.icon size={14} /> {t.label}</span>
              </button>
            ))}
          </div>

          {tab === "code" && (
            <div className={`field${error ? " has-error" : ""}`}>
              <label htmlFor="guia-code">CÓDIGO DA GUIA</label>
              <input
                id="guia-code"
                className="mono guia-code-input"
                autoComplete="off"
                spellCheck={false}
                placeholder="ENC-XXXX-XXXX"
                value={code}
                maxLength={20}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                aria-invalid={!!error || undefined}
                // eslint-disable-next-line jsx-a11y/no-autofocus -- o modal abre para digitar o código
                autoFocus
              />
              {error && <small className="field-error"><AlertCircle size={12} /> {error}</small>}
            </div>
          )}

          {tab === "cpf" && (
            <div className={`field${error ? " has-error" : ""}`}>
              <label htmlFor="guia-cpf">CPF DO PACIENTE</label>
              <input
                id="guia-cpf"
                className="mono"
                inputMode="numeric"
                autoComplete="off"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(maskCpf(e.target.value))}
                aria-invalid={!!error || undefined}
              />
              {error && <small className="field-error"><AlertCircle size={12} /> {error}</small>}
              <small className="field-hint">Mostra as guias deste paciente. A busca fica registrada na Auditoria (sem o CPF).</small>
            </div>
          )}

          {tab === "qr" && (
            <Suspense fallback={<p className="muted">Abrindo o leitor…</p>}>
              <QrScanner onResult={onQr} />
            </Suspense>
          )}

          {state.status === "busy" && <p className="muted" role="status">Buscando…</p>}
          {state.status === "error" && (
            <p className="guia-error" role="alert"><TriangleAlert size={16} /> {state.error}</p>
          )}
          {state.status === "done" && (
            <div className="guia-results" aria-live="polite">
              {state.list.length === 0 ? (
                <p className="guia-empty"><SearchX size={18} /> Nenhuma guia encontrada.</p>
              ) : (
                <ul>
                  {state.list.map((r) => {
                    const st = REFERRAL_STATUS[r.status];
                    return (
                      <li key={r.id}>
                        <button type="button" onClick={() => { onClose(); onOpen(r.id); }}>
                          <div>
                            <strong>{r.patientName}</strong>
                            <small>
                              <span className="mono">{r.code ?? r.protocol}</span> · {when(r.createdAt)} · {r.unitName} → {r.healthUnitName ?? r.doctorName}
                            </small>
                          </div>
                          <span className={`status status--${st.tone}`}><i />{st.short}</span>
                          <ChevronRight size={16} aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        <footer className="modal-foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Fechar</button>
          {tab !== "qr" && (
            <button type="submit" className="btn btn--primary" disabled={state.status === "busy"}>
              <ScanSearch size={16} /> Buscar
            </button>
          )}
        </footer>
      </motion.form>
    </motion.div>
  );
}
