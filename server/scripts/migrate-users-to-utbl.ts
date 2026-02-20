/**
 * One-time migration: copy users from rb_users into utbl_Users_Master.
 * - Preserves same UserId (IDENTITY_INSERT) so existing FKs keep working.
 * - Plain-text passwords are hashed with bcrypt; existing bcrypt hashes are copied as-is.
 *
 * Run after applying migration 057, and before applying migration 058.
 * Usage (from server folder): npx ts-node scripts/migrate-users-to-utbl.ts
 */

import 'dotenv/config';
import sql from 'mssql';
import bcrypt from 'bcryptjs';
import { config } from '../src/config/env';

const SCHEMA = config.db.schema || 'dbo';
const RB_USERS = `[${SCHEMA}].[rb_users]`;
const USERS_MASTER = `[${SCHEMA}].[utbl_Users_Master]`;

function isBcryptHash(s: string): boolean {
  return typeof s === 'string' && (s.startsWith('$2a$') || s.startsWith('$2b$') || s.startsWith('$2y$'));
}

interface RbUserRow {
  userid: number;
  Username: string | null;
  Email: string;
  Password: string;
  Name: string;
  DepartmentID: number | null;
  IsActive: number | boolean;
}

async function run(): Promise<void> {
  const pool = await sql.connect({
    server: config.db.server,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password,
    options: config.db.options,
    connectionTimeout: 30000,
    requestTimeout: 60000,
  });

  const req = new sql.Request(pool);

  const countResult = await req.query(`SELECT COUNT(1) AS n FROM ${USERS_MASTER}`);
  const existing = (countResult.recordset[0] as { n: number }).n;
  if (existing > 0) {
    console.log(`utbl_Users_Master already has ${existing} row(s). Skipping migration to avoid duplicates.`);
    await pool.close();
    return;
  }

  const rows = await req.query(`SELECT userid, Username, Email, [Password], Name, DepartmentID, IsActive FROM ${RB_USERS}`);
  const users = rows.recordset as RbUserRow[];
  console.log(`Found ${users.length} user(s) in rb_users.`);

  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  const txReq = new sql.Request(transaction);
  try {
    for (const u of users) {
      let passwordHash = (u.Password ?? '').trim();
      if (!passwordHash) {
        passwordHash = bcrypt.hashSync('ChangeMe123!', 10);
        console.log(`  User ${u.userid} (${u.Email}): empty password, set to bcrypt(ChangeMe123!)`);
      } else if (!isBcryptHash(passwordHash)) {
        passwordHash = bcrypt.hashSync(passwordHash, 10);
        console.log(`  User ${u.userid} (${u.Email}): plain password hashed with bcrypt`);
      }

      const username = (u.Username ?? u.Email ?? '').trim() || u.Email;
      const name = (u.Name ?? '').trim() || username;

      // New Request per row so parameters are fresh; SET + INSERT in same batch for same connection
      const rowReq = new sql.Request(transaction);
      await rowReq
        .input('UserId', sql.Int, u.userid)
        .input('Username', sql.NVarChar(256), username)
        .input('Email', sql.NVarChar(256), u.Email)
        .input('PasswordHash', sql.NVarChar(255), passwordHash)
        .input('Name', sql.NVarChar(200), name)
        .input('DepartmentID', sql.Int, u.DepartmentID ?? null)
        .input('IsActive', sql.Bit, u.IsActive === 1 || u.IsActive === true)
        .query(`
          SET IDENTITY_INSERT ${USERS_MASTER} ON;
          INSERT INTO ${USERS_MASTER} (UserId, Username, Email, PasswordHash, Name, DepartmentID, IsActive, CreatedAt, UpdatedAt)
          VALUES (@UserId, @Username, @Email, @PasswordHash, @Name, @DepartmentID, @IsActive, GETDATE(), NULL)
        `);
    }

    await txReq.query(`SET IDENTITY_INSERT ${USERS_MASTER} OFF`);
    await transaction.commit();
    console.log(`Inserted ${users.length} row(s) into utbl_Users_Master.`);
  } catch (e) {
    await transaction.rollback();
    throw e;
  }
  await pool.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
