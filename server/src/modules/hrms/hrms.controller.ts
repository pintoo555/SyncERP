/**
 * HRMS: employees, profile, family, bank, departments, designations, user search & activity.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import { logAuditFromRequest } from '../../services/auditService';
import * as hrmsService from './hrms.service';
import * as hrmsOrgService from './hrmsOrg.service';
import * as auditListService from '../../services/auditListService';
import { auditListQuerySchema } from '../../validators/auditSchemas';
import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import { getPermissionsForUser } from '../rbac';

const SCHEMA = config.db.schema || 'dbo';
const USERS = `[${SCHEMA}].[rb_users]`;
const PROFILE = `[${SCHEMA}].[hrms_EmployeeProfile]`;
const DEPT = `[${SCHEMA}].[sync_Department]`;

/** List departments (sync_Department). */
export async function listDepartments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await hrmsService.listDepartments();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

/** List designations (sync_Designation). */
export async function listDesignations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await hrmsService.listDesignations();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

/** List employees (HRMS.VIEW). Optional search, departmentId, isActive, orgDesignationId (utbl_Org_Designation). */
export async function listEmployees(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    const departmentId = req.query.departmentId != null ? Number(req.query.departmentId) : undefined;
    const isActive = req.query.isActive === '1' ? true : req.query.isActive === '0' ? false : undefined;
    const orgDesignationId = req.query.orgDesignationId != null ? Number(req.query.orgDesignationId) : undefined;
    const data = await hrmsService.listEmployees(search, departmentId, isActive, orgDesignationId);
    res.json({ success: true, data, total: data.length });
  } catch (e) {
    next(e);
  }
}

/** Get one employee: basic user info + profile + family + bank. Allowed for self or HRMS.VIEW. */
export async function getEmployee(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = Number((req.params as { userId: string }).userId);
    if (!Number.isInteger(userId) || userId < 1) return next(new AppError(400, 'Invalid userId'));
    const currentUserId = req.user?.userId;
    if (!currentUserId) return next(new AppError(401, 'Not authenticated'));
    if (userId !== currentUserId) {
      const perms = await getPermissionsForUser(currentUserId);
      if (!perms.includes('HRMS.VIEW')) return next(new AppError(403, 'Insufficient permissions'));
    }
    const reqDb = await getRequest();
    const userResult = await reqDb.input('userId', userId).query(`
      SELECT u.userid AS userId, u.Name AS name, u.Email AS email, u.DepartmentID AS departmentId
      FROM ${USERS} u WHERE u.userid = @userId
    `);
    const userRow = userResult.recordset[0] as { userId: number; name: string; email: string; departmentId: number | null } | undefined;
    if (!userRow) return next(new AppError(404, 'User not found'));
    const [profile, family, bank, contactNumbersRaw] = await Promise.all([
      hrmsService.getEmployeeProfile(userId),
      hrmsService.listFamily(userId),
      hrmsService.getEmployeeBank(userId),
      hrmsService.listContactNumbers(userId).catch(() => []),
    ]);
    const contactNumbers = contactNumbersRaw ?? [];
    const departmentName = userRow.departmentId != null
      ? (await hrmsService.listDepartments()).find(d => d.departmentId === userRow.departmentId)?.departmentName ?? null
      : null;
    const designationName = profile?.designationId != null
      ? (await hrmsService.listDesignations()).find(d => d.designationId === profile.designationId)?.designationType ?? null
      : null;
    res.json({
      success: true,
      user: { ...userRow, departmentName },
      profile: profile ?? null,
      designationName: designationName ?? null,
      family: family ?? [],
      bank: bank ?? null,
      contactNumbers: contactNumbers ?? [],
    });
  } catch (e) {
    next(e);
  }
}

