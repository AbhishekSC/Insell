import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: 'dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-stream': ['stream-chat', 'stream-chat-react', '@stream-io/video-react-sdk'],
          'vendor-pdf': ['jspdf'],
          'vendor-leaflet': ['leaflet', 'react-leaflet'],
          'vendor-react': ['react', 'react-dom', 'react-router'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      // Server-rendered share pages (/p/:id, /u/:id) and dynamic sitemap (/sitemap.xml)
      // in prod Vercel rewrites these to the backend; mirror that in dev so shared links
      // resolve instead of falling through to the SPA.
      '^/(p|u)/[^/]+$': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/sitemap.xml': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
})
