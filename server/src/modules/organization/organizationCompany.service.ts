/**
 * Company service: CRUD for utbl_Company.
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type { CompanyRow } from './organization.types';

const SCHEMA = config.db.schema || 'dbo';
const COMPANY = `[${SCHEMA}].[utbl_Company]`;

function dateToIso(d: unknown): string {
  return d instanceof Date ? d.toISOString() : String(d ?? '');
}
function dateToIsoOrNull(d: unknown): string | null {
  if (d == null) return null;
  return d instanceof Date ? d.toISOString() : String(d);
}

export async function listCompanies(activeOnly = false): Promise<CompanyRow[]> {
  const req = await getRequest();
  req.input('activeOnly', activeOnly ? 1 : 0);
  const result = await req.query(`
    SELECT Id AS id, CompanyCode AS companyCode, LegalName AS legalName, TradeName AS tradeName,
           TaxRegistrationNumber AS taxRegistrationNumber, TaxRegistrationType AS taxRegistrationType,
           PAN AS pan, CIN AS cin, DefaultJurisdictionId AS defaultJurisdictionId,
           BankName AS bankName, BankAccountNumber AS bankAccountNumber, BankIFSC AS bankIFSC, BankBranch AS bankBranch,
           AddressLine1 AS addressLine1, AddressLine2 AS addressLine2, City AS city,
           StateId AS stateId, CountryId AS countryId, Pincode AS pincode,
           Phone AS phone, Email AS email, Website AS website, LogoUrl AS logoUrl,
           IsActive AS isActive, CreatedOn AS createdOn, CreatedBy AS createdBy,
           UpdatedOn AS updatedOn, UpdatedBy AS updatedBy
    FROM ${COMPANY}
    WHERE (@activeOnly = 0 OR IsActive = 1)
    ORDER BY LegalName
  `);
  return (result.recordset || []).map((r: any) => ({
    ...r,
    createdOn: dateToIso(r.createdOn),
    updatedOn: dateToIsoOrNull(r.updatedOn),
  }));
}

export async function getCompany(id: number): Promise<CompanyRow | null> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`
    SELECT Id AS id, CompanyCode AS companyCode, LegalName AS legalName, TradeName AS tradeName,
           TaxRegistrationNumber AS taxRegistrationNumber, TaxRegistrationType AS taxRegistrationType,
           PAN AS pan, CIN AS cin, DefaultJurisdictionId AS defaultJurisdictionId,
           BankName AS bankName, BankAccountNumber AS bankAccountNumber, BankIFSC AS bankIFSC, BankBranch AS bankBranch,
           AddressLine1 AS addressLine1, AddressLine2 AS addressLine2, City AS city,
           StateId AS stateId, CountryId AS countryId, Pincode AS pincode,
           Phone AS phone, Email AS email, Website AS website, LogoUrl AS logoUrl,
           IsActive AS isActive, CreatedOn AS createdOn, CreatedBy AS createdBy,
           UpdatedOn AS updatedOn, UpdatedBy AS updatedBy
    FROM ${COMPANY} WHERE Id = @id
  `);
  const r = (result.recordset as any[])?.[0];
  if (!r) return null;
  return { ...r, createdOn: dateToIso(r.createdOn), updatedOn: dateToIsoOrNull(r.updatedOn) };
}

export async function createCompany(data: {
  companyCode: string; legalName: string; tradeName?: string;
  taxRegistrationNumber?: string; taxRegistrationType?: string; pan?: string; cin?: string;
  defaultJurisdictionId?: number; bankName?: string; bankAccountNumber?: string; bankIFSC?: string; bankBranch?: string;
  addressLine1?: string; addressLine2?: string; city?: string; stateId?: number; countryId?: number; pincode?: string;
  phone?: string; email?: string; website?: string; logoUrl?: string;
}, userId: number | null): Promise<number> {
  const req = await getRequest();
  req.input('code', (data.companyCode || '').trim().slice(0, 20));
  req.input('legalName', (data.legalName || '').trim().slice(0, 300));
  req.input('tradeName', (data.tradeName || '').trim().slice(0, 300) || null);
  req.input('taxRegNo', (data.taxRegistrationNumber || '').trim().slice(0, 50) || null);
  req.input('taxRegType', (data.taxRegistrationType || '').trim().slice(0, 50) || null);
  req.input('pan', (data.pan || '').trim().slice(0, 20) || null);
  req.input('cin', (data.cin || '').trim().slice(0, 30) || null);
  req.input('jurisdictionId', data.defaultJurisdictionId ?? null);
  req.input('bankName', (data.bankName || '').trim().slice(0, 200) || null);
  req.input('bankAccNo', (data.bankAccountNumber || '').trim().slice(0, 50) || null);
  req.input('bankIFSC', (data.bankIFSC || '').trim().slice(0, 20) || null);
  req.input('bankBranch', (data.bankBranch || '').trim().slice(0, 200) || null);
  req.input('addr1', (data.addressLine1 || '').trim().slice(0, 300) || null);
  req.input('addr2', (data.addressLine2 || '').trim().slice(0, 300) || null);
  req.input('city', (data.city || '').trim().slice(0, 100) || null);
  req.input('stateId', data.stateId ?? null);
  req.input('countryId', data.countryId ?? null);
  req.input('pincode', (data.pincode || '').trim().slice(0, 20) || null);
  req.input('phone', (data.phone || '').trim().slice(0, 30) || null);
  req.input('email', (data.email || '').trim().slice(0, 200) || null);
  req.input('website', (data.website || '').trim().slice(0, 300) || null);
  req.input('logoUrl', (data.logoUrl || '').trim().slice(0, 500) || null);
  req.input('createdBy', userId);
  const result = await req.query(`
    INSERT INTO ${COMPANY} (CompanyCode, LegalName, TradeName, TaxRegistrationNumber, TaxRegistrationType,
      PAN, CIN, DefaultJurisdictionId, BankName, BankAccountNumber, BankIFSC, BankBranch,
      AddressLine1, AddressLine2, City, StateId, CountryId, Pincode, Phone, Email, Website, LogoUrl, CreatedBy)
    OUTPUT INSERTED.Id
    VALUES (@code, @legalName, @tradeName, @taxRegNo, @taxRegType, @pan, @cin, @jurisdictionId,
      @bankName, @bankAccNo, @bankIFSC, @bankBranch, @addr1, @addr2, @city, @stateId, @countryId,
      @pincode, @phone, @email, @website, @logoUrl, @createdBy)
  `);
  return (result.recordset as { Id: number }[])[0].Id;
}

export async function updateCompany(id: number, data: Partial<{
  companyCode: string; legalName: string; tradeName: string;
  taxRegistrationNumber: string; taxRegistrationType: string; pan: string; cin: string;
  defaultJurisdictionId: number; bankName: string; bankAccountNumber: string; bankIFSC: string; bankBranch: string;
  addressLine1: string; addressLine2: string; city: string; stateId: number; countryId: number; pincode: string;
  phone: string; email: string; website: string; logoUrl: string; isActive: boolean;
}>, userId: number | null): Promise<boolean> {
  const req = await getRequest();
  req.input('id', id);
  req.input('code', data.companyCode !== undefined ? (data.companyCode || '').trim().slice(0, 20) : null);
  req.input('legalName', data.legalName !== undefined ? (data.legalName || '').trim().slice(0, 300) : null);
  req.input('tradeName', data.tradeName !== undefined ? (data.tradeName || '').trim().slice(0, 300) : null);
  req.input('taxRegNo', data.taxRegistrationNumber !== undefined ? (data.taxRegistrationNumber || '').trim().slice(0, 50) : null);
  req.input('taxRegType', data.taxRegistrationType !== undefined ? (data.taxRegistrationType || '').trim().slice(0, 50) : null);
  req.input('pan', data.pan !== undefined ? (data.pan || '').trim().slice(0, 20) : null);
  req.input('cin', data.cin !== undefined ? (data.cin || '').trim().slice(0, 30) : null);
  req.input('jurisdictionId', data.defaultJurisdictionId !== undefined ? data.defaultJurisdictionId : null);
  req.input('bankName', data.bankName !== undefined ? (data.bankName || '').trim().slice(0, 200) : null);
  req.input('bankAccNo', data.bankAccountNumber !== undefined ? (data.bankAccountNumber || '').trim().slice(0, 50) : null);
  req.input('bankIFSC', data.bankIFSC !== undefined ? (data.bankIFSC || '').trim().slice(0, 20) : null);
  req.input('bankBranch', data.bankBranch !== undefined ? (data.bankBranch || '').trim().slice(0, 200) : null);
  req.input('isActive', data.isActive !== undefined ? (data.isActive ? 1 : 0) : null);
  req.input('updatedBy', userId);
  await req.query(`
    UPDATE ${COMPANY} SET
      CompanyCode = ISNULL(@code, CompanyCode), LegalName = ISNULL(@legalName, LegalName),
      TradeName = ISNULL(@tradeName, TradeName), TaxRegistrationNumber = ISNULL(@taxRegNo, TaxRegistrationNumber),
      TaxRegistrationType = ISNULL(@taxRegType, TaxRegistrationType), PAN = ISNULL(@pan, PAN), CIN = ISNULL(@cin, CIN),
      DefaultJurisdictionId = ISNULL(@jurisdictionId, DefaultJurisdictionId),
      BankName = ISNULL(@bankName, BankName), BankAccountNumber = ISNULL(@bankAccNo, BankAccountNumber),
      BankIFSC = ISNULL(@bankIFSC, BankIFSC), BankBranch = ISNULL(@bankBranch, BankBranch),
      IsActive = ISNULL(@isActive, IsActive), UpdatedOn = GETDATE(), UpdatedBy = @updatedBy
    WHERE Id = @id
  `);
  return true;
}
