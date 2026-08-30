// vite.config.js - Place this in the root of your project
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // IMPORTANT: base must be './' so asset paths are relative.
  // Without this, Vite outputs /assets/... (absolute) which breaks
  // when Electron loads the app via file:// protocol.
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          qrcode: ['qrcode.react']
        }
      }
    }
  }
})