/** Update employee profile (and optionally name/department). Self can update own profile + name only; HRMS.EDIT can update any. */
export async function updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = Number((req.params as { userId: string }).userId);
    if (!Number.isInteger(userId) || userId < 1) return next(new AppError(400, 'Invalid userId'));
    const currentUserId = req.user?.userId;
    if (!currentUserId) return next(new AppError(401, 'Not authenticated'));
    let canEditAll = false;
    if (userId !== currentUserId) {
      const perms = await getPermissionsForUser(currentUserId);
      if (!perms.includes('HRMS.EDIT')) return next(new AppError(403, 'Insufficient permissions'));
      canEditAll = true;
    }
    const body = req.body as Record<string, unknown>;
    const profilePayload: Parameters<typeof hrmsService.upsertEmployeeProfile>[1] = {
      designationId: body.designationId != null ? Number(body.designationId) : undefined,
      orgDesignationId: body.orgDesignationId != null ? Number(body.orgDesignationId) : undefined,
      orgDepartmentId: body.orgDepartmentId != null ? Number(body.orgDepartmentId) : undefined,
      employeeCode: typeof body.employeeCode === 'string' ? body.employeeCode : undefined,
      dateOfBirth: typeof body.dateOfBirth === 'string' ? body.dateOfBirth : undefined,
      gender: typeof body.gender === 'string' ? body.gender : undefined,
      phone: typeof body.phone === 'string' ? body.phone : undefined,
      mobile: typeof body.mobile === 'string' ? body.mobile : undefined,
      addressLine1: typeof body.addressLine1 === 'string' ? body.addressLine1 : undefined,
      addressLine2: typeof body.addressLine2 === 'string' ? body.addressLine2 : undefined,
      city: typeof body.city === 'string' ? body.city : undefined,
      state: typeof body.state === 'string' ? body.state : undefined,
      pincode: typeof body.pincode === 'string' ? body.pincode : undefined,
      joinDate: typeof body.joinDate === 'string' ? body.joinDate : undefined,
      pan: typeof body.pan === 'string' ? body.pan : undefined,
      aadhar: typeof body.aadhar === 'string' ? body.aadhar : undefined,
      photoUrl: typeof body.photoUrl === 'string' ? body.photoUrl : undefined,
      emergencyContact: typeof body.emergencyContact === 'string' ? body.emergencyContact : undefined,
      emergencyPhone: typeof body.emergencyPhone === 'string' ? body.emergencyPhone : undefined,
    };
    await hrmsService.upsertEmployeeProfile(userId, profilePayload);
    if (canEditAll) {
      const departmentId = body.departmentId !== undefined ? (body.departmentId === null ? null : Number(body.departmentId)) : undefined;
      const name = typeof body.name === 'string' ? body.name : undefined;
      if (departmentId !== undefined || name !== undefined) {
        await hrmsService.updateUserDepartmentAndName(userId, { departmentId, name });
      }
    } else if (typeof body.name === 'string' && body.name.trim()) {
      await hrmsService.updateUserDepartmentAndName(userId, { name: body.name.trim() });
    }
    logAuditFromRequest(req, { eventType: 'update', entityType: 'hrms_employee', entityId: String(userId), details: 'profile updated' });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

/** Send WhatsApp OTP for verification. Self only. */
export async function sendWhatsAppOtp(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(new AppError(401, 'Not authenticated'));
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
    if (!phone) return next(new AppError(400, 'Phone number is required'));
    const result = await hrmsService.sendWhatsAppOtp(userId, phone);
    if (!result.success) return next(new AppError(400, result.error ?? 'Failed to send OTP'));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'hrms_whatsapp', entityId: String(userId), details: 'OTP sent' });
    res.json({ success: true, message: 'OTP sent to your WhatsApp' });
  } catch (e) {
    next(e);
  }
}

/** Verify WhatsApp OTP and save verified number. Self only. */
export async function verifyWhatsAppOtp(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(new AppError(401, 'Not authenticated'));
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    if (!phone || !code) return next(new AppError(400, 'Phone and OTP code are required'));
    const result = await hrmsService.verifyWhatsAppOtp(userId, phone, code);
    if (!result.success) return next(new AppError(400, result.error ?? 'Verification failed'));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'hrms_whatsapp', entityId: String(userId), details: 'verified' });
    res.json({ success: true, message: 'WhatsApp number verified successfully' });
  } catch (e) {
    next(e);
  }
}

