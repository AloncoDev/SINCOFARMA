import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import logo from "../../assets/logo-sincofarma.webp";
import SpotlightCard from "../../components/SpotlightCard";
import { useAuth } from "../../contexts/auth";
import { rise } from "../../utils/motion";
import "../../styles/app.css";
import "./Privacidade.css";

const data = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

/**
 * Moldura das páginas públicas de texto (política de privacidade, termos de uso):
 * abrem com ou sem login, no visual das telas internas. `outra` é o link para a
 * página irmã, na barra do topo.
 */
export function PolicyPage({ crumb, title, lead, updated, updatedLabel = "Atualizada em", banner, outra, children }) {
  const { user } = useAuth();
  const back = user ? "/minha-conta" : "/login";

  return (
    <div className="dash policy-page">
      <div className="dash-main">
        <header className="topbar policy-topbar">
          <Link to={back}><img src={logo} alt="Sincofarma DF" className="policy-logo" /></Link>
          <nav className="policy-nav" aria-label="Documentos">
            {outra && <Link to={outra.to} className="policy-sibling">{outra.label}</Link>}
            <Link to={back} className="btn btn--ghost policy-back">
              <ArrowLeft size={16} aria-hidden="true" /> {user ? "Voltar para minha conta" : "Voltar para o login"}
            </Link>
          </nav>
        </header>

        <main className="dash-content">
          <section className="page-head">
            <div>
              <motion.nav className="crumbs" aria-label="Trilha" {...rise(0)}>
                <b>SINCOFARMA</b>
                <span>/</span>
                <span>{crumb}</span>
              </motion.nav>
              <motion.h1 {...rise(1)}>{title}</motion.h1>
              <motion.p className="hello" {...rise(2)}>{lead}</motion.p>
            </div>
            <motion.span className="policy-updated" {...rise(2)}>{updatedLabel} {data(updated)}</motion.span>
          </section>

          {banner && (
            <motion.div className="policy-banner" role="note" {...rise(3)}>
              {banner}
            </motion.div>
          )}

          <div className="policy-grid">{children}</div>
        </main>
      </div>
    </div>
  );
}

/** Um cartão da página: ícone, título, uma linha de resumo e o texto. */
export function PolicySection({ id, icon: Icon, title, hint, wide, index, children }) {
  return (
    <SpotlightCard index={index} id={id} className={`policy-card${wide ? " policy-card--wide" : ""}`}>
      <header className="policy-card-head">
        <span className="policy-card-icon"><Icon size={18} aria-hidden="true" /></span>
        <div>
          <h2>{title}</h2>
          <p>{hint}</p>
        </div>
      </header>
      {children}
    </SpotlightCard>
  );
}
