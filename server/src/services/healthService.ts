/**
 * System health: CPU, RAM, disk usage, database.
 * Uses Node.js os module and check-disk-space.
 * Enumerates all drives: Windows (A-Z), Linux (/proc/mounts).
 */

import * as os from 'os';
import { getRequest } from '../db/pool';
import * as fs from 'fs';
import * as path from 'path';
import checkDiskSpace from 'check-disk-space';

export interface CpuInfo {
  model: string;
  cores: number;
  speedMhz: number;
}

export interface MemoryInfo {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usedPercent: number;
  processRssMb: number;
}

export interface DiskInfo {
  path: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usedPercent: number;
}

export interface DatabaseHealth {
  databaseName: string;
  state: string;
  totalSizeBytes: number;
  dataSizeBytes: number;
  logSizeBytes: number;
  tableCount: number;
  connectionCount: number;
  serverVersion: string;
}

export interface HealthSnapshot {
  cpu: CpuInfo[];
  cpuUsagePercent: number;  // overall CPU usage % (0-100)
  memory: MemoryInfo;
  disk: DiskInfo[];
  database: DatabaseHealth | null;
  platform: string;
  arch: string;
  uptimeSeconds: number;
  loadAvg: [number, number, number];
}

/** Get CPU info */
function getCpuInfo(): CpuInfo[] {
  const cpus = os.cpus();
  return cpus.map((c) => ({
    model: c.model.trim(),
    cores: cpus.length,
    speedMhz: Math.round(c.speed),
  }));
}

/** Compute CPU usage % from two samples (idle delta / total delta) */
async function getCpuUsagePercent(): Promise<number> {
  const cpus = os.cpus();
  if (!cpus.length) return 0;

  function sample() {
    return cpus.map((c) => {
      const t = c.times as Record<string, number>;
      const total = t.user + t.nice + t.sys + t.idle + (t.irq || 0) + (t.softirq || 0) + (t.steal || 0);
      return { idle: t.idle, total };
    });
  }

  const s1 = sample();
  await new Promise((r) => setTimeout(r, 200));
  const s2 = sample();

  let idleDelta = 0;
  let totalDelta = 0;
  for (let i = 0; i < s1.length; i++) {
    idleDelta += s2[i].idle - s1[i].idle;
    totalDelta += s2[i].total - s1[i].total;
  }
  if (totalDelta <= 0) return 0;
  const usedPercent = 100 - (idleDelta / totalDelta) * 100;
  return Math.round(Math.max(0, Math.min(100, usedPercent)));
}

/** Get memory info */
function getMemoryInfo(): MemoryInfo {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const mem = process.memoryUsage();
  return {
    totalBytes: total,
    freeBytes: free,
    usedBytes: used,
    usedPercent: total > 0 ? Math.round((used / total) * 100) : 0,
    processRssMb: Math.round(mem.rss / 1024 / 1024),
  };
}

/** Get list of paths to check for disk space (all drives/partitions) */
function getDiskPaths(): string[] {
  const paths: string[] = [];

  if (process.platform === 'win32') {
    // Windows: try drive letters A-Z
    for (let i = 65; i <= 90; i++) {
      const letter = String.fromCharCode(i);
      paths.push(letter + ':\\');
    }
  } else {
    // Linux: read /proc/mounts for local block device mount points
    try {
      const mounts = fs.readFileSync('/proc/mounts', 'utf8');
      const seen = new Set<string>();
      const blockPrefixes = ['/dev/sd', '/dev/nvme', '/dev/mmcblk', '/dev/vd', '/dev/mapper/'];
      for (const line of mounts.split('\n')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 2) continue;
        const [device, mountPoint, fstype] = parts;
        if (!device || !mountPoint) continue;
        const isBlock = blockPrefixes.some((p) => device.startsWith(p));
        const skipFstype = ['tmpfs', 'proc', 'sysfs', 'devtmpfs', 'cgroup', 'cgroup2', 'overlay', 'squashfs', 'devpts', 'mqueue', 'hugetlbfs', 'debugfs', 'tracefs', 'securityfs', 'pstore', 'efivarfs', 'fusectl', 'bpf', 'autofs'];
        if (!isBlock || skipFstype.includes(fstype)) continue;
        const canonical = path.resolve(mountPoint);
        if (seen.has(canonical)) continue;
        seen.add(canonical);
        paths.push(mountPoint);
      }
    } catch {
      // Fallback: common Linux paths
      paths.push('/', '/home', '/var', '/tmp');
    }
  }

  return paths.length > 0 ? paths : (process.platform === 'win32' ? ['C:\\'] : ['/']);
}