/** Remove WhatsApp number and verified state. Self only. */
export async function clearWhatsAppNumber(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(new AppError(401, 'Not authenticated'));
    await hrmsService.clearWhatsAppNumber(userId);
    logAuditFromRequest(req, { eventType: 'update', entityType: 'hrms_whatsapp', entityId: String(userId), details: 'removed' });
    res.json({ success: true, message: 'WhatsApp number removed' });
  } catch (e) {
    next(e);
  }
}

/** Resolve target userId from params and ensure caller can act on that employee (self or HRMS). */
async function ensureEmployeeAccess(req: AuthRequest, targetUserId: number, requireEdit = false): Promise<void> {
  const currentUserId = req.user?.userId;
  if (!currentUserId) throw new AppError(401, 'Not authenticated');
  if (targetUserId === currentUserId) return;
  const perms = await getPermissionsForUser(currentUserId);
  if (requireEdit ? !perms.includes('HRMS.EDIT') : !perms.includes('HRMS.VIEW')) {
    throw new AppError(403, 'Insufficient permissions');
  }
}

/** Send WhatsApp OTP for a specific employee (self or HRMS.VIEW). */
export async function sendWhatsAppOtpForEmployee(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const targetUserId = Number((req.params as { userId: string }).userId);
    if (!Number.isInteger(targetUserId) || targetUserId < 1) return next(new AppError(400, 'Invalid userId'));
    await ensureEmployeeAccess(req, targetUserId, false);
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
    if (!phone) return next(new AppError(400, 'Phone number is required'));
    const result = await hrmsService.sendWhatsAppOtp(targetUserId, phone);
    if (!result.success) return next(new AppError(400, result.error ?? 'Failed to send OTP'));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'hrms_whatsapp', entityId: String(targetUserId), details: 'OTP sent' });
    res.json({ success: true, message: 'OTP sent to WhatsApp' });
  } catch (e) {
    next(e);
  }
}

/** Verify WhatsApp OTP for a specific employee (self or HRMS.VIEW). */
export async function verifyWhatsAppOtpForEmployee(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const targetUserId = Number((req.params as { userId: string }).userId);
    if (!Number.isInteger(targetUserId) || targetUserId < 1) return next(new AppError(400, 'Invalid userId'));
    await ensureEmployeeAccess(req, targetUserId, false);
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    if (!phone || !code) return next(new AppError(400, 'Phone and OTP code are required'));
    const result = await hrmsService.verifyWhatsAppOtp(targetUserId, phone, code);
    if (!result.success) return next(new AppError(400, result.error ?? 'Verification failed'));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'hrms_whatsapp', entityId: String(targetUserId), details: 'verified' });
    res.json({ success: true, message: 'WhatsApp number verified successfully' });
  } catch (e) {
    next(e);
  }
}

/** Clear WhatsApp number for a specific employee (HRMS.EDIT only when not self). */
export async function clearWhatsAppNumberForEmployee(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const targetUserId = Number((req.params as { userId: string }).userId);
    if (!Number.isInteger(targetUserId) || targetUserId < 1) return next(new AppError(400, 'Invalid userId'));
    await ensureEmployeeAccess(req, targetUserId, true);
    await hrmsService.clearWhatsAppNumber(targetUserId);
    logAuditFromRequest(req, { eventType: 'update', entityType: 'hrms_whatsapp', entityId: String(targetUserId), details: 'removed' });
    res.json({ success: true, message: 'WhatsApp number removed' });
  } catch (e) {
    next(e);
  }
}

