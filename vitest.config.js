import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // nos testes, o repositório é o de demonstração (igual ao build sem API)
  resolve: {
    alias: { '#repositorio': fileURLToPath(new URL('./src/data/mockRepository.js', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
