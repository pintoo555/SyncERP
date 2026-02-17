/**
 * Communication module: channels, send, dashboard, webhook.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import { logAuditFromRequest } from '../../services/auditService';
import * as commService from '../../services/communicationService';
import * as ultramsg from '../../services/ultramsgProvider';

// --- Channels (auth required) ---

export async function listChannels(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const channels = await commService.listChannels();
    const payload = channels.map((c) => ({
      id: c.ChannelID,
      name: c.Name,
      channelType: c.ChannelType,
      providerCode: c.ProviderCode,
      instanceId: c.InstanceId,
      token: c.Token ? '••••••••' : null,
      isActive: Boolean(c.IsActive),
      isDefault: Boolean(c.IsDefault),
      createdAt: c.CreatedAt,
      updatedAt: c.UpdatedAt,
    }));
    res.json({ success: true, data: payload });
  } catch (e) {
    next(e);
  }
}

export async function createChannel(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const b = req.body as Record<string, unknown>;
    const input: commService.CreateChannelInput = {
      name: String(b.name ?? '').trim(),
      channelType: (b.channelType === 'sms' ? 'sms' : 'whatsapp') as commService.ChannelType,
      providerCode: (b.providerCode === 'twilio' ? 'twilio' : 'ultramsg') as commService.ProviderCode,
      instanceId: b.instanceId != null ? String(b.instanceId).trim() || null : null,
      token: b.token != null ? String(b.token).trim() || null : null,
      isActive: b.isActive !== false,
      isDefault: b.isDefault === true,
    };
    if (!input.name) return next(new AppError(400, 'Name is required'));
    const created = await commService.createChannel(input);
    logAuditFromRequest(req, { eventType: 'create', entityType: 'communication_channel', entityId: String(created.ChannelID), details: created.Name });
    res.status(201).json({ success: true, data: { id: created.ChannelID, name: created.Name } });
  } catch (e) {
    next(e);
  }
}

export async function updateChannel(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid channel id'));
    const b = req.body as Record<string, unknown>;
    const updates: Partial<commService.CreateChannelInput> = {};
    if (b.name !== undefined) updates.name = String(b.name).trim();
    if (b.instanceId !== undefined) updates.instanceId = String(b.instanceId).trim() || null;
    if (b.token !== undefined) updates.token = String(b.token).trim() || null;
    if (b.isActive !== undefined) updates.isActive = b.isActive === true;
    if (b.isDefault !== undefined) updates.isDefault = b.isDefault === true;
    const updated = await commService.updateChannel(id, updates);
    if (!updated) return next(new AppError(404, 'Channel not found'));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'communication_channel', entityId: String(id) });
    res.json({ success: true, data: { id: updated.ChannelID } });
  } catch (e) {
    next(e);
  }
}

export async function deleteChannel(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid channel id'));
    const ok = await commService.deleteChannel(id);
    if (!ok) return next(new AppError(404, 'Channel not found'));
    logAuditFromRequest(req, { eventType: 'delete', entityType: 'communication_channel', entityId: String(id) });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

// --- Send (auth required) ---

export async function sendMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    const b = req.body as { channelId?: number; to?: string; body?: string };
    const channelId = b.channelId != null ? Number(b.channelId) : null;
    const to = typeof b.to === 'string' ? b.to.trim() : '';
    const body = typeof b.body === 'string' ? b.body.trim() : '';

    if (!to) return next(new AppError(400, 'Recipient (to) is required'));
    if (!body) return next(new AppError(400, 'Message body is required'));

    const channel = channelId
      ? await commService.getChannelById(channelId)
      : await commService.getDefaultChannel('whatsapp');
    if (!channel || !channel.IsActive)
      return next(new AppError(400, 'No active WhatsApp channel configured'));

    if (channel.ProviderCode !== 'ultramsg' || !channel.InstanceId || !channel.Token)
      return next(new AppError(400, 'Channel must be configured with Ultramsg instance and token'));

    // Normalize phone: ensure international format (e.g. 9876543210 -> +919876543210)
    let normalizedTo = to.replace(/\s/g, '');
    if (/^\d{10}$/.test(normalizedTo)) normalizedTo = '+91' + normalizedTo;
    else if (/^0\d{10}$/.test(normalizedTo)) normalizedTo = '+91' + normalizedTo.slice(1);
    else if (!normalizedTo.startsWith('+')) normalizedTo = '+' + normalizedTo;

    const result = await ultramsg.sendText(
      { instanceId: channel.InstanceId, token: channel.Token },
      normalizedTo,
      body
    );

    if (!result.success) {
      return next(new AppError(400, result.error ?? 'Failed to send message'));
    }

    const inst = await commService.getChannelById(channel.ChannelID);
    const fromNumber = inst?.InstanceId ? `instance-${inst.InstanceId}` : 'unknown';
    await commService.saveOutboundMessage({
      channelId: channel.ChannelID,
      externalId: result.messageId ?? null,
      fromNumber,
      toNumber: normalizedTo,
      body,
      status: 'sent',
      sentByUserId: userId ?? null,
      sentAt: new Date(),
    });

    logAuditFromRequest(req, { eventType: 'create', entityType: 'communication_message', details: `to ${normalizedTo}` });
    res.json({ success: true, messageId: result.messageId });
  } catch (e) {
    next(e);
  }
}

// --- Dashboard & Messages (auth required) ---

export async function getDashboard(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const days = Math.min(90, Math.max(7, parseInt(String(req.query.days ?? 30), 10) || 30));
    const stats = await commService.getDashboardStats(days);
    res.json({ success: true, data: stats });
  } catch (e) {
    next(e);
  }
}

export async function listMessages(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const q = req.query as Record<string, string | undefined>;
    const params = {
      channelId: q.channelId ? parseInt(q.channelId, 10) : undefined,
      direction: (q.direction === 'inbound' || q.direction === 'outbound' ? q.direction : undefined) as 'inbound' | 'outbound' | undefined,
      fromNumber: q.fromNumber,
      toNumber: q.toNumber,
      fromDate: q.fromDate,
      toDate: q.toDate,
      page: q.page ? parseInt(q.page, 10) : 1,
      limit: q.limit ? parseInt(q.limit, 10) : 50,
    };
    const result = await commService.listMessages(params);
    res.json({ success: true, data: result.messages, total: result.total });
  } catch (e) {
    next(e);
  }
}

// --- Webhook (NO auth - Ultramsg calls this) ---

export async function webhookIncoming(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = req.body as {
      event_type?: string;
      instanceId?: string | number;
      data?: {
        id?: string;
        from?: string;
        to?: string;
        body?: string;
        type?: string;
        fromMe?: boolean;
        time?: number;
      };
    };

    if (body.event_type !== 'message_received' && body.event_type !== 'webhook_message_received') {
      res.status(200).json({ received: true });
      return;
    }

    const data = body.data;
    if (!data || data.fromMe) {
      res.status(200).json({ received: true });
      return;
    }

    const instanceIdStr = body.instanceId != null ? String(body.instanceId) : null;
    const channels = await commService.listChannels();
    const channel = channels.find(
      (c) => c.ProviderCode === 'ultramsg' && c.InstanceId != null && String(c.InstanceId) === instanceIdStr && c.IsActive
    );
    if (!channel) {
      console.warn('Communication webhook: no matching channel for instance', body.instanceId, '- available:', channels.filter(c => c.ProviderCode === 'ultramsg').map(c => c.InstanceId));
      res.status(200).json({ received: true });
      return;
    }

    const from = (data.from ?? '').replace(/@c\.us$/, '');
    const to = (data.to ?? '').replace(/@c\.us$/, '');
    await commService.saveInboundMessage({
      channelId: channel.ChannelID,
      externalId: data.id ?? null,
      fromNumber: from,
      toNumber: to,
      body: data.body ?? null,
      messageType: data.type ?? 'text',
      status: 'received',
      receivedAt: data.time ? new Date(data.time * 1000) : new Date(),
      metadataJson: JSON.stringify(body),
    });

    res.status(200).json({ received: true });
  } catch (e) {
    console.error('Communication webhook error:', e);
    next(e);
  }
}

/** Simulate inbound message for testing (auth required). Inserts a test message so you can verify it appears in Communication > Messages. */
export async function testWebhook(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const b = req.body as { channelId?: number; body?: string };
    const channels = await commService.listChannels();
    const channel = b.channelId
      ? channels.find((c) => c.ChannelID === b.channelId && c.IsActive)
      : channels.find((c) => c.ProviderCode === 'ultramsg' && c.IsActive);
    if (!channel) {
      return next(new AppError(400, 'No active Ultramsg channel found. Add a channel in the Sandbox first.'));
    }
    const body = (b.body ?? 'Test message from Sandbox').trim().slice(0, 500);
    await commService.saveInboundMessage({
      channelId: channel.ChannelID,
      externalId: 'test-' + Date.now(),
      fromNumber: '919876543210',
      toNumber: channel.InstanceId ?? 'instance',
      body: body || 'Test inbound message',
      messageType: 'text',
      status: 'received',
      receivedAt: new Date(),
      metadataJson: JSON.stringify({ _test: true }),
    });
    res.json({
      success: true,
      message: 'Test inbound message saved. View it in Communication > Messages (filter: Received).',
    });
  } catch (e) {
    next(e);
  }
}
