import { Router } from 'express';
import {
  askQuestion,
  streamQuestion,
  getChatHistory,
  getChatById,
  deleteChat,
  createAssignment,
  searchPastQuestions,
} from '../controllers/teacherController.js';
import { protect } from '../middleware/auth.js';
import { checkDailyLimit } from '../middleware/dailyLimit.js';

const router = Router();
router.use(protect);

router.post('/ask',            checkDailyLimit('teacher'), askQuestion);
router.post('/ask-stream',     checkDailyLimit('teacher'), streamQuestion);
router.get('/history',         getChatHistory);
router.get('/chats/:id',       getChatById);
router.delete('/chats/:id',    deleteChat);
router.post('/assignment',     createAssignment);
router.post('/past-questions', searchPastQuestions);

export default router;