/** Get disk info for one path; returns null on failure */
async function getDiskInfoForPath(p: string): Promise<DiskInfo | null> {
  try {
    const info = await checkDiskSpace(p);
    if (info && typeof info.size === 'number' && typeof info.free === 'number') {
      const diskPath = (info.diskPath || p).replace(/[\\/]+$/, '') || p;
      const total = info.size;
      const free = info.free;
      const used = total - free;
      return {
        path: diskPath,
        totalBytes: total,
        freeBytes: free,
        usedBytes: used,
        usedPercent: total > 0 ? Math.round((used / total) * 100) : 0,
      };
    }
  } catch {
    // Path doesn't exist or failed
  }
  return null;
}

/** Get disk info for all detected drives (parallel where possible for speed) */
async function getDiskInfo(): Promise<DiskInfo[]> {
  const paths = getDiskPaths();
  const settled = await Promise.allSettled(paths.map((p) => getDiskInfoForPath(p)));
  const results: DiskInfo[] = [];
  const seenPaths = new Set<string>();

  for (const s of settled) {
    if (s.status !== 'fulfilled' || s.value == null) continue;
    const d = s.value;
    if (seenPaths.has(d.path)) continue;
    seenPaths.add(d.path);
    results.push(d);
  }

  // Fallback: try process.cwd() root if no results
  if (results.length === 0) {
    const basePath = process.platform === 'win32' ? process.cwd().split(path.sep)[0] + path.sep : '/';
    const fallback = await getDiskInfoForPath(basePath);
    if (fallback) results.push(fallback);
  }

  return results;
}

/** Get database health (SQL Server). Returns null if DB unavailable. */
async function getDatabaseHealth(): Promise<DatabaseHealth | null> {
  try {
    // Basic connectivity + metadata (works with normal DB user permissions)
    const metaResult = await (await getRequest()).query(`
      SELECT DB_NAME() AS dbName, CAST(SERVERPROPERTY('ProductVersion') AS NVARCHAR(128)) AS version
    `);
    const metaRow = (metaResult.recordset as { dbName?: string; version?: string }[])?.[0];
    const databaseName = String(metaRow?.dbName ?? '');
    const serverVersion = String(metaRow?.version ?? '');

    // Size: use sys.database_files (database-scoped, no VIEW SERVER STATE needed)
    let dataKb = 0;
    let logKb = 0;
    try {
      const sizeResult = await (await getRequest()).query(`
        SELECT
          SUM(CASE WHEN type = 0 THEN size * 8.0 * 1024 ELSE 0 END) AS data_kb,
          SUM(CASE WHEN type = 1 THEN size * 8.0 * 1024 ELSE 0 END) AS log_kb
        FROM sys.database_files
      `);
      const sizeRow = (sizeResult.recordset as { data_kb?: number; log_kb?: number }[])?.[0];
      dataKb = Number(sizeRow?.data_kb) || 0;
      logKb = Number(sizeRow?.log_kb) || 0;
    } catch (e) {
      console.warn('Health: database size query failed:', (e as Error).message);
    }

    // Table count (minimal permissions)
    let tableCount = 0;
    try {
      const tableResult = await (await getRequest()).query(`SELECT COUNT(*) AS cnt FROM sys.tables WHERE is_ms_shipped = 0`);
      const tableRow = (tableResult.recordset as { cnt?: number }[])?.[0];
      tableCount = Number(tableRow?.cnt) || 0;
    } catch (e) {
      console.warn('Health: table count query failed:', (e as Error).message);
    }

    // Connection count (requires VIEW SERVER STATE; skip if denied)
    let connectionCount = 0;
    try {
      const connResult = await (await getRequest()).query(`SELECT COUNT(*) AS cnt FROM sys.dm_exec_sessions WHERE database_id = DB_ID()`);
      const connRow = (connResult.recordset as { cnt?: number }[])?.[0];
      connectionCount = Number(connRow?.cnt) || 0;
    } catch (e) {
      console.warn('Health: connection count query failed (VIEW SERVER STATE may be required):', (e as Error).message);
    }

    const totalKb = dataKb + logKb;
    const bytesPerKb = 1024;

    return {
      databaseName,
      state: 'ONLINE',
      totalSizeBytes: Math.round(totalKb * bytesPerKb),
      dataSizeBytes: Math.round(dataKb * bytesPerKb),
      logSizeBytes: Math.round(logKb * bytesPerKb),
      tableCount,
      connectionCount,
      serverVersion,
    };
  } catch (e) {
    console.warn('Health: database health failed:', (e as Error).message);
    return null;
  }
}

/** Get full health snapshot */
export async function getHealthSnapshot(): Promise<HealthSnapshot> {
  const [cpu, cpuUsagePercent, memory, disk, database] = await Promise.all([
    Promise.resolve(getCpuInfo()),
    getCpuUsagePercent(),
    Promise.resolve(getMemoryInfo()),
    getDiskInfo(),
    getDatabaseHealth(),
  ]);

  return {
    cpu,
    cpuUsagePercent,
    memory,
    disk,
    database,
    platform: os.platform(),
    arch: os.arch(),
    uptimeSeconds: Math.floor(os.uptime()),
    loadAvg: os.loadavg() as [number, number, number],
  };
}
