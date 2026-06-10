/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

function escapeNonAscii() {
  return {
    name: 'escape-non-ascii',
    generateBundle(_: any, bundle: any) {
      for (const chunk of Object.values(bundle) as any[]) {
        if (chunk.type === 'chunk' && typeof chunk.code === 'string') {
          chunk.code = chunk.code.replace(/[^\x00-\x7F]/g, (c: string) => {
            const cp = c.codePointAt(0)!;
            return cp > 0xffff
              ? `\\u{${cp.toString(16)}}`
              : `\\u${cp.toString(16).padStart(4, '0')}`;
          });
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
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
      plugins: [escapeNonAscii()],
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
