import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '../pkg/proxy/inject-react-dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        inject: resolve(__dirname, 'src/index.tsx'),
      },
      output: {
        entryFileNames: 'inject-react.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        // Inline all CSS into the JS bundle for easier injection
        inlineDynamicImports: true,
      },
    },
    // Minimize bundle size
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    // Generate sourcemaps for debugging
    sourcemap: false,
  },
  define: {
    // Define global constants
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
  },
});
