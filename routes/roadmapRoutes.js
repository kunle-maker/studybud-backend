import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminAuth.js';
import {
  listRoadmaps,
  getRoadmap,
  completeLesson,
  uncompleteLesson,
  myProgress,
  createRoadmap,
  updateRoadmap,
  deleteRoadmap,
} from '../controllers/roadmapController.js';

const router = Router();
router.use(protect);

// ── User-facing ──────────────────────────────────────────────────────────────
router.get('/',                                       listRoadmaps);
router.get('/my-progress',                            myProgress);
router.get('/:id',                                    getRoadmap);
router.post('/:id/lessons/:lessonId/complete',        completeLesson);
router.delete('/:id/lessons/:lessonId/complete',      uncompleteLesson);

// ── Admin only ───────────────────────────────────────────────────────────────
router.post('/',         adminOnly, createRoadmap);
router.put('/:id',       adminOnly, updateRoadmap);
router.delete('/:id',    adminOnly, deleteRoadmap);

export default router;
