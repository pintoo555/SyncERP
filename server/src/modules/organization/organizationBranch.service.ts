/**
 * Branch service: CRUD for Branch, BranchCompany, BranchDepartment, BranchCapability, BranchCapabilityMap, BranchLocation.
 * Also hosts department/designation CRUD (moved from HRMS).
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type {
  BranchRow, BranchCompanyRow, BranchDepartmentRow,
  BranchCapabilityRow, BranchCapabilityMapRow, BranchLocationRow,
  OrgDepartmentRow, OrgDesignationRow,
} from './organization.types';

const SCHEMA = config.db.schema || 'dbo';
const BRANCH = `[${SCHEMA}].[utbl_Branch]`;
const BRANCH_COMPANY = `[${SCHEMA}].[utbl_BranchCompany]`;
const BRANCH_DEPT = `[${SCHEMA}].[utbl_BranchDepartment]`;
const CAPABILITY = `[${SCHEMA}].[utbl_BranchCapability]`;
const CAP_MAP = `[${SCHEMA}].[utbl_BranchCapabilityMap]`;
const LOCATION = `[${SCHEMA}].[utbl_BranchLocation]`;
const ORG_DEPT = `[${SCHEMA}].[utbl_Org_Department]`;
const ORG_DESIG = `[${SCHEMA}].[utbl_Org_Designation]`;
const ORG_TEAM = `[${SCHEMA}].[utbl_Org_Team]`;
const PROFILE = `[${SCHEMA}].[hrms_EmployeeProfile]`;

function d2s(d: unknown): string { return d instanceof Date ? d.toISOString() : String(d ?? ''); }
function d2sn(d: unknown): string | null { return d == null ? null : (d instanceof Date ? d.toISOString() : String(d)); }

// ─── Branch CRUD ───

export async function listBranches(activeOnly = false): Promise<BranchRow[]> {
  const req = await getRequest();
  req.input('activeOnly', activeOnly ? 1 : 0);
  const result = await req.query(`
    SELECT Id AS id, BranchCode AS branchCode, BranchName AS branchName, BranchType AS branchType,
           CountryId AS countryId, StateId AS stateId, City AS city, Timezone AS timezone,
           AddressLine1 AS addressLine1, AddressLine2 AS addressLine2, Pincode AS pincode,
           Phone AS phone, Email AS email, IsActive AS isActive,
           CreatedOn AS createdOn, CreatedBy AS createdBy, UpdatedOn AS updatedOn, UpdatedBy AS updatedBy
    FROM ${BRANCH}
    WHERE (@activeOnly = 0 OR IsActive = 1)
    ORDER BY BranchName
  `);
  return (result.recordset || []).map((r: any) => ({ ...r, createdOn: d2s(r.createdOn), updatedOn: d2sn(r.updatedOn) }));
}

export async function getBranch(id: number): Promise<BranchRow | null> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`
    SELECT Id AS id, BranchCode AS branchCode, BranchName AS branchName, BranchType AS branchType,
           CountryId AS countryId, StateId AS stateId, City AS city, Timezone AS timezone,
           AddressLine1 AS addressLine1, AddressLine2 AS addressLine2, Pincode AS pincode,
           Phone AS phone, Email AS email, IsActive AS isActive,
           CreatedOn AS createdOn, CreatedBy AS createdBy, UpdatedOn AS updatedOn, UpdatedBy AS updatedBy
    FROM ${BRANCH} WHERE Id = @id
  `);
  const r = (result.recordset as any[])?.[0];
  if (!r) return null;
  return { ...r, createdOn: d2s(r.createdOn), updatedOn: d2sn(r.updatedOn) };
}

export async function createBranch(data: {
  branchCode: string; branchName: string; branchType: string;
  countryId?: number; stateId?: number; city?: string; timezone?: string;
  addressLine1?: string; addressLine2?: string; pincode?: string; phone?: string; email?: string;
}, userId: number | null): Promise<number> {
  const req = await getRequest();
  req.input('code', (data.branchCode || '').trim().slice(0, 20));
  req.input('name', (data.branchName || '').trim().slice(0, 200));
  req.input('type', (data.branchType || 'FULL').trim().slice(0, 20));
  req.input('countryId', data.countryId ?? null);
  req.input('stateId', data.stateId ?? null);
  req.input('city', (data.city || '').trim().slice(0, 100) || null);
  req.input('timezone', (data.timezone || '').trim().slice(0, 100) || null);
  req.input('addr1', (data.addressLine1 || '').trim().slice(0, 300) || null);
  req.input('addr2', (data.addressLine2 || '').trim().slice(0, 300) || null);
  req.input('pincode', (data.pincode || '').trim().slice(0, 20) || null);
  req.input('phone', (data.phone || '').trim().slice(0, 30) || null);
  req.input('email', (data.email || '').trim().slice(0, 200) || null);
  req.input('createdBy', userId);
  const result = await req.query(`
    INSERT INTO ${BRANCH} (BranchCode, BranchName, BranchType, CountryId, StateId, City, Timezone,
      AddressLine1, AddressLine2, Pincode, Phone, Email, CreatedBy)
    OUTPUT INSERTED.Id
    VALUES (@code, @name, @type, @countryId, @stateId, @city, @timezone, @addr1, @addr2, @pincode, @phone, @email, @createdBy)
  `);
  return (result.recordset as { Id: number }[])[0].Id;
}

export async function updateBranch(id: number, data: Partial<{
  branchCode: string; branchName: string; branchType: string;
  countryId: number; stateId: number; city: string; timezone: string;
  addressLine1: string; addressLine2: string; pincode: string; phone: string; email: string; isActive: boolean;
}>, userId: number | null): Promise<boolean> {
  const req = await getRequest();
  req.input('id', id);
  req.input('code', data.branchCode !== undefined ? (data.branchCode || '').trim().slice(0, 20) : null);
  req.input('name', data.branchName !== undefined ? (data.branchName || '').trim().slice(0, 200) : null);
  req.input('type', data.branchType !== undefined ? (data.branchType || '').trim().slice(0, 20) : null);
  req.input('isActive', data.isActive !== undefined ? (data.isActive ? 1 : 0) : null);
  req.input('updatedBy', userId);
  await req.query(`
    UPDATE ${BRANCH} SET
      BranchCode = ISNULL(@code, BranchCode), BranchName = ISNULL(@name, BranchName),
      BranchType = ISNULL(@type, BranchType), IsActive = ISNULL(@isActive, IsActive),
      UpdatedOn = GETDATE(), UpdatedBy = @updatedBy
    WHERE Id = @id
  `);
  return true;
}

// ─── Branch–Company mapping ───

export async function listBranchCompanies(branchId: number): Promise<BranchCompanyRow[]> {
  const req = await getRequest();
  const result = await req.input('branchId', branchId).query(`
    SELECT Id AS id, BranchId AS branchId, CompanyId AS companyId, IsDefault AS isDefault,
           EffectiveFrom AS effectiveFrom, EffectiveTo AS effectiveTo,
           IsActive AS isActive, CreatedOn AS createdOn, CreatedBy AS createdBy, UpdatedOn AS updatedOn, UpdatedBy AS updatedBy
    FROM ${BRANCH_COMPANY} WHERE BranchId = @branchId ORDER BY IsDefault DESC, EffectiveFrom
  `);
  return (result.recordset || []).map((r: any) => ({
    ...r,
    effectiveFrom: r.effectiveFrom instanceof Date ? r.effectiveFrom.toISOString().slice(0, 10) : String(r.effectiveFrom),
    effectiveTo: r.effectiveTo == null ? null : (r.effectiveTo instanceof Date ? r.effectiveTo.toISOString().slice(0, 10) : String(r.effectiveTo)),
    createdOn: d2s(r.createdOn), updatedOn: d2sn(r.updatedOn),
  }));
}

export async function addBranchCompany(data: { branchId: number; companyId: number; isDefault?: boolean; effectiveFrom: string; effectiveTo?: string }, userId: number | null): Promise<number> {
  const req = await getRequest();
  req.input('branchId', data.branchId);
  req.input('companyId', data.companyId);
  req.input('isDefault', data.isDefault ? 1 : 0);
  req.input('effectiveFrom', data.effectiveFrom);
  req.input('effectiveTo', data.effectiveTo ?? null);
  req.input('createdBy', userId);
  const result = await req.query(`
    INSERT INTO ${BRANCH_COMPANY} (BranchId, CompanyId, IsDefault, EffectiveFrom, EffectiveTo, CreatedBy)
    OUTPUT INSERTED.Id VALUES (@branchId, @companyId, @isDefault, @effectiveFrom, @effectiveTo, @createdBy)
  `);
  return (result.recordset as { Id: number }[])[0].Id;
}

export async function removeBranchCompany(id: number): Promise<boolean> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`DELETE FROM ${BRANCH_COMPANY} WHERE Id = @id`);
  return (result.rowsAffected[0] ?? 0) > 0;
}

/** Get default company for a branch (active, current date in range). */
export async function getDefaultCompanyForBranch(branchId: number): Promise<number | null> {
  const req = await getRequest();
  const result = await req.input('branchId', branchId).query(`
    SELECT TOP 1 CompanyId FROM ${BRANCH_COMPANY}
    WHERE BranchId = @branchId AND IsActive = 1 AND IsDefault = 1
      AND EffectiveFrom <= CAST(GETDATE() AS DATE)
      AND (EffectiveTo IS NULL OR EffectiveTo >= CAST(GETDATE() AS DATE))
    ORDER BY EffectiveFrom DESC
  `);
  return (result.recordset as { CompanyId: number }[])?.[0]?.CompanyId ?? null;
}

