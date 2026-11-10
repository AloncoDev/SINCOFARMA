/** Itens da ficha em etiquetas (alergias, comorbidades...), ou "Nenhum registrado". */
export default function List({ items }) {
  return items?.length ? <ul className="ficha-list">{items.map((i) => <li key={i}>{i}</li>)}</ul> : <span className="muted">Nenhum registrado</span>;
}
