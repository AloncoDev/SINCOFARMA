/**
 * Baixa um texto como arquivo. Gera o arquivo no próprio navegador: nada passa por outro servidor.
 */
export function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // dá tempo de o navegador começar o download antes de soltar o arquivo
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Baixa `data` como arquivo JSON legível (portabilidade, LGPD art. 18, V). */
export function downloadJson(filename, data) {
  downloadText(filename, JSON.stringify(data, null, 2), "application/json");
}

/** Baixa um CSV; o BOM faz o Excel ler os acentos em UTF-8. */
export function downloadCsv(filename, csv) {
  downloadText(filename, `\uFEFF${csv}`, "text/csv;charset=utf-8");
}

/** "sincofarma-meus-dados-2026-10-29.json" */
export const datedName = (base) => `${base}-${new Date().toISOString().slice(0, 10)}.json`;
