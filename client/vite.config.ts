import path from 'path';
import { createLogger, defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

const apiTarget = process.env.VITE_PROXY_TARGET || process.env.API_PROXY_TARGET || 'http://localhost:4001';
const useHttps = process.env.MODE === 'https' || process.env.VITE_HTTPS === 'true';
const httpsHost = process.env.VITE_HTTPS_HOST || ''; // e.g. 192.168.50.200 for remote HTTPS

/*
 * Suppress proxy-related error logs from Vite's internal proxy handler.
 * Vite adds its own proxy.on('error') AFTER our configure() callback,
 * so both handlers fire. Our handler sends a proper JSON 503 to the client;
 * Vite's handler tries to log and send a 500 text/plain (which fails because
 * our handler already sent headers). The log line is the "[vite] http proxy error"
 * message the user sees — we suppress it here.
 */
const baseLogger = createLogger();
const customLogger: ReturnType<typeof createLogger> = {
  ...baseLogger,
  error(msg, options) {
    // Swallow all proxy error + ECONNRESET log lines
    if (typeof msg === 'string' && (msg.includes('proxy error') || msg.includes('ECONNRESET'))) {
      return;
    }
    baseLogger.error(msg, options);
  },
};

export default defineConfig({
  customLogger,
  plugins: [react(), ...(useHttps ? [basicSsl(httpsHost ? { domains: [httpsHost] } : {})] : [])],
  appType: 'spa',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3001,
    host: true, // listen on 0.0.0.0 so remote PCs can connect
    ...(useHttps ? { https: {} } : {}),
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            // Return a clean JSON 503 so the client gets a parseable error
            // instead of Vite's default 500 text/plain.
            if (res && 'writeHead' in res && !res.headersSent) {
              const sres = res as import('http').ServerResponse;
              sres.writeHead(503, { 'Content-Type': 'application/json' });
              sres.end(JSON.stringify({
                success: false,
                error: 'API server is not reachable. Ensure it is running on ' + apiTarget,
              }));
            }
          });
        },
      },
      '/socket.io': {
        target: apiTarget,
        ws: true,
        configure: (proxy) => {
          proxy.on('error', () => {});
        },
      },
      '/ping': {
        target: apiTarget,
        configure: (proxy) => {
          proxy.on('error', () => {});
        },
      },
    },
  },
});
