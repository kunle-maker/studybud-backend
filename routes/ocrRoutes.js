import { Router } from 'express';
import { uploadAndOCR, getOcrHistory } from '../controllers/ocrController.js';
import { protect } from '../middleware/auth.js';
import { checkDailyLimit } from '../middleware/dailyLimit.js';
import upload from '../middleware/upload.js';

const router = Router();
router.use(protect);

router.post('/process', checkDailyLimit('ocr'), upload.single('image'), uploadAndOCR);
router.get('/history', getOcrHistory);

export default router;
