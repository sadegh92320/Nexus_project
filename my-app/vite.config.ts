import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // match anything under /api (including nested paths)
      '^/api/.*': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        ws: false,
        // Keep the path as-is (no rewrite)
        // rewrite: (path) => path,  // not needed; default
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log('[vite-proxy] →', req.url)
          })
          proxy.on('proxyRes', (proxyRes, req) => {
            console.log('[vite-proxy] ←', proxyRes.statusCode, req.url)
          })
          proxy.on('error', (err, _req) => {
            console.error('[vite-proxy] ERROR', err.message)
          })
        },
      },
    },
  },
})
