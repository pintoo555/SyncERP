/**
 * Maintenance tickets: list, get, create, update, close, delete. Audit and realtime.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import { logAudit, getClientIp, getUserAgent } from '../../services/auditService';
import { emitTicketChanged, emitDashboardUpdate } from '../../realtime/setup';
import * as ticketService from '../../services/ticketService';
import { ticketCreateSchema, ticketUpdateSchema, ticketCloseSchema, ticketListQuerySchema } from '../../validators/ticketSchemas';

function audit(req: AuthRequest, eventType: 'create' | 'update' | 'delete', entityType: string, entityId: string, details?: string) {
  logAudit({
    eventType,
    entityType,
    entityId,
    userId: req.user?.userId,
    userEmail: req.user?.email,
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
    details,
  }).catch(() => {});
}

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const query = ticketListQuerySchema.parse({
      page: req.query.page,
      pageSize: req.query.pageSize,
      assetId: req.query.assetId,
      status: req.query.status,
    });
    const result = await ticketService.listTickets(query);
    res.json({ success: true, data: result.data, total: result.total });
  } catch (e) {
    next(e);
  }
}

export async function getTicket(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid ticket ID'));
    const ticket = await ticketService.getTicketById(id);
    if (!ticket) return next(new AppError(404, 'Ticket not found'));
    res.json({ success: true, data: ticket });
  } catch (e) {
    next(e);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const body = ticketCreateSchema.parse(req.body);
    const ticket = await ticketService.createTicket(body, req.user.userId);
    audit(req, 'create', 'ticket', String(ticket.ticketId));
    emitTicketChanged(ticket.ticketId, { status: ticket.status, userName: req.user?.email ?? 'Someone' });
    emitDashboardUpdate();
    res.status(201).json({ success: true, data: ticket });
  } catch (e) {
    next(e);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid ticket ID'));
    const body = ticketUpdateSchema.parse(req.body);
    const ticket = await ticketService.updateTicket(id, body, req.user.userId);
    if (!ticket) return next(new AppError(404, 'Ticket not found'));
    audit(req, 'update', 'ticket', String(id));
    emitTicketChanged(id, { status: ticket.status, userName: req.user?.email ?? 'Someone' });
    emitDashboardUpdate();
    res.json({ success: true, data: ticket });
  } catch (e) {
    next(e);
  }
}

export async function close(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid ticket ID'));
    const body = ticketCloseSchema.parse(req.body);
    const ticket = await ticketService.closeTicket(id, body, req.user.userId);
    if (!ticket) return next(new AppError(404, 'Ticket not found'));
    audit(req, 'update', 'ticket', String(id), 'closed');
    emitTicketChanged(id, { status: ticket.status, userName: req.user?.email ?? 'Someone' });
    emitDashboardUpdate();
    res.json({ success: true, data: ticket });
  } catch (e) {
    next(e);
  }
}

export async function deleteTicket(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid ticket ID'));
    const ticket = await ticketService.getTicketById(id);
    if (!ticket) return next(new AppError(404, 'Ticket not found'));
    const ok = await ticketService.deleteTicket(id, req.user.userId);
    if (!ok) return next(new AppError(404, 'Ticket not found'));
    audit(req, 'delete', 'ticket', String(id));
    emitTicketChanged(id, { status: 'DELETED', userName: req.user?.email ?? 'Someone' });
    emitDashboardUpdate();
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}
