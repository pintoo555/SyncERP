import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import { logAuditFromRequest } from '../../services/auditService';

import * as channelService from './leadInboxChannel.service';
import * as conversationService from './leadConversation.service';
import { testEmailCredentials, sendTestLeadEmail, testEmailChannelById, sendTestLeadEmailByChannelId } from './leadEmailPoller.service';

function uid(req: AuthRequest): number {
  return req.user?.userId ?? 0;
}

/* ═══════════════════════ Channel management (LEADS.INBOX.SETTINGS) ═══════════════════════ */

export async function listChannels(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const includeInactive = req.query.includeInactive === 'true' || req.query.includeInactive === '1';
    const result = await channelService.listChannels(includeInactive);
    res.json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
}

export async function getChannel(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));

    const channel = await channelService.getChannel(id);
    if (!channel) return next(new AppError(404, 'Channel not found'));

    res.json({ success: true, data: channel });
  } catch (e) {
    next(e);
  }
}

export async function createChannel(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = await channelService.createChannel(req.body, uid(req));

    logAuditFromRequest(req, {
      eventType: 'create',
      entityType: 'utbl_Leads_InboxChannel',
      entityId: String(id),
    });

    const channel = await channelService.getChannel(id);
    res.status(201).json({ success: true, id, data: channel });
  } catch (e) {
    next(e);
  }
}

export async function updateChannel(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));

    await channelService.updateChannel(id, req.body, uid(req));

    logAuditFromRequest(req, {
      eventType: 'update',
      entityType: 'utbl_Leads_InboxChannel',
      entityId: String(id),
    });

    const channel = await channelService.getChannel(id);
    res.json({ success: true, data: channel });
  } catch (e) {
    next(e);
  }
}

export async function toggleChannelStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));

    const channel = await channelService.getChannel(id);
    if (!channel) return next(new AppError(404, 'Channel not found'));

    await channelService.toggleChannelStatus(id, !channel.isActive, uid(req));

    logAuditFromRequest(req, {
      eventType: 'update',
      entityType: 'utbl_Leads_InboxChannel',
      entityId: String(id),
      details: 'Channel status toggled',
    });

    const updated = await channelService.getChannel(id);
    res.json({ success: true, data: updated });
  } catch (e) {
    next(e);
  }
}

/** POST /channels/test-email – test email channel credentials (no persist). */
export async function testEmailChannelCredentials(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = req.body as {
      emailAddress?: string;
      imapHost?: string;
      imapPort?: number;
      imapUser?: string;
      imapPassword?: string;
      imapUseTls?: boolean;
      smtpHost?: string;
      smtpPort?: number;
      smtpUser?: string;
      smtpPassword?: string;
      smtpUseTls?: boolean;
    };
    const result = await testEmailCredentials({
      emailAddress: body.emailAddress ?? '',
      imapHost: body.imapHost ?? '',
      imapPort: typeof body.imapPort === 'number' ? body.imapPort : parseInt(String(body.imapPort || 993), 10) || 993,
      imapUser: body.imapUser,
      imapPassword: body.imapPassword ?? '',
      imapUseTls: body.imapUseTls,
      smtpHost: body.smtpHost,
      smtpPort: body.smtpPort != null ? Number(body.smtpPort) : undefined,
      smtpUser: body.smtpUser,
      smtpPassword: body.smtpPassword,
      smtpUseTls: body.smtpUseTls,
    });
    if (result.success) {
      res.json({ success: true, message: 'Connection successful.' });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (e) {
    next(e);
  }
}

/** POST /channels/send-test-lead-email – send test lead email and verify received via IMAP. */
export async function sendTestLeadEmailHandler(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = req.body as {
      emailAddress?: string;
      imapHost?: string;
      imapPort?: number;
      imapUser?: string;
      imapPassword?: string;
      imapUseTls?: boolean;
      smtpHost?: string;
      smtpPort?: number;
      smtpUser?: string;
      smtpPassword?: string;
      smtpUseTls?: boolean;
    };
    const smtpHost = (body.smtpHost || '').trim();
    const smtpPassword = (body.smtpPassword || '').trim();
    if (!smtpHost || !smtpPassword) {
      return res.status(400).json({ success: false, error: 'SMTP host and password are required.' });
    }
    const result = await sendTestLeadEmail({
      emailAddress: body.emailAddress ?? '',
      imapHost: body.imapHost ?? '',
      imapPort: typeof body.imapPort === 'number' ? body.imapPort : parseInt(String(body.imapPort || 993), 10) || 993,
      imapUser: body.imapUser,
      imapPassword: body.imapPassword ?? '',
      imapUseTls: body.imapUseTls,
      smtpHost,
      smtpPort: body.smtpPort != null ? Number(body.smtpPort) : 587,
      smtpUser: body.smtpUser,
      smtpPassword,
      smtpUseTls: body.smtpUseTls,
    });
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (e) {
    next(e);
  }
}

/** POST /channels/:id/test-connection – test email channel using stored credentials. */
export async function testChannelConnectionById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));

    const result = await testEmailChannelById(id);
    if (result.success) {
      res.json({ success: true, message: 'Connection successful.' });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (e) {
    next(e);
  }
}

