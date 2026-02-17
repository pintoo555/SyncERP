import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../../config/env';
import { requireAuth, optionalAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as authController from './auth.controller';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.loginMax,
  message: { success: false, error: 'Too many login attempts' },
  standardHeaders: true,
  keyGenerator: (req) => (req.body?.username || req.body?.email || req.ip || 'unknown').toString(),
});

router.post('/login', loginLimiter, authController.login);
router.post('/logout', requireAuth, authController.logout);
router.get('/me', optionalAuth, authController.currentUser);
router.get('/socket-token', requireAuth, authController.socketToken);
router.get('/sessions', requireAuth, authController.getSessions);
router.get('/sessions/admin', requireAuth, requirePermission('SESSIONS.VIEW'), authController.listAllSessionsForAdmin);
router.post('/sessions/revoke-bulk', requireAuth, requirePermission('SESSIONS.VIEW'), authController.revokeSessionsBulk);
router.post('/sessions/:id/revoke', requireAuth, authController.revokeSession);
router.post('/change-password', requireAuth, authController.changePassword);
router.post('/verify-password', requireAuth, authController.verifyPassword);

export const authRoutes = router;
