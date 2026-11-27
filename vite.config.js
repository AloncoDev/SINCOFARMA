import process from 'node:process'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const PKG = /node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/]+)/
// bibliotecas carregadas sob demanda (import() no código): ficam fora do chunk "vendor",
// senão o navegador baixa tudo logo na abertura
const LAZY_PKGS = ['jsqr', 'qrcode', 'dijkstrajs']

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // com API, só o repositório real entra no pacote; sem API (demonstração), só o de exemplo
  const env = loadEnv(mode, process.cwd(), '')
  const repositorio = env.VITE_API_URL ? './src/data/apiRepository.js' : './src/data/mockRepository.js'

  return {
    plugins: [react()],
    resolve: {
      alias: { '#repositorio': fileURLToPath(new URL(repositorio, import.meta.url)) },
    },
    // buffer@4 (dependência do amazon-cognito-identity-js) usa o `global` do Node,
    // que não existe no navegador: sem isso a tela fica branca
    define: { global: 'globalThis' },
    // o backend (Python, com .venv de milhares de arquivos) não faz parte do front
    server: {
      watch: { ignored: ['**/backend/**'] },
    },
    optimizeDeps: {
      entries: ['index.html'],
    },
    build: {
      // separa bibliotecas estáveis em chunks próprios: o navegador
      // mantém o cache delas entre deploys que só mudam o código do app
      rollupOptions: {
        output: {
          manualChunks(id) {
            const m = id.match(PKG)
            if (!m) return undefined
            const pkg = m[1].replace(/\\/g, '/')
            if (['framer-motion', 'motion-dom', 'motion-utils'].includes(pkg)) return 'motion'
            if (pkg === 'lucide-react') return 'icons'
            if (['react', 'react-dom', 'scheduler', 'react-router', 'react-router-dom', 'cookie', 'set-cookie-parser'].includes(pkg)) return 'react'
            if (pkg.startsWith('@fontsource')) return undefined
            if (LAZY_PKGS.includes(pkg)) return undefined
            return 'vendor'
          },
        },
      },
    },
  }
})
