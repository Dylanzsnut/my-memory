import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'firebase-core': [
            'firebase/app',
            'firebase/app-check',
            'firebase/remote-config',
          ],
          'firebase-auth': ['firebase/auth'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});
