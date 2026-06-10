import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Backend (Flask) dev port — app.py defaults to 8050.
const BACKEND = process.env.BACKEND_URL || 'http://localhost:8050'

// https://vitejs.dev/config/
export default defineConfig({
  // Set VITE_BASE=/InvestingHub2.0/ for the GitHub Pages build; '/' locally.
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    port: 5173,
    // In dev, proxy REST + the WebSocket to Flask so the app is same-origin and
    // VITE_API_BASE / VITE_WS_URL can stay empty.
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
      '/ws': { target: BACKEND, ws: true, changeOrigin: true },
    },
  },
  // Build straight into ../docs so GitHub Pages serves the terminal.
  build: { outDir: '../docs', emptyOutDir: true },
})
