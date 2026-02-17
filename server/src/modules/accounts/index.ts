/**
 * Accounts module - placeholder for Invoices, Credit Notes, Overview.
 * Backend API to be implemented.
 */
import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('ACCOUNTS.VIEW'), (_req, res) => {
  res.json({ success: true, data: {}, message: 'Accounts API - to be implemented' });
});

export const accountsRoutes = router;
