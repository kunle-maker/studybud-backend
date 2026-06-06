import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { checkDailyLimit } from '../middleware/dailyLimit.js';
import {
  askSubject,
  getSubjectHistory,
  getSubjectChatById,
  deleteSubjectChat,
} from '../controllers/subjectController.js';

const router = Router();
router.use(protect);

router.post('/ask',            checkDailyLimit('teacher'), askSubject);
router.get('/history',         getSubjectHistory);
router.get('/chats/:id',       getSubjectChatById);
router.delete('/chats/:id',    deleteSubjectChat);

export default router;
