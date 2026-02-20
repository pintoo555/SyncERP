/**
 * hMailServer Email Admin controller - proxy to bridge with permission checks and audit.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import { logAuditFromRequest } from '../../services/auditService';
import * as svc from './emailAdmin.service';

export async function listRecipients(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const out = await svc.listRecipients();
    if (out.error) return next(new AppError(503, out.error));
    res.json({ success: true, data: out.data ?? [] });
  } catch (e) { next(e); }
}

export async function listDomains(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const out = await svc.listDomains();
    if (out.error) return next(new AppError(503, out.error));
    res.json({ success: true, data: out.data ?? [] });
  } catch (e) { next(e); }
}

export async function createDomain(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, active } = req.body as { name?: string; active?: boolean };
    if (!name?.trim()) return next(new AppError(400, 'Domain name is required'));
    const out = await svc.createDomain(name.trim(), active ?? true);
    if (out.error) return next(new AppError(400, out.error));
    logAuditFromRequest(req, { eventType: 'create', entityType: 'hmail_domain', entityId: String(out.data!.id), details: `domain ${out.data!.name} created` });
    res.status(201).json({ success: true, data: out.data });
  } catch (e) { next(e); }
}

export async function updateDomain(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid domain id'));
    const { name, active } = req.body as { name?: string; active?: boolean };
    const out = await svc.updateDomain(id, { name: name?.trim(), active });
    if (out.error) return next(new AppError(400, out.error));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'hmail_domain', entityId: String(id), details: 'domain updated' });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function deleteDomain(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid domain id'));
    const out = await svc.deleteDomain(id);
    if (out.error) return next(new AppError(400, out.error));
    logAuditFromRequest(req, { eventType: 'delete', entityType: 'hmail_domain', entityId: String(id), details: 'domain deleted' });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function listAccounts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const domainId = Number(req.params.domainId);
    if (!Number.isInteger(domainId)) return next(new AppError(400, 'Invalid domain id'));
    const out = await svc.listAccounts(domainId);
    if (out.error) return next(new AppError(503, out.error));
    res.json({ success: true, data: out.data ?? [] });
  } catch (e) { next(e); }
}

export async function createAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const domainId = Number(req.params.domainId);
    if (!Number.isInteger(domainId)) return next(new AppError(400, 'Invalid domain id'));
    const { address, password, active, maxSize } = req.body as { address?: string; password?: string; active?: boolean; maxSize?: number };
    if (!address?.trim()) return next(new AppError(400, 'Email address is required'));
    if (!password) return next(new AppError(400, 'Password is required'));
    const out = await svc.createAccount(domainId, address.trim(), password, active ?? true, maxSize ?? 100);
    if (out.error) return next(new AppError(400, out.error));
    logAuditFromRequest(req, { eventType: 'create', entityType: 'hmail_account', entityId: String(out.data!.id), details: `account ${out.data!.address} created` });
    res.status(201).json({ success: true, data: out.data });
  } catch (e) { next(e); }
}

export async function updateAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid account id'));
    const { personFirstName, personLastName, active, maxSize } = req.body as { personFirstName?: string; personLastName?: string; active?: boolean; maxSize?: number };
    const out = await svc.updateAccount(id, { personFirstName, personLastName, active, maxSize });
    if (out.error) return next(new AppError(400, out.error));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'hmail_account', entityId: String(id), details: 'account updated' });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function changeAccountPassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid account id'));
    const { password } = req.body as { password?: string };
    if (!password) return next(new AppError(400, 'Password is required'));
    const out = await svc.changeAccountPassword(id, password);
    if (out.error) return next(new AppError(400, out.error));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'hmail_account', entityId: String(id), details: 'password changed' });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function deleteAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid account id'));
    const out = await svc.deleteAccount(id);
    if (out.error) return next(new AppError(400, out.error));
    logAuditFromRequest(req, { eventType: 'delete', entityType: 'hmail_account', entityId: String(id), details: 'account deleted' });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function listAliases(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const domainId = Number(req.params.domainId);
    if (!Number.isInteger(domainId)) return next(new AppError(400, 'Invalid domain id'));
    const out = await svc.listAliases(domainId);
    if (out.error) return next(new AppError(503, out.error));
    res.json({ success: true, data: out.data ?? [] });
  } catch (e) { next(e); }
}

export async function createAlias(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const domainId = Number(req.params.domainId);
    if (!Number.isInteger(domainId)) return next(new AppError(400, 'Invalid domain id'));
    const { name, value, active } = req.body as { name?: string; value?: string; active?: boolean };
    if (!name?.trim()) return next(new AppError(400, 'Alias name is required'));
    if (!value?.trim()) return next(new AppError(400, 'Alias value is required'));
    const out = await svc.createAlias(domainId, name.trim(), value.trim(), active ?? true);
    if (out.error) return next(new AppError(400, out.error));
    logAuditFromRequest(req, { eventType: 'create', entityType: 'hmail_alias', entityId: String(out.data!.id), details: `alias ${out.data!.name} created` });
    res.status(201).json({ success: true, data: out.data });
  } catch (e) { next(e); }
}

export async function updateAlias(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid alias id'));
    const { name, value, active } = req.body as { name?: string; value?: string; active?: boolean };
    const out = await svc.updateAlias(id, { name: name?.trim(), value: value?.trim(), active });
    if (out.error) return next(new AppError(400, out.error));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'hmail_alias', entityId: String(id), details: 'alias updated' });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function deleteAlias(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid alias id'));
    const out = await svc.deleteAlias(id);
    if (out.error) return next(new AppError(400, out.error));
    logAuditFromRequest(req, { eventType: 'delete', entityType: 'hmail_alias', entityId: String(id), details: 'alias deleted' });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function listDistributionLists(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const domainId = Number(req.params.domainId);
    if (!Number.isInteger(domainId)) return next(new AppError(400, 'Invalid domain id'));
    const out = await svc.listDistributionLists(domainId);
    if (out.error) return next(new AppError(503, out.error));
    res.json({ success: true, data: out.data ?? [] });
  } catch (e) { next(e); }
}

export async function createDistributionList(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const domainId = Number(req.params.domainId);
    if (!Number.isInteger(domainId)) return next(new AppError(400, 'Invalid domain id'));
    const { address, active } = req.body as { address?: string; active?: boolean };
    if (!address?.trim()) return next(new AppError(400, 'Distribution list address is required'));
    const out = await svc.createDistributionList(domainId, address.trim(), active ?? true);
    if (out.error) return next(new AppError(400, out.error));
    logAuditFromRequest(req, { eventType: 'create', entityType: 'hmail_distributionlist', entityId: String(out.data!.id), details: `distribution list ${out.data!.address} created` });
    res.status(201).json({ success: true, data: out.data });
  } catch (e) { next(e); }
}

export async function updateDistributionList(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid distribution list id'));
    const { address, active } = req.body as { address?: string; active?: boolean };
    const out = await svc.updateDistributionList(id, { address: address?.trim(), active });
    if (out.error) return next(new AppError(400, out.error));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'hmail_distributionlist', entityId: String(id), details: 'distribution list updated' });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function deleteDistributionList(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid distribution list id'));
    const out = await svc.deleteDistributionList(id);
    if (out.error) return next(new AppError(400, out.error));
    logAuditFromRequest(req, { eventType: 'delete', entityType: 'hmail_distributionlist', entityId: String(id), details: 'distribution list deleted' });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function listDistributionListRecipients(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid distribution list id'));
    const out = await svc.listDistributionListRecipients(id);
    if (out.error) return next(new AppError(503, out.error));
    res.json({ success: true, data: out.data ?? [] });
  } catch (e) { next(e); }
}

export async function addDistributionListRecipient(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid distribution list id'));
    const { address } = req.body as { address?: string };
    if (!address?.trim()) return next(new AppError(400, 'Recipient address is required'));
    const out = await svc.addDistributionListRecipient(id, address.trim());
    if (out.error) return next(new AppError(400, out.error));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'hmail_distributionlist', entityId: String(id), details: `recipient ${address.trim()} added` });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function removeDistributionListRecipient(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid distribution list id'));
    const { address } = req.params as { address: string };
    if (!address) return next(new AppError(400, 'Recipient address is required'));
    const decoded = decodeURIComponent(address);
    const out = await svc.removeDistributionListRecipient(id, decoded);
    if (out.error) return next(new AppError(400, out.error));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'hmail_distributionlist', entityId: String(id), details: `recipient removed` });
    res.json({ success: true });
  } catch (e) { next(e); }
}
