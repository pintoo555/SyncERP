/**
 * HRMS: Employee profiles, family, bank. Uses utbl_Users_Master, sync_Department, sync_Designation.
 * Internal email (HmailServer) stored on profile; password encrypted via mailboxCrypto.
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import { encryptMailboxPassword } from '../../utils/mailboxCrypto';
import type {
  DepartmentRow,
  DesignationRow,
  EmployeeProfileRow,
  EmployeeContactNumberRow,
  EmployeeFamilyRow,
  EmployeeBankRow,
  EmployeeListItem,
} from './hrms.types';

const SCHEMA = config.db.schema || 'dbo';
const PROFILE = `[${SCHEMA}].[hrms_EmployeeProfile]`;
const OTP_TABLE = `[${SCHEMA}].[hrms_WhatsAppOtp]`;
const CONTACT_NUM = `[${SCHEMA}].[hrms_EmployeeContactNumber]`;
const FAMILY = `[${SCHEMA}].[hrms_EmployeeFamily]`;
const BANK = `[${SCHEMA}].[hrms_EmployeeBank]`;
const USERS = `[${SCHEMA}].[utbl_Users_Master]`;
const DEPT = `[${SCHEMA}].[sync_Department]`;
const DESIG = `[${SCHEMA}].[sync_Designation]`;
const ORG_DESIG = `[${SCHEMA}].[utbl_Org_Designation]`;
const USER_BRANCH = `[${SCHEMA}].[utbl_UserBranchAccess]`;
const BRANCH = `[${SCHEMA}].[utbl_Branch]`;

export async function listDepartments(): Promise<DepartmentRow[]> {
  const req = await getRequest();
  const result = await req.query(`SELECT DepartmentID AS departmentId, DepartmentName AS departmentName FROM ${DEPT} ORDER BY DepartmentName`);
  return (result.recordset || []) as DepartmentRow[];
}

export async function listDesignations(): Promise<DesignationRow[]> {
  const req = await getRequest();
  const result = await req.query(`SELECT DesignationID AS designationId, DesignationType AS designationType FROM ${DESIG} ORDER BY DesignationType`);
  return (result.recordset || []) as DesignationRow[];
}

export async function listEmployees(search?: string, departmentId?: number, isActive?: boolean, orgDesignationId?: number, branchId?: number): Promise<EmployeeListItem[]> {
  const req = await getRequest();
  req.input('search', search ? `%${search}%` : null);
  req.input('departmentId', departmentId ?? null);
  req.input('isActive', isActive === undefined ? null : (isActive ? 1 : 0));
  req.input('orgDesignationId', orgDesignationId ?? null);
  req.input('branchId', branchId ?? null);
  const hasSearch = search && search.trim().length > 0 ? 1 : 0;
  const hasDept = departmentId != null ? 1 : 0;
  const hasActiveFilter = isActive !== undefined ? 1 : 0;
  const hasDesignation = orgDesignationId != null ? 1 : 0;
  const hasBranch = branchId != null ? 1 : 0;
  req.input('hasSearch', hasSearch);
  req.input('hasDept', hasDept);
  req.input('hasActiveFilter', hasActiveFilter);
  req.input('hasDesignation', hasDesignation);
  req.input('hasBranch', hasBranch);
  const result = await req.query(`
    SELECT u.UserId AS userId, u.Name AS name, u.Email AS email, u.DepartmentID AS departmentId,
           d.DepartmentName AS departmentName, p.DesignationID AS designationId,
           COALESCE(orgDesig.Name, des.DesignationType) AS designationType,
           p.OrgDesignationId AS orgDesignationId,
           ISNULL(NULLIF(RTRIM(p.EmployeeCode), ''), 'SYNC' + RIGHT('00' + CAST(u.UserId AS VARCHAR(10)), 2)) AS employeeCode,
           p.Mobile AS mobile, p.JoinDate AS joinDate, u.IsActive AS isActive,
           uba_def.BranchId AS branchId, b.BranchName AS branchName
    FROM ${USERS} u
    LEFT JOIN ${DEPT} d ON d.DepartmentID = u.DepartmentID
    LEFT JOIN ${PROFILE} p ON p.UserID = u.UserId
    LEFT JOIN ${DESIG} des ON des.DesignationID = p.DesignationID
    LEFT JOIN ${ORG_DESIG} orgDesig ON orgDesig.Id = p.OrgDesignationId
    LEFT JOIN ${USER_BRANCH} uba_def ON uba_def.UserId = u.UserId AND uba_def.IsDefault = 1 AND uba_def.IsActive = 1
    LEFT JOIN ${BRANCH} b ON b.Id = uba_def.BranchId
    WHERE (0 = @hasSearch OR u.Name LIKE @search OR u.Email LIKE @search OR p.EmployeeCode LIKE @search OR 'SYNC' + RIGHT('00' + CAST(u.UserId AS VARCHAR(10)), 2) LIKE @search OR p.Mobile LIKE @search OR p.Phone LIKE @search OR d.DepartmentName LIKE @search)
      AND (0 = @hasDept OR u.DepartmentID = @departmentId)
      AND (0 = @hasActiveFilter OR u.IsActive = @isActive)
      AND (0 = @hasDesignation OR p.OrgDesignationId = @orgDesignationId)
      AND (0 = @hasBranch OR EXISTS (SELECT 1 FROM ${USER_BRANCH} ba WHERE ba.UserId = u.UserId AND ba.BranchId = @branchId AND ba.IsActive = 1))
    ORDER BY u.Name
  `);
  const rows = (result.recordset || []) as (EmployeeListItem & { joinDate: Date | null })[];
  return rows.map((r) => ({
    ...r,
    joinDate: r.joinDate ? new Date(r.joinDate).toISOString().slice(0, 10) : null,
    isActive: Boolean(r.isActive),
    branchId: r.branchId ?? null,
    branchName: r.branchName ?? null,
  }));
}

/** Get all branches an employee has access to. */
export async function getEmployeeBranches(userId: number): Promise<{ branchId: number; branchName: string; branchCode: string; isDefault: boolean }[]> {
  const req = await getRequest();
  const result = await req.input('userId', userId).query(`
    SELECT uba.BranchId AS branchId, b.BranchName AS branchName, b.BranchCode AS branchCode, uba.IsDefault AS isDefault
    FROM ${USER_BRANCH} uba
    INNER JOIN ${BRANCH} b ON b.Id = uba.BranchId
    WHERE uba.UserId = @userId AND uba.IsActive = 1
    ORDER BY uba.IsDefault DESC, b.BranchName
  `);
  return (result.recordset || []).map((r: any) => ({
    branchId: r.branchId,
    branchName: r.branchName,
    branchCode: r.branchCode,
    isDefault: Boolean(r.isDefault),
  }));
}

