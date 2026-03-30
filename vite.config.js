import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/transcribe': { target: 'http://localhost:5000', changeOrigin: true },
      '/transcriptions': { target: 'http://localhost:5000', changeOrigin: true },
      '/csrf-token': { target: 'http://localhost:5000', changeOrigin: true },
    },
    host: 'localhost',
    port: 5173,
  },
})