// ─── Branch–Department mapping ───

export async function listBranchDepartments(branchId: number): Promise<(BranchDepartmentRow & { departmentName: string })[]> {
  const req = await getRequest();
  const result = await req.input('branchId', branchId).query(`
    SELECT bd.Id AS id, bd.BranchId AS branchId, bd.DepartmentId AS departmentId,
           d.DepartmentName AS departmentName, bd.IsActive AS isActive,
           bd.CreatedOn AS createdOn, bd.CreatedBy AS createdBy, bd.UpdatedOn AS updatedOn, bd.UpdatedBy AS updatedBy
    FROM ${BRANCH_DEPT} bd
    INNER JOIN ${ORG_DEPT} d ON d.Id = bd.DepartmentId
    WHERE bd.BranchId = @branchId ORDER BY d.SortOrder, d.DepartmentName
  `);
  return (result.recordset || []).map((r: any) => ({ ...r, createdOn: d2s(r.createdOn), updatedOn: d2sn(r.updatedOn) }));
}

export async function addBranchDepartment(data: { branchId: number; departmentId: number }, userId: number | null): Promise<number> {
  const req = await getRequest();
  req.input('branchId', data.branchId);
  req.input('deptId', data.departmentId);
  req.input('createdBy', userId);
  const result = await req.query(`
    INSERT INTO ${BRANCH_DEPT} (BranchId, DepartmentId, CreatedBy)
    OUTPUT INSERTED.Id VALUES (@branchId, @deptId, @createdBy)
  `);
  return (result.recordset as { Id: number }[])[0].Id;
}

