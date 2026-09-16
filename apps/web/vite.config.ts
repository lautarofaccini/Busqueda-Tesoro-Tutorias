import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Resolves the shared workspace package to its TypeScript source
      // so Vite and tsc follow the same module graph.
      '@busqueda-tesoro/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url)
      ),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy all /api/* and /health requests to the local Wrangler Worker.
      // This means the browser sees a single origin (localhost:5173) —
      // no CORS complexity in local dev.
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
})
