/**
 * Load server/.env so scripts use the same DB config regardless of cwd.
 * Import this first in scripts that use config from env.
 */
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });
