/**
 * Copy data from existing (source) database to new (target) database.
 * Only copies tables used by the ERP project. Does not touch other tables on source.
 *
 * Prerequisites:
 *   - Target DB already has schema (run run-migrations-new-server.ts first).
 *   - Source DB has the data (existing server).
 *
 * Environment:
 *   Target (new server): DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD  (e.g. 192.168.50.200, SynchronicsERP, sa, rani@123)
 *   Source (existing):  SOURCE_DB_SERVER, SOURCE_DB_NAME, SOURCE_DB_USER, SOURCE_DB_PASSWORD
 *
 * Usage: npx ts-node scripts/copy-data-to-new-server.ts
 * From repo root or server/:  npx ts-node server/scripts/copy-data-to-new-server.ts  (loads server/.env)
 *
 * Users: copies from source.rb_users into target.utbl_Users_Master (with bcrypt for passwords).
 * Other tables: copied as-is from source to target (same table names).
 *
 * Set FORCE_COPY_USERS=1 to always insert users (skip exists check); use when target shows 0 but script reports existing.
 */

import './load-dotenv';
import sql from 'mssql';
import bcrypt from 'bcryptjs';
import { config } from '../src/config/env';

const SCHEMA = config.db.schema || 'dbo';

function env(key: string): string {
  const v = process.env[key];
  if (v === undefined || v === '') throw new Error(`Missing env: ${key}`);
  return v;
}

const sourceConfig = {
  server: env('SOURCE_DB_SERVER'),
  database: env('SOURCE_DB_NAME'),
  user: env('SOURCE_DB_USER'),
  password: env('SOURCE_DB_PASSWORD'),
  options: { encrypt: process.env.SOURCE_DB_ENCRYPT !== 'false', trustServerCertificate: process.env.SOURCE_DB_TRUST_CERTIFICATE === 'true', enableArithAbort: true },
  connectionTimeout: 30000,
  requestTimeout: 120000,
};

const targetConfig = {
  server: config.db.server,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  options: config.db.options,
  connectionTimeout: 30000,
  requestTimeout: 120000,
};

function isBcryptHash(s: string): boolean {
  return typeof s === 'string' && (s.startsWith('$2a$') || s.startsWith('$2b$') || s.startsWith('$2y$'));
}

/** Tables to copy (target name). Order: users first, then by dependency. */
const TABLES_TO_COPY = [
  // Lookups first
  'sync_Department',
  'sync_Designation',
  'react_Roles',
  'react_Permissions',
  'react_RolePermissions',
  'react_UserRoles',
  'react_AppSettings',
  // Assets: FileStore before Asset (FK dependency)
  'react_AssetCategory',
  'react_AssetBrand',
  'react_AssetModel',
  'react_Vendors',
  'react_Location',
  'react_FileStore',
  'react_Asset',
  'react_AssetAssignment',
  'react_AssetMaintenanceTicket',
  'react_AssetVerification',
  'react_AssetTags',
  'react_AssetFiles',
  'react_AssetSearch',
  // Audit & chat
  'react_AuditLog',
  'react_ChatMessage',
  'react_UserLastSeen',
  'react_UserPermissions',
  'react_UserPreferences',
  'react_UserMailbox',
  'react_EmailTemplates',
  'react_EmailSettings',
  'react_BrandKit',
  // HRMS
  'hrms_EmployeeProfile',
  'hrms_EmployeeFamily',
  'hrms_EmployeeBank',
  'hrms_EmployeeContactNumber',
  'hrms_WhatsAppOtp',
  // Geo & company
  'utbl_Country',
  'utbl_State',
  'utbl_TaxJurisdiction',
  'utbl_Company',
  'utbl_Branch',
  'utbl_UserBranchAccess',
  'utbl_UserCompanyAccess',
  // Org
  'utbl_Org_Department',
  'utbl_Org_Designation',
  'utbl_Org_Team',
  'utbl_Org_TeamMember',
  'utbl_Org_PromotionHistory',
  // Clients
  'utbl_Industry',
  'utbl_Client',
  'utbl_ClientAddress',
  'utbl_ClientContact',
  'utbl_ClientGroup',
  'utbl_ClientGroupMember',
  'utbl_ContactRemark',
  // Announcements
  'utbl_Announcements_Category',
  'utbl_Announcements_Master',
  'utbl_Announcements_Audience',
  'utbl_Announcements_ReadLog',
  'utbl_Announcements_Version',
  'utbl_Announcements_Attachment',
  'utbl_Announcements_Poll',
  'utbl_Announcements_PollResponse',
  'utbl_Announcements_Feedback',
  'utbl_Announcements_ReminderLog',
  'utbl_Announcements_ApprovalHistory',
  // Transfers
  'utbl_Transfer',
  'utbl_TransferLog',
  'utbl_TransferUser',
  // Misc
  'HealthAlertRecipients',
  'HealthAlerts',
  'AIUsageLog',
  'CommunicationMessage',
  'react_CalendarEvents',
  'react_CronJob',
  'react_CronJobRun',
  'react_ApiConfig',
];