export async function removeBranchDepartment(id: number): Promise<boolean> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`DELETE FROM ${BRANCH_DEPT} WHERE Id = @id`);
  return (result.rowsAffected[0] ?? 0) > 0;
}

// ─── Capabilities ───

export async function listCapabilities(): Promise<BranchCapabilityRow[]> {
  const req = await getRequest();
  const result = await req.query(`
    SELECT Id AS id, CapabilityCode AS capabilityCode, CapabilityName AS capabilityName,
           Description AS description, IsActive AS isActive,
           CreatedOn AS createdOn, CreatedBy AS createdBy, UpdatedOn AS updatedOn, UpdatedBy AS updatedBy
    FROM ${CAPABILITY} WHERE IsActive = 1 ORDER BY CapabilityName
  `);
  return (result.recordset || []).map((r: any) => ({ ...r, createdOn: d2s(r.createdOn), updatedOn: d2sn(r.updatedOn) }));
}

export async function listBranchCapabilities(branchId: number): Promise<(BranchCapabilityMapRow & { capabilityCode: string; capabilityName: string })[]> {
  const req = await getRequest();
  const result = await req.input('branchId', branchId).query(`
    SELECT cm.Id AS id, cm.BranchId AS branchId, cm.CapabilityId AS capabilityId,
           c.CapabilityCode AS capabilityCode, c.CapabilityName AS capabilityName,
           cm.IsActive AS isActive,
           cm.CreatedOn AS createdOn, cm.CreatedBy AS createdBy, cm.UpdatedOn AS updatedOn, cm.UpdatedBy AS updatedBy
    FROM ${CAP_MAP} cm
    INNER JOIN ${CAPABILITY} c ON c.Id = cm.CapabilityId
    WHERE cm.BranchId = @branchId ORDER BY c.CapabilityName
  `);
  return (result.recordset || []).map((r: any) => ({ ...r, createdOn: d2s(r.createdOn), updatedOn: d2sn(r.updatedOn) }));
}

