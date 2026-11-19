import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 0,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://127.0.0.1:0',
        changeOrigin: true,
      },
    },
  },
});
