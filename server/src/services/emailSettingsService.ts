/**
 * Email settings: CRUD for react_EmailSettings. SMTP and API-based configs.
 * One config can be marked default for sending.
 */

import { getRequest } from '../db/pool';
import { config } from '../utils/config';

const SCHEMA = config.db.schema || 'dbo';
const TABLE = `[${SCHEMA}].[react_EmailSettings]`;

export type EmailSettingType = 'smtp' | 'api';
export type ApiProvider = 'sendgrid' | 'mailgun' | 'custom';

export interface EmailSettingRow {
  Id: number;
  Name: string;
  Type: string;
  IsDefault: boolean;
  IsActive: boolean;
  FromEmail: string;
  FromName: string | null;
  SmtpHost: string | null;
  SmtpPort: number | null;
  SmtpSecure: boolean;
  SmtpUsername: string | null;
  SmtpPassword: string | null;
  ApiProvider: string | null;
  ApiUrl: string | null;
  ApiKey: string | null;
  ApiDomain: string | null;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export interface EmailSettingPayload {
  id: number;
  name: string;
  type: EmailSettingType;
  isDefault: boolean;
  isActive: boolean;
  fromEmail: string;
  fromName: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUsername: string | null;
  smtpPassword: string | null;
  apiProvider: string | null;
  apiUrl: string | null;
  apiKey: string | null;
  apiDomain: string | null;
  createdAt: string;
  updatedAt: string;
}

function toPayload(row: EmailSettingRow, maskSecrets: boolean = true): EmailSettingPayload {
  const createdAt = row.CreatedAt instanceof Date ? row.CreatedAt.toISOString() : String(row.CreatedAt);
  const updatedAt = row.UpdatedAt instanceof Date ? row.UpdatedAt.toISOString() : String(row.UpdatedAt);
  const mask = (v: string | null) => (v && maskSecrets && v.length > 4 ? '••••••••' + v.slice(-4) : v);
  return {
    id: row.Id,
    name: row.Name,
    type: row.Type as EmailSettingType,
    isDefault: Boolean(row.IsDefault),
    isActive: Boolean(row.IsActive),
    fromEmail: row.FromEmail,
    fromName: row.FromName,
    smtpHost: row.SmtpHost,
    smtpPort: row.SmtpPort,
    smtpSecure: Boolean(row.SmtpSecure),
    smtpUsername: row.SmtpUsername,
    smtpPassword: mask(row.SmtpPassword) as string | null,
    apiProvider: row.ApiProvider as ApiProvider | null,
    apiUrl: row.ApiUrl,
    apiKey: mask(row.ApiKey) as string | null,
    apiDomain: row.ApiDomain,
    createdAt,
    updatedAt,
  };
}

const COLS = 'Id, Name, Type, IsDefault, IsActive, FromEmail, FromName, SmtpHost, SmtpPort, SmtpSecure, SmtpUsername, SmtpPassword, ApiProvider, ApiUrl, ApiKey, ApiDomain, CreatedAt, UpdatedAt';

export async function list(maskSecrets: boolean = true): Promise<EmailSettingPayload[]> {
  const req = await getRequest();
  const result = await req.query(`SELECT ${COLS} FROM ${TABLE} ORDER BY IsDefault DESC, Name`);
  const rows = (result.recordset || []) as EmailSettingRow[];
  return rows.map((r) => toPayload(r, maskSecrets));
}

export async function getById(id: number, maskSecrets: boolean = false): Promise<EmailSettingPayload | null> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`SELECT ${COLS} FROM ${TABLE} WHERE Id = @id`);
  const row = (result.recordset as EmailSettingRow[])?.[0];
  return row ? toPayload(row, maskSecrets) : null;
}

export async function getDefault(): Promise<EmailSettingPayload | null> {
  const req = await getRequest();
  const result = await req.query(`SELECT ${COLS} FROM ${TABLE} WHERE IsDefault = 1 AND IsActive = 1`);
  const row = (result.recordset as EmailSettingRow[])?.[0];
  return row ? toPayload(row, false) : null;
}

