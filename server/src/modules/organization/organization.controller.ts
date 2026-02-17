/**
 * Organization controller: handles all organization endpoints.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import { logAuditFromRequest } from '../../services/auditService';
import { emitOrgChanged } from '../../realtime/setup';

import * as geoService from './organizationGeo.service';
import * as companyService from './organizationCompany.service';
import * as branchService from './organizationBranch.service';
import * as permService from './organizationPermission.service';
import * as transferService from './organizationTransfer.service';

function userId(req: AuthRequest): number {
  return req.user?.userId ?? 0;
}

// ─── Geography: Countries ───

export async function listCountries(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const activeOnly = req.query.activeOnly === '1';
    const data = await geoService.listCountries(activeOnly);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createCountry(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = req.body as any;
    const id = await geoService.createCountry(body, userId(req));
    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_Country', entityId: String(id) });
    res.status(201).json({ success: true, id, data: await geoService.getCountry(id) });
  } catch (e) { next(e); }
}

export async function updateCountry(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    await geoService.updateCountry(id, req.body as any, userId(req));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_Country', entityId: String(id) });
    res.json({ success: true, data: await geoService.getCountry(id) });
  } catch (e) { next(e); }
}

// ─── Geography: States ───

export async function listStates(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const countryId = req.query.countryId != null ? Number(req.query.countryId) : undefined;
    const activeOnly = req.query.activeOnly === '1';
    const data = await geoService.listStates(countryId, activeOnly);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createState(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = req.body as any;
    const id = await geoService.createState(body, userId(req));
    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_State', entityId: String(id) });
    res.status(201).json({ success: true, id });
  } catch (e) { next(e); }
}

export async function updateState(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    await geoService.updateState(id, req.body as any, userId(req));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_State', entityId: String(id) });
    res.json({ success: true });
  } catch (e) { next(e); }
}

// ─── Geography: Tax Jurisdictions ───

export async function listTaxJurisdictions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const countryId = req.query.countryId != null ? Number(req.query.countryId) : undefined;
    const activeOnly = req.query.activeOnly === '1';
    const data = await geoService.listTaxJurisdictions(countryId, activeOnly);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createTaxJurisdiction(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = await geoService.createTaxJurisdiction(req.body as any, userId(req));
    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_TaxJurisdiction', entityId: String(id) });
    res.status(201).json({ success: true, id });
  } catch (e) { next(e); }
}

export async function updateTaxJurisdiction(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    await geoService.updateTaxJurisdiction(id, req.body as any, userId(req));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_TaxJurisdiction', entityId: String(id) });
    res.json({ success: true });
  } catch (e) { next(e); }
}

// ─── Companies ───

export async function listCompanies(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const activeOnly = req.query.activeOnly === '1';
    const data = await companyService.listCompanies(activeOnly);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function getCompany(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    const data = await companyService.getCompany(id);
    if (!data) return next(new AppError(404, 'Company not found'));
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createCompany(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = await companyService.createCompany(req.body as any, userId(req));
    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_Company', entityId: String(id) });
    res.status(201).json({ success: true, id, data: await companyService.getCompany(id) });
  } catch (e) { next(e); }
}

export async function updateCompany(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    await companyService.updateCompany(id, req.body as any, userId(req));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_Company', entityId: String(id) });
    res.json({ success: true, data: await companyService.getCompany(id) });
  } catch (e) { next(e); }
}

// ─── Branches ───

export async function listBranches(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const activeOnly = req.query.activeOnly === '1';
    const data = await branchService.listBranches(activeOnly);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function getBranch(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    const data = await branchService.getBranch(id);
    if (!data) return next(new AppError(404, 'Branch not found'));
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createBranch(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = await branchService.createBranch(req.body as any, userId(req));
    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_Branch', entityId: String(id) });
    res.status(201).json({ success: true, id, data: await branchService.getBranch(id) });
  } catch (e) { next(e); }
}

export async function updateBranch(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    await branchService.updateBranch(id, req.body as any, userId(req));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_Branch', entityId: String(id) });
    res.json({ success: true, data: await branchService.getBranch(id) });
  } catch (e) { next(e); }
}

// ─── Branch sub-resources ───

export async function listBranchCompanies(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const branchId = Number(req.params.id);
    const data = await branchService.listBranchCompanies(branchId);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function addBranchCompany(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const branchId = Number(req.params.id);
    const body = req.body as any;
    const id = await branchService.addBranchCompany({ branchId, ...body }, userId(req));
    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_BranchCompany', entityId: String(id) });
    res.status(201).json({ success: true, id });
  } catch (e) { next(e); }
}

export async function removeBranchCompany(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const mapId = Number(req.params.mapId);
    const ok = await branchService.removeBranchCompany(mapId);
    if (!ok) return next(new AppError(404, 'Mapping not found'));
    logAuditFromRequest(req, { eventType: 'delete', entityType: 'utbl_BranchCompany', entityId: String(mapId) });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function listBranchDepartments(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const branchId = Number(req.params.id);
    const data = await branchService.listBranchDepartments(branchId);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function addBranchDepartment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const branchId = Number(req.params.id);
    const body = req.body as { departmentId: number };
    const id = await branchService.addBranchDepartment({ branchId, departmentId: body.departmentId }, userId(req));
    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_BranchDepartment', entityId: String(id) });
    res.status(201).json({ success: true, id });
  } catch (e) { next(e); }
}

export async function removeBranchDepartment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const mapId = Number(req.params.mapId);
    const ok = await branchService.removeBranchDepartment(mapId);
    if (!ok) return next(new AppError(404, 'Mapping not found'));
    logAuditFromRequest(req, { eventType: 'delete', entityType: 'utbl_BranchDepartment', entityId: String(mapId) });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function listCapabilities(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await branchService.listCapabilities();
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function listBranchCapabilities(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const branchId = Number(req.params.id);
    const data = await branchService.listBranchCapabilities(branchId);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function addBranchCapability(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const branchId = Number(req.params.id);
    const body = req.body as { capabilityId: number };
    const id = await branchService.addBranchCapability({ branchId, capabilityId: body.capabilityId }, userId(req));
    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_BranchCapabilityMap', entityId: String(id) });
    res.status(201).json({ success: true, id });
  } catch (e) { next(e); }
}

export async function removeBranchCapability(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const mapId = Number(req.params.mapId);
    const ok = await branchService.removeBranchCapability(mapId);
    if (!ok) return next(new AppError(404, 'Mapping not found'));
    logAuditFromRequest(req, { eventType: 'delete', entityType: 'utbl_BranchCapabilityMap', entityId: String(mapId) });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function listBranchLocations(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const branchId = Number(req.params.id);
    const data = await branchService.listBranchLocations(branchId);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createBranchLocation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const branchId = Number(req.params.id);
    const id = await branchService.createBranchLocation({ branchId, ...(req.body as any) }, userId(req));
    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_BranchLocation', entityId: String(id) });
    res.status(201).json({ success: true, id });
  } catch (e) { next(e); }
}

export async function updateBranchLocation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const locId = Number(req.params.locId);
    if (!Number.isInteger(locId)) return next(new AppError(400, 'Invalid id'));
    await branchService.updateBranchLocation(locId, req.body as any, userId(req));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_BranchLocation', entityId: String(locId) });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function deleteBranchLocation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const locId = Number(req.params.locId);
    const ok = await branchService.deleteBranchLocation(locId);
    if (!ok) return next(new AppError(404, 'Location not found'));
    logAuditFromRequest(req, { eventType: 'delete', entityType: 'utbl_BranchLocation', entityId: String(locId) });
    res.json({ success: true });
  } catch (e) { next(e); }
}

// ─── Departments (moved from HRMS) ───

export async function listOrgDepartments(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const activeOnly = req.query.activeOnly === '1';
    const data = await branchService.listOrgDepartments(activeOnly);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createOrgDepartment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = req.body as { departmentCode?: string; departmentName?: string; sortOrder?: number };
    const id = await branchService.createOrgDepartment({
      departmentCode: body.departmentCode ?? '', departmentName: body.departmentName ?? '', sortOrder: body.sortOrder,
    });
    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_Org_Department', entityId: String(id) });
    emitOrgChanged({ action: 'create', entityType: 'department', entityId: id });
    res.status(201).json({ success: true, id, data: await branchService.getOrgDepartment(id) });
  } catch (e) { next(e); }
}

export async function updateOrgDepartment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    await branchService.updateOrgDepartment(id, req.body as any);
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_Org_Department', entityId: String(id) });
    emitOrgChanged({ action: 'update', entityType: 'department', entityId: id });
    res.json({ success: true, data: await branchService.getOrgDepartment(id) });
  } catch (e) { next(e); }
}

export async function deleteOrgDepartment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    const ok = await branchService.deleteOrgDepartment(id);
    if (!ok) return next(new AppError(404, 'Department not found'));
    logAuditFromRequest(req, { eventType: 'delete', entityType: 'utbl_Org_Department', entityId: String(id) });
    emitOrgChanged({ action: 'delete', entityType: 'department', entityId: id });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function listOrgDesignations(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const departmentId = req.query.departmentId != null ? Number(req.query.departmentId) : undefined;
    if (departmentId == null || !Number.isInteger(departmentId)) return next(new AppError(400, 'departmentId required'));
    const data = await branchService.listOrgDesignations(departmentId);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createOrgDesignation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = req.body as { departmentId: number; name: string; level: number; isLeader?: boolean; sortOrder?: number };
    const id = await branchService.createOrgDesignation({
      departmentId: body.departmentId, name: body.name ?? '', level: body.level ?? 1,
      isLeader: body.isLeader ?? false, sortOrder: body.sortOrder,
    });
    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_Org_Designation', entityId: String(id) });
    res.status(201).json({ success: true, id });
  } catch (e) { next(e); }
}

export async function updateOrgDesignation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    await branchService.updateOrgDesignation(id, req.body as any);
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_Org_Designation', entityId: String(id) });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function deleteOrgDesignation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    const ok = await branchService.deleteOrgDesignation(id);
    if (!ok) return next(new AppError(404, 'Designation not found'));
    logAuditFromRequest(req, { eventType: 'delete', entityType: 'utbl_Org_Designation', entityId: String(id) });
    res.json({ success: true });
  } catch (e) { next(e); }
}

// ─── Branch Permissions ───

export async function getRoleBranchScope(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const roleId = Number(req.params.roleId);
    const data = await permService.getRoleBranchScope(roleId);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function upsertRoleBranchScope(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const roleId = Number(req.params.roleId);
    const body = req.body as { scopeType: string };
    await permService.upsertRoleBranchScope(roleId, body.scopeType, userId(req));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_RoleBranchScope', entityId: String(roleId) });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function listUserBranchAccess(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const uid = Number(req.params.userId);
    const data = await permService.listUserBranchAccess(uid);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function addUserBranchAccess(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const uid = Number(req.params.userId);
    const body = req.body as { branchId: number; isDefault?: boolean };
    const id = await permService.addUserBranchAccess({ userId: uid, branchId: body.branchId, isDefault: body.isDefault }, userId(req));
    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_UserBranchAccess', entityId: String(id) });
    res.status(201).json({ success: true, id });
  } catch (e) { next(e); }
}

export async function removeUserBranchAccess(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const accessId = Number(req.params.accessId);
    const ok = await permService.removeUserBranchAccess(accessId);
    if (!ok) return next(new AppError(404, 'Access record not found'));
    logAuditFromRequest(req, { eventType: 'delete', entityType: 'utbl_UserBranchAccess', entityId: String(accessId) });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function getUserAccessibleBranches(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const uid = req.params.userId ? Number(req.params.userId) : userId(req);
    const data = await permService.getUserAccessibleBranches(uid);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

// ─── Transfers ───

export async function listTransfers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const filters = {
      branchId: req.query.branchId != null ? Number(req.query.branchId) : undefined,
      type: typeof req.query.type === 'string' ? req.query.type : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    };
    const data = await transferService.listTransfers(filters);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function getTransfer(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    const data = await transferService.getTransfer(id);
    if (!data) return next(new AppError(404, 'Transfer not found'));
    const logs = await transferService.listTransferLogs(id);
    const jobs = data.transferType === 'JOB' ? await transferService.getTransferJobs(id) : [];
    res.json({ success: true, data, logs, jobs });
  } catch (e) { next(e); }
}

export async function createTransfer(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = req.body as any;
    const id = await transferService.createTransfer(body, userId(req));

    if (body.transferType === 'JOB' && Array.isArray(body.jobs)) {
      await transferService.addTransferJobs(id, body.jobs);
    }
    if (body.transferType === 'INVENTORY' && Array.isArray(body.items)) {
      await transferService.addTransferInventory(id, body.inventoryNotes ?? null, body.items);
    }
    if (body.transferType === 'ASSET' && Array.isArray(body.assets)) {
      await transferService.addTransferAssets(id, body.assets);
    }
    if (body.transferType === 'USER' && Array.isArray(body.users)) {
      await transferService.addTransferUsers(id, body.users);
    }

    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_Transfer', entityId: String(id) });
    res.status(201).json({ success: true, id, data: await transferService.getTransfer(id) });
  } catch (e) { next(e); }
}

export async function approveTransfer(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const remarks = typeof req.body?.remarks === 'string' ? req.body.remarks : undefined;
    const ok = await transferService.approveTransfer(id, userId(req), remarks);
    if (!ok) return next(new AppError(404, 'Transfer not found'));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_Transfer', entityId: String(id), details: 'approved' });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function dispatchTransfer(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const remarks = typeof req.body?.remarks === 'string' ? req.body.remarks : undefined;
    const ok = await transferService.dispatchTransfer(id, userId(req), remarks);
    if (!ok) return next(new AppError(404, 'Transfer not found'));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_Transfer', entityId: String(id), details: 'dispatched' });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function receiveTransfer(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const remarks = typeof req.body?.remarks === 'string' ? req.body.remarks : undefined;
    const ok = await transferService.receiveTransfer(id, userId(req), remarks);
    if (!ok) return next(new AppError(404, 'Transfer not found'));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_Transfer', entityId: String(id), details: 'received' });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function rejectTransfer(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const remarks = typeof req.body?.remarks === 'string' ? req.body.remarks : undefined;
    const ok = await transferService.rejectTransfer(id, userId(req), remarks);
    if (!ok) return next(new AppError(404, 'Transfer not found'));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_Transfer', entityId: String(id), details: 'rejected' });
    res.json({ success: true });
  } catch (e) { next(e); }
}
