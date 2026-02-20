/**
 * Run migration 058 (switch FKs to utbl_Users_Master).
 * Usage (from server folder): npx ts-node scripts/run-migration-058.ts
 */

import 'dotenv/config';
import sql from 'mssql';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from '../src/config/env';

async function run(): Promise<void> {
  const pool = await sql.connect({
    server: config.db.server,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password,
    options: config.db.options,
    connectionTimeout: 30000,
    requestTimeout: 120000,
  });

  const path = join(__dirname, '../../database/migrations/058_switch_fks_to_utbl_Users_Master.sql');
  const content = readFileSync(path, 'utf8');
  const batches = content
    .split(/\bGO\b/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

  const req = new sql.Request(pool);
  for (const batch of batches) {
    if (batch.length === 0) continue;
    await req.query(batch);
    console.log('Batch executed.');
  }
  console.log('Migration 058 completed.');
  await pool.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