export async function addBranchCapability(data: { branchId: number; capabilityId: number }, userId: number | null): Promise<number> {
  const req = await getRequest();
  req.input('branchId', data.branchId);
  req.input('capId', data.capabilityId);
  req.input('createdBy', userId);
  const result = await req.query(`
    INSERT INTO ${CAP_MAP} (BranchId, CapabilityId, CreatedBy)
    OUTPUT INSERTED.Id VALUES (@branchId, @capId, @createdBy)
  `);
  return (result.recordset as { Id: number }[])[0].Id;
}

export async function removeBranchCapability(id: number): Promise<boolean> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`DELETE FROM ${CAP_MAP} WHERE Id = @id`);
  return (result.rowsAffected[0] ?? 0) > 0;
}

/** Check if a branch has a specific capability. */
export async function branchHasCapability(branchId: number, capabilityCode: string): Promise<boolean> {
  const req = await getRequest();
  const result = await req.input('branchId', branchId).input('code', capabilityCode).query(`
    SELECT 1 FROM ${CAP_MAP} cm
    INNER JOIN ${CAPABILITY} c ON c.Id = cm.CapabilityId
    WHERE cm.BranchId = @branchId AND c.CapabilityCode = @code AND cm.IsActive = 1
  `);
  return (result.recordset?.length ?? 0) > 0;
}

// ─── Locations ───

export async function listBranchLocations(branchId: number): Promise<BranchLocationRow[]> {
  const req = await getRequest();
  const result = await req.input('branchId', branchId).query(`
    SELECT Id AS id, BranchId AS branchId, LocationCode AS locationCode, LocationName AS locationName,
           LocationType AS locationType, ParentLocationId AS parentLocationId, SortOrder AS sortOrder,
           IsActive AS isActive,
           CreatedOn AS createdOn, CreatedBy AS createdBy, UpdatedOn AS updatedOn, UpdatedBy AS updatedBy
    FROM ${LOCATION} WHERE BranchId = @branchId ORDER BY SortOrder, LocationName
  `);
  return (result.recordset || []).map((r: any) => ({ ...r, createdOn: d2s(r.createdOn), updatedOn: d2sn(r.updatedOn) }));
}

export async function createBranchLocation(data: {
  branchId: number; locationCode: string; locationName: string; locationType: string;
  parentLocationId?: number; sortOrder?: number;
}, userId: number | null): Promise<number> {
  const req = await getRequest();
  req.input('branchId', data.branchId);
  req.input('code', (data.locationCode || '').trim().slice(0, 50));
  req.input('name', (data.locationName || '').trim().slice(0, 200));
  req.input('type', (data.locationType || 'OTHER').trim().slice(0, 20));
  req.input('parentId', data.parentLocationId ?? null);
  req.input('sort', data.sortOrder ?? 0);
  req.input('createdBy', userId);
  const result = await req.query(`
    INSERT INTO ${LOCATION} (BranchId, LocationCode, LocationName, LocationType, ParentLocationId, SortOrder, CreatedBy)
    OUTPUT INSERTED.Id VALUES (@branchId, @code, @name, @type, @parentId, @sort, @createdBy)
  `);
  return (result.recordset as { Id: number }[])[0].Id;
}

