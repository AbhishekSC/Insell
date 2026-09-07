import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      // Server-rendered share pages (/p/:id, /u/:id) — in prod Vercel
      // rewrites these to the backend; mirror that in dev so shared links
      // resolve instead of falling through to the SPA. Regex so it only
      // catches a single-segment /p/x or /u/x, not /property/... or /profile.
      '^/(p|u)/[^/]+$': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
})
