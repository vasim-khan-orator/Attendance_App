// vite.config.js - Place this in the root of your project
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',      // Allows external connections (mobile access)
    port: 5173,           // Default Vite port
    strictPort: false,    // Allows port changes
    // Enable CORS for cross-origin requests
    cors: true,
    // Proxy setup if needed for APIs
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  // Build configuration
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
