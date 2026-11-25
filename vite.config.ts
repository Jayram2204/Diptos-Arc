import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@diptos/contracts': path.resolve(__dirname, './packages/contracts/deployments.ts'),
      '@diptos/agent-guard': path.resolve(__dirname, './packages/agent-guard/src/index.ts'),
      '@diptos/app': path.resolve(__dirname, './apps/app/src'),
      '@diptos/docs': path.resolve(__dirname, './apps/docs/src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT || '8443', 10),
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT || '8443', 10),
  },
})
