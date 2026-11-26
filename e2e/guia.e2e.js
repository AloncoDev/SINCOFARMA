// Encaminhamento à unidade de saúde e guia: a farmácia encaminha e imprime a guia; a unidade
// de saúde localiza pelo código ou lendo o QR code (aqui, por uma foto da guia: o navegador do
// teste não tem câmera); a administração cadastra unidades de saúde.
import QRCode from "qrcode";
import { test, expect } from "@playwright/test";

async function entrar(page) {
  await page.goto("/login");
  await page.locator("#identifier").fill("CRF 12345/DF");
  await page.locator("#password").fill("12345678");
  await page.locator('button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login/);
}

test("farmácia encaminha à unidade de saúde, imprime a guia e acha pelo código", async ({ page }, info) => {
  test.skip(info.project.name !== "farmaceutico", "só a farmácia encaminha");
  await entrar(page);
  await page.goto("/atendimentos");
  await page.getByRole("button", { name: /Abrir atendimento de Maria da Silva Santos/ }).click();
  await page.getByRole("button", { name: "Encaminhar à unidade de saúde" }).click();

  const modal = page.getByRole("dialog", { name: "Encaminhar à unidade de saúde" });
  await modal.locator("#ref-unit").click();
  await page.getByRole("option", { name: /UBS 5 Taguatinga/ }).click();
  await modal.locator("#ref-reason").fill("Cefaleia recorrente há 3 semanas; avaliar com clínico geral.");
  await modal.getByRole("button", { name: "Encaminhar e gerar guia" }).click();

  // abre direto a guia para imprimir
  await expect(page).toHaveURL(/\/encaminhamentos\/[^/]+\/guia$/);
  const sheet = page.getByRole("article", { name: "Guia de encaminhamento" });
  await expect(sheet).toContainText("UBS 5 Taguatinga");
  await expect(sheet).toContainText("Dra. Ana Souza");
  await expect(sheet.getByRole("img", { name: /QR code da guia/ })).toBeVisible();
  const code = (await sheet.locator(".guia-code strong").textContent()).trim();
  expect(code).toMatch(/^ENC-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  const refUrl = page.url().replace(/\/guia$/, "");

  // localizar pelo código, digitado de qualquer jeito (pelo menu: na demonstração, recarregar apaga o encaminhamento novo)
  await page.getByRole("link", { name: "Encaminhamentos" }).first().click();
  await expect(page).toHaveURL(/\/encaminhamentos$/);
  await page.getByRole("button", { name: "Localizar guia" }).click();
  await page.locator("#guia-code").fill(code.toLowerCase().replace(/-/g, " "));
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page).toHaveURL(refUrl);
  await expect(page.getByText(`Guia ${code}`, { exact: false })).toBeVisible();
});

test("unidade de saúde lê o QR code da guia (foto) e abre o encaminhamento", async ({ page }, info) => {
  test.skip(info.project.name !== "medico", "a leitura é feita na unidade de saúde");
  await entrar(page);
  await page.goto("/encaminhamentos?status=all");
  await expect(page.getByRole("heading", { name: "Encaminhamentos da sua unidade" })).toBeVisible();
  const code = (await page.locator('tr[role="link"] .mono').first().textContent()).trim();
  expect(code).toMatch(/^ENC-/);

  // a guia impressa leva o endereço /guia/<código> no QR
  const png = await QRCode.toBuffer(`${new URL(page.url()).origin}/guia/${code}`, { margin: 2, width: 420 });
  await page.getByRole("button", { name: "Localizar guia" }).click();
  await page.getByRole("tab", { name: /Ler QR code/ }).click();
  await page.locator('.qr-scanner input[type="file"]').setInputFiles({ name: "guia.png", mimeType: "image/png", buffer: png });
  await expect(page).toHaveURL(/\/encaminhamentos\/ref-demo-\d+$/);
  await expect(page.getByText(`Guia ${code}`, { exact: false })).toBeVisible();

  // o endereço do QR também abre direto (celular ou outro leitor)
  await page.goto(`/guia/${code}`);
  await expect(page).toHaveURL(/\/encaminhamentos\/ref-demo-\d+$/);
});

test("administração cadastra unidade de saúde", async ({ page }, info) => {
  test.skip(info.project.name !== "admin", "só a administração gerencia");
  await entrar(page);
  await page.goto("/unidades-saude");
  await expect(page.getByRole("heading", { name: "Unidades de saúde" })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(5);
  await page.getByRole("button", { name: "Nova unidade" }).click();
  const modal = page.getByRole("dialog", { name: "Nova unidade de saúde" });
  await modal.getByPlaceholder("Ex.: UBS 1 Asa Sul").fill("UBS 2 Guará");
  await modal.getByRole("button", { name: "Cadastrar unidade" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(6);
  await expect(page.getByText("saude:ubs-2-guara")).toBeVisible();
});
