/**
 * Company Brand Kit – colors, logo, fonts for WhatsApp, emails, reports, PDFs.
 */

import { getRequest } from '../config/db';

const TABLE = 'dbo.react_BrandKit';
const DEFAULT_ID = 1;

export interface BrandKitRow {
  id: number;
  companyName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  backgroundColor: string | null;
  textColor: string | null;
  fontHeading: string | null;
  fontBody: string | null;
  updatedAt: string;
}

function toCamel(r: Record<string, unknown>): BrandKitRow {
  return {
    id: Number(r.Id ?? r.id ?? DEFAULT_ID),
    companyName: r.CompanyName != null || r.companyName != null ? String(r.CompanyName ?? r.companyName) : null,
    logoUrl: r.LogoUrl != null || r.logoUrl != null ? String(r.LogoUrl ?? r.logoUrl) : null,
    primaryColor: r.PrimaryColor != null || r.primaryColor != null ? String(r.PrimaryColor ?? r.primaryColor) : null,
    secondaryColor: r.SecondaryColor != null || r.secondaryColor != null ? String(r.SecondaryColor ?? r.secondaryColor) : null,
    accentColor: r.AccentColor != null || r.accentColor != null ? String(r.AccentColor ?? r.accentColor) : null,
    backgroundColor: r.BackgroundColor != null || r.backgroundColor != null ? String(r.BackgroundColor ?? r.backgroundColor) : null,
    textColor: r.TextColor != null || r.textColor != null ? String(r.TextColor ?? r.textColor) : null,
    fontHeading: r.FontHeading != null || r.fontHeading != null ? String(r.FontHeading ?? r.fontHeading) : null,
    fontBody: r.FontBody != null || r.fontBody != null ? String(r.FontBody ?? r.fontBody) : null,
    updatedAt: String(r.UpdatedAt ?? r.updatedAt ?? ''),
  };
}

const HEX = /^#[0-9A-Fa-f]{6}$/;
function validHex(s: string | null | undefined): boolean {
  return !s || s.trim() === '' || HEX.test(s.trim());
}

export async function getBrandKit(): Promise<BrandKitRow | null> {
  const req = await getRequest();
  req.input('id', DEFAULT_ID);
  const result = await req.query(`SELECT * FROM ${TABLE} WHERE Id = @id`);
  const row = result.recordset?.[0] as Record<string, unknown> | undefined;
  return row ? toCamel(row) : null;
}

function normHex(v: string | null | undefined): string | null {
  const s = (v ?? '').trim().slice(0, 7);
  if (!s) return null;
  if (!validHex(s)) throw new Error('Invalid hex color; use e.g. #3b82f6');
  return s;
}

export async function updateBrandKit(data: {
  companyName?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  backgroundColor?: string | null;
  textColor?: string | null;
  fontHeading?: string | null;
  fontBody?: string | null;
}): Promise<BrandKitRow> {
  const current = await getBrandKit();
  const companyName = data.companyName !== undefined ? (data.companyName ?? '').trim().slice(0, 200) || null : (current?.companyName ?? null);
  const logoUrl = data.logoUrl !== undefined ? (data.logoUrl ?? '').trim().slice(0, 500) || null : (current?.logoUrl ?? null);
  const primaryColor = data.primaryColor !== undefined ? normHex(data.primaryColor) : (current?.primaryColor ?? null);
  const secondaryColor = data.secondaryColor !== undefined ? normHex(data.secondaryColor) : (current?.secondaryColor ?? null);
  const accentColor = data.accentColor !== undefined ? normHex(data.accentColor) : (current?.accentColor ?? null);
  const backgroundColor = data.backgroundColor !== undefined ? normHex(data.backgroundColor) : (current?.backgroundColor ?? null);
  const textColor = data.textColor !== undefined ? normHex(data.textColor) : (current?.textColor ?? null);
  const fontHeading = data.fontHeading !== undefined ? (data.fontHeading ?? '').trim().slice(0, 100) || null : (current?.fontHeading ?? null);
  const fontBody = data.fontBody !== undefined ? (data.fontBody ?? '').trim().slice(0, 100) || null : (current?.fontBody ?? null);

  const req = await getRequest();
  req.input('id', DEFAULT_ID);
  req.input('companyName', companyName);
  req.input('logoUrl', logoUrl);
  req.input('primaryColor', primaryColor);
  req.input('secondaryColor', secondaryColor);
  req.input('accentColor', accentColor);
  req.input('backgroundColor', backgroundColor);
  req.input('textColor', textColor);
  req.input('fontHeading', fontHeading);
  req.input('fontBody', fontBody);

  await req.query(`
    MERGE ${TABLE} AS t
    USING (SELECT @id AS Id, @companyName AS CompanyName, @logoUrl AS LogoUrl, @primaryColor AS PrimaryColor, @secondaryColor AS SecondaryColor,
      @accentColor AS AccentColor, @backgroundColor AS BackgroundColor, @textColor AS TextColor, @fontHeading AS FontHeading, @fontBody AS FontBody) AS s
    ON t.Id = s.Id
    WHEN MATCHED THEN UPDATE SET
      CompanyName = s.CompanyName, LogoUrl = s.LogoUrl, PrimaryColor = s.PrimaryColor, SecondaryColor = s.SecondaryColor,
      AccentColor = s.AccentColor, BackgroundColor = s.BackgroundColor, TextColor = s.TextColor, FontHeading = s.FontHeading, FontBody = s.FontBody,
      UpdatedAt = GETDATE()
    WHEN NOT MATCHED THEN INSERT (Id, CompanyName, LogoUrl, PrimaryColor, SecondaryColor, AccentColor, BackgroundColor, TextColor, FontHeading, FontBody, UpdatedAt)
    VALUES (s.Id, s.CompanyName, s.LogoUrl, s.PrimaryColor, s.SecondaryColor, s.AccentColor, s.BackgroundColor, s.TextColor, s.FontHeading, s.FontBody, GETDATE());
  `);

  const updated = await getBrandKit();
  if (!updated) throw new Error('Brand kit not found after update');
  return updated;
}
