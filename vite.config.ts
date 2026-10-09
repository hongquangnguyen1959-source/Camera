import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'suppress-hmr-client-error',
        transformIndexHtml: {
          order: 'pre',
          handler() {
            return [
              {
                tag: 'script',
                attrs: { type: 'text/javascript' },
                injectTo: 'head-prepend',
                children: `
                  (function() {
                    if (typeof window === 'undefined') return;
                    try {
                      var OWS = window.WebSocket;
                      if (OWS) {
                        window.WebSocket = function() {
                          var ws = new (Function.prototype.bind.apply(OWS, [null].concat(Array.prototype.slice.call(arguments))));
                          var origAEL = ws.addEventListener;
                          ws.addEventListener = function(type, fn, opt) {
                            if (type === 'close') {
                              return origAEL.call(ws, type, function(ev) {
                                try {
                                  var p = new Proxy(ev, { get: function(t, k) { return k === 'wasClean' ? true : t[k]; } });
                                  return fn.call(this, p);
                                } catch(e) { return fn.apply(this, arguments); }
                              }, opt);
                            }
                            return origAEL.apply(ws, arguments);
                          };
                          return ws;
                        };
                        window.WebSocket.prototype = OWS.prototype;
                        window.WebSocket.CONNECTING = OWS.CONNECTING;
                        window.WebSocket.OPEN = OWS.OPEN;
                        window.WebSocket.CLOSING = OWS.CLOSING;
                        window.WebSocket.CLOSED = OWS.CLOSED;
                      }
                    } catch(e){}
                    var origErr = console.error;
                    console.error = function() {
                      if (arguments.length > 0 && String(arguments[0] && (arguments[0].message || arguments[0].stack || arguments[0]) || '').indexOf('WebSocket closed without opened') !== -1) return;
                      return origErr.apply(console, arguments);
                    };
                  })();
                `,
              },
            ];
          },
        },
      },
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          id: '/',
          name: 'Dịch Camera Trực Tiếp - AR Translator',
          short_name: 'Dịch Camera',
          description: 'Ứng dụng dịch ngôn ngữ trực tiếp qua camera sang tiếng Việt tức thì.',
          theme_color: '#022c22',
          background_color: '#022c22',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
