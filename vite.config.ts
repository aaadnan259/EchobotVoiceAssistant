import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],

  // SECURITY: No API keys are exposed to the frontend!
  // All Gemini API calls go through /api/gemini/* endpoints
  define: {
    'process.env': {}
  },

  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    target: 'esnext',
    outDir: 'build',
  },

  server: {
    port: 3000,
    open: true,
    proxy: {
      // Proxy API requests to your Express server during development
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  },
});