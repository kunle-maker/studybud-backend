import { Router } from 'express';
import { askQuestion, getChatHistory } from '../controllers/teacherController.js';
import { protect } from '../middleware/auth.js';
import { checkDailyLimit } from '../middleware/dailyLimit.js';

const router = Router();
router.use(protect);

router.post('/ask', checkDailyLimit('teacher'), askQuestion);
router.get('/history', getChatHistory);

export default router;