// Responsividade nas telas de PC mais comuns no balcão: notebook 1366×768 e monitores
// com o zoom do Windows ligado (125% e 150% deixam a área útil bem menor).
// Falha se o login cortar ou empurrar o botão de entrar para baixo da dobra, se algum
// campo sair do card, ou se uma tela do painel ganhar rolagem horizontal.
import { test, expect } from "@playwright/test";
import { termosAceitos } from "./termos";

// largura × altura em px CSS, já com o zoom do Windows aplicado
const TELAS_PC = [
  { nome: "1366×768", width: 1366, height: 657, deviceScaleFactor: 1 },
  { nome: "1920×1080 com 150%", width: 1280, height: 617, deviceScaleFactor: 1.5 },
  { nome: "1366×768 com 125%", width: 1093, height: 526, deviceScaleFactor: 1.25 },
];

const TELAS = {
  farmaceutico: ["/dashboard", "/atendimentos", "/nova-triagem", "/encaminhamentos", "/minha-conta"],
  medico: ["/encaminhamentos", "/minha-conta"],
  admin: ["/dashboard", "/atendimentos", "/farmacias", "/unidades-saude", "/relatorios", "/usuarios", "/auditoria", "/privacidade-lgpd", "/minha-conta"],
};

/** O que sai pela direita da janela fora de áreas com rolagem própria (tabelas). */
const vazamentos = () => {
  const W = document.documentElement.clientWidth;
  const fora = [];
  for (const el of document.querySelectorAll("main *")) {
    const b = el.getBoundingClientRect();
    if (!b.width || b.right <= W + 1) continue;
    let p = el.parentElement;
    let rolagemPropria = false;
    while (p && p !== document.body) {
      if (["auto", "scroll", "hidden", "clip"].includes(getComputedStyle(p).overflowX)) {
        rolagemPropria = true;
        break;
      }
      p = p.parentElement;
    }
    if (!rolagemPropria) fora.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} (+${Math.round(b.right - W)}px)`);
  }
  return { rolagem: document.scrollingElement.scrollWidth > W + 1, fora: [...new Set(fora)].slice(0, 5) };
};

for (const tela of TELAS_PC) {
  test.describe(tela.nome, () => {
    test.use({ viewport: { width: tela.width, height: tela.height }, deviceScaleFactor: tela.deviceScaleFactor });

    test("login cabe na tela, com os campos dentro do card", async ({ page }, info) => {
      test.skip(info.project.name !== "farmaceutico", "o login é igual em todos os perfis");
      await page.goto("/login");
      const card = await page.locator(".login-card").boundingBox();
      const caixas = await page.locator(".login-card .input-wrap, .login-card .btn-primary").evaluateAll((els) =>
        els.map((e) => ({ cls: e.className.split(" ")[0], ...e.getBoundingClientRect().toJSON() }))
      );
      for (const b of caixas) {
        expect(b.left, `${b.cls} saiu do card pela esquerda`).toBeGreaterThanOrEqual(card.x - 1);
        expect(b.right, `${b.cls} saiu do card pela direita`).toBeLessThanOrEqual(card.x + card.width + 1);
      }
      const botao = await page.locator(".login-card .btn-primary").boundingBox();
      expect(botao.y + botao.height, "botão de entrar abaixo da dobra").toBeLessThanOrEqual(tela.height);
      expect(await page.evaluate(vazamentos)).toEqual({ rolagem: false, fora: [] });
    });

    test("telas do painel sem rolagem horizontal", async ({ page }, info) => {
      await termosAceitos(page);
      await page.goto("/login");
      await page.locator("#identifier").fill("CRF 12345/DF");
      await page.locator("#password").fill("12345678");
      await page.locator('button[type="submit"]').click();
      await expect(page).not.toHaveURL(/\/login/);
      for (const caminho of TELAS[info.project.name]) {
        await page.goto(caminho);
        await expect(page.locator("h1").first()).toBeVisible();
        expect(await page.evaluate(vazamentos), caminho).toEqual({ rolagem: false, fora: [] });
      }
    });
  });
}
