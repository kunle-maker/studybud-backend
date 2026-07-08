import { Router } from 'express';
import {
  createFlashcards,
  createQuiz,
  createQuizSession,
  getQuizSession,
  saveQuizProgress,
  summarizeFromOcr,
} from '../controllers/studyToolsController.js';
import { protect } from '../middleware/auth.js';
import { checkDailyLimit } from '../middleware/dailyLimit.js';
import { aiLimiter } from '../middleware/rateLimiter.js';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(protect);

router.post('/flashcards', aiLimiter, checkDailyLimit('summaries'), [
  body('text').isString().isLength({ min: 10, max: 8000 }),
  body('count').optional().isInt({ min: 1, max: 20 }),
  validate
], createFlashcards);

router.post('/quiz', aiLimiter, checkDailyLimit('summaries'), [
  body('text').isString().isLength({ min: 10, max: 8000 }),
  body('questionCount').optional().isInt({ min: 1, max: 15 }),
  validate
], createQuiz);

// Persistent quiz sessions
router.post('/quiz-session', aiLimiter, checkDailyLimit('summaries'), [
  body('text').isString().isLength({ min: 10, max: 8000 }),
  body('questionCount').optional().isInt({ min: 1, max: 15 }),
  validate
], createQuizSession);

router.get('/quiz-session/:id',              getQuizSession);
router.patch('/quiz-session/:id/progress',   saveQuizProgress);

router.post('/ocr-summary', aiLimiter, checkDailyLimit('summaries'), [
  body('extractedText').isString().isLength({ min: 10 }),
  validate
], summarizeFromOcr);

export default router;
