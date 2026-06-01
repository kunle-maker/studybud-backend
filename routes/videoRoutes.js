import { Router } from 'express';
import { searchVideos, getVideoById } from '../controllers/videoController.js';
import { protect } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rateLimiter.js';

const router = Router();
router.use(protect);

router.get('/search', aiLimiter, searchVideos);
router.get('/:videoId', getVideoById);

export default router;
