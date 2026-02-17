import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as ticketController from './ticket.controller';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('TICKET.VIEW'), ticketController.list);
router.get('/:id', requirePermission('TICKET.VIEW'), ticketController.getTicket);
router.post('/', requirePermission('TICKET.CREATE'), ticketController.create);
router.put('/:id', requirePermission('TICKET.EDIT'), ticketController.update);
router.patch('/:id/close', requirePermission('TICKET.CLOSE'), ticketController.close);
router.delete('/:id', requirePermission('TICKET.DELETE'), ticketController.deleteTicket);

export const ticketRoutes = router;
