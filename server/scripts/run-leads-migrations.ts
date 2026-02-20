/**
 * Run Lead Management CRM migrations (059-064) and permission seed (028).
 *
 * Usage: cd server && npx ts-node scripts/run-leads-migrations.ts
 */
import './load-dotenv';
import sql from 'mssql';
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(__dirname, '../../database/migrations');
const SEEDS_DIR = join(__dirname, '../../database/seeds');

const MIGRATION_FILES = [
  '059_leads_stage_source.sql',
  '060_leads_master.sql',
  '061_leads_activity_score_reminder.sql',
  '062_leads_webhook.sql',
  '063_leads_inbox_channel.sql',
  '064_leads_conversation.sql',
];

const SEED_FILES = [
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

  console.log('=== Running Migrations ===');
  for (const file of MIGRATION_FILES) {
    const filePath = join(MIGRATIONS_DIR, file);
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
      if (err.message?.includes('already an object named') || err.message?.includes('already exists')) {
        console.log(`  ${file} SKIPPED (already exists)`);
      } else {
        console.error(`  ${file} FAILED: ${err.message}`);
      }
    }
  }

  console.log('\n=== Running Seeds ===');
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

  await pool.close();
  console.log('\nDone! Leads tables and permissions are ready.');
  console.log('Now rebuild the frontend (cd client && npm run build) or restart your dev server.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
