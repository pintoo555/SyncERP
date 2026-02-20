/**
 * Run HRMS InternalEmail columns migration (067).
 * Usage: cd server && npx ts-node scripts/run-migration-067.ts
 */
import './load-dotenv';
import sql from 'mssql';
import { readFileSync } from 'fs';
import { join } from 'path';

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
  const pool = await sql.connect(cfg);
  const filePath = join(__dirname, '../../database/migrations/067_hrms_EmployeeProfile_internal_email.sql');
  const content = readFileSync(filePath, 'utf8');
  const batches = content.split(/\nGO\b/i).map((s) => s.trim()).filter((s) => s && s !== 'GO');
  for (const batch of batches) await pool.request().query(batch);
  console.log('067_hrms_EmployeeProfile_internal_email.sql applied successfully.');
  await pool.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
