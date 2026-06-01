import { Router } from 'express';
import { createFlashcards, createQuiz, summarizeFromOcr } from '../controllers/studyToolsController.js';
import { protect } from '../middleware/auth.js';
import { checkDailyLimit } from '../middleware/dailyLimit.js';
import { aiLimiter } from '../middleware/rateLimiter.js';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(protect);

router.post('/flashcards', aiLimiter, checkDailyLimit('summaries'), [
  body('text').isString().isLength({ min: 10, max: 8000 }).withMessage('Text must be between 10 and 8000 characters'),
  body('count').optional().isInt({ min: 1, max: 20 }).withMessage('Count must be between 1 and 20'),
  validate
], createFlashcards);

router.post('/quiz', aiLimiter, checkDailyLimit('summaries'), [
  body('text').isString().isLength({ min: 10, max: 8000 }).withMessage('Text must be between 10 and 8000 characters'),
  body('questionCount').optional().isInt({ min: 1, max: 15 }).withMessage('Question count must be between 1 and 15'),
  validate
], createQuiz);

router.post('/ocr-summary', aiLimiter, checkDailyLimit('summaries'), [
  body('extractedText').isString().isLength({ min: 10 }).withMessage('Extracted text is required'),
  validate
], summarizeFromOcr);

export default router;