async function copyUsers(sourcePool: sql.ConnectionPool, targetPool: sql.ConnectionPool): Promise<void> {
  const fullName = `[${SCHEMA}].[utbl_Users_Master]`;
  const targetCountReq = new sql.Request(targetPool);
  const targetCount = await targetCountReq.query(`SELECT COUNT(1) AS n FROM ${fullName}`);
  const existingCount = (targetCount.recordset[0] as { n: number }).n;
  const forceInsert = process.env.FORCE_COPY_USERS === '1' || process.env.FORCE_COPY_USERS === 'true';
  console.log(`  Target DB: ${targetConfig.server} / ${targetConfig.database}; existing users: ${existingCount}${forceInsert ? ' (FORCE_COPY_USERS=1, will insert all)' : ''}`);

  const srcReq = new sql.Request(sourcePool);
  const rows = await srcReq.query(`
    SELECT userid, Username, Email, [Password], Name, DepartmentID, IsActive
    FROM [${SCHEMA}].[rb_users]
  `);
  const users = rows.recordset as any[];
  if (users.length === 0) {
    console.log('  No users in source rb_users.');
    return;
  }
  console.log(`  Syncing ${users.length} users from rb_users -> utbl_Users_Master (bcrypt)...`);
  let inserted = 0;
  let updated = 0;
  const insertAll = existingCount === 0 || forceInsert;

  for (const u of users) {
    let passwordHash = (u.Password ?? '').trim();
    if (!passwordHash) passwordHash = bcrypt.hashSync('ChangeMe123!', 10);
    else if (!isBcryptHash(passwordHash)) passwordHash = bcrypt.hashSync(passwordHash, 10);
    const username = (u.Username ?? u.Email ?? '').trim() || u.Email;
    const name = (u.Name ?? '').trim() || username;

    if (!insertAll) {
      const checkReq = new sql.Request(targetPool);
      const check = await checkReq
        .input('UserId', sql.Int, u.userid)
        .query(`SELECT 1 AS ok FROM ${fullName} WHERE UserId = @UserId`);
      const exists = (check.recordset?.length ?? 0) > 0;
      if (exists) {
        const upd = new sql.Request(targetPool);
        await upd
          .input('UserId', sql.Int, u.userid)
          .input('Username', sql.NVarChar(256), username)
          .input('Email', sql.NVarChar(256), u.Email)
          .input('PasswordHash', sql.NVarChar(255), passwordHash)
          .input('Name', sql.NVarChar(200), name)
          .input('DepartmentID', sql.Int, u.DepartmentID ?? null)
          .input('IsActive', sql.Bit, u.IsActive === 1 || u.IsActive === true)
          .query(`
            UPDATE ${fullName} SET Username = @Username, Email = @Email, PasswordHash = @PasswordHash,
              Name = @Name, DepartmentID = @DepartmentID, IsActive = @IsActive, UpdatedAt = GETDATE()
            WHERE UserId = @UserId
          `);
        updated++;
        continue;
      }
    }

    // INSERT (when table empty or FORCE_COPY_USERS: no exists check). SET and INSERT in same request (same connection).
    const ins = new sql.Request(targetPool);
    ins.input('UserId', sql.Int, u.userid);
    ins.input('Username', sql.NVarChar(256), username);
    ins.input('Email', sql.NVarChar(256), u.Email);
    ins.input('PasswordHash', sql.NVarChar(255), passwordHash);
    ins.input('Name', sql.NVarChar(200), name);
    ins.input('DepartmentID', sql.Int, u.DepartmentID ?? null);
    ins.input('IsActive', sql.Bit, u.IsActive === 1 || u.IsActive === true);
    try {
      await ins.query(`
        SET IDENTITY_INSERT ${fullName} ON;
        INSERT INTO ${fullName} (UserId, Username, Email, PasswordHash, Name, DepartmentID, IsActive, CreatedAt, UpdatedAt)
        VALUES (@UserId, @Username, @Email, @PasswordHash, @Name, @DepartmentID, @IsActive, GETDATE(), NULL)
      `);
      inserted++;
    } catch (err: any) {
      if (err?.number === 2627 || err?.number === 2601) {
        // Duplicate key: update existing row (e.g. FORCE_COPY_USERS when target already had rows)
        const upd = new sql.Request(targetPool);
        await upd
          .input('UserId', sql.Int, u.userid)
          .input('Username', sql.NVarChar(256), username)
          .input('Email', sql.NVarChar(256), u.Email)
          .input('PasswordHash', sql.NVarChar(255), passwordHash)
          .input('Name', sql.NVarChar(200), name)
          .input('DepartmentID', sql.Int, u.DepartmentID ?? null)
          .input('IsActive', sql.Bit, u.IsActive === 1 || u.IsActive === true)
          .query(`
            UPDATE ${fullName} SET Username = @Username, Email = @Email, PasswordHash = @PasswordHash,
              Name = @Name, DepartmentID = @DepartmentID, IsActive = @IsActive, UpdatedAt = GETDATE()
            WHERE UserId = @UserId
          `);
        updated++;
      } else throw err;
    }
  }
  console.log(`  Users: ${updated} updated, ${inserted} inserted.`);
}

