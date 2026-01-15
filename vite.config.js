import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  esbuild: {
    charset: 'utf8',
    legalComments: 'none',
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
  },
  server: {
    port: 5173,
    host: '127.0.0.1', // Explicitly bind to IPv4
    strictPort: false, // 포트가 사용 중이면 자동으로 다른 포트 사용
    open: false, // 브라우저 자동 열기 비활성화
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    'process.env': {},
  },
});
