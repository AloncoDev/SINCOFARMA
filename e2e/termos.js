// Aceite dos termos de uso nos testes: a demonstração guarda o aceite no navegador.
import { readFileSync } from "node:fs";

const config = readFileSync(new URL("../src/config/app.js", import.meta.url), "utf8");
export const VERSAO_TERMOS = /atualizadosEm:\s*"([\d-]+)"/.exec(config)[1];

/** Navegador do teste com os termos já aceitos (o modal de aceite não aparece). */
export async function termosAceitos(page) {
  await page.addInitScript((version) => {
    localStorage.setItem("sinco:termos", JSON.stringify({ version, acceptedAt: new Date().toISOString() }));
  }, VERSAO_TERMOS);
}
