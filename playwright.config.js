// Teste de fumaça de ponta a ponta (npm run e2e): um build da demonstração por
// perfil, servido pelo `vite preview`, e o Playwright passando pelas telas.
// Os testes ficam em e2e/*.e2e.js (o nome não termina em .test/.spec para o
// Vitest não pegar).
import { defineConfig } from "@playwright/test";

const CI = !!process.env.CI;

// demonstração pura: nada de API nem Cognito, mesmo que o terminal tenha essas variáveis
const DEMO_ENV = { VITE_API_URL: "", VITE_COGNITO_REGION: "", VITE_COGNITO_CLIENT_ID: "" };

const PERFIS = [
  { name: "farmaceutico", port: 4191 },
  { name: "medico", port: 4192 },
  { name: "admin", port: 4193 },
];

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.js",
  fullyParallel: true,
  // três servidores de preview na mesma máquina: com mais navegadores por vez, o
  // preview começa a recusar conexões por excesso de carga (falso erro de rede)
  workers: CI ? 2 : 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [["github"], ["list"]] : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    // o painel é usado só no computador do balcão
    viewport: { width: 1440, height: 900 },
    // pula a animação de entrada (o logotipo aparece parado)
    reducedMotion: "reduce",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    // no CI usa o Chromium do Playwright; aqui, o Edge já instalado
    channel: CI ? undefined : "msedge",
    trace: "retain-on-failure",
  },
  projects: PERFIS.map(({ name, port }) => ({
    name,
    use: { baseURL: `http://127.0.0.1:${port}` },
  })),
  // 127.0.0.1 fixo: "localhost" tenta o IPv6 antes e às vezes demora a cair no IPv4
  webServer: PERFIS.map(({ name, port }) => ({
    command: `npx vite build --outDir dist-e2e/${name} --logLevel warn && npx vite preview --outDir dist-e2e/${name} --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}/login`,
    env: { ...DEMO_ENV, VITE_DEMO_PERFIL: name },
    reuseExistingServer: !CI,
    timeout: 120_000,
  })),
});
