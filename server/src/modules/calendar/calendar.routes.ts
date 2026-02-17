import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as calendarController from './calendar.controller';

const router = Router();

router.use(requireAuth);
router.use(requirePermission('CALENDAR.VIEW'));

router.get('/events', calendarController.list);
router.post('/events', calendarController.create);
router.put('/events/:id', calendarController.update);
router.delete('/events/:id', calendarController.remove);

router.get('/availability', requirePermission('CALENDAR.VIEW_AVAILABILITY'), calendarController.availability);
router.get('/users', requirePermission('CALENDAR.VIEW_AVAILABILITY'), calendarController.users);

export const calendarRoutes = router;
