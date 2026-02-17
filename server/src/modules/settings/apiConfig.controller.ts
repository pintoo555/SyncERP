/**
 * API / AI Config: CRUD for external service keys (OpenAI, Claude, etc.)
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import { logAuditFromRequest } from '../../services/auditService';
import * as apiConfigService from '../../services/apiConfigService';
import { testOpenAIConfig } from '../../modules/chat/chat.improve';

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await apiConfigService.list(true);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const configId = parseInt(String(req.params.configId), 10);
    if (Number.isNaN(configId)) return next(new AppError(400, 'Invalid config ID'));
    const row = await apiConfigService.getById(configId, false);
    if (!row) return next(new AppError(404, 'Config not found'));
    res.json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = req.body as apiConfigService.CreateInput;
    if (!body?.serviceCode?.trim()) return next(new AppError(400, 'Service code is required'));
    if (!body?.displayName?.trim()) return next(new AppError(400, 'Display name is required'));
    const data = await apiConfigService.create(body);
    logAuditFromRequest(req, { eventType: 'create', entityType: 'ai_config', entityId: String(data.configId), details: body.serviceCode?.trim() ?? '' });
    res.status(201).json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const configId = parseInt(String(req.params.configId), 10);
    if (Number.isNaN(configId)) return next(new AppError(400, 'Invalid config ID'));
    const body = req.body as apiConfigService.UpdateInput;
    const data = await apiConfigService.update(configId, body);
    if (!data) return next(new AppError(404, 'Config not found'));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'ai_config', entityId: String(configId) });
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const configId = parseInt(String(req.params.configId), 10);
    if (Number.isNaN(configId)) return next(new AppError(400, 'Invalid config ID'));
    const deleted = await apiConfigService.remove(configId);
    if (!deleted) return next(new AppError(404, 'Config not found'));
    logAuditFromRequest(req, { eventType: 'delete', entityType: 'ai_config', entityId: String(configId) });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

/** Test GSTZen API key by verifying a well-known GSTIN (Maharashtra state code). */
async function testGstZenConfig(row: apiConfigService.ApiConfigRow): Promise<{ ok: boolean; message?: string; error?: string }> {
  const baseUrl = row.baseUrl?.trim() || 'https://my.gstzen.in/api/gstin-validator/';
  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Token': row.apiKey! },
      body: JSON.stringify({ gstin: '27AAPFU0939F1ZV' }),
    });
    if (!response.ok) {
      return { ok: false, error: `GSTZen returned HTTP ${response.status}` };
    }
    const data = await response.json();
    if (data.status === 0) {
      return { ok: false, error: data.message || 'GSTZen subscription error' };
    }
    return { ok: true, message: `GSTZen API connection successful (valid=${data.valid})` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Connection failed' };
  }
}

/** POST /api/ai-config/:configId/test – test if the API key works. Supports OpenAI and GSTZen. */
export async function testConfig(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const configId = parseInt(String(req.params.configId), 10);
    if (Number.isNaN(configId)) return next(new AppError(400, 'Invalid config ID'));
    const row = await apiConfigService.getById(configId, false);
    if (!row) return next(new AppError(404, 'Config not found'));
    if (!row.apiKey?.trim()) {
      return res.json({ success: false, error: 'No API key configured' });
    }

    // Route test to the correct handler based on service code
    const code = (row.serviceCode || '').toUpperCase().trim();
    let result: { ok: boolean; message?: string; error?: string };

    if (code === 'GSTZEN') {
      result = await testGstZenConfig(row);
    } else {
      result = await testOpenAIConfig(row);
    }

    if (result.ok) {
      res.json({ success: true, message: result.message ?? 'API connection successful' });
    } else {
      res.status(400).json({ success: false, error: result.error ?? 'API test failed' });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Test failed';
    next(new AppError(400, msg));
  }
}
