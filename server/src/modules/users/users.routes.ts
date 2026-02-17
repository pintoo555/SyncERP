/**
 * Users routes – /api/users
 */

import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as usersController from './users.controller';

const router = Router();

router.use(requireAuth);
router.use(requirePermission('USERS.VIEW', 'USERS.SEARCH'));
router.get('/', usersController.listUsers);

export const userRoutes = router;
