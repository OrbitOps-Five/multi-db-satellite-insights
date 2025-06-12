import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8000,
    proxy: {
      '/api': {
        target: 'http://localhost:5003',
        changeOrigin: true,
      }
    }
    // (No API proxy yet—only Cesium asset serving via public/)
  }
})