/** POST /channels/:id/send-test-lead-email – send test lead email using stored credentials. */
export async function sendTestLeadEmailById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));

    const result = await sendTestLeadEmailByChannelId(id);
    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (e) {
    next(e);
  }
}

/* ═══════════════════════ Conversations (LEADS.INBOX) ═══════════════════════ */

export async function listConversations(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const q = req.query;
    const result = await conversationService.listConversations({
      channelType: q.channelType as string | undefined,
      status: q.status as string | undefined,
      assignedToUserId: q.assignedToUserId ? Number(q.assignedToUserId) : undefined,
      leadId: q.leadId ? Number(q.leadId) : undefined,
      search: q.search as string | undefined,
      page: Math.max(1, Number(q.page) || 1),
      pageSize: Math.min(200, Math.max(1, Number(q.pageSize) || 25)),
    });
    res.json({ success: true, ...result });
  } catch (e) {
    next(e);
  }
}

export async function getConversation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));

    const conversation = await conversationService.getConversation(id);
    if (!conversation) return next(new AppError(404, 'Conversation not found'));

    res.json({ success: true, data: conversation });
  } catch (e) {
    next(e);
  }
}

export async function getMessages(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));

    const q = req.query;
    const result = await conversationService.getMessages(id, {
      page: Math.max(1, Number(q.page) || 1),
      pageSize: Math.min(100, Math.max(1, Number(q.pageSize) || 25)),
    });
    res.json({ success: true, ...result });
  } catch (e) {
    next(e);
  }
}

export async function replyToConversation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));

    const { body, mediaUrl, channelType } = req.body;
    if (!body || typeof body !== 'string') return next(new AppError(400, 'body is required'));

    const result = await conversationService.replyToConversation(
      id,
      { body, mediaUrl, channelType },
      uid(req)
    );

    logAuditFromRequest(req, {
      eventType: 'update',
      entityType: 'utbl_Leads_Conversation',
      entityId: String(id),
      details: 'Reply sent',
    });

    res.status(201).json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
}

export async function addInternalNote(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));

    const { body } = req.body;
    if (!body || typeof body !== 'string') return next(new AppError(400, 'body is required'));

    const result = await conversationService.addInternalNote(id, { body }, uid(req));

    logAuditFromRequest(req, {
      eventType: 'update',
      entityType: 'utbl_Leads_Conversation',
      entityId: String(id),
      details: 'Internal note added',
    });

    res.status(201).json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
}

export async function updateConversationStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));

    const { status, snoozedUntil } = req.body;
    if (!status || typeof status !== 'string') return next(new AppError(400, 'status is required'));

    const result = await conversationService.updateConversationStatus(
      id,
      { status, snoozedUntil },
      uid(req)
    );

    logAuditFromRequest(req, {
      eventType: 'update',
      entityType: 'utbl_Leads_Conversation',
      entityId: String(id),
      details: `Status updated to ${status}`,
    });

    res.json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
}

export async function assignConversation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));

    const { assignedToUserId } = req.body;

    const result = await conversationService.assignConversation(
      id,
      { assignedToUserId: assignedToUserId != null ? Number(assignedToUserId) : null },
      uid(req)
    );

    logAuditFromRequest(req, {
      eventType: 'update',
      entityType: 'utbl_Leads_Conversation',
      entityId: String(id),
      details: 'Assignment updated',
    });

    res.json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
}

export async function linkConversationToLead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));

    const { leadId } = req.body;
    if (!leadId) return next(new AppError(400, 'leadId is required'));

    const result = await conversationService.linkConversationToLead(
      id,
      { leadId: Number(leadId) },
      uid(req)
    );

    logAuditFromRequest(req, {
      eventType: 'update',
      entityType: 'utbl_Leads_Conversation',
      entityId: String(id),
      details: `Linked to lead ${leadId}`,
    });

    res.json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
}

export async function createLeadFromConversation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));

    const result = await conversationService.createLeadFromConversation(id, uid(req));

    logAuditFromRequest(req, {
      eventType: 'create',
      entityType: 'utbl_Leads_Master',
      entityId: String(result.leadId),
      details: `Created from conversation ${id}`,
    });

    res.status(201).json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
}

export async function getConversationStats(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await conversationService.getConversationStats();
    res.json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
}

export async function markConversationRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));

    const result = await conversationService.markConversationRead(id, uid(req));
    res.json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
}
