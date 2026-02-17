/**
 * SQL Server connection pool. Uses parameterized queries only.
 * Resilient: logs connection errors but never crashes the server.
 */

import sql from 'mssql';
import { config } from './env';

let pool: sql.ConnectionPool | null = null;
let connecting: Promise<sql.ConnectionPool> | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool?.connected) return pool;
  if (connecting) return connecting;
  connecting = sql.connect({
    server: config.db.server,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password,
    options: config.db.options,
    pool: config.db.pool,
    connectionTimeout: 15000,
    requestTimeout: 15000,
  }).then((p) => {
    pool = p;
    connecting = null;
    console.log('DB pool connected to', config.db.server, '/', config.db.database);
    p.on('error', (err) => {
      console.error('DB pool error (will reconnect on next request):', err.message);
      pool = null;
    });
    return p;
  }).catch((err) => {
    connecting = null;
    pool = null;
    console.error('DB connection failed:', err.message);
    throw err;
  });
  return connecting;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

export type Request = sql.Request;
export type Transaction = sql.Transaction;

export async function getRequest(transaction?: sql.Transaction): Promise<sql.Request> {
  const p = await getPool();
  if (transaction) return new sql.Request(transaction);
  return new sql.Request(p);
}
