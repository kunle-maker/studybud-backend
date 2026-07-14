import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  createAssignment,
  listAssignments,
  getAssignment,
  updateAssignment,
  deleteAssignment,
  manageShareLink,
  joinViaShareLink,
  inviteCollaborator,
  removeCollaborator,
  addComment,
  resolveComment,
  deleteComment,
  getActivity,
} from '../controllers/assignmentController.js';
import {
  generateQuestions,
  regenerateQuestions,
  saveAnswer,
  submitAssignment,
  getGrades,
} from '../controllers/assignmentAIController.js';

const router = Router();
router.use(protect);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.post('/',      createAssignment);
router.get('/',       listAssignments);
router.get('/:id',    getAssignment);
router.patch('/:id',  updateAssignment);
router.delete('/:id', deleteAssignment);

// ── Collaboration ─────────────────────────────────────────────────────────────
// NOTE: /join/:token must come before /:id/* routes to avoid param conflicts
router.post('/join/:token',                      joinViaShareLink);
router.post('/:id/share',                        manageShareLink);
router.post('/:id/invite',                       inviteCollaborator);
router.delete('/:id/collaborators/:userId',      removeCollaborator);
router.post('/:id/comments',                     addComment);
router.patch('/:id/comments/:commentId/resolve', resolveComment);
router.delete('/:id/comments/:commentId',        deleteComment);
router.get('/:id/activity',                      getActivity);

// ── AI features ───────────────────────────────────────────────────────────────
router.post('/:id/generate-questions',   generateQuestions);
router.post('/:id/regenerate-questions', regenerateQuestions);
router.post('/:id/answers',            saveAnswer);
router.post('/:id/submit',             submitAssignment);
router.get('/:id/grades',              getGrades);

export default router;
