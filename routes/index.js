import { Router } from 'express';
import authRoutes from './authRoutes.js';
import summaryRoutes from './summaryRoutes.js';
import teacherRoutes from './teacherRoutes.js';
import topicRoutes from './topicRoutes.js';
import ocrRoutes from './ocrRoutes.js';
import videoRoutes from './videoRoutes.js';
import userRoutes from './userRoutes.js';
import subscriptionRoutes from './subscriptionRoutes.js';
import studyToolsRoutes from './studyToolsRoutes.js';
import adminRoutes from './adminRoutes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'StudyFlow API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/summaries', summaryRoutes);
router.use('/teacher', teacherRoutes);
router.use('/topics', topicRoutes);
router.use('/ocr', ocrRoutes);
router.use('/videos', videoRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/study-tools', studyToolsRoutes);
router.use('/admin',      adminRoutes);

export default router;
