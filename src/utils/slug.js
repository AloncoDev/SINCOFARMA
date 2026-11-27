/** "Drogaria Vida — Ceilândia Norte" -> "drogaria-vida-ceilandia-norte" (até 40 caracteres) */
export function slug(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}