export async function getEmployeeProfile(userId: number): Promise<EmployeeProfileRow | null> {
  const req = await getRequest();
  let result: { recordset: unknown[] };
  try {
    result = await req.input('userId', userId).query(`
      SELECT UserID AS userId, DesignationID AS designationId, OrgDesignationId AS orgDesignationId, OrgDepartmentId AS orgDepartmentId, EmployeeCode AS employeeCode,
             DateOfBirth AS dateOfBirth, Gender AS gender, Phone AS phone, Mobile AS mobile,
             WhatsAppNumber AS whatsAppNumber, WhatsAppVerifiedAt AS whatsAppVerifiedAt,
             AddressLine1 AS addressLine1, AddressLine2 AS addressLine2, City AS city, State AS state, Pincode AS pincode,
             JoinDate AS joinDate, PAN AS pan, Aadhar AS aadhar, PhotoUrl AS photoUrl,
             EmergencyContact AS emergencyContact, EmergencyPhone AS emergencyPhone,
             InternalEmail AS internalEmail,
             CreatedAt AS createdAt, UpdatedAt AS updatedAt
      FROM ${PROFILE} WHERE UserID = @userId
    `);
  } catch {
    const req2 = await getRequest();
    result = await req2.input('userId', userId).query(`
      SELECT UserID AS userId, DesignationID AS designationId, OrgDesignationId AS orgDesignationId, OrgDepartmentId AS orgDepartmentId, EmployeeCode AS employeeCode,
             DateOfBirth AS dateOfBirth, Gender AS gender, Phone AS phone, Mobile AS mobile,
             AddressLine1 AS addressLine1, AddressLine2 AS addressLine2, City AS city, State AS state, Pincode AS pincode,
             JoinDate AS joinDate, PAN AS pan, Aadhar AS aadhar, PhotoUrl AS photoUrl,
             EmergencyContact AS emergencyContact, EmergencyPhone AS emergencyPhone,
             InternalEmail AS internalEmail,
             CreatedAt AS createdAt, UpdatedAt AS updatedAt
      FROM ${PROFILE} WHERE UserID = @userId
    `);
  }
  const row = result.recordset[0] as (EmployeeProfileRow & { dateOfBirth?: Date; joinDate?: Date; whatsAppVerifiedAt?: Date }) | undefined;
  if (!row) return null;
  const displayEmployeeCode = row.employeeCode?.trim() || 'SYNC' + String(userId).padStart(2, '0');
  return {
    ...row,
    employeeCode: displayEmployeeCode,
    dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth).toISOString().slice(0, 10) : null,
    joinDate: row.joinDate ? new Date(row.joinDate).toISOString().slice(0, 10) : null,
    whatsAppNumber: (row as { whatsAppNumber?: string }).whatsAppNumber ?? null,
    whatsAppVerifiedAt: row.whatsAppVerifiedAt ? new Date(row.whatsAppVerifiedAt).toISOString() : null,
    internalEmail: (row as { internalEmail?: string }).internalEmail ?? null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export async function upsertEmployeeProfile(
  userId: number,
  data: Partial<Omit<EmployeeProfileRow, 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const req = await getRequest();
  const dob = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
  const joinDate = data.joinDate ? new Date(data.joinDate) : null;
  const employeeCode = 'SYNC' + String(userId).padStart(2, '0');
  req.input('userId', userId);
  req.input('designationId', data.designationId ?? null);
  req.input('orgDesignationId', data.orgDesignationId ?? null);
  req.input('orgDepartmentId', data.orgDepartmentId ?? null);
  req.input('employeeCode', employeeCode);
  req.input('dateOfBirth', dob);
  req.input('gender', (data.gender ?? '').trim().slice(0, 20) || null);
  req.input('phone', (data.phone ?? '').trim().slice(0, 30) || null);
  req.input('mobile', (data.mobile ?? '').trim().slice(0, 30) || null);
  req.input('addressLine1', (data.addressLine1 ?? '').trim().slice(0, 200) || null);
  req.input('addressLine2', (data.addressLine2 ?? '').trim().slice(0, 200) || null);
  req.input('city', (data.city ?? '').trim().slice(0, 100) || null);
  req.input('state', (data.state ?? '').trim().slice(0, 100) || null);
  req.input('pincode', (data.pincode ?? '').trim().slice(0, 20) || null);
  req.input('joinDate', joinDate);
  req.input('pan', (data.pan ?? '').trim().slice(0, 20) || null);
  req.input('aadhar', (data.aadhar ?? '').trim().slice(0, 20) || null);
  req.input('photoUrl', (data.photoUrl ?? '').trim().slice(0, 500) || null);
  req.input('emergencyContact', (data.emergencyContact ?? '').trim().slice(0, 100) || null);
  req.input('emergencyPhone', (data.emergencyPhone ?? '').trim().slice(0, 30) || null);
  const internalEmail = data.internalEmail !== undefined ? (data.internalEmail ?? '').trim().slice(0, 256) || null : null;
  const internalPasswordPlain = data.internalEmailPassword;
  let internalPasswordEnc: string | null = null;
  let hasInternalPassword = 0;
  if (internalPasswordPlain !== undefined) {
    hasInternalPassword = 1;
    internalPasswordEnc = internalPasswordPlain && String(internalPasswordPlain).trim() ? encryptMailboxPassword(String(internalPasswordPlain).trim()) : null;
  }
  req.input('internalEmail', internalEmail);
  req.input('internalEmailPasswordEnc', internalPasswordEnc);
  req.input('hasInternalPassword', hasInternalPassword);
  await req.query(`
    MERGE ${PROFILE} AS t
    USING (SELECT @userId AS UserID) AS s ON t.UserID = s.UserID
    WHEN MATCHED THEN
      UPDATE SET DesignationID = ISNULL(@designationId, t.DesignationID),
        OrgDesignationId = ISNULL(@orgDesignationId, t.OrgDesignationId),
        OrgDepartmentId = ISNULL(@orgDepartmentId, t.OrgDepartmentId),
        EmployeeCode = @employeeCode, DateOfBirth = @dateOfBirth,
        Gender = @gender, Phone = @phone, Mobile = @mobile,
        AddressLine1 = @addressLine1, AddressLine2 = @addressLine2,
        City = @city, State = @state, Pincode = @pincode, JoinDate = @joinDate, PAN = @pan, Aadhar = @aadhar,
        PhotoUrl = @photoUrl, EmergencyContact = @emergencyContact, EmergencyPhone = @emergencyPhone,
        InternalEmail = COALESCE(@internalEmail, t.InternalEmail),
        InternalEmailPassword = CASE WHEN @hasInternalPassword = 1 THEN @internalEmailPasswordEnc ELSE t.InternalEmailPassword END,
        UpdatedAt = GETDATE()
    WHEN NOT MATCHED THEN
      INSERT (UserID, DesignationID, OrgDesignationId, OrgDepartmentId, EmployeeCode, DateOfBirth, Gender, Phone, Mobile, AddressLine1, AddressLine2,
        City, State, Pincode, JoinDate, PAN, Aadhar, PhotoUrl, EmergencyContact, EmergencyPhone, InternalEmail, InternalEmailPassword)
      VALUES (@userId, @designationId, @orgDesignationId, @orgDepartmentId, @employeeCode, @dateOfBirth, @gender, @phone, @mobile, @addressLine1, @addressLine2,
        @city, @state, @pincode, @joinDate, @pan, @aadhar, @photoUrl, @emergencyContact, @emergencyPhone, @internalEmail, @internalEmailPasswordEnc);
  `);
}

export async function listFamily(employeeUserId: number): Promise<EmployeeFamilyRow[]> {
  const req = await getRequest();
  const result = await req.input('employeeUserId', employeeUserId).query(`
    SELECT Id AS id, EmployeeUserID AS employeeUserId, Relation AS relation, FullName AS fullName,
           DateOfBirth AS dateOfBirth, Contact AS contact, IsDependent AS isDependent,
           CreatedAt AS createdAt, UpdatedAt AS updatedAt
    FROM ${FAMILY} WHERE EmployeeUserID = @employeeUserId ORDER BY Id
  `);
  const rows = (result.recordset || []) as (EmployeeFamilyRow & { dateOfBirth?: Date })[];
  return rows.map((r) => ({
    ...r,
    dateOfBirth: r.dateOfBirth ? new Date(r.dateOfBirth).toISOString().slice(0, 10) : null,
    isDependent: Boolean(r.isDependent),
  }));
}

export async function addFamilyMember(
  employeeUserId: number,
  data: { relation: string; fullName: string; dateOfBirth?: string; contact?: string; isDependent?: boolean }
): Promise<number> {
  const req = await getRequest();
  req.input('employeeUserId', employeeUserId);
  req.input('relation', (data.relation || '').trim().slice(0, 50));
  req.input('fullName', (data.fullName || '').trim().slice(0, 100));
  req.input('dateOfBirth', data.dateOfBirth ? new Date(data.dateOfBirth) : null);
  req.input('contact', (data.contact ?? '').trim().slice(0, 30) || null);
  req.input('isDependent', data.isDependent ? 1 : 0);
  const result = await req.query(`
    INSERT INTO ${FAMILY} (EmployeeUserID, Relation, FullName, DateOfBirth, Contact, IsDependent)
    OUTPUT INSERTED.Id VALUES (@employeeUserId, @relation, @fullName, @dateOfBirth, @contact, @isDependent)
  `);
  const id = (result.recordset[0] as { Id: number })?.Id;
  return id ?? 0;
}

export async function updateFamilyMember(
  id: number,
  employeeUserId: number,
  data: { relation?: string; fullName?: string; dateOfBirth?: string; contact?: string; isDependent?: boolean }
): Promise<boolean> {
  const req = await getRequest();
  req.input('id', id);
  req.input('employeeUserId', employeeUserId);
  req.input('relation', (data.relation ?? '').trim().slice(0, 50));
  req.input('fullName', (data.fullName ?? '').trim().slice(0, 100));
  req.input('dateOfBirth', data.dateOfBirth ? new Date(data.dateOfBirth) : null);
  req.input('contact', (data.contact ?? '').trim().slice(0, 30) || null);
  req.input('isDependent', data.isDependent ? 1 : 0);
  const result = await req.query(`
    UPDATE ${FAMILY} SET Relation = @relation, FullName = @fullName, DateOfBirth = @dateOfBirth, Contact = @contact, IsDependent = @isDependent, UpdatedAt = GETDATE()
    WHERE Id = @id AND EmployeeUserID = @employeeUserId
  `);
  return (result.rowsAffected[0] ?? 0) > 0;
}

export async function deleteFamilyMember(id: number, employeeUserId: number): Promise<boolean> {
  const req = await getRequest();
  const result = await req.input('id', id).input('employeeUserId', employeeUserId).query(`
    DELETE FROM ${FAMILY} WHERE Id = @id AND EmployeeUserID = @employeeUserId
  `);
  return (result.rowsAffected[0] ?? 0) > 0;
}

export async function listContactNumbers(employeeUserId: number): Promise<EmployeeContactNumberRow[]> {
  const req = await getRequest();
  const result = await req.input('employeeUserId', employeeUserId).query(`
    SELECT Id AS id, EmployeeUserID AS employeeUserId, Type AS type, Number AS number, CreatedAt AS createdAt
    FROM ${CONTACT_NUM} WHERE EmployeeUserID = @employeeUserId ORDER BY Type, Id
  `);
  const rows = (result.recordset || []) as (EmployeeContactNumberRow & { createdAt?: Date })[];
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
  }));
}

