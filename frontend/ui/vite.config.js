import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  css: {
    preprocessorOptions: {
      scss: {
        // Keep build logs clean while upstream ecosystem completes Sass API migration.
        silenceDeprecations: ['legacy-js-api']
      }
    }
  },
  define: {
    // KaTeX ESM bundle expects this compile-time replacement symbol.
    __VERSION__: JSON.stringify('0.16.34'),
    // mathjax-full falls back to `eval('require')` in browsers when missing.
    PACKAGE_VERSION: JSON.stringify('3.2.1')
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    hmr: {
      protocol: 'ws',
      host: process.env.VITE_HMR_HOST || 'localhost',
      clientPort: Number(process.env.VITE_HMR_CLIENT_PORT || 80),
      path: process.env.VITE_HMR_PATH || '/vite-hmr'
    }
  },
  optimizeDeps: {
    // Keep CJS/UMD packages pre-bundled to avoid browser-side `require` issues.
    include: ['flowise-react-json-view', 'flowise-embed-react'],
    esbuildOptions: {
      define: {
        PACKAGE_VERSION: JSON.stringify('3.2.1')
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'mui-core': ['@mui/material', '@mui/icons-material'],
          'react-flow': ['reactflow'],
          'tabler-icons': ['@tabler/icons-react']
        }
      }
    }
  }
})
