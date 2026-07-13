import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.js'],
    include: ['test/**/*.{test,spec}.{js,jsx}'],
    // Electron services do `require('electron')` etc. — only pure modules are unit-tested.
    exclude: ['node_modules/**', 'dist/**', 'dist-installer/**'],
  },
});
