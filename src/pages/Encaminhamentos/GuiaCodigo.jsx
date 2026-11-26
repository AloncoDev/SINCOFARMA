import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, SearchX, TriangleAlert } from "lucide-react";
import { repository } from "../../data";
import { normalizeCode, forgetGuide } from "../../utils/guia";

/**
 * Endereço que vai no QR code da guia (/guia/ENC-XXXX-XXXX): acha o encaminhamento pelo
 * código e abre. Quem não estava logado entra e volta para cá (ver App.jsx).
 */
export default function GuiaCodigo() {
  const { code } = useParams();
  const norm = normalizeCode(code);
  const [state, setState] = useState({ code: null, status: "loading" });

  // chegou na guia: o retorno depois do login já foi usado
  useEffect(forgetGuide, []);

  useEffect(() => {
    if (!norm) return;
    let alive = true;
    repository.findGuides({ code: norm }).then(
      (list) => alive && setState({ code: norm, status: "ready", list }),
      (err) => alive && setState({ code: norm, status: "error", error: err.message || "Não foi possível localizar a guia." })
    );
    return () => {
      alive = false;
    };
  }, [norm]);

  const ready = state.code === norm && state.status === "ready";
  if (ready && state.list.length === 1) return <Navigate to={`/encaminhamentos/${state.list[0].id}`} replace />;

  const problem = !norm
    ? "Este endereço não tem um código de guia válido."
    : state.code === norm && state.status === "error"
      ? state.error
      : ready
        ? "Nenhuma guia com este código. Confira o código impresso ou busque pelo CPF do paciente."
        : null;

  return (
    <main className="dash-content">
      <Link to="/encaminhamentos" className="link-arrow"><ArrowLeft size={14} /> Encaminhamentos</Link>
      {problem ? (
        <div className="load-error" role="alert">
          {ready ? <SearchX size={18} /> : <TriangleAlert size={18} />}
          <span>{problem}</span>
        </div>
      ) : (
        <p className="muted" role="status">Localizando a guia <b className="mono">{norm}</b>…</p>
      )}
    </main>
  );
}
