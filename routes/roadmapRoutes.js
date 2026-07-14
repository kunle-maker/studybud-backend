import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminAuth.js';
import {
  listRoadmaps,
  getRoadmap,
  completeLesson,
  uncompleteLesson,
  myProgress,
  generateRoadmapForUser,
  createRoadmap,
  updateRoadmap,
  deleteRoadmap,
  getLessonContent,
  regenerateLessonContent,
  getExam,
  startExam,
  saveExamAnswer,
  submitExam,
} from '../controllers/roadmapController.js';

const router = Router();
router.use(protect);

// ── User-facing ──────────────────────────────────────────────────────────────
router.get('/',                                       listRoadmaps);
router.get('/my-progress',                            myProgress);
router.post('/generate',                              generateRoadmapForUser);

// Lesson content generation (must come before /:id/* catch-alls)
router.get('/:id/lessons/:lessonId/content',                     getLessonContent);
// Regeneration overwrites shared roadmap content — admin only to prevent unauthorized mutations
router.post('/:id/lessons/:lessonId/regenerate', adminOnly,      regenerateLessonContent);
router.post('/:id/lessons/:lessonId/complete',        completeLesson);
router.delete('/:id/lessons/:lessonId/complete',      uncompleteLesson);

// Final examination
router.get('/:id/exam',                               getExam);
router.post('/:id/exam/start',                        startExam);
router.patch('/:id/exam/answers',                     saveExamAnswer);
router.post('/:id/exam/submit',                       submitExam);

router.get('/:id',                                    getRoadmap);

// ── Admin only ───────────────────────────────────────────────────────────────
router.post('/',         adminOnly, createRoadmap);
router.put('/:id',       adminOnly, updateRoadmap);
// Admins can delete any roadmap; creators can delete their own (checked inside controller)
router.delete('/:id',              deleteRoadmap);

export default router;
