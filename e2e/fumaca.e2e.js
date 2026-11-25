// Teste de fumaça: entra na demonstração com cada perfil e abre todas as telas
// que ele pode ver. Falha se a tela ficar em branco ou cair no "Algo deu errado",
// se houver erro no console ou se a CSP de produção (lida do vercel.json)
// bloquear alguma coisa.
import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const CSP = vercel.headers
  .flatMap((regra) => regra.headers)
  .find((h) => h.key === "Content-Security-Policy").value;

// telas de cada perfil (as mesmas do menu, ver services/permissoes.js)
const TELAS = {
  farmaceutico: ["/dashboard", "/atendimentos", "/nova-triagem", "/encaminhamentos", "/minha-conta"],
  medico: ["/encaminhamentos", "/minha-conta"],
  admin: ["/dashboard", "/atendimentos", "/farmacias", "/relatorios", "/usuarios", "/auditoria", "/privacidade-lgpd", "/minha-conta"],
};

const DEMO_SENHA = "12345678";

/** Aplica a CSP de produção a cada página e junta os erros do console. */
async function vigiar(page) {
  const erros = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") erros.push(msg.text());
  });
  page.on("pageerror", (err) => erros.push(err.message));
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    const resposta = await route.fetch();
    await route.fulfill({ response: resposta, headers: { ...resposta.headers(), "content-security-policy": CSP } });
  });
  return erros;
}

/** A tela abriu de verdade: está no endereço pedido, tem título e não caiu no erro. */
async function conferirTela(page, caminho) {
  await expect.poll(() => new URL(page.url()).pathname, { message: `continuar em ${caminho}` }).toBe(caminho);
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /Algo deu errado|Nova versão disponível/ })).toHaveCount(0);
}

async function entrar(page) {
  await page.goto("/login");
  await page.locator("#identifier").fill("CRF 12345/DF");
  await page.locator("#password").fill(DEMO_SENHA);
  await page.locator('button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login/);
}

test("telas abertas sem login: login, política de privacidade e termos de uso", async ({ page }, info) => {
  test.skip(info.project.name !== "farmaceutico", "iguais em todos os perfis");
  const erros = await vigiar(page);
  for (const caminho of ["/login", "/privacidade", "/termos"]) {
    await page.goto(caminho);
    await conferirTela(page, caminho);
  }
  expect(erros).toEqual([]);
});

test("entra e abre todas as telas do perfil", async ({ page }, info) => {
  const erros = await vigiar(page);
  await entrar(page);
  for (const caminho of TELAS[info.project.name]) {
    await test.step(caminho, async () => {
      await page.goto(caminho);
      await conferirTela(page, caminho);
    });
  }
  expect(erros).toEqual([]);
});

test("abre um encaminhamento (e, para o farmacêutico, a ficha do atendimento)", async ({ page }, info) => {
  test.skip(info.project.name === "admin", "a administração não vê encaminhamentos");
  const erros = await vigiar(page);
  await entrar(page);
  await page.goto("/encaminhamentos");
  await page.locator('tr[role="link"]').first().click();
  await expect(page).toHaveURL(/\/encaminhamentos\/[^/]+$/);
  await expect(page.locator("h1").first()).toBeVisible();

  const ficha = page.locator('a[href^="/ficha/"]');
  if (info.project.name === "farmaceutico") {
    await ficha.first().click();
    await expect(page).toHaveURL(/\/ficha\/[^/]+$/);
    await expect(page.locator("h1").first()).toBeVisible();
  } else {
    // o médico vê só o que foi encaminhado, não a ficha completa
    await expect(ficha).toHaveCount(0);
  }
  expect(erros).toEqual([]);
});

test("administração acompanha um atendimento: quem cuidou e a situação, sem o paciente", async ({ page }, info) => {
  test.skip(info.project.name !== "admin", "só a administração acompanha a rede");
  const erros = await vigiar(page);
  await entrar(page);
  // um dia útil passado da farmácia de Ceilândia (movimento gerado e estável na demonstração)
  await page.goto("/atendimentos?unidade=ceilandia-norte&filtro=doctor&dia=2026-11-03");
  await expect(page.getByRole("heading", { name: "Atendimentos da rede" })).toBeVisible();
  const linha = page.locator('tr[role="link"]').first();
  await expect(linha).toContainText(/Dr\.|Dra\./);
  await linha.click();
  await expect(page).toHaveURL(/\/atendimentos\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "Linha do tempo" })).toBeVisible();
  await expect(page.getByText("Atendimento registrado")).toBeVisible();
  await expect(page.getByText("Encaminhado a médico")).toBeVisible();
  // nada que identifique o paciente
  await expect(page.locator("main")).not.toContainText(/CPF \*|\*\*\*\./);
  expect(erros).toEqual([]);
});
