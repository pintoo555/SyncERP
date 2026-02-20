/**
 * Client module controller – handles all client endpoints including dashboard analytics.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import { logAuditFromRequest } from '../../services/auditService';

import * as clientService from './client.service';
import * as addressService from './clientAddress.service';
import * as contactService from './clientContact.service';
import * as groupService from './clientGroup.service';
import * as relationshipService from './clientRelationship.service';
import * as duplicateService from './clientDuplicate.service';
import * as client360Service from './client360.service';
import * as industryService from './industry.service';
import * as gstVerifyService from './gstVerify.service';
import * as remarkService from './contactRemark.service';
import * as dashboardService from './clientDashboard.service';
import * as apiConfigService from '../../services/apiConfigService';
import * as aiUsageService from '../../services/aiUsageService';

function userId(req: AuthRequest): number {
  return req.user?.userId ?? 0;
}

/* ═══════════════════════ Clients ═══════════════════════ */

export async function listClients(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await clientService.listClients({
      search: req.query.search as string | undefined,
      industryId: req.query.industryId ? Number(req.query.industryId) : undefined,
      clientType: req.query.clientType as string | undefined,
      isActive: req.query.isActive !== undefined ? Number(req.query.isActive) : undefined,
      isBlacklisted: req.query.isBlacklisted !== undefined ? Number(req.query.isBlacklisted) : undefined,
      page: Math.max(1, Number(req.query.page) || 1),
      pageSize: Math.min(200, Math.max(1, Number(req.query.pageSize) || 25)),
      sortBy: req.query.sortBy as string | undefined,
      sortDir: (req.query.sortDir as string)?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC',
    });
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function createClient(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = req.body;

    // Normalise contacts: accept both `contacts` array and legacy `primaryContact` field
    const incomingContacts: any[] = Array.isArray(body.contacts) ? body.contacts : [];
    if (!incomingContacts.length && body.primaryContact && body.primaryContact.contactName) {
      incomingContacts.push({ ...body.primaryContact, isPrimary: true });
    }

    // Run duplicate check unless confirmDuplicate is true
    if (!body.confirmDuplicate) {
      const contactsForCheck = incomingContacts
        .filter((c: any) => c.mobileNumber || c.email)
        .map((c: any) => ({ mobileNumber: c.mobileNumber, email: c.email }));
      const duplicates = await duplicateService.checkDuplicates({
        clientName: body.clientName,
        gstNumber: body.gstNumber,
        contacts: contactsForCheck,
      });
      if (duplicates.length > 0) {
        res.status(409).json({
          success: false,
          error: 'Potential duplicates found',
          potentialDuplicates: duplicates,
        });
        return;
      }
    }

    const id = await clientService.createClient(body, userId(req));

    // Create addresses (supports both legacy `defaultAddress` and new `addresses` array)
    const incomingAddresses: any[] = Array.isArray(body.addresses) ? body.addresses : [];
    if (!incomingAddresses.length && body.defaultAddress && body.defaultAddress.addressLine1) {
      incomingAddresses.push({ ...body.defaultAddress, isDefault: true });
    }
    for (const addr of incomingAddresses) {
      if (addr.addressLine1) {
        await addressService.createAddress(id, addr, userId(req));
      }
    }

    // Create contacts
    for (let i = 0; i < incomingContacts.length; i++) {
      const ct = incomingContacts[i];
      if (ct.contactName) {
        const isPrimary = ct.isPrimary ?? (i === 0);
        await contactService.createContact(id, { ...ct, isPrimary }, userId(req));
      }
    }

    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_Client', entityId: String(id) });
    const client = await clientService.getClientById(id);
    res.status(201).json({ success: true, id, data: client });
  } catch (e) { next(e); }
}

export async function getClient(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));

    const client = await clientService.getClientById(id);
    if (!client) return next(new AppError(404, 'Client not found'));

    const [addresses, contacts, relationships] = await Promise.all([
      addressService.listAddresses(id),
      contactService.listContacts(id),
      relationshipService.getRelationships(id),
    ]);

    res.json({ success: true, data: { ...client, addresses, contacts, relationships } });
  } catch (e) { next(e); }
}

