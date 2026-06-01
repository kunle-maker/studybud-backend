import { Router } from 'express';
import { createSummary, getSummaryHistory } from '../controllers/summaryController.js';
import { protect } from '../middleware/auth.js';
import { checkDailyLimit } from '../middleware/dailyLimit.js';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(protect);

router.post('/', [
  checkDailyLimit('summaries'),
  body('text').isString().isLength({ min: 10, max: 5000 }),
  validate
], createSummary);

router.get('/history', getSummaryHistory);

export default router;