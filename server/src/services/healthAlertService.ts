/**
 * Health alert thresholds, recipients, and alert creation.
 * Checks metrics against settings and creates alerts for configured users.
 */

import { getRequest } from '../db/pool';
import type { HealthSnapshot } from './healthService';

const SETTINGS_TABLE = 'dbo.react_HealthAlertSettings';
const RECIPIENTS_TABLE = 'dbo.react_HealthAlertRecipients';
const ALERTS_TABLE = 'dbo.react_HealthAlerts';

export interface HealthAlertSetting {
  id: number;
  metric: 'cpu' | 'memory' | 'disk';
  thresholdPercent: number;
  diskPath: string | null;
  enabled: boolean;
}

export interface HealthAlertSettingWithRecipients extends HealthAlertSetting {
  recipientUserIds: number[];
}

export interface HealthAlert {
  id: number;
  metric: string;
  message: string;
  value: number;
  thresholdPercent: number;
  diskPath: string | null;
  status: 'active' | 'acknowledged';
  acknowledgedAt: string | null;
  createdAt: string;
}

const COOLDOWN_MINUTES = 5;  // avoid duplicate alerts for same metric within 5 min

/** Get all enabled alert settings with recipients */
export async function getAlertSettings(): Promise<HealthAlertSettingWithRecipients[]> {
  const req = await getRequest();
  const result = await req
    .input('enabled', true)
    .query(`
      SELECT s.Id, s.Metric, s.ThresholdPercent, s.DiskPath, s.[Enabled]
      FROM ${SETTINGS_TABLE} s
      WHERE s.[Enabled] = 1
      ORDER BY s.Id
    `);

  const rows = result.recordset || [];
  const withRecipients: HealthAlertSettingWithRecipients[] = [];

  for (const r of rows) {
    const recReq = await getRequest();
    const recResult = await recReq
      .input('settingsId', r.Id)
      .query(`
        SELECT UserId FROM ${RECIPIENTS_TABLE} WHERE SettingsId = @settingsId
      `);
    const recipientUserIds = (recResult.recordset || []).map((rr: { UserId: number }) => rr.UserId);
    withRecipients.push({
      id: r.Id,
      metric: r.Metric,
      thresholdPercent: r.ThresholdPercent,
      diskPath: r.DiskPath,
      enabled: !!r.Enabled,
      recipientUserIds,
    });
  }
  return withRecipients;
}

/** Create alerts when thresholds are exceeded. Call after getHealthSnapshot. */
export async function processHealthAlerts(snapshot: HealthSnapshot): Promise<void> {
  const settings = await getAlertSettings();
  if (!settings.length) return;

  for (const s of settings) {
    if (!s.enabled || !s.recipientUserIds.length) continue;

    let value = 0;
    let diskPath: string | null = null;
    let message = '';

    if (s.metric === 'cpu') {
      value = snapshot.cpuUsagePercent ?? 0;
      if (value <= s.thresholdPercent) continue;
      message = `CPU usage is ${value}% (threshold: ${s.thresholdPercent}%)`;
    } else if (s.metric === 'memory') {
      value = snapshot.memory.usedPercent ?? 0;
      if (value <= s.thresholdPercent) continue;
      message = `Memory usage is ${value}% (threshold: ${s.thresholdPercent}%)`;
    } else if (s.metric === 'disk') {
      let found = false;
      for (const d of snapshot.disk || []) {
        if (s.diskPath && d.path !== s.diskPath) continue;
        if (d.usedPercent <= s.thresholdPercent) continue;
        value = d.usedPercent;
        diskPath = d.path;
        message = `Disk ${d.path} usage is ${value}% (threshold: ${s.thresholdPercent}%)`;
        found = true;
        break;  // one alert per setting (first matching disk)
      }
      if (!found) continue;
    } else {
      continue;
    }

    // Cooldown: skip if we already alerted for this metric recently
    const recent = await (await getRequest())
      .input('metric', s.metric)
      .input('cutoff', new Date(Date.now() - COOLDOWN_MINUTES * 60 * 1000))
      .query(`
        SELECT TOP 1 1 FROM ${ALERTS_TABLE}
        WHERE Metric = @metric AND CreatedAt > @cutoff
      `);
    if ((recent.recordset?.length ?? 0) > 0) continue;

    for (const userId of s.recipientUserIds) {
      await (await getRequest())
        .input('recipientUserId', userId)
        .input('metric', s.metric)
        .input('message', message)
        .input('value', value)
        .input('thresholdPercent', s.thresholdPercent)
        .input('diskPath', diskPath)
        .query(`
          INSERT INTO ${ALERTS_TABLE} (RecipientUserId, Metric, Message, [Value], ThresholdPercent, DiskPath, Status)
          VALUES (@recipientUserId, @metric, @message, @value, @thresholdPercent, @diskPath, 'active')
        `);
    }
  }
}