export async function updateClient(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));

    await clientService.updateClient(id, req.body, userId(req));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_Client', entityId: String(id) });
    const client = await clientService.getClientById(id);
    res.json({ success: true, data: client });
  } catch (e) { next(e); }
}

export async function patchClientStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));

    await clientService.patchStatus(id, req.body, userId(req));
    logAuditFromRequest(req, {
      eventType: 'update',
      entityType: 'utbl_Client',
      entityId: String(id),
      details: `status change: ${JSON.stringify(req.body)}`,
    });
    const client = await clientService.getClientById(id);
    res.json({ success: true, data: client });
  } catch (e) { next(e); }
}

export async function mergeClient(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const sourceId = Number(req.params.id);
    if (!Number.isInteger(sourceId)) return next(new AppError(400, 'Invalid id'));

    const { targetClientId, remarks } = req.body;
    if (!targetClientId) return next(new AppError(400, 'targetClientId is required'));
    if (sourceId === targetClientId) return next(new AppError(400, 'Cannot merge client into itself'));

    await relationshipService.mergeClients(sourceId, targetClientId, remarks, userId(req));
    logAuditFromRequest(req, {
      eventType: 'update',
      entityType: 'utbl_Client',
      entityId: String(sourceId),
      details: `merged into ${targetClientId}`,
    });
    res.json({ success: true, message: 'Client merged successfully' });
  } catch (e) { next(e); }
}

export async function linkClient(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const parentId = Number(req.params.id);
    if (!Number.isInteger(parentId)) return next(new AppError(400, 'Invalid id'));

    const { otherClientId, relationshipType, effectiveFrom, remarks } = req.body;
    if (!otherClientId || !relationshipType || !effectiveFrom) {
      return next(new AppError(400, 'otherClientId, relationshipType, effectiveFrom are required'));
    }

    const relId = await relationshipService.linkClients(
      parentId, otherClientId, relationshipType, effectiveFrom, remarks, userId(req)
    );
    logAuditFromRequest(req, {
      eventType: 'create',
      entityType: 'utbl_ClientRelationship',
      entityId: String(relId),
    });
    res.status(201).json({ success: true, id: relId });
  } catch (e) { next(e); }
}

export async function getAliases(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    const aliases = await relationshipService.getAliases(id);
    res.json({ success: true, data: aliases });
  } catch (e) { next(e); }
}

export async function getEffectiveClient(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    const effectiveId = await clientService.getEffectiveClientId(id);
    res.json({ success: true, effectiveClientId: effectiveId });
  } catch (e) { next(e); }
}

/* ═══════════════════════ Client 360 ═══════════════════════ */

export async function get360ByClient(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    const includeMerged = req.query.includeMerged === '1';
    const includeGroup = req.query.includeGroup === '1';
    const result = await client360Service.get360ByClient(id, includeMerged, includeGroup);
    if (!result) return next(new AppError(404, 'Client not found'));
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
}

export async function get360ByGroup(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const groupId = Number(req.params.groupId);
    if (!Number.isInteger(groupId)) return next(new AppError(400, 'Invalid groupId'));
    const result = await client360Service.get360ByGroup(groupId);
    if (!result) return next(new AppError(404, 'Group not found'));
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
}

/* ═══════════════════════ Addresses ═══════════════════════ */

export async function listAddresses(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const clientId = Number(req.params.id);
    if (!Number.isInteger(clientId)) return next(new AppError(400, 'Invalid id'));
    const data = await addressService.listAddresses(clientId);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createAddress(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const clientId = Number(req.params.id);
    if (!Number.isInteger(clientId)) return next(new AppError(400, 'Invalid id'));
    const id = await addressService.createAddress(clientId, req.body, userId(req));
    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_ClientAddress', entityId: String(id) });
    const addr = await addressService.getAddress(id);
    res.status(201).json({ success: true, id, data: addr });
  } catch (e) { next(e); }
}

export async function updateAddress(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const addrId = Number(req.params.addrId);
    if (!Number.isInteger(addrId)) return next(new AppError(400, 'Invalid address id'));
    await addressService.updateAddress(addrId, req.body, userId(req));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_ClientAddress', entityId: String(addrId) });
    const addr = await addressService.getAddress(addrId);
    res.json({ success: true, data: addr });
  } catch (e) { next(e); }
}