export async function updateBranchLocation(id: number, data: Partial<{
  locationCode: string; locationName: string; locationType: string; parentLocationId: number; sortOrder: number; isActive: boolean;
}>, userId: number | null): Promise<boolean> {
  const req = await getRequest();
  req.input('id', id);
  req.input('code', data.locationCode !== undefined ? (data.locationCode || '').trim().slice(0, 50) : null);
  req.input('name', data.locationName !== undefined ? (data.locationName || '').trim().slice(0, 200) : null);
  req.input('type', data.locationType !== undefined ? (data.locationType || '').trim().slice(0, 20) : null);
  req.input('isActive', data.isActive !== undefined ? (data.isActive ? 1 : 0) : null);
  req.input('sort', data.sortOrder !== undefined ? data.sortOrder : null);
  req.input('updatedBy', userId);
  await req.query(`
    UPDATE ${LOCATION} SET
      LocationCode = ISNULL(@code, LocationCode), LocationName = ISNULL(@name, LocationName),
      LocationType = ISNULL(@type, LocationType), SortOrder = ISNULL(@sort, SortOrder),
      IsActive = ISNULL(@isActive, IsActive), UpdatedOn = GETDATE(), UpdatedBy = @updatedBy
    WHERE Id = @id
  `);
  return true;
}

export async function deleteBranchLocation(id: number): Promise<boolean> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`DELETE FROM ${LOCATION} WHERE Id = @id`);
  return (result.rowsAffected[0] ?? 0) > 0;
}

// ─── Department CRUD (moved from HRMS) ───

export async function listOrgDepartments(activeOnly = false): Promise<OrgDepartmentRow[]> {
  const req = await getRequest();
  req.input('activeOnly', activeOnly ? 1 : 0);
  const result = await req.query(`
    SELECT Id AS id, DepartmentCode AS departmentCode, DepartmentName AS departmentName,
           IsActive AS isActive, SortOrder AS sortOrder, CreatedAt AS createdAt, UpdatedAt AS updatedAt
    FROM ${ORG_DEPT}
    WHERE (@activeOnly = 0 OR IsActive = 1)
    ORDER BY SortOrder, DepartmentName
  `);
  return (result.recordset || []).map((r: any) => ({
    ...r,
    createdAt: d2s(r.createdAt),
    updatedAt: d2sn(r.updatedAt),
  }));
}

export async function getOrgDepartment(id: number): Promise<OrgDepartmentRow | null> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`
    SELECT Id AS id, DepartmentCode AS departmentCode, DepartmentName AS departmentName,
           IsActive AS isActive, SortOrder AS sortOrder, CreatedAt AS createdAt, UpdatedAt AS updatedAt
    FROM ${ORG_DEPT} WHERE Id = @id
  `);
  const r = (result.recordset as any[])?.[0];
  if (!r) return null;
  return { ...r, createdAt: d2s(r.createdAt), updatedAt: d2sn(r.updatedAt) };
}

export async function createOrgDepartment(data: { departmentCode: string; departmentName: string; sortOrder?: number }): Promise<number> {
  const req = await getRequest();
  req.input('code', (data.departmentCode || '').trim().slice(0, 50));
  req.input('name', (data.departmentName || '').trim().slice(0, 200));
  req.input('sortOrder', data.sortOrder ?? 0);
  const result = await req.query(`
    INSERT INTO ${ORG_DEPT} (DepartmentCode, DepartmentName, IsActive, SortOrder) OUTPUT INSERTED.Id
    VALUES (@code, @name, 1, @sortOrder)
  `);
  const id = (result.recordset as { Id: number }[])?.[0]?.Id;
  if (id == null) throw new Error('Failed to create department');
  return id;
}

export async function updateOrgDepartment(id: number, data: { departmentCode?: string; departmentName?: string; isActive?: boolean; sortOrder?: number }): Promise<boolean> {
  const req = await getRequest();
  req.input('id', id);
  req.input('code', data.departmentCode !== undefined ? (data.departmentCode || '').trim().slice(0, 50) : null);
  req.input('name', data.departmentName !== undefined ? (data.departmentName || '').trim().slice(0, 200) : null);
  req.input('isActive', data.isActive !== undefined ? (data.isActive ? 1 : 0) : null);
  req.input('sortOrder', data.sortOrder !== undefined ? data.sortOrder : null);
  await req.query(`
    UPDATE ${ORG_DEPT} SET
      DepartmentCode = ISNULL(@code, DepartmentCode), DepartmentName = ISNULL(@name, DepartmentName),
      IsActive = ISNULL(@isActive, IsActive), SortOrder = ISNULL(@sortOrder, SortOrder), UpdatedAt = GETDATE()
    WHERE Id = @id
  `);
  return true;
}