export async function addContactNumber(
  employeeUserId: number,
  data: { type: 'extension' | 'voip'; number: string }
): Promise<number> {
  const req = await getRequest();
  const num = (data.number ?? '').trim().slice(0, 50);
  if (!num) throw new Error('Number is required');
  const result = await req
    .input('employeeUserId', employeeUserId)
    .input('type', data.type === 'voip' ? 'voip' : 'extension')
    .input('number', num)
    .query(`
    INSERT INTO ${CONTACT_NUM} (EmployeeUserID, Type, Number)
    OUTPUT INSERTED.Id VALUES (@employeeUserId, @type, @number)
  `);
  const id = (result.recordset[0] as { Id: number })?.Id;
  return id ?? 0;
}

export async function updateContactNumber(
  id: number,
  employeeUserId: number,
  data: { number: string }
): Promise<boolean> {
  const req = await getRequest();
  const num = (data.number ?? '').trim().slice(0, 50);
  if (!num) return false;
  const result = await req
    .input('id', id)
    .input('employeeUserId', employeeUserId)
    .input('number', num)
    .query(`
    UPDATE ${CONTACT_NUM} SET Number = @number WHERE Id = @id AND EmployeeUserID = @employeeUserId
  `);
  return (result.rowsAffected[0] ?? 0) > 0;
}