export async function toggleAddressStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const addrId = Number(req.params.addrId);
    if (!Number.isInteger(addrId)) return next(new AppError(400, 'Invalid address id'));
    const { isActive } = req.body;
    await addressService.toggleAddressStatus(addrId, !!isActive, userId(req));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_ClientAddress', entityId: String(addrId) });
    res.json({ success: true });
  } catch (e) { next(e); }
}

/* ═══════════════════════ Contacts ═══════════════════════ */

export async function listContacts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const clientId = Number(req.params.id);
    if (!Number.isInteger(clientId)) return next(new AppError(400, 'Invalid id'));
    const data = await contactService.listContacts(clientId);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createContact(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const clientId = Number(req.params.id);
    if (!Number.isInteger(clientId)) return next(new AppError(400, 'Invalid id'));
    const id = await contactService.createContact(clientId, req.body, userId(req));
    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_ClientContact', entityId: String(id) });
    const contact = await contactService.getContact(id);
    res.status(201).json({ success: true, id, data: contact });
  } catch (e) { next(e); }
}

export async function updateContact(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const contactId = Number(req.params.contactId);
    if (!Number.isInteger(contactId)) return next(new AppError(400, 'Invalid contact id'));
    await contactService.updateContact(contactId, req.body, userId(req));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_ClientContact', entityId: String(contactId) });
    const contact = await contactService.getContact(contactId);
    res.json({ success: true, data: contact });
  } catch (e) { next(e); }
}

export async function deactivateContact(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const contactId = Number(req.params.contactId);
    if (!Number.isInteger(contactId)) return next(new AppError(400, 'Invalid contact id'));
    const { replacedByContactId } = req.body;
    await contactService.deactivateContact(contactId, replacedByContactId ?? null, userId(req));
    logAuditFromRequest(req, {
      eventType: 'update',
      entityType: 'utbl_ClientContact',
      entityId: String(contactId),
      details: 'deactivated',
    });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function suggestReplacement(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const contactId = Number(req.params.contactId);
    if (!Number.isInteger(contactId)) return next(new AppError(400, 'Invalid contact id'));
    const suggestions = await contactService.suggestReplacement(contactId);
    res.json({ success: true, data: suggestions });
  } catch (e) { next(e); }
}

export async function verifyWhatsAppContact(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const contactId = Number(req.params.contactId);
    if (!Number.isInteger(contactId)) return next(new AppError(400, 'Invalid contact id'));
    const whatsAppNumber = typeof req.body?.whatsAppNumber === 'string' ? req.body.whatsAppNumber.trim() : undefined;
    const result = await contactService.verifyWhatsApp(contactId, whatsAppNumber);
    if (!result.verified) {
      return next(new AppError(400, result.error || 'WhatsApp verification failed'));
    }
    const contact = await contactService.getContact(contactId);
    res.json({ success: true, data: contact });
  } catch (e) { next(e); }
}

/* ═══════════════════════ Groups ═══════════════════════ */

export async function listGroups(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await groupService.listGroups();
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createGroup(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = await groupService.createGroup(req.body, userId(req));
    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_ClientGroup', entityId: String(id) });
    const group = await groupService.getGroup(id);
    res.status(201).json({ success: true, id, data: group });
  } catch (e) { next(e); }
}

export async function getGroup(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const groupId = Number(req.params.groupId);
    if (!Number.isInteger(groupId)) return next(new AppError(400, 'Invalid groupId'));

    const group = await groupService.getGroup(groupId);
    if (!group) return next(new AppError(404, 'Group not found'));

    const members = await groupService.getGroupMembers(groupId);
    res.json({ success: true, data: { ...group, members } });
  } catch (e) { next(e); }
}

export async function addGroupMember(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const groupId = Number(req.params.groupId);
    if (!Number.isInteger(groupId)) return next(new AppError(400, 'Invalid groupId'));
    const id = await groupService.addGroupMember(groupId, req.body, userId(req));
    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_ClientGroupMember', entityId: String(id) });
    res.status(201).json({ success: true, id });
  } catch (e) { next(e); }
}

