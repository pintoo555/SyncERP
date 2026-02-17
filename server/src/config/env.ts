/**
 * Environment configuration. Never hardcode credentials.
 */

function env(key: string, defaultValue?: string): string {
  const v = process.env[key];
  if (v !== undefined && v !== '') return v;
  if (defaultValue !== undefined) return defaultValue;
  throw new Error(`Missing required environment variable: ${key}`);
}

function envNumber(key: string, defaultValue: number): number {
  const v = process.env[key];
  if (v === undefined || v === '') return defaultValue;
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return defaultValue;
  return n;
}

export const config = {
  port: envNumber('PORT', 4001),
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    server: env('DB_SERVER'),
    database: env('DB_NAME'),
    /** Schema for tables (default dbo). If your tables are in another schema, set DB_SCHEMA in .env */
    schema: process.env.DB_SCHEMA || 'dbo',
    user: env('DB_USER'),
    password: env('DB_PASSWORD'),
    options: {
      encrypt: process.env.DB_ENCRYPT !== 'false',
      trustServerCertificate: process.env.DB_TRUST_CERTIFICATE === 'true',
      enableArithAbort: true,
      instanceName: process.env.DB_INSTANCE || undefined,
    },
    pool: {
      max: envNumber('DB_POOL_MAX', 10),
      min: envNumber('DB_POOL_MIN', 2),
      idleTimeoutMillis: 30000,
    },
  },

  jwt: {
    secret: env('JWT_SECRET'),
    cookieName: 'sync_token',
    expiresIn: env('JWT_EXPIRES_IN', '8h'),
  },

  corsAllowedOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3001').split(',').map(s => s.trim()),

  upload: {
    dir: process.env.UPLOAD_DIR || 'uploads',
    maxFileSizeBytes: envNumber('UPLOAD_MAX_SIZE', 10 * 1024 * 1024), // 10MB
    allowedMimeTypes: (process.env.UPLOAD_ALLOWED_TYPES || 'image/jpeg,image/png,image/gif,application/pdf').split(',').map(s => s.trim()),
    allowedMimeTypesChat: (process.env.UPLOAD_CHAT_TYPES || 'image/jpeg,image/jpg,image/png,image/gif,image/webp,image/heic,audio/webm,audio/ogg,audio/mp4,audio/mpeg,audio/wav,audio/x-m4a,video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska,application/pdf').split(',').map(s => s.trim()),
  },

  rateLimit: {
    windowMs: envNumber('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    max: envNumber('RATE_LIMIT_MAX', 100),
    loginMax: envNumber('RATE_LIMIT_LOGIN_MAX', 20),
  },
};
