import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import * as commController from './communication.controller';

const router = Router();

// Webhook - NO auth (Ultramsg posts here)
router.post('/webhook/whatsapp', commController.webhookIncoming);

// Test webhook - auth required, simulates inbound message for Sandbox testing
router.post('/test-webhook', requireAuth, commController.testWebhook);

// All below require auth
router.get('/channels', requireAuth, commController.listChannels);
router.post('/channels', requireAuth, commController.createChannel);
router.put('/channels/:id', requireAuth, commController.updateChannel);
router.delete('/channels/:id', requireAuth, commController.deleteChannel);

router.post('/send', requireAuth, commController.sendMessage);

router.get('/dashboard', requireAuth, commController.getDashboard);
router.get('/messages', requireAuth, commController.listMessages);

export const communicationRoutes = router;
