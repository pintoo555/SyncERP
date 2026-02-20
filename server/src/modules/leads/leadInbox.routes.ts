import { Router } from 'express';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as inboxCtrl from './leadInbox.controller';

const router = Router();

// Channel management (settings)
router.get('/channels', requirePermission('LEADS.INBOX.SETTINGS'), inboxCtrl.listChannels);
router.post('/channels/test-email', requirePermission('LEADS.INBOX.SETTINGS'), inboxCtrl.testEmailChannelCredentials);
router.post('/channels/send-test-lead-email', requirePermission('LEADS.INBOX.SETTINGS'), inboxCtrl.sendTestLeadEmailHandler);
router.get('/channels/:id', requirePermission('LEADS.INBOX.SETTINGS'), inboxCtrl.getChannel);
router.post('/channels/:id/test-connection', requirePermission('LEADS.INBOX.SETTINGS'), inboxCtrl.testChannelConnectionById);
router.post('/channels/:id/send-test-lead-email', requirePermission('LEADS.INBOX.SETTINGS'), inboxCtrl.sendTestLeadEmailById);
router.post('/channels', requirePermission('LEADS.INBOX.SETTINGS'), inboxCtrl.createChannel);
router.put('/channels/:id', requirePermission('LEADS.INBOX.SETTINGS'), inboxCtrl.updateChannel);
router.patch('/channels/:id/status', requirePermission('LEADS.INBOX.SETTINGS'), inboxCtrl.toggleChannelStatus);

// Conversations
router.get('/conversations', requirePermission('LEADS.INBOX'), inboxCtrl.listConversations);
router.get('/stats', requirePermission('LEADS.INBOX'), inboxCtrl.getConversationStats);
router.get('/conversations/:id', requirePermission('LEADS.INBOX'), inboxCtrl.getConversation);
router.get('/conversations/:id/messages', requirePermission('LEADS.INBOX'), inboxCtrl.getMessages);
router.post('/conversations/:id/reply', requirePermission('LEADS.INBOX'), inboxCtrl.replyToConversation);
router.post('/conversations/:id/note', requirePermission('LEADS.INBOX'), inboxCtrl.addInternalNote);
router.patch('/conversations/:id/status', requirePermission('LEADS.INBOX'), inboxCtrl.updateConversationStatus);
router.patch('/conversations/:id/assign', requirePermission('LEADS.INBOX'), inboxCtrl.assignConversation);
router.patch('/conversations/:id/link-lead', requirePermission('LEADS.INBOX'), inboxCtrl.linkConversationToLead);
router.post('/conversations/:id/create-lead', requirePermission('LEADS.INBOX'), inboxCtrl.createLeadFromConversation);
router.patch('/conversations/:id/read', requirePermission('LEADS.INBOX'), inboxCtrl.markConversationRead);

export { router as inboxRoutes };