export async function deleteContactNumber(id: number, employeeUserId: number): Promise<boolean> {
  const req = await getRequest();
  const result = await req.input('id', id).input('employeeUserId', employeeUserId).query(`
    DELETE FROM ${CONTACT_NUM} WHERE Id = @id AND EmployeeUserID = @employeeUserId
  `);
  return (result.rowsAffected[0] ?? 0) > 0;
}

export async function getEmployeeBank(employeeUserId: number): Promise<EmployeeBankRow | null> {
  const req = await getRequest();
  const result = await req.input('employeeUserId', employeeUserId).query(`
    SELECT Id AS id, EmployeeUserID AS employeeUserId, BankName AS bankName, AccountNumber AS accountNumber,
           IFSC AS ifsc, Branch AS branch, AccountType AS accountType, IsPrimary AS isPrimary,
           CreatedAt AS createdAt, UpdatedAt AS updatedAt
    FROM ${BANK} WHERE EmployeeUserID = @employeeUserId AND IsPrimary = 1
  `);
  const row = result.recordset[0] as EmployeeBankRow | undefined;
  return row ?? null;
}

export async function upsertEmployeeBank(
  employeeUserId: number,
  data: { bankName?: string; accountNumber?: string; ifsc?: string; branch?: string; accountType?: string }
): Promise<void> {
  const req = await getRequest();
  req.input('employeeUserId', employeeUserId);
  req.input('bankName', (data.bankName ?? '').trim().slice(0, 100) || null);
  req.input('accountNumber', (data.accountNumber ?? '').trim().slice(0, 50) || null);
  req.input('ifsc', (data.ifsc ?? '').trim().slice(0, 20) || null);
  req.input('branch', (data.branch ?? '').trim().slice(0, 100) || null);
  req.input('accountType', (data.accountType ?? '').trim().slice(0, 50) || null);
  await req.query(`
    MERGE ${BANK} AS t
    USING (SELECT @employeeUserId AS EmployeeUserID) AS s ON t.EmployeeUserID = s.EmployeeUserID AND t.IsPrimary = 1
    WHEN MATCHED THEN
      UPDATE SET BankName = @bankName, AccountNumber = @accountNumber, IFSC = @ifsc, Branch = @branch, AccountType = @accountType, UpdatedAt = GETDATE()
    WHEN NOT MATCHED THEN
      INSERT (EmployeeUserID, BankName, AccountNumber, IFSC, Branch, AccountType, IsPrimary)
      VALUES (@employeeUserId, @bankName, @accountNumber, @ifsc, @branch, @accountType, 1);
  `);
}