export interface CreateInput {
  name: string;
  type: EmailSettingType;
  isDefault?: boolean;
  isActive?: boolean;
  fromEmail: string;
  fromName?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecure?: boolean;
  smtpUsername?: string | null;
  smtpPassword?: string | null;
  apiProvider?: ApiProvider | null;
  apiUrl?: string | null;
  apiKey?: string | null;
  apiDomain?: string | null;
}

export async function create(input: CreateInput): Promise<EmailSettingPayload> {
  const req = await getRequest();
  if (input.isDefault) {
    await req.query(`UPDATE ${TABLE} SET IsDefault = 0`);
  }
  const result = await req
    .input('name', (input.name || '').trim().slice(0, 200))
    .input('type', input.type)
    .input('isDefault', input.isDefault ? 1 : 0)
    .input('isActive', input.isActive !== false ? 1 : 0)
    .input('fromEmail', (input.fromEmail || '').trim().slice(0, 256))
    .input('fromName', (input.fromName || '').trim().slice(0, 200) || null)
    .input('smtpHost', (input.smtpHost || '').trim().slice(0, 256) || null)
    .input('smtpPort', input.smtpPort ?? null)
    .input('smtpSecure', input.smtpSecure ? 1 : 0)
    .input('smtpUsername', (input.smtpUsername || '').trim().slice(0, 256) || null)
    .input('smtpPassword', input.smtpPassword ?? null)
    .input('apiProvider', (input.apiProvider || '').trim().slice(0, 50) || null)
    .input('apiUrl', (input.apiUrl || '').trim().slice(0, 500) || null)
    .input('apiKey', input.apiKey ?? null)
    .input('apiDomain', (input.apiDomain || '').trim().slice(0, 256) || null)
    .query(`
      INSERT INTO ${TABLE} (Name, Type, IsDefault, IsActive, FromEmail, FromName, SmtpHost, SmtpPort, SmtpSecure, SmtpUsername, SmtpPassword, ApiProvider, ApiUrl, ApiKey, ApiDomain, CreatedAt, UpdatedAt)
      OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.Type, INSERTED.IsDefault, INSERTED.IsActive, INSERTED.FromEmail, INSERTED.FromName,
        INSERTED.SmtpHost, INSERTED.SmtpPort, INSERTED.SmtpSecure, INSERTED.SmtpUsername, INSERTED.SmtpPassword,
        INSERTED.ApiProvider, INSERTED.ApiUrl, INSERTED.ApiKey, INSERTED.ApiDomain, INSERTED.CreatedAt, INSERTED.UpdatedAt
      VALUES (@name, @type, @isDefault, @isActive, @fromEmail, @fromName, @smtpHost, @smtpPort, @smtpSecure, @smtpUsername, @smtpPassword, @apiProvider, @apiUrl, @apiKey, @apiDomain, SYSDATETIME(), SYSDATETIME())
    `);
  const row = (result.recordset as EmailSettingRow[])?.[0];
  if (!row) throw new Error('Insert failed');
  return toPayload(row, false);
}

export interface UpdateInput {
  name?: string;
  isDefault?: boolean;
  isActive?: boolean;
  fromEmail?: string;
  fromName?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecure?: boolean;
  smtpUsername?: string | null;
  smtpPassword?: string | null;
  apiProvider?: ApiProvider | null;
  apiUrl?: string | null;
  apiKey?: string | null;
  apiDomain?: string | null;
}

