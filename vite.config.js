// vite.config.js
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      '/socket.io': {
        target: 'ws://localhost:3001',
        ws: true
      },
      '/config': {
        target: 'http://localhost:3001'
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true
  },
  publicDir: 'public',
  resolve: {
    alias: {
      'three': 'three',
      '@three/examples': path.resolve(__dirname, 'node_modules/three/examples')
    }
  },
  optimizeDeps: {
    include: [
      'three',
      'three/examples/jsm/loaders/GLTFLoader'
    ]
  }
});