/** Send a test (or custom) WhatsApp message to an employee's verified number (HRMS.VIEW). */
export async function sendWhatsAppTestForEmployee(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const targetUserId = Number((req.params as { userId: string }).userId);
    if (!Number.isInteger(targetUserId) || targetUserId < 1) return next(new AppError(400, 'Invalid userId'));
    await ensureEmployeeAccess(req, targetUserId, false);
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : 'Test message from HR.';
    const sentByUserId = req.user?.userId ?? null;
    const result = await hrmsService.sendWhatsAppToEmployee(targetUserId, message || 'Test message from HR.', sentByUserId);
    if (!result.success) return next(new AppError(400, result.error ?? 'Failed to send'));
    logAuditFromRequest(req, { eventType: 'create', entityType: 'hrms_whatsapp', entityId: String(targetUserId), details: 'send-test' });
    res.json({ success: true, message: 'Message sent' });
  } catch (e) {
    next(e);
  }
}

/** List contact numbers (extensions, voip). Self or HRMS.VIEW. */
export async function listContactNumbers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = Number((req.params as { userId: string }).userId);
    if (!Number.isInteger(userId) || userId < 1) return next(new AppError(400, 'Invalid userId'));
    const currentUserId = req.user?.userId;
    if (!currentUserId) return next(new AppError(401, 'Not authenticated'));
    if (userId !== currentUserId) {
      const perms = await getPermissionsForUser(currentUserId);
      if (!perms.includes('HRMS.VIEW')) return next(new AppError(403, 'Insufficient permissions'));
    }
    const data = await hrmsService.listContactNumbers(userId);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

/** Add contact number (extension or voip). HRMS.EDIT only. */
export async function addContactNumber(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = Number((req.params as { userId: string }).userId);
    if (!Number.isInteger(userId) || userId < 1) return next(new AppError(400, 'Invalid userId'));
    const currentUserId = req.user?.userId;
    if (!currentUserId) return next(new AppError(401, 'Not authenticated'));
    const perms = await getPermissionsForUser(currentUserId);
    if (!perms.includes('HRMS.EDIT')) return next(new AppError(403, 'Insufficient permissions'));
    const body = req.body as { type?: string; number?: string };
    const type = body.type === 'voip' ? 'voip' : 'extension';
    const number = typeof body.number === 'string' ? body.number.trim() : '';
    if (!number) return next(new AppError(400, 'Number is required'));
    const id = await hrmsService.addContactNumber(userId, { type, number });
    logAuditFromRequest(req, { eventType: 'create', entityType: 'hrms_contact', entityId: String(id), details: `employee ${userId}` });
    res.status(201).json({ success: true, id });
  } catch (e) {
    next(e);
  }
}

/** Update contact number. HRMS.EDIT only. */
export async function updateContactNumber(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = Number((req.params as { userId: string }).userId);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(userId) || userId < 1 || !Number.isInteger(id) || id < 1) return next(new AppError(400, 'Invalid id'));
    const currentUserId = req.user?.userId;
    if (!currentUserId) return next(new AppError(401, 'Not authenticated'));
    const perms = await getPermissionsForUser(currentUserId);
    if (!perms.includes('HRMS.EDIT')) return next(new AppError(403, 'Insufficient permissions'));
    const body = req.body as { number?: string };
    const number = typeof body.number === 'string' ? body.number.trim() : '';
    if (!number) return next(new AppError(400, 'Number is required'));
    const ok = await hrmsService.updateContactNumber(id, userId, { number });
    if (!ok) return next(new AppError(404, 'Contact number not found'));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'hrms_contact', entityId: String(id), details: `employee ${userId}` });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

/** Delete contact number. HRMS.EDIT only. */
export async function deleteContactNumber(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = Number((req.params as { userId: string }).userId);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(userId) || userId < 1 || !Number.isInteger(id) || id < 1) return next(new AppError(400, 'Invalid id'));
    const currentUserId = req.user?.userId;
    if (!currentUserId) return next(new AppError(401, 'Not authenticated'));
    const perms = await getPermissionsForUser(currentUserId);
    if (!perms.includes('HRMS.EDIT')) return next(new AppError(403, 'Insufficient permissions'));
    const ok = await hrmsService.deleteContactNumber(id, userId);
    if (!ok) return next(new AppError(404, 'Contact number not found'));
    logAuditFromRequest(req, { eventType: 'delete', entityType: 'hrms_contact', entityId: String(id), details: `employee ${userId}` });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

