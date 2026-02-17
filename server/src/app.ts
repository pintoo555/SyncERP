/**
 * Synchronics Asset Management System - Backend API
 * Entry point: Express + Socket.IO server
 *
 * The server ALWAYS starts and listens, even if the DB is not yet reachable.
 * DB connections are lazy (first request triggers connect).
 */
import 'dotenv/config';

import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import path from 'path';
import { existsSync } from 'fs';

import { config } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { optionalAuth } from './middleware/auth';
import { sessionTracker } from './middleware/sessionTracker';
import { checkRevokedSession } from './middleware/checkRevokedSession';
import { branchContext } from './shared/middleware/branchContext';

import apiRoutes from './routes';
import { startScheduler } from './modules/cronJobs';
import { setupRealtime } from './realtime/setup';

const app = express();
const server = createServer(app);

// Security and parsing
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: config.corsAllowedOrigins,
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// Request logging (no passwords)
app.use(requestLogger);

// Session tracking: run optionalAuth so req.user is set, then update session store (X-Session-Id)
app.use('/api', optionalAuth);
app.use('/api', sessionTracker);
// If this request's session was revoked (signed out from another device), return 401 and clear cookie
app.use('/api', checkRevokedSession);

// Branch context: reads X-Branch-Id header and attaches to request
app.use(branchContext);

// API routes (central loader)
app.use('/api', apiRoutes);

// Connectivity check for load balancers (use /ping to avoid conflicting with SPA route /health)
app.get('/ping', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// Production: serve built client (set CLIENT_DIST to client dist path, or leave unset to skip)
const clientDist = process.env.CLIENT_DIST || (config.nodeEnv === 'production' ? path.join(__dirname, '../../client/dist') : '');
if (clientDist && existsSync(clientDist)) {
  app.use(express.static(clientDist, { fallthrough: true }));
  // Explicit SPA routes so direct /health (etc.) serve index.html (avoids 404 from static)
  app.get('/health', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Central error handler (only reached if no route or static file matched)
app.use(errorHandler);

// Socket.IO realtime
setupRealtime(server);

// Catch-all for unhandled rejections so the server never silently dies
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

const PORT = config.port;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Synchronics Asset API listening on 0.0.0.0:${PORT}`);
  console.log(`CORS origins: ${config.corsAllowedOrigins.join(', ')}`);
  console.log(`DB target: ${config.db.server} / ${config.db.database}`);
  setImmediate(() => startScheduler());
});

export { app, server };
