/**
 * Fix the two failed seeds (025, 026) and assign ADMIN role to user 'admin' (UserId 1).
 * Usage: cd server && npx ts-node scripts/fix-seeds-and-admin.ts
 */
import './load-dotenv';
import sql from 'mssql';
import { readFileSync } from 'fs';
import { join } from 'path';

const SEEDS_DIR = join(__dirname, '../../database/seeds');

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

  console.log('Connecting...');
  const pool = await sql.connect(cfg);
  console.log('Connected.');

  // Re-run the two fixed seeds
  for (const file of ['025_email_template_permissions.sql', '026_brand_kit_permissions.sql']) {
    const content = readFileSync(join(SEEDS_DIR, file), 'utf8');
    const batches = content.split(/\nGO\b/i);
    console.log(`Running ${file} ...`);
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

  // Assign ADMIN role to user 'admin' (UserId 1) if not already assigned
  console.log('\nAssigning ADMIN role to admin user (UserId 1)...');
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM react_UserRoles ur
      JOIN react_Roles r ON r.RoleID = ur.RoleID
      WHERE ur.UserID = 1 AND r.RoleCode = 'ADMIN'
    )
    INSERT INTO react_UserRoles (UserID, RoleID)
    SELECT 1, RoleID FROM react_Roles WHERE RoleCode = 'ADMIN';
  `);
  console.log('  Done.');

  // Also assign ADMIN to srp (UserId 3)
  console.log('Assigning ADMIN role to srp user (UserId 3)...');
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM react_UserRoles ur
      JOIN react_Roles r ON r.RoleID = ur.RoleID
      WHERE ur.UserID = 3 AND r.RoleCode = 'ADMIN'
    )
    INSERT INTO react_UserRoles (UserID, RoleID)
    SELECT 3, RoleID FROM react_Roles WHERE RoleCode = 'ADMIN';
  `);
  console.log('  Done.');

  // Verify: list all ADMIN users
  console.log('\nAll ADMIN users:');
  const admins = await pool.request().query(`
    SELECT u.UserId, u.Name, u.Username
    FROM utbl_Users_Master u
    JOIN react_UserRoles ur ON ur.UserID = u.UserId
    JOIN react_Roles r ON r.RoleID = ur.RoleID
    WHERE r.RoleCode = 'ADMIN'
    ORDER BY u.UserId
  `);
  for (const row of admins.recordset) {
    console.log(`  UserId ${row.UserId}: ${row.Name} (${row.Username})`);
  }

  // Final counts
  console.log('\nFinal counts:');
  const counts = await pool.request().query(`
    SELECT 'Permissions' AS Item, COUNT(*) AS Cnt FROM react_Permissions
    UNION ALL SELECT 'Roles', COUNT(*) FROM react_Roles
    UNION ALL SELECT 'RolePermissions', COUNT(*) FROM react_RolePermissions
  `);
  for (const row of counts.recordset) {
    console.log(`  ${row.Item}: ${row.Cnt}`);
  }

  await pool.close();
  console.log('\nAll done! Restart your server and refresh the app.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