export async function toggleMemberStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const memberId = Number(req.params.memberId);
    if (!Number.isInteger(memberId)) return next(new AppError(400, 'Invalid memberId'));
    const { isActive } = req.body;
    await groupService.toggleMemberStatus(memberId, !!isActive, userId(req));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_ClientGroupMember', entityId: String(memberId) });
    res.json({ success: true });
  } catch (e) { next(e); }
}

/* ═══════════════════════ Industries ═══════════════════════ */

export async function listIndustries(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await industryService.listIndustries();
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createIndustry(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = await industryService.createIndustry(req.body, userId(req));
    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_Industry', entityId: String(id) });
    const industry = await industryService.getIndustry(id);
    res.status(201).json({ success: true, id, data: industry });
  } catch (e) { next(e); }
}

export async function updateIndustry(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    await industryService.updateIndustry(id, req.body, userId(req));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_Industry', entityId: String(id) });
    const industry = await industryService.getIndustry(id);
    res.json({ success: true, data: industry });
  } catch (e) { next(e); }
}

export async function toggleIndustryStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    const { isActive } = req.body;
    await industryService.toggleIndustryStatus(id, !!isActive, userId(req));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_Industry', entityId: String(id) });
    res.json({ success: true });
  } catch (e) { next(e); }
}

/* ═══════════════════════ Contact Remarks ═══════════════════════ */

export async function listContactRemarks(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const contactId = Number(req.params.contactId);
    if (!Number.isInteger(contactId)) return next(new AppError(400, 'Invalid contact id'));
    const data = await remarkService.listRemarks(contactId);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createContactRemark(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const clientId = Number(req.params.id);
    const contactId = Number(req.params.contactId);
    if (!Number.isInteger(clientId) || !Number.isInteger(contactId)) return next(new AppError(400, 'Invalid id'));
    const id = await remarkService.createRemark(contactId, clientId, req.body, userId(req));
    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_ContactRemark', entityId: String(id) });
    res.status(201).json({ success: true, id });
  } catch (e) { next(e); }
}

export async function deleteContactRemark(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const remarkId = Number(req.params.remarkId);
    if (!Number.isInteger(remarkId)) return next(new AppError(400, 'Invalid remark id'));
    await remarkService.deleteRemark(remarkId, userId(req));
    logAuditFromRequest(req, { eventType: 'delete', entityType: 'utbl_ContactRemark', entityId: String(remarkId) });
    res.json({ success: true });
  } catch (e) { next(e); }
}

/* ─── GST Verification ─── */

export async function verifyGst(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { gstin } = req.body;
    if (!gstin || typeof gstin !== 'string') return next(new AppError(400, 'GSTIN is required'));
    const result = await gstVerifyService.verifyGstin(gstin);
    logAuditFromRequest(req, { eventType: 'gst_verify', entityType: 'utbl_Client', entityId: gstin, details: result.valid ? 'valid' : 'invalid' });
    const uid = req.user?.userId;
    if (uid != null) {
      const gstConfig = await apiConfigService.getByServiceCode('GSTZEN');
      if (gstConfig) {
        aiUsageService.logUsage({
          userId: uid,
          configId: gstConfig.configId,
          serviceCode: gstConfig.serviceCode,
          displayName: gstConfig.displayName,
          model: null,
          feature: 'GST_VERIFY',
        }).catch(() => {});
      }
    }
    res.json({ success: true, data: result });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'GST verification failed';
    next(new AppError(400, msg));
  }
}

/* ═══════════════════════ Dashboard ═══════════════════════ */

export async function getDashboard(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const stats = await dashboardService.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (e) { next(e); }
}

/** GET /api/clients/india-geojson – India states GeoJSON for dashboard map (avoids CORS). */
export async function getIndiaGeoJson(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const url = 'https://raw.githubusercontent.com/geohacker/india/master/state/india_state.geojson';
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Failed to fetch India GeoJSON');
    const geo = (await resp.json()) as { type: string; features?: { type: string; properties?: Record<string, string>; geometry?: unknown }[] };
    if (geo.features) {
      geo.features = geo.features.map((f) => {
        const props = f.properties ?? {};
        if (!props.name && props.ST_NM) {
          return { ...f, properties: { ...props, name: props.ST_NM } };
        }
        return f;
      });
    }
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.json(geo);
  } catch (e) {
    next(e);
  }
}
