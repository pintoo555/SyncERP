/**
 * Run ERP schema migrations on a NEW server (no existing rb_users).
 * Uses utbl_Users_Master from the start. Set .env to TARGET server (new DB).
 *
 * Usage:
 *   1. Create database "SynchronicsERP" on 192.168.50.200.
 *   2. Set .env: DB_SERVER=192.168.50.200, DB_NAME=SynchronicsERP, DB_USER=sa, DB_PASSWORD=rani@123
 *   3. From server folder: npx ts-node scripts/run-migrations-new-server.ts
 *
 * This runs: 057 (utbl_Users_Master) -> 000_sync_tables -> 001..056 with rb_users patched to utbl_Users_Master.
 * Skips: 039 (alters rb_users), 058 (FK switch; not needed when FKs point to utbl_Users_Master from start).
 */

import 'dotenv/config';
import sql from 'mssql';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { config } from '../src/config/env';

const MIGRATIONS_DIR = join(__dirname, '../../database/migrations');
const NEW_SERVER_DIR = join(__dirname, '../../database/new_server');

function patchForNewServer(content: string): string {
  return content
    .replace(/REFERENCES\s+dbo\.rb_users\s*\(\s*userid\s*\)/gi, 'REFERENCES dbo.utbl_Users_Master(UserId)')
    .replace(/REFERENCES\s+rb_users\s*\(\s*userid\s*\)/gi, 'REFERENCES utbl_Users_Master(UserId)')
    .replace(/\bFROM\s+dbo\.rb_users\b/gi, 'FROM dbo.utbl_Users_Master')
    .replace(/\bFROM\s+rb_users\b/gi, 'FROM utbl_Users_Master')
    .replace(/\bJOIN\s+dbo\.rb_users\b/gi, 'JOIN dbo.utbl_Users_Master')
    .replace(/\bJOIN\s+rb_users\b/gi, 'JOIN utbl_Users_Master')
    .replace(/\bu\.userid\b/gi, 'u.UserId');
}

function runBatches(req: sql.Request, sqlContent: string, label: string): Promise<void> {
  const batches = sqlContent
    .split(/\bGO\b/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  let done = 0;
  return batches.reduce(
    (p, batch) =>
      p.then(() => {
        return req.query(batch).then(() => {
          done++;
          if (label) process.stdout.write(`  ${label} batch ${done}/${batches.length}\r`);
        });
      }),
    Promise.resolve()
  );
}

const MIGRATION_ORDER = [
  '057_utbl_Users_Master.sql',
  '001_rbac.sql',
  '002_masters.sql',
  '003_assets.sql',
  '004_files.sql',
  '005_search_audit.sql',
  '006_primary_photo.sql',
  '007_chat.sql',
  '008_user_permissions.sql',
  '009_chat_delivery_read_lastseen.sql',
  '010_api_config.sql',
  '011_hrms.sql',
  '012_app_settings.sql',
  '013_user_preferences.sql',
  '014_user_mailbox.sql',
  '015_health_alerts.sql',
  '016_ai_usage_log.sql',
  '017_communication.sql',
  '018_hrms_extension_voip.sql',
  '019_hrms_contact_numbers.sql',
  '020_hrms_whatsapp_verified.sql',
  '021_audit_request_context.sql',
  '023_cron_jobs.sql',
  '024_cron_job_runs.sql',
  '025_cron_jobs_audit_report.sql',
  '026_utbl_Org_tables.sql',
  '027_seed_utbl_Org_Departments.sql',
  '028_seed_utbl_Org_Designations.sql',
  '029_add_LeftAt_only.sql',
  '029_org_team_enhancements.sql',
  '030_geography_tables.sql',
  '031_company_table.sql',
  '032_branch_tables.sql',
  '033_capability_location_tables.sql',
  '034_permission_tables.sql',
  '035_transfer_tables.sql',
  '036_seed_org_permissions.sql',
  '037_update_states_gst_codes.sql',
  '038_branch_aware_org.sql',
  '040_client_industries.sql',
  '041_client_master.sql',
  '042_client_addresses.sql',
  '043_client_contacts.sql',
  '044_client_groups.sql',
  '045_client_relationships.sql',
  '046_seed_client_industries.sql',
  '047_seed_client_permissions.sql',
  '048_client_gst_fields.sql',
  '049_seed_countries.sql',
  '050_contact_roles_remarks.sql',
  '051_contact_whatsapp_verified.sql',
  '052_announcements.sql',
  '053_announcements_performance_indexes.sql',
  '054_email_templates.sql',
  '055_brand_kit.sql',
  '056_react_EmailSettings.sql',
];

async function main(): Promise<void> {
  const pool = await sql.connect({
    server: config.db.server,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password,
    options: config.db.options,
    connectionTimeout: 30000,
    requestTimeout: 120000,
  });

  const req = new sql.Request(pool);

  // 1) 057 first (utbl_Users_Master)
  const mig057 = join(MIGRATIONS_DIR, '057_utbl_Users_Master.sql');
  if (existsSync(mig057)) {
    console.log('Running 057_utbl_Users_Master.sql...');
    await runBatches(req, readFileSync(mig057, 'utf8'), '057');
    console.log('  Done.');
  }

  // 2) 000_sync_tables (sync_Department, sync_Designation)
  const syncPath = join(NEW_SERVER_DIR, '000_sync_tables_for_erp.sql');
  if (existsSync(syncPath)) {
    console.log('Running 000_sync_tables_for_erp.sql...');
    const syncSql = readFileSync(syncPath, 'utf8');
    await runBatches(req, syncSql, 'sync');
    console.log('  Done.');
  }

  // 3) Remaining migrations in order (001..056 patched; skip 039, 058)
  const restOrder = MIGRATION_ORDER.filter((n) => n !== '057_utbl_Users_Master.sql');
  for (const name of restOrder) {
    const path = join(MIGRATIONS_DIR, name);
    if (!existsSync(path)) {
      console.warn('Skip (not found):', name);
      continue;
    }
    console.log('Running', name, '...');
    let content = readFileSync(path, 'utf8');
    if (name !== '057_utbl_Users_Master.sql') {
      content = patchForNewServer(content);
    }
    await runBatches(req, content, name);
    console.log('  Done.');
  }

  console.log('All migrations completed for new server.');
  await pool.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
