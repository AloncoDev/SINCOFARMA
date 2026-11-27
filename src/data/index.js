// Ponto único de acesso a dados. Com VITE_API_URL definida usa a API; sem ela, o
// repositório de demonstração no navegador. O resto do app não sabe a diferença.
// "#repositorio" é escolhido no build (vite.config.js): o pacote de produção não leva
// os dados de demonstração, e a demonstração não leva o cliente da API.
import * as escolhido from "#repositorio";

export const HAS_API = Boolean(import.meta.env.VITE_API_URL);
export const repository = escolhido.apiRepository ?? escolhido.mockRepository;
