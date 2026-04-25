import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'EXPO_PUBLIC_'],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('recharts')) {
            return 'charts';
          }

          if (id.includes('@dnd-kit')) {
            return 'dnd';
          }

          if (id.includes('@supabase')) {
            return 'supabase';
          }

          if (id.includes('react-router-dom')) {
            return 'router';
          }

          if (id.includes('react-icons')) {
            return 'icons';
          }

          return undefined;
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