export async function updateUserDepartmentAndName(
  userId: number,
  data: { departmentId?: number | null; name?: string; email?: string | null; username?: string | null }
): Promise<boolean> {
  const req = await getRequest();
  req.input('userId', userId);
  req.input('departmentId', data.departmentId ?? null);
  req.input('name', (data.name ?? '').trim().slice(0, 200));
  const emailProvided = data.email !== undefined ? 1 : 0;
  const usernameProvided = data.username !== undefined ? 1 : 0;
  req.input('email', data.email !== undefined ? (data.email ?? '').trim().slice(0, 256) || null : null);
  req.input('username', data.username !== undefined ? (data.username ?? '').trim().slice(0, 256) || null : null);
  req.input('emailProvided', emailProvided);
  req.input('usernameProvided', usernameProvided);
  const result = await req.query(`
    UPDATE ${USERS} SET DepartmentID = @departmentId, Name = @name,
      Email = CASE WHEN @emailProvided = 1 THEN @email ELSE Email END,
      Username = CASE WHEN @usernameProvided = 1 THEN @username ELSE Username END,
      UpdatedAt = GETDATE()
    WHERE UserId = @userId
  `);
  return (result.rowsAffected[0] ?? 0) > 0;
}

export async function getUserNameAndEmail(userId: number): Promise<{ name: string; email: string } | null> {
  const req = await getRequest();
  const result = await req.input('userId', userId).query(`SELECT Name AS name, Email AS email FROM ${USERS} WHERE UserId = @userId`);
  const row = result.recordset[0] as { name: string; email: string } | undefined;
  return row ?? null;
}

