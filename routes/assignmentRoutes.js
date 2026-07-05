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

const router = Router();
router.use(protect);

router.post('/',      createAssignment);
router.get('/',       listAssignments);
router.get('/:id',    getAssignment);
router.patch('/:id',  updateAssignment);
router.delete('/:id', deleteAssignment);
router.post('/join/:token',         joinViaShareLink);
router.post('/:id/share',           manageShareLink);
router.post('/:id/invite',          inviteCollaborator);
router.delete('/:id/collaborators/:userId', removeCollaborator);
router.post('/:id/comments',                      addComment);
router.patch('/:id/comments/:commentId/resolve',  resolveComment);
router.delete('/:id/comments/:commentId',         deleteComment);
router.get('/:id/activity', getActivity);

export default router;