async function tableExists(pool: sql.ConnectionPool, table: string): Promise<boolean> {
  const req = new sql.Request(pool);
  const r = await req.query(`
    SELECT 1 FROM sys.tables WHERE name = N'${table.replace(/'/g, "''")}' AND schema_id = SCHEMA_ID(N'${SCHEMA.replace(/'/g, "''")}')
  `);
  return (r.recordset?.length ?? 0) > 0;
}

async function hasIdentityColumn(pool: sql.ConnectionPool, table: string): Promise<boolean> {
  const req = new sql.Request(pool);
  const r = await req.query(`
    SELECT 1 FROM sys.identity_columns ic
    INNER JOIN sys.tables t ON t.object_id = ic.object_id
    INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE t.name = N'${table.replace(/'/g, "''")}' AND s.name = N'${SCHEMA.replace(/'/g, "''")}'
  `);
  return (r.recordset?.length ?? 0) > 0;
}

/** Get column names that are insertable (not computed) on the target table. */
async function getInsertableColumns(pool: sql.ConnectionPool, table: string): Promise<string[]> {
  const req = new sql.Request(pool);
  const r = await req.query(`
    SELECT c.name FROM sys.columns c
    INNER JOIN sys.tables t ON t.object_id = c.object_id
    INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE t.name = N'${table.replace(/'/g, "''")}' AND s.name = N'${SCHEMA.replace(/'/g, "''")}'
      AND c.is_computed = 0
    ORDER BY c.column_id
  `);
  return (r.recordset as { name: string }[]).map((x) => x.name);
}

async function copyTable(sourcePool: sql.ConnectionPool, targetPool: sql.ConnectionPool, table: string): Promise<number> {
  const existsSrc = await tableExists(sourcePool, table);
  const existsTgt = await tableExists(targetPool, table);
  if (!existsSrc || !existsTgt) return 0;
  const req = new sql.Request(sourcePool);
  const rows = await req.query(`SELECT * FROM [${SCHEMA}].[${table}]`);
  const data = rows.recordset as any[];
  if (data.length === 0) return 0;
  const insertableCols = await getInsertableColumns(targetPool, table);
  const rowKeys = Object.keys(data[0]);
  const keyMap = Object.fromEntries(rowKeys.map((k) => [k.toLowerCase(), k]));
  const cols = insertableCols.filter((c) => keyMap[c.toLowerCase()] != null);
  if (cols.length === 0) return 0;
  const colList = cols.map((c) => `[${c}]`).join(', ');
  const getVal = (row: any, col: string) => row[keyMap[col.toLowerCase()] ?? col];
  const fullName = `[${SCHEMA}].[${table}]`;
  const useIdentity = await hasIdentityColumn(targetPool, table);

  let inserted = 0;
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const r = new sql.Request(targetPool);
    cols.forEach((c, idx) => r.input(`c${idx}`, getVal(row, c)));
    const values = cols.map((_, idx) => `@c${idx}`).join(', ');
    const insertSql = `INSERT INTO ${fullName} (${colList}) VALUES (${values})`;
    // node-mssql can use different connections per request; SET and INSERT must be in same batch
    const batchSql = useIdentity ? `SET IDENTITY_INSERT ${fullName} ON; ${insertSql}` : insertSql;
    try {
      await r.query(batchSql);
      inserted++;
    } catch (err: any) {
      if (err?.number === 2627 || err?.number === 2601) {
        continue; // Duplicate key - skip row
      }
      throw err;
    }
  }
  return inserted;
}

