import react from '@vitejs/plugin-react'
import process from 'node:process'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const djangoProxyTarget = process.env.DJANGO_PROXY_TARGET || 'http://127.0.0.1:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: djangoProxyTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
