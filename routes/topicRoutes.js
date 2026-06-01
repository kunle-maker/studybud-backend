import { Router } from 'express';
import { explainTopicHandler, betterExplanation } from '../controllers/topicController.js';
import { protect } from '../middleware/auth.js';
import { checkDailyLimit } from '../middleware/dailyLimit.js';

const router = Router();
router.use(protect);

router.post('/explain', checkDailyLimit('topic'), explainTopicHandler);
router.post('/better', betterExplanation);

export default router;