/** Delete a department only if it has no teams or employees. */
export async function deleteOrgDepartment(id: number): Promise<{ success: boolean; error?: string }> {
  const checkReq = await getRequest();
  checkReq.input('id', id);
  const check = await checkReq.query(`
    SELECT
      (SELECT COUNT(*) FROM ${ORG_TEAM} WHERE DepartmentId = @id) AS teamCount,
      (SELECT COUNT(*) FROM ${PROFILE} WHERE OrgDepartmentId = @id) AS employeeCount
  `);
  const { teamCount, employeeCount } = check.recordset[0] as { teamCount: number; employeeCount: number };
  if (teamCount > 0) return { success: false, error: `Cannot delete: ${teamCount} team(s) still belong to this department` };
  if (employeeCount > 0) return { success: false, error: `Cannot delete: ${employeeCount} employee(s) still assigned to this department` };

  const req = await getRequest();
  const result = await req.input('id', id).query(`DELETE FROM ${ORG_DEPT} WHERE Id = @id`);
  return { success: (result.rowsAffected[0] ?? 0) > 0 };
}

// ─── Designation CRUD (moved from HRMS) ───

export async function listOrgDesignations(departmentId: number): Promise<OrgDesignationRow[]> {
  const req = await getRequest();
  const result = await req.input('departmentId', departmentId).query(`
    SELECT Id AS id, DepartmentId AS departmentId, Name AS name, Level AS level,
           IsLeader AS isLeader, SortOrder AS sortOrder, CreatedAt AS createdAt, UpdatedAt AS updatedAt
    FROM ${ORG_DESIG} WHERE DepartmentId = @departmentId ORDER BY SortOrder, Level, Name
  `);
  return (result.recordset || []).map((r: any) => ({
    ...r, createdAt: d2s(r.createdAt), updatedAt: d2sn(r.updatedAt),
  }));
}

export async function createOrgDesignation(data: { departmentId: number; name: string; level: number; isLeader: boolean; sortOrder?: number }): Promise<number> {
  const req = await getRequest();
  req.input('departmentId', data.departmentId);
  req.input('name', (data.name || '').trim().slice(0, 200));
  req.input('level', data.level);
  req.input('isLeader', data.isLeader ? 1 : 0);
  req.input('sortOrder', data.sortOrder ?? 0);
  const result = await req.query(`
    INSERT INTO ${ORG_DESIG} (DepartmentId, Name, Level, IsLeader, SortOrder) OUTPUT INSERTED.Id
    VALUES (@departmentId, @name, @level, @isLeader, @sortOrder)
  `);
  const id = (result.recordset as { Id: number }[])?.[0]?.Id;
  if (id == null) throw new Error('Failed to create designation');
  return id;
}

export async function updateOrgDesignation(id: number, data: { name?: string; level?: number; isLeader?: boolean; sortOrder?: number }): Promise<boolean> {
  const req = await getRequest();
  req.input('id', id);
  req.input('name', data.name !== undefined ? (data.name || '').trim().slice(0, 200) : null);
  req.input('level', data.level !== undefined ? data.level : null);
  req.input('isLeader', data.isLeader !== undefined ? (data.isLeader ? 1 : 0) : null);
  req.input('sortOrder', data.sortOrder !== undefined ? data.sortOrder : null);
  await req.query(`
    UPDATE ${ORG_DESIG} SET
      Name = ISNULL(@name, Name), Level = ISNULL(@level, Level),
      IsLeader = ISNULL(@isLeader, IsLeader), SortOrder = ISNULL(@sortOrder, SortOrder), UpdatedAt = GETDATE()
    WHERE Id = @id
  `);
  return true;
}

export async function deleteOrgDesignation(id: number): Promise<boolean> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`DELETE FROM ${ORG_DESIG} WHERE Id = @id`);
  return (result.rowsAffected[0] ?? 0) > 0;
}
