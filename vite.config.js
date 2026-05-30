import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  build: {
    // safari15.4: first version that supports @layer, @property, crypto.randomUUID,
    // structuredClone, and Object.hasOwn natively. Polyfills in main.jsx cover older
    // iOS; this target prevents the bundler from down-emitting in ways that break v4.
    target: ['es2020', 'safari15.4'],
  },
  server: {
    proxy: {
      '/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/yahoo/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
      },
      '/api/coingecko': {
        target: 'https://api.coingecko.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/coingecko/, ''),
      },
      '/api/brapi': {
        target: 'https://brapi.dev',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/brapi/, ''),
        headers: { 'User-Agent': 'Mozilla/5.0' },
      },
      '/api/bcb': {
        target: 'https://api.bcb.gov.br',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/bcb/, ''),
        headers: { 'Accept': 'application/json' },
      },
    },
  },
})
