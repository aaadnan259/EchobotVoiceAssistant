import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'EchoBot Voice Assistant',
        short_name: 'EchoBot',
        description: 'AI-powered voice assistant with offline capabilities',
        theme_color: '#7c3aed',
        background_color: '#0B0D18',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
            }
          }
        ]
      }
    })
  ],

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
    rollupOptions: {
      output: {
        // Data-driven split (F15): measured with rollup-plugin-visualizer against
        // the dd07a60 baseline. @sentry/* + @sentry-internal/* and the react-markdown
        // parsing ecosystem (micromark/mdast-util/unist-util/remark-*/hast-util-*/vfile*
        // and their small shared helpers) together account for ~71% of non-app rendered
        // bytes and are the two dominant contributors to the >500kB chunk warning.
        // Splitting just these two out is sufficient to bring every chunk under the
        // threshold without regrouping react/react-dom or anything else. See
        // EchoBot_Phase6_Workstream6_Plan_2026-08-31.md §3/§13 for the measurement.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (id.includes('node_modules/@sentry')) {
            // Matches both @sentry/* and @sentry-internal/* (the latter also
            // starts with the substring "@sentry").
            return 'vendor-sentry';
          }

          const match = id.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/);
          const pkg = match ? match[1] : null;
          const isMarkdownEcosystem =
            pkg === 'react-markdown' ||
            pkg === 'property-information' ||
            pkg === 'unified' ||
            pkg === 'trough' ||
            pkg === 'bail' ||
            pkg === 'devlop' ||
            pkg === 'decode-named-character-reference' ||
            pkg === 'html-url-attributes' ||
            pkg === 'space-separated-tokens' ||
            pkg === 'comma-separated-tokens' ||
            pkg === 'estree-util-is-identifier-name' ||
            pkg === 'is-plain-obj' ||
            pkg === 'style-to-js' ||
            pkg === 'style-to-object' ||
            pkg === 'inline-style-parser' ||
            pkg === 'trim-lines' ||
            pkg === 'extend' ||
            pkg === '@ungap/structured-clone' ||
            (pkg != null &&
              (pkg.startsWith('micromark') ||
                pkg.startsWith('mdast-util') ||
                pkg.startsWith('unist-util') ||
                pkg.startsWith('remark-') ||
                pkg.startsWith('hast-util') ||
                pkg.startsWith('vfile')));

          if (isMarkdownEcosystem) {
            return 'vendor-markdown';
          }

          return undefined;
        },
      },
    },
  },

  server: {
    port: 3000,
    open: true,
    proxy: {
      // Proxy API requests to your Express server during development
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      }
    }
  },
});