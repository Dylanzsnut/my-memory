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
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: [
            'firebase/app',
            'firebase/ai',
            'firebase/app-check',
            'firebase/firestore',
            'firebase/remote-config',
          ],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});