async function disableAllFKs(pool: sql.ConnectionPool): Promise<void> {
  const r = new sql.Request(pool);
  const tables = await r.query(`
    SELECT DISTINCT s.name + '.' + t.name AS fullName
    FROM sys.foreign_keys fk
    INNER JOIN sys.tables t ON t.object_id = fk.parent_object_id
    INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
  `);
  for (const row of tables.recordset as { fullName: string }[]) {
    const req = new sql.Request(pool);
    await req.query(`ALTER TABLE [${row.fullName.replace('.', '].[')}] NOCHECK CONSTRAINT ALL`);
  }
}

async function cleanOrphanFKRows(pool: sql.ConnectionPool): Promise<void> {
  // Delete rows in child tables that reference non-existent parent rows (orphans from source)
  const orphanChecks = [
    `DELETE rp FROM [${SCHEMA}].[react_RolePermissions] rp LEFT JOIN [${SCHEMA}].[react_Permissions] p ON rp.PermissionID = p.PermissionID WHERE p.PermissionID IS NULL`,
    `DELETE rp FROM [${SCHEMA}].[react_RolePermissions] rp LEFT JOIN [${SCHEMA}].[react_Roles] r ON rp.RoleID = r.RoleID WHERE r.RoleID IS NULL`,
    `DELETE ur FROM [${SCHEMA}].[react_UserRoles] ur LEFT JOIN [${SCHEMA}].[react_Roles] r ON ur.RoleID = r.RoleID WHERE r.RoleID IS NULL`,
    `DELETE ur FROM [${SCHEMA}].[react_UserRoles] ur LEFT JOIN [${SCHEMA}].[utbl_Users_Master] u ON ur.UserID = u.UserId WHERE u.UserId IS NULL`,
  ];
  for (const q of orphanChecks) {
    try {
      const req = new sql.Request(pool);
      const res = await req.query(q);
      if (res.rowsAffected[0] > 0) console.log(`  Cleaned ${res.rowsAffected[0]} orphan rows: ${q.substring(0, 80)}...`);
    } catch { /* table might not exist */ }
  }
}

async function enableAllFKs(pool: sql.ConnectionPool): Promise<void> {
  const r = new sql.Request(pool);
  const tables = await r.query(`
    SELECT DISTINCT s.name + '.' + t.name AS fullName
    FROM sys.foreign_keys fk
    INNER JOIN sys.tables t ON t.object_id = fk.parent_object_id
    INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
  `);
  let failures = 0;
  for (const row of tables.recordset as { fullName: string }[]) {
    try {
      const req = new sql.Request(pool);
      await req.query(`ALTER TABLE [${row.fullName.replace('.', '].[')}] WITH CHECK CHECK CONSTRAINT ALL`);
    } catch (e: any) {
      console.warn(`  FK re-enable failed for ${row.fullName}: ${e.message?.substring(0, 120)}`);
      failures++;
    }
  }
  if (failures > 0) console.warn(`  ${failures} table(s) had FK re-enable failures (orphan data from source).`);
}

async function main(): Promise<void> {
  if (!process.env.SOURCE_DB_SERVER || !process.env.SOURCE_DB_NAME) {
    console.error('Set SOURCE_DB_SERVER, SOURCE_DB_NAME, SOURCE_DB_USER, SOURCE_DB_PASSWORD for the existing database.');
    process.exit(1);
  }
  // MUST use new ConnectionPool() for each – sql.connect() is a global singleton
  // and the second call would reuse/replace the first, so both pools would point to the same DB.
  const sourcePool = await new sql.ConnectionPool(sourceConfig).connect();
  const targetPool = await new sql.ConnectionPool(targetConfig).connect();
  console.log(`  Source: ${sourceConfig.server} / ${sourceConfig.database}`);
  console.log(`  Target: ${targetConfig.server} / ${targetConfig.database}`);

  console.log('0. Disabling FK constraints on target...');
  await disableAllFKs(targetPool);

  console.log('1. Copy users (rb_users -> utbl_Users_Master)...');
  await copyUsers(sourcePool, targetPool);

  console.log('2. Copy other tables...');
  for (const table of TABLES_TO_COPY) {
    try {
      const n = await copyTable(sourcePool, targetPool, table);
      if (n > 0) console.log(`  ${table}: ${n} rows`);
    } catch (e) {
      console.warn(`  ${table}: FAIL -`, (e as Error).message);
    }
  }

  console.log('3. Cleaning orphan FK rows on target...');
  await cleanOrphanFKRows(targetPool);

  console.log('4. Re-enabling FK constraints on target...');
  await enableAllFKs(targetPool);

  console.log('Data copy completed.');
  await sourcePool.close();
  await targetPool.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
