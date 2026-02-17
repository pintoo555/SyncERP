var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
import path from 'path';
import { createLogger, defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
var apiTarget = process.env.VITE_PROXY_TARGET || process.env.API_PROXY_TARGET || 'http://localhost:4001';
var useHttps = process.env.MODE === 'https' || process.env.VITE_HTTPS === 'true';
var httpsHost = process.env.VITE_HTTPS_HOST || ''; // e.g. 192.168.50.200 for remote HTTPS
/*
 * Suppress proxy-related error logs from Vite's internal proxy handler.
 * Vite adds its own proxy.on('error') AFTER our configure() callback,
 * so both handlers fire. Our handler sends a proper JSON 503 to the client;
 * Vite's handler tries to log and send a 500 text/plain (which fails because
 * our handler already sent headers). The log line is the "[vite] http proxy error"
 * message the user sees — we suppress it here.
 */
var baseLogger = createLogger();
var customLogger = __assign(__assign({}, baseLogger), { error: function (msg, options) {
        // Swallow all proxy error + ECONNRESET log lines
        if (typeof msg === 'string' && (msg.includes('proxy error') || msg.includes('ECONNRESET'))) {
            return;
        }
        baseLogger.error(msg, options);
    } });
export default defineConfig({
    customLogger: customLogger,
    plugins: __spreadArray([react()], (useHttps ? [basicSsl(httpsHost ? { domains: [httpsHost] } : {})] : []), true),
    appType: 'spa',
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: __assign(__assign({ port: 3001, host: true }, (useHttps ? { https: {} } : {})), { proxy: {
            '/api': {
                target: apiTarget,
                changeOrigin: true,
                configure: function (proxy) {
                    proxy.on('error', function (_err, _req, res) {
                        // Return a clean JSON 503 so the client gets a parseable error
                        // instead of Vite's default 500 text/plain.
                        if (res && 'writeHead' in res && !res.headersSent) {
                            var sres = res;
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
                configure: function (proxy) {
                    proxy.on('error', function () { });
                },
            },
            '/ping': {
                target: apiTarget,
                configure: function (proxy) {
                    proxy.on('error', function () { });
                },
            },
        } }),
});