/** Normalize WhatsApp number: +country + 10 digits. Indian 10-digit -> +91. */
function normalizeWhatsAppNumber(value: string): string {
  let s = String(value).replace(/\s/g, '').replace(/^0+/, '');
  if (!s) return '';
  if (s.startsWith('+')) {
    const digits = s.slice(1).replace(/\D/g, '');
    return digits.length >= 10 ? '+' + digits.slice(0, 13) : '';
  }
  const digits = s.replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) return '+91' + digits;
  if (digits.length >= 11) return '+' + digits.slice(0, 13);
  return '';
}

/** Send WhatsApp OTP. Stores OTP in DB (5 min expiry), sends via Ultramsg. */
export async function sendWhatsAppOtp(userId: number, phone: string): Promise<{ success: boolean; error?: string }> {
  const normalized = normalizeWhatsAppNumber(phone);
  if (!normalized || normalized.length < 12) return { success: false, error: 'Invalid WhatsApp number. Use country code + 10 digits (e.g. +919876543210)' };
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  try {
    const delReq = await getRequest();
    await delReq.input('userId', userId).input('phoneNumber', normalized).query(`DELETE FROM ${OTP_TABLE} WHERE UserID = @userId AND PhoneNumber = @phoneNumber`);
    const insReq = await getRequest();
    await insReq.input('userId', userId).input('phoneNumber', normalized).input('otpCode', otp).query(
      `INSERT INTO ${OTP_TABLE} (UserID, PhoneNumber, OtpCode, ExpiresAt) VALUES (@userId, @phoneNumber, @otpCode, DATEADD(minute, 5, GETDATE()))`
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Invalid object name|does not exist/i.test(msg)) {
      return { success: false, error: 'WhatsApp verification not configured. Run database migration 020_hrms_whatsapp_verified.sql' };
    }
    throw e;
  }
  const commService = await import('../../services/communicationService');
  const sent = await commService.sendWhatsAppText(normalized, `Your WhatsApp verification code is: ${otp}. Valid for 5 minutes.`, userId);
  if (!sent.success) {
    const delReq = await getRequest();
    await delReq.input('userId', userId).input('phoneNumber', normalized).query(`DELETE FROM ${OTP_TABLE} WHERE UserID = @userId AND PhoneNumber = @phoneNumber`);
    return { success: false, error: sent.error ?? 'Failed to send OTP. Configure WhatsApp channel in Settings → Communication Sandbox.' };
  }
  return { success: true };
}

