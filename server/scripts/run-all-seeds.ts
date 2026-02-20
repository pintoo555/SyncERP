/**
 * Run ALL seed files on the database.
 * This is needed after run-migrations-new-server.ts which only runs migrations, not seeds.
 *
 * Usage: cd server && npx ts-node scripts/run-all-seeds.ts
 */
import './load-dotenv';
import sql from 'mssql';
import { readFileSync } from 'fs';
import { join } from 'path';

const SEEDS_DIR = join(__dirname, '../../database/seeds');

const SEED_FILES = [
  '001_rbac_seed.sql',
  '002_chat_print_permissions.sql',
  '003_calendar_permissions.sql',
  '004_email_settings_permissions.sql',
  '005_sessions_permission.sql',
  '006_hrms_permissions.sql',
  '007_general_settings_permissions.sql',
  '008_health_permission.sql',
  '009_health_settings_permission.sql',
  '022_call_matrix_permissions.sql',
  '023_cron_jobs_permissions.sql',
  '024_announcements_permissions.sql',
  '025_email_template_permissions.sql',
  '026_brand_kit_permissions.sql',
  '027_email_admin_permissions.sql',
  '028_leads_permissions.sql',
];

async function main() {
  const cfg: sql.config = {
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME || 'SynchronicsERP',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '',
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_CERTIFICATE !== 'false',
    },
    connectionTimeout: 30000,
    requestTimeout: 60000,
  };

  console.log(`Connecting to ${cfg.server}/${cfg.database} ...`);
  const pool = await sql.connect(cfg);
  console.log('Connected.\n');

  // Diagnostics first
  console.log('=== Pre-Seed Diagnostics ===');
  const diag = await pool.request().query(`
    SELECT 'react_Permissions' AS TableName, COUNT(*) AS Cnt FROM react_Permissions
    UNION ALL
    SELECT 'react_Roles', COUNT(*) FROM react_Roles
    UNION ALL
    SELECT 'react_RolePermissions', COUNT(*) FROM react_RolePermissions
    UNION ALL
    SELECT 'utbl_Users_Master', COUNT(*) FROM utbl_Users_Master
  `);
  for (const row of diag.recordset) {
    console.log(`  ${row.TableName}: ${row.Cnt} rows`);
  }

  // Check if any user has a role assigned
  try {
    const userRoles = await pool.request().query(`
      SELECT TOP 5 ur.UserID, u.Name, u.Username, r.RoleCode
      FROM react_UserRoles ur
      JOIN utbl_Users_Master u ON u.UserId = ur.UserID
      JOIN react_Roles r ON r.RoleID = ur.RoleID
    `);
    console.log(`  react_UserRoles: ${userRoles.recordset.length} sample mappings`);
    for (const row of userRoles.recordset) {
      console.log(`    UserId ${row.UserID} (${row.Name} / ${row.Username}) => ${row.RoleCode}`);
    }
  } catch (e: any) {
    console.log(`  react_UserRoles check: ${e.message}`);
  }
  console.log('');

  // Run all seeds
  console.log('=== Running Seeds ===');
  for (const file of SEED_FILES) {
    const filePath = join(SEEDS_DIR, file);
    const content = readFileSync(filePath, 'utf8');
    const batches = content.split(/\nGO\b/i);
    console.log(`  ${file} ...`);
    try {
      for (const batch of batches) {
        const trimmed = batch.trim();
        if (!trimmed || trimmed === 'GO') continue;
        await pool.request().query(trimmed);
      }
      console.log(`  ${file} OK`);
    } catch (err: any) {
      console.error(`  ${file} FAILED: ${err.message}`);
    }
  }
  console.log('');

  // Post-seed diagnostics
  console.log('=== Post-Seed Diagnostics ===');
  const diag2 = await pool.request().query(`
    SELECT 'react_Permissions' AS TableName, COUNT(*) AS Cnt FROM react_Permissions
    UNION ALL
    SELECT 'react_Roles', COUNT(*) FROM react_Roles
    UNION ALL
    SELECT 'react_RolePermissions', COUNT(*) FROM react_RolePermissions
  `);
  for (const row of diag2.recordset) {
    console.log(`  ${row.TableName}: ${row.Cnt} rows`);
  }

  // Check if admin user has ADMIN role
  try {
    const adminCheck = await pool.request().query(`
      SELECT u.UserId, u.Name, u.Username, r.RoleCode
      FROM utbl_Users_Master u
      LEFT JOIN react_UserRoles ur ON ur.UserID = u.UserId
      LEFT JOIN react_Roles r ON r.RoleID = ur.RoleID
      WHERE u.IsActive = 1
      ORDER BY u.UserId
    `);
    console.log(`\n=== User-Role Assignments ===`);
    if (adminCheck.recordset.length === 0) {
      console.log('  WARNING: No active users found in utbl_Users_Master!');
    } else {
      for (const row of adminCheck.recordset) {
        const role = row.RoleCode || '** NO ROLE **';
        console.log(`  UserId ${row.UserId}: ${row.Name} (${row.Username}) => ${role}`);
      }
    }
  } catch (e: any) {
    console.log(`  User-Role check error: ${e.message}`);
  }

  await pool.close();
  console.log('\nDone! Seeds have been applied.');
  console.log('If any users show "** NO ROLE **", you need to assign them a role.');
  console.log('You can do this via: INSERT INTO react_UserRoles (UserID, RoleID) SELECT <userId>, RoleID FROM react_Roles WHERE RoleCode = \'ADMIN\'');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
