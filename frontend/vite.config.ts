import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// In dev the SPA runs on :5173 and proxies /api → the backend on :3000, so the
// browser sees a single origin (no CORS) and the httpOnly session cookie works
// with SameSite=Lax — mirroring the nginx reverse-proxy used in the container.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
