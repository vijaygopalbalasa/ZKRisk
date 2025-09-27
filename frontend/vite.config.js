import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    port: 5173,
    host: true
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html'
      }
    }
  },
  define: {
    global: 'globalThis',
    'process.env': {}
  },
  resolve: {
    alias: {
      process: 'process/browser',
      buffer: 'buffer'
    }
  },
  optimizeDeps: {
    include: ['buffer', 'process', 'ethers']
  }
})