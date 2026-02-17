import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import { uploadChatSingle } from '../../shared/middleware/uploadMiddleware';
import * as chatController from './chat.controller';

const router = Router();

router.use(requireAuth);
router.use(requirePermission('CHAT.USE', 'DASH.VIEW_ADMIN'));

router.get('/ai-models', chatController.getAIModels);
router.get('/users', chatController.getChatUsers);
router.get('/conversations', chatController.getConversations);
router.get('/unread-count', chatController.getUnreadCount);
router.get('/messages', chatController.getMessages);
router.get('/last-seen/:userId', chatController.getLastSeen);
router.post('/send', chatController.sendMessage);
router.post('/improve', chatController.improveMessageHandler);
router.post('/upload', (req, res, next) => {
  uploadChatSingle(req, res, (err) => {
    if (err) return next(err);
    next();
  });
}, chatController.uploadChatFile);
router.get('/attachment/:tokenOrId', chatController.getChatAttachment);
router.post('/mark-delivered', chatController.markDelivered);
router.post('/mark-read', chatController.markRead);
router.post('/message/:messageId/react', chatController.reactToMessage);
router.delete('/message/:messageId/react', chatController.removeReaction);
router.post('/message/:messageId/forward', chatController.forwardMessage);
router.post('/message/:messageId/delete', chatController.deleteMessage);
router.post('/message/:messageId/star', chatController.starMessage);
router.delete('/message/:messageId/star', chatController.unstarMessage);
router.post('/message/:messageId/pin', chatController.pinMessage);
router.delete('/message/:messageId/pin', chatController.unpinMessage);

export const chatRoutes = router;