/** Add family member. Self or HRMS.EDIT. */
export async function addFamilyMember(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = Number((req.params as { userId: string }).userId);
    if (!Number.isInteger(userId) || userId < 1) return next(new AppError(400, 'Invalid userId'));
    const currentUserId = req.user?.userId;
    if (!currentUserId) return next(new AppError(401, 'Not authenticated'));
    if (userId !== currentUserId) {
      const perms = await getPermissionsForUser(currentUserId);
      if (!perms.includes('HRMS.EDIT')) return next(new AppError(403, 'Insufficient permissions'));
    }
    const body = req.body as { relation?: string; fullName?: string; dateOfBirth?: string; contact?: string; isDependent?: boolean };
    const id = await hrmsService.addFamilyMember(userId, {
      relation: body.relation ?? '',
      fullName: body.fullName ?? '',
      dateOfBirth: body.dateOfBirth,
      contact: body.contact,
      isDependent: body.isDependent,
    });
    logAuditFromRequest(req, { eventType: 'create', entityType: 'hrms_family', entityId: String(id), details: `employee ${userId}` });
    res.status(201).json({ success: true, id });
  } catch (e) {
    next(e);
  }
}

/** Update family member. */
export async function updateFamilyMember(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = Number((req.params as { userId: string }).userId);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(userId) || userId < 1 || !Number.isInteger(id) || id < 1) return next(new AppError(400, 'Invalid id'));
    const currentUserId = req.user?.userId;
    if (!currentUserId) return next(new AppError(401, 'Not authenticated'));
    if (userId !== currentUserId) {
      const perms = await getPermissionsForUser(currentUserId);
      if (!perms.includes('HRMS.EDIT')) return next(new AppError(403, 'Insufficient permissions'));
    }
    const body = req.body as { relation?: string; fullName?: string; dateOfBirth?: string; contact?: string; isDependent?: boolean };
    const ok = await hrmsService.updateFamilyMember(id, userId, body);
    if (!ok) return next(new AppError(404, 'Family member not found'));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'hrms_family', entityId: String(id), details: `employee ${userId}` });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

/** Delete family member. */
export async function deleteFamilyMember(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = Number((req.params as { userId: string }).userId);
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(userId) || userId < 1 || !Number.isInteger(id) || id < 1) return next(new AppError(400, 'Invalid id'));
    const currentUserId = req.user?.userId;
    if (!currentUserId) return next(new AppError(401, 'Not authenticated'));
    if (userId !== currentUserId) {
      const perms = await getPermissionsForUser(currentUserId);
      if (!perms.includes('HRMS.EDIT')) return next(new AppError(403, 'Insufficient permissions'));
    }
    const ok = await hrmsService.deleteFamilyMember(id, userId);
    if (!ok) return next(new AppError(404, 'Family member not found'));
    logAuditFromRequest(req, { eventType: 'delete', entityType: 'hrms_family', entityId: String(id), details: `employee ${userId}` });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