export async function update(id: number, input: UpdateInput): Promise<EmailSettingPayload | null> {
  const existing = await getById(id, false);
  if (!existing) return null;
  const req = await getRequest();
  if (input.isDefault === true) {
    await req.query(`UPDATE ${TABLE} SET IsDefault = 0`);
  }
  const name = input.name !== undefined ? input.name.trim().slice(0, 200) : existing.name;
  const isDefault = input.isDefault !== undefined ? input.isDefault : existing.isDefault;
  const isActive = input.isActive !== undefined ? input.isActive : existing.isActive;
  const fromEmail = input.fromEmail !== undefined ? input.fromEmail.trim().slice(0, 256) : existing.fromEmail;
  const fromName = input.fromName !== undefined ? (input.fromName?.trim().slice(0, 200) || null) : existing.fromName;
  const smtpHost = input.smtpHost !== undefined ? (input.smtpHost?.trim().slice(0, 256) || null) : existing.smtpHost;
  const smtpPort = input.smtpPort !== undefined ? input.smtpPort : existing.smtpPort;
  const smtpSecure = input.smtpSecure !== undefined ? input.smtpSecure : existing.smtpSecure;
  const smtpUsername = input.smtpUsername !== undefined ? (input.smtpUsername?.trim().slice(0, 256) || null) : existing.smtpUsername;
  const smtpPasswordNew = input.smtpPassword !== undefined && input.smtpPassword !== '' && !String(input.smtpPassword).startsWith('••••')
    ? input.smtpPassword
    : null;
  const apiProvider = input.apiProvider !== undefined ? input.apiProvider : existing.apiProvider;
  const apiUrl = input.apiUrl !== undefined ? (input.apiUrl?.trim().slice(0, 500) || null) : existing.apiUrl;
  const apiKeyNew = input.apiKey !== undefined && input.apiKey !== '' && !String(input.apiKey).startsWith('••••')
    ? input.apiKey
    : null;
  const apiDomain = input.apiDomain !== undefined ? (input.apiDomain?.trim().slice(0, 256) || null) : existing.apiDomain;

  const req2 = await getRequest();
  await req2
    .input('id', id)
    .input('name', name)
    .input('isDefault', isDefault ? 1 : 0)
    .input('isActive', isActive ? 1 : 0)
    .input('fromEmail', fromEmail)
    .input('fromName', fromName)
    .input('smtpHost', smtpHost)
    .input('smtpPort', smtpPort)
    .input('smtpSecure', smtpSecure ? 1 : 0)
    .input('smtpUsername', smtpUsername)
    .input('smtpPassword', smtpPasswordNew)
    .input('apiProvider', apiProvider)
    .input('apiUrl', apiUrl)
    .input('apiKey', apiKeyNew)
    .input('apiDomain', apiDomain)
    .query(`
      UPDATE ${TABLE}
      SET Name = @name, IsDefault = @isDefault, IsActive = @isActive, FromEmail = @fromEmail, FromName = @fromName,
          SmtpHost = @smtpHost, SmtpPort = @smtpPort, SmtpSecure = @smtpSecure, SmtpUsername = @smtpUsername,
          SmtpPassword = CASE WHEN @smtpPassword IS NOT NULL AND LEN(@smtpPassword) > 0 THEN @smtpPassword ELSE SmtpPassword END,
          ApiProvider = @apiProvider, ApiUrl = @apiUrl,
          ApiKey = CASE WHEN @apiKey IS NOT NULL AND LEN(@apiKey) > 0 THEN @apiKey ELSE ApiKey END,
          ApiDomain = @apiDomain, UpdatedAt = SYSDATETIME()
      WHERE Id = @id
    `);
  return getById(id, false);
}

export async function setDefault(id: number): Promise<boolean> {
  const req = await getRequest();
  await req.query(`UPDATE ${TABLE} SET IsDefault = 0`);
  const result = await req.input('id', id).query(`UPDATE ${TABLE} SET IsDefault = 1 WHERE Id = @id`);
  return (result.rowsAffected?.[0] ?? 0) > 0;
}

export async function remove(id: number): Promise<boolean> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`DELETE FROM ${TABLE} WHERE Id = @id`);
  return (result.rowsAffected?.[0] ?? 0) > 0;
}
