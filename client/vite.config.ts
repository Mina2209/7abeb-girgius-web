import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Vite dev proxy: forward all /api/* calls to the Express backend.
// Fixes 404s like: http://localhost:5173/api/auth/settings/site
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    proxy: {
      // IMPORTANT: must include the leading /api
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          router: ['react-router-dom'],
          lucide: ['lucide-react'],
          framerMotion: ['framer-motion'],
          tailwind: ['tailwindcss'],
        },
      },
    },
  },
})