/** Upsert primary bank for employee. */
export async function upsertBank(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = Number((req.params as { userId: string }).userId);
    if (!Number.isInteger(userId) || userId < 1) return next(new AppError(400, 'Invalid userId'));
    const currentUserId = req.user?.userId;
    if (!currentUserId) return next(new AppError(401, 'Not authenticated'));
    if (userId !== currentUserId) {
      const perms = await getPermissionsForUser(currentUserId);
      if (!perms.includes('HRMS.EDIT')) return next(new AppError(403, 'Insufficient permissions'));
    }
    const body = req.body as { bankName?: string; accountNumber?: string; ifsc?: string; branch?: string; accountType?: string };
    await hrmsService.upsertEmployeeBank(userId, body);
    logAuditFromRequest(req, { eventType: 'update', entityType: 'hrms_bank', entityId: String(userId) });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

/** List users for search (HRMS.VIEW). Returns active users with WhatsApp fields. Strong search: name, email, employee code, mobile, phone, department name. */
export async function listUsersForSearch(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    const reqDb = await getRequest();
    const result = await reqDb
      .input('search', search ? `%${search}%` : null)
      .query(`
        SELECT u.userid AS userId, u.Name AS name, u.Email AS email, u.DepartmentID AS departmentId,
               d.DepartmentName AS departmentName,
               p.WhatsAppNumber AS whatsAppNumber, p.WhatsAppVerifiedAt AS whatsAppVerifiedAt,
               p.EmployeeCode AS employeeCode, p.Mobile AS mobile, p.Phone AS phone
        FROM ${USERS} u
        LEFT JOIN ${PROFILE} p ON p.UserID = u.userid
        LEFT JOIN ${DEPT} d ON d.DepartmentID = u.DepartmentID
        WHERE (@search IS NULL
          OR u.Name LIKE @search OR u.Email LIKE @search
          OR p.EmployeeCode LIKE @search OR p.Mobile LIKE @search OR p.Phone LIKE @search
          OR d.DepartmentName LIKE @search)
        ORDER BY u.Name
      `);
    const data = (result.recordset || []) as {
      userId: number; name: string; email: string; departmentId: number | null;
      departmentName: string | null; whatsAppNumber: string | null; whatsAppVerifiedAt: string | null;
      employeeCode: string | null; mobile: string | null; phone: string | null;
    }[];
    res.json({ success: true, data, total: data.length });
  } catch (e) {
    next(e);
  }
}

/** User activity: audit log filtered by userId (HRMS.VIEW). */
export async function getUserActivity(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.query.userId != null ? Number(req.query.userId) : undefined;
    const query = auditListQuerySchema.parse({
      page: req.query.page,
      pageSize: req.query.pageSize,
      eventType: req.query.eventType,
      entityType: req.query.entityType,
      entityId: req.query.entityId,
      userId: userId ?? req.query.userId,
      userEmail: req.query.userEmail,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      details: req.query.details,
    });
    const result = await auditListService.listAuditLog(query);
    const data = result.data.map((r) => ({
      ...r,
      createdAt: (() => { const c = (r as { createdAt?: unknown }).createdAt; return c instanceof Date ? c.toISOString() : String(c ?? ''); })(),
    }));
    res.json({ success: true, data, total: result.total });
  } catch (e) {
    next(e);
  }
}

// --- Organization structure (utbl_Org_*). HRMS.EDIT for mutations, HRMS.VIEW for read. ---

export async function listOrgDepartments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const activeOnly = req.query.activeOnly === '1';
    const data = await hrmsOrgService.listOrgDepartments(activeOnly);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function createOrgDepartment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const perms = await getPermissionsForUser(req.user!.userId!);
    if (!perms.includes('HRMS.EDIT')) return next(new AppError(403, 'Insufficient permissions'));
    const body = req.body as { departmentCode?: string; departmentName?: string; sortOrder?: number };
    const id = await hrmsOrgService.createOrgDepartment({
      departmentCode: body.departmentCode ?? '',
      departmentName: body.departmentName ?? '',
      sortOrder: body.sortOrder,
    });
    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_Org_Department', entityId: String(id) });
    res.status(201).json({ success: true, id, data: await hrmsOrgService.getOrgDepartment(id) });
  } catch (e) {
    next(e);
  }
}

export async function updateOrgDepartment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const perms = await getPermissionsForUser(req.user!.userId!);
    if (!perms.includes('HRMS.EDIT')) return next(new AppError(403, 'Insufficient permissions'));
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    const body = req.body as { departmentCode?: string; departmentName?: string; isActive?: boolean; sortOrder?: number };
    await hrmsOrgService.updateOrgDepartment(id, body);
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_Org_Department', entityId: String(id) });
    res.json({ success: true, data: await hrmsOrgService.getOrgDepartment(id) });
  } catch (e) {
    next(e);
  }
}

