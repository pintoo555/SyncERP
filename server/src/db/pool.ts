/**
 * Re-export database pool from config/db for backward compatibility.
 */
export {
  getPool,
  closePool,
  getRequest,
  type Request,
  type Transaction,
} from '../config/db';