/** Get alerts for a user (for topbar). SQL Server 2008 compatible (TOP instead of OFFSET/FETCH). */
export async function getAlertsForUser(userId: number, limit = 20): Promise<HealthAlert[]> {
  const result = await (await getRequest())
    .input('userId', userId)
    .input('limit', limit)
    .query(`
      SELECT TOP (@limit) Id, Metric, Message, [Value], ThresholdPercent, DiskPath, Status, AcknowledgedAt, CreatedAt
      FROM ${ALERTS_TABLE}
      WHERE RecipientUserId = @userId
      ORDER BY CreatedAt DESC
    `);

  const rows = (result.recordset || []) as Array<{
    Id: number; Metric: string; Message: string; Value: number; ThresholdPercent: number;
    DiskPath: string | null; Status: string; AcknowledgedAt: Date | null; CreatedAt: Date;
  }>;
  return rows.map((r) => ({
    id: r.Id,
    metric: r.Metric,
    message: r.Message,
    value: r.Value,
    thresholdPercent: r.ThresholdPercent,
    diskPath: r.DiskPath,
    status: (r.Status === 'acknowledged' ? 'acknowledged' : 'active') as 'active' | 'acknowledged',
    acknowledgedAt: r.AcknowledgedAt ? r.AcknowledgedAt.toISOString() : null,
    createdAt: r.CreatedAt.toISOString(),
  }));
}

/** Count active (unacknowledged) alerts for user */
export async function getActiveAlertCount(userId: number): Promise<number> {
  const result = await (await getRequest())
    .input('userId', userId)
    .query(`
      SELECT COUNT(*) AS Cnt       FROM ${ALERTS_TABLE}
      WHERE RecipientUserId = @userId AND Status = 'active'
    `);
  const row = result.recordset?.[0];
  return row ? Number(row.Cnt) : 0;
}

/** Acknowledge an alert (only if user is the recipient) */
export async function acknowledgeAlert(alertId: number, userId: number): Promise<boolean> {
  const result = await (await getRequest())
    .input('id', alertId)
    .input('userId', userId)
    .query(`
      UPDATE ${ALERTS_TABLE}
      SET Status = 'acknowledged', AcknowledgedAt = GETDATE()
      WHERE Id = @id AND RecipientUserId = @userId AND Status = 'active'
    `);
  return (result.rowsAffected?.[0] ?? 0) > 0;
}

/** Acknowledge all active alerts for user */
export async function acknowledgeAllAlerts(userId: number): Promise<number> {
  const result = await (await getRequest())
    .input('userId', userId)
    .query(`
      UPDATE ${ALERTS_TABLE}
      SET Status = 'acknowledged', AcknowledgedAt = GETDATE()
      WHERE RecipientUserId = @userId AND Status = 'active'
    `);
  return result.rowsAffected?.[0] ?? 0;
}

/** List all settings (for settings page) */
export async function listSettings(): Promise<HealthAlertSettingWithRecipients[]> {
  const result = await (await getRequest()).query(`
    SELECT Id, Metric, ThresholdPercent, DiskPath, [Enabled]
    FROM ${SETTINGS_TABLE}
    ORDER BY Id
  `);
  const rows = (result.recordset || []) as Array<{ Id?: number; id?: number; Metric?: string; metric?: string; ThresholdPercent?: number; thresholdPercent?: number; DiskPath?: string | null; diskPath?: string | null; Enabled?: boolean; enabled?: boolean }>;
  const out: HealthAlertSettingWithRecipients[] = [];
  for (const r of rows) {
    const id = r.Id ?? r.id ?? 0;
    const recResult = await (await getRequest()).input('settingsId', id).query(`
      SELECT UserId FROM react_HealthAlertRecipients WHERE SettingsId = @settingsId
    `);
    const recRows = (recResult.recordset || []) as Array<{ UserId?: number; userId?: number }>;
    out.push({
      id,
      metric: (r.Metric ?? r.metric ?? 'cpu') as 'cpu' | 'memory' | 'disk',
      thresholdPercent: r.ThresholdPercent ?? r.thresholdPercent ?? 80,
      diskPath: r.DiskPath ?? r.diskPath ?? null,
      enabled: !!(r.Enabled ?? r.enabled),
      recipientUserIds: recRows.map((rr) => rr.UserId ?? rr.userId ?? 0).filter((uid) => uid > 0),
    });
  }
  return out;
}

/** Create a new alert setting */
export async function createSetting(data: {
  metric: 'cpu' | 'memory' | 'disk';
  thresholdPercent: number;
  diskPath?: string | null;
  enabled?: boolean;
  recipientUserIds?: number[];
}): Promise<number> {
  const result = await (await getRequest())
    .input('metric', data.metric)
    .input('thresholdPercent', data.thresholdPercent)
    .input('diskPath', data.diskPath ?? null)
    .input('enabled', data.enabled !== false ? 1 : 0)
    .query(`
      INSERT INTO ${SETTINGS_TABLE} (Metric, ThresholdPercent, DiskPath, [Enabled])
      OUTPUT INSERTED.Id
      VALUES (@metric, @thresholdPercent, @diskPath, @enabled)
    `);
  const row = result.recordset?.[0] as { Id?: number; id?: number } | undefined;
  const id = row?.Id ?? row?.id;
  if (id != null && data.recipientUserIds?.length) {
    for (const uid of data.recipientUserIds) {
      await (await getRequest())
        .input('settingsId', id)
        .input('userId', uid)
        .query(`
          INSERT INTO ${RECIPIENTS_TABLE} (SettingsId, UserId) VALUES (@settingsId, @userId)
        `);
    }
  }
  if (id == null) throw new Error('Failed to create alert setting');
  return id;
}

/** Update a setting */
export async function updateSetting(
  id: number,
  data: Partial<{ metric: 'cpu' | 'memory' | 'disk'; thresholdPercent: number; diskPath: string | null; enabled: boolean; recipientUserIds: number[] }>
): Promise<boolean> {
  const existing = await (await getRequest()).input('id', id).query(`
    SELECT Id, Metric, ThresholdPercent, DiskPath, [Enabled] FROM ${SETTINGS_TABLE} WHERE Id = @id
  `);
  const row = existing.recordset?.[0] as { Metric?: string; metric?: string; ThresholdPercent?: number; thresholdPercent?: number; DiskPath?: string | null; diskPath?: string | null; Enabled?: boolean; enabled?: boolean } | undefined;
  if (!row) return false;

  const metric = data.metric ?? row.Metric ?? row.metric ?? 'cpu';
  const thresholdPercent = data.thresholdPercent ?? row.ThresholdPercent ?? row.thresholdPercent ?? 80;
  const diskPath = data.diskPath !== undefined ? data.diskPath : (row.DiskPath ?? row.diskPath ?? null);
  const enabledVal = data.enabled !== undefined ? data.enabled : (row.Enabled ?? row.enabled ?? true);
  const enabled = enabledVal ? 1 : 0;

  await (await getRequest())
    .input('id', id)
    .input('metric', metric)
    .input('thresholdPercent', thresholdPercent)
    .input('diskPath', diskPath)
    .input('enabled', enabled)
    .query(`
      UPDATE ${SETTINGS_TABLE}
      SET Metric = @metric, ThresholdPercent = @thresholdPercent, DiskPath = @diskPath, [Enabled] = @enabled, UpdatedAt = GETDATE()
      WHERE Id = @id
    `);

  if (Array.isArray(data.recipientUserIds)) {
    await (await getRequest()).input('settingsId', id).query(`
      DELETE FROM ${RECIPIENTS_TABLE} WHERE SettingsId = @settingsId
    `);
    for (const uid of data.recipientUserIds) {
      await (await getRequest())
        .input('settingsId', id)
        .input('userId', uid)
        .query(`
          INSERT INTO ${RECIPIENTS_TABLE} (SettingsId, UserId) VALUES (@settingsId, @userId)
        `);
    }
  }
  return true;
}

/** Delete a setting */
export async function deleteSetting(id: number): Promise<boolean> {
  const result = await (await getRequest()).input('id', id).query(`
    DELETE FROM ${SETTINGS_TABLE} WHERE Id = @id
  `);
  return (result.rowsAffected?.[0] ?? 0) > 0;
}
