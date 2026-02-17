import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as assignmentController from './assignment.controller';

const router = Router();
router.use(requireAuth);

router.post('/issue', requirePermission('ASSIGN.ISSUE'), assignmentController.issue);
router.post('/return', requirePermission('ASSIGN.RETURN'), assignmentController.returnAssignment);
router.post('/transfer', requirePermission('ASSIGN.TRANSFER'), assignmentController.transfer);
router.get('/history', requirePermission('ASSIGN.VIEW_HISTORY'), assignmentController.getHistory);
router.get('/history/by-user', requirePermission('ASSIGN.VIEW_HISTORY'), assignmentController.getHistoryByUser);

export const assignmentRoutes = router;
