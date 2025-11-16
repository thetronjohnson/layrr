import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config for minimal injection (hover + selection only)
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../pkg/proxy/inject-react-dist-minimal',
    emptyOutDir: true,
    lib: {
      entry: 'src/minimal-inject.tsx',
      formats: ['iife'],
      name: 'LayrrMinimal',
      fileName: () => 'inject-minimal.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console logs for debugging
        passes: 2,
      },
      mangle: true,
    },
    target: 'es2015',
    cssCodeSplit: false,
  },
});
