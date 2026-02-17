/**
 * Generic AI endpoints (improve text) - used by Chat, Email, etc.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import { logAuditFromRequest } from '../../services/auditService';
import { improveMessage } from '../chat/chat.improve';

/** POST /api/ai/improve – improve text using AI. Used by email compose, etc. */
export async function improveHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (userId == null) return next(new AppError(401, 'Unauthorized'));
    const body = req.body as { text?: string; variant?: 'professional' | 'friendly' | 'concise'; serviceCode?: string; context?: 'chat' | 'email' };
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) return next(new AppError(400, 'Text is required'));
    const context = body.context === 'email' ? 'email' : 'chat';
    const feature = context === 'email' ? 'email_compose' : 'chat_improve';
    const result = await improveMessage(text, body.variant, {
      serviceCode: body.serviceCode ?? null,
      userId,
      feature,
      context,
    });
    logAuditFromRequest(req, { eventType: 'create', entityType: 'ai_usage', entityId: String(userId), details: `improve text (${feature})` });
    res.json({ success: true, data: result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to improve text';
    next(new AppError(400, msg));
  }
}