export async function deleteOrgDepartment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const perms = await getPermissionsForUser(req.user!.userId!);
    if (!perms.includes('HRMS.EDIT')) return next(new AppError(403, 'Insufficient permissions'));
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    const ok = await hrmsOrgService.deleteOrgDepartment(id);
    if (!ok) return next(new AppError(404, 'Department not found'));
    logAuditFromRequest(req, { eventType: 'delete', entityType: 'utbl_Org_Department', entityId: String(id) });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function listOrgDesignations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const departmentId = req.query.departmentId != null ? Number(req.query.departmentId) : undefined;
    if (departmentId == null || !Number.isInteger(departmentId)) return next(new AppError(400, 'departmentId required'));
    const data = await hrmsOrgService.listOrgDesignations(departmentId);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function createOrgDesignation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const perms = await getPermissionsForUser(req.user!.userId!);
    if (!perms.includes('HRMS.EDIT')) return next(new AppError(403, 'Insufficient permissions'));
    const body = req.body as { departmentId: number; name: string; level: number; isLeader?: boolean; sortOrder?: number };
    const id = await hrmsOrgService.createOrgDesignation({
      departmentId: body.departmentId,
      name: body.name ?? '',
      level: body.level ?? 1,
      isLeader: body.isLeader ?? false,
      sortOrder: body.sortOrder,
    });
    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_Org_Designation', entityId: String(id) });
    res.status(201).json({ success: true, id, data: (await hrmsOrgService.listOrgDesignations(body.departmentId)).find((d) => d.id === id) });
  } catch (e) {
    next(e);
  }
}

export async function updateOrgDesignation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const perms = await getPermissionsForUser(req.user!.userId!);
    if (!perms.includes('HRMS.EDIT')) return next(new AppError(403, 'Insufficient permissions'));
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    const body = req.body as { name?: string; level?: number; isLeader?: boolean; sortOrder?: number };
    await hrmsOrgService.updateOrgDesignation(id, body);
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_Org_Designation', entityId: String(id) });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function deleteOrgDesignation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const perms = await getPermissionsForUser(req.user!.userId!);
    if (!perms.includes('HRMS.EDIT')) return next(new AppError(403, 'Insufficient permissions'));
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    const ok = await hrmsOrgService.deleteOrgDesignation(id);
    if (!ok) return next(new AppError(404, 'Designation not found'));
    logAuditFromRequest(req, { eventType: 'delete', entityType: 'utbl_Org_Designation', entityId: String(id) });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function listOrgTeams(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const departmentId = req.query.departmentId != null ? Number(req.query.departmentId) : undefined;
    const data = await hrmsOrgService.listOrgTeams(departmentId);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function getOrgTeam(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    const data = await hrmsOrgService.getOrgTeam(id);
    if (!data) return next(new AppError(404, 'Team not found'));
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function createOrgTeam(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const perms = await getPermissionsForUser(req.user!.userId!);
    if (!perms.includes('HRMS.EDIT')) return next(new AppError(403, 'Insufficient permissions'));
    const body = req.body as { departmentId: number; name: string; parentTeamId?: number | null; leadUserId?: number | null; level: number };
    const id = await hrmsOrgService.createOrgTeam({
      departmentId: body.departmentId,
      name: body.name ?? '',
      parentTeamId: body.parentTeamId,
      leadUserId: body.leadUserId,
      level: body.level ?? 1,
    });
    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_Org_Team', entityId: String(id) });
    res.status(201).json({ success: true, id, data: await hrmsOrgService.getOrgTeam(id) });
  } catch (e) {
    next(e);
  }
}

export async function updateOrgTeam(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const perms = await getPermissionsForUser(req.user!.userId!);
    if (!perms.includes('HRMS.EDIT')) return next(new AppError(403, 'Insufficient permissions'));
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    const body = req.body as { name?: string; parentTeamId?: number | null; leadUserId?: number | null; level?: number };
    await hrmsOrgService.updateOrgTeam(id, body);
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_Org_Team', entityId: String(id) });
    res.json({ success: true, data: await hrmsOrgService.getOrgTeam(id) });
  } catch (e) {
    next(e);
  }
}

