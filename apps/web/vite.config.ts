import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Force a single copy of these packages — prevents "Multiple instances of Three.js"
    // and the "R3F: Hooks can only be used within the Canvas" crash from postprocessing
    dedupe: ['three', '@react-three/fiber', '@react-three/drei', 'react', 'react-dom'],
  },
  optimizeDeps: {
    // Pre-bundle together so Vite doesn't split them across chunks
    include: [
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      '@react-three/postprocessing',
    ],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
