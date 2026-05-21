import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  esbuild: {
    charset: 'ascii',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/scheduler/'))
            return 'vendor-react';
          if (id.includes('node_modules/react-router') || id.includes('node_modules/@remix-run/'))
            return 'vendor-router';
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') || id.includes('node_modules/victory-vendor') || id.includes('node_modules/react-smooth'))
            return 'vendor-charts';
          if (id.includes('node_modules/@dnd-kit/'))
            return 'vendor-dnd';
          if (id.includes('node_modules/framer-motion/'))
            return 'vendor-motion';
          if (id.includes('node_modules/@react-oauth/') || id.includes('node_modules/oauth'))
            return 'vendor-auth';
          if (id.includes('node_modules/'))
            return 'vendor-misc';
        },
      },
    },
  },
});
