/**
 * Webmail API: per-user mailbox credentials, folders, messages, send.
 */

import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../../shared/middleware/auth';
import * as mailboxController from './mailbox.controller';

const router = Router();
const mailboxUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
}).array('attachments', 10);

router.use(requireAuth);

router.get('/credentials', mailboxController.getCredentials);
router.put('/credentials', mailboxController.setCredentials);
router.get('/unread-count', mailboxController.getUnreadCount);
router.get('/folders', mailboxController.listFolders);
router.get('/folders/:path/messages', mailboxController.getMessages);
router.get('/folders/:path/search', mailboxController.searchMessages);
router.get('/folders/:path/messages/:uid', mailboxController.getMessage);
router.get('/folders/:path/messages/:uid/attachments/:index', mailboxController.downloadAttachment);
router.put('/folders/:path/messages/:uid/read', mailboxController.markMessageRead);
router.put('/folders/:path/messages/:uid/flag', mailboxController.toggleFlag);
router.post('/folders/:path/mark-read', mailboxController.markMessagesRead);
router.post('/folders/:path/mark-all-read', mailboxController.markAllRead);
router.post('/folders/:path/delete', mailboxController.deleteMessages);
router.post('/folders/:path/archive', mailboxController.archiveMessages);
router.post('/send', (req, res, next) => {
  mailboxUpload(req, res, (err) => {
    if (err) return next(err);
    next();
  });
}, mailboxController.sendMail);

export const mailboxRoutes = router;