export async function deleteOrgTeam(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const perms = await getPermissionsForUser(req.user!.userId!);
    if (!perms.includes('HRMS.EDIT')) return next(new AppError(403, 'Insufficient permissions'));
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    const ok = await hrmsOrgService.deleteOrgTeam(id);
    if (!ok) return next(new AppError(404, 'Team not found'));
    logAuditFromRequest(req, { eventType: 'delete', entityType: 'utbl_Org_Team', entityId: String(id) });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function listOrgTeamMembers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const teamId = Number((req.params as { id: string }).id);
    if (!Number.isInteger(teamId)) return next(new AppError(400, 'Invalid id'));
    const data = await hrmsOrgService.listOrgTeamMembers(teamId);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function addOrgTeamMember(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const perms = await getPermissionsForUser(req.user!.userId!);
    if (!perms.includes('HRMS.EDIT')) return next(new AppError(403, 'Insufficient permissions'));
    const teamId = Number((req.params as { id: string }).id);
    const body = req.body as { userId: number };
    const userId = body.userId;
    if (!Number.isInteger(teamId) || !Number.isInteger(userId)) return next(new AppError(400, 'Invalid team id or userId'));
    await hrmsOrgService.assignUserToTeam(userId, teamId);
    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_Org_TeamMember', entityId: String(teamId), details: `userId ${userId}` });
    res.status(201).json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function moveUserToTeam(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const perms = await getPermissionsForUser(req.user!.userId!);
    if (!perms.includes('HRMS.EDIT')) return next(new AppError(403, 'Insufficient permissions'));
    const userId = Number((req.params as { userId: string }).userId);
    const body = req.body as { toTeamId: number };
    const toTeamId = body.toTeamId;
    if (!Number.isInteger(userId) || !Number.isInteger(toTeamId)) return next(new AppError(400, 'Invalid userId or toTeamId'));
    const result = await hrmsOrgService.moveUserToTeam(userId, toTeamId);
    if (!result.success) return next(new AppError(400, result.error ?? 'Move failed'));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_Org_TeamMember', entityId: String(userId), details: `moved to team ${toTeamId}` });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function getOrgTree(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const departmentId = req.query.departmentId != null ? Number(req.query.departmentId) : undefined;
    const currentUserId = req.user?.userId;
    if (!currentUserId) return next(new AppError(401, 'Not authenticated'));
    const perms = await getPermissionsForUser(currentUserId);
    const hasHrmsEdit = perms.includes('HRMS.EDIT');
    const teamIdsFilter = await hrmsOrgService.getTeamsForCurrentUser(currentUserId, hasHrmsEdit);
    const result = await hrmsOrgService.getOrgTree(departmentId, teamIdsFilter ?? undefined);
    res.json({ success: true, ...result });
  } catch (e) {
    next(e);
  }
}

export async function recordPromotion(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const perms = await getPermissionsForUser(req.user!.userId!);
    if (!perms.includes('HRMS.EDIT')) return next(new AppError(403, 'Insufficient permissions'));
    const userId = Number((req.params as { userId: string }).userId);
    if (!Number.isInteger(userId)) return next(new AppError(400, 'Invalid userId'));
    const body = req.body as { toOrgDesignationId: number; toTeamId: number; effectiveDate: string; changeType: 'Promotion' | 'Demotion' | 'Transfer'; notes?: string };
    if (!body.toOrgDesignationId || !body.toTeamId || !body.effectiveDate || !body.changeType) return next(new AppError(400, 'toOrgDesignationId, toTeamId, effectiveDate, changeType required'));
    await hrmsOrgService.recordPromotion(userId, body, req.user!.userId!);
    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_Org_PromotionHistory', entityId: String(userId), details: body.changeType });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function listPromotionHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = Number((req.params as { userId: string }).userId);
    if (!Number.isInteger(userId)) return next(new AppError(400, 'Invalid userId'));
    const currentUserId = req.user?.userId;
    if (!currentUserId) return next(new AppError(401, 'Not authenticated'));
    if (userId !== currentUserId) {
      const perms = await getPermissionsForUser(currentUserId);
      if (!perms.includes('HRMS.VIEW')) return next(new AppError(403, 'Insufficient permissions'));
    }
    const data = await hrmsOrgService.listPromotionHistory(userId);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}