/** Verify WhatsApp OTP and update profile. Clears verified state if number changes. */
export async function verifyWhatsAppOtp(userId: number, phone: string, code: string): Promise<{ success: boolean; error?: string }> {
  const normalized = normalizeWhatsAppNumber(phone);
  if (!normalized) return { success: false, error: 'Invalid WhatsApp number' };
  const trimmedCode = String(code).replace(/\D/g, '').slice(0, 6);
  if (!trimmedCode || trimmedCode.length < 6) return { success: false, error: 'Invalid OTP code' };
  const selectReq = await getRequest();
  const result = await selectReq
    .input('userId', userId)
    .input('phoneNumber', normalized)
    .input('otpCode', trimmedCode)
    .query(`
      SELECT Id FROM ${OTP_TABLE}
      WHERE UserID = @userId AND PhoneNumber = @phoneNumber AND OtpCode = @otpCode AND ExpiresAt > GETDATE()
    `);
  const row = (result.recordset as { Id: number }[])?.[0];
  if (!row) return { success: false, error: 'Invalid or expired OTP. Request a new code.' };
  const delReq = await getRequest();
  await delReq.input('userId', userId).query(`DELETE FROM ${OTP_TABLE} WHERE UserID = @userId`);
  const mergeReq = await getRequest();
  await mergeReq.input('userId', userId).input('phoneNumber', normalized).query(`
    MERGE ${PROFILE} AS t
    USING (SELECT @userId AS UserID, @phoneNumber AS WhatsAppNumber) AS s ON t.UserID = s.UserID
    WHEN MATCHED THEN UPDATE SET WhatsAppNumber = s.WhatsAppNumber, WhatsAppVerifiedAt = GETDATE(), UpdatedAt = GETDATE()
    WHEN NOT MATCHED THEN INSERT (UserID, WhatsAppNumber, WhatsAppVerifiedAt, CreatedAt, UpdatedAt)
    VALUES (s.UserID, s.WhatsAppNumber, GETDATE(), GETDATE(), GETDATE());
  `);
  return { success: true };
}

/** Clear WhatsApp number and verified state for the user. Self only. */
export async function clearWhatsAppNumber(userId: number): Promise<void> {
  const req = await getRequest();
  await req.input('userId', userId).query(`
    UPDATE ${PROFILE}
    SET WhatsAppNumber = NULL, WhatsAppVerifiedAt = NULL, UpdatedAt = GETDATE()
    WHERE UserID = @userId
  `);
}

/** Get employee's verified WhatsApp number (non-null only if verified). */
export async function getEmployeeVerifiedWhatsApp(userId: number): Promise<string | null> {
  const req = await getRequest();
  const result = await req.input('userId', userId).query(`
    SELECT WhatsAppNumber AS whatsAppNumber FROM ${PROFILE}
    WHERE UserID = @userId AND WhatsAppNumber IS NOT NULL AND WhatsAppVerifiedAt IS NOT NULL
  `);
  const row = (result.recordset as { whatsAppNumber: string }[])?.[0];
  return row?.whatsAppNumber?.trim() ?? null;
}

/** Send a WhatsApp message to an employee's verified number. Returns success/error. */
export async function sendWhatsAppToEmployee(
  employeeUserId: number,
  message: string,
  sentByUserId: number | null
): Promise<{ success: boolean; error?: string }> {
  const to = await getEmployeeVerifiedWhatsApp(employeeUserId);
  if (!to) return { success: false, error: 'Employee has no verified WhatsApp number' };
  const commService = await import('../../services/communicationService');
  return commService.sendWhatsAppText(to, message, sentByUserId);
}
