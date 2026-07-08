import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  deleteNotification,
} from '../controllers/notificationController.js';

const router = Router();
router.use(protect);

router.get('/',             getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all',   markAllRead);
router.patch('/:id/read',   markRead);
router.delete('/:id',       deleteNotification);

export default router;
