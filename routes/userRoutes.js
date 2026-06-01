import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  updateProfilePicture,
  changePassword,
  getUsageStats,
  getStudyHistory,
  getDashboard,
  deleteAccount
} from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(protect);

router.get('/profile', getProfile);
router.patch('/profile', [
  body('name').optional().isString().isLength({ min: 2, max: 50 }),
  validate
], updateProfile);
router.patch('/profile/picture', upload.single('image'), updateProfilePicture);
router.patch('/password', [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 }),
  validate
], changePassword);
router.get('/usage', getUsageStats);
router.get('/history', getStudyHistory);
router.get('/dashboard', getDashboard);
router.delete('/account', deleteAccount);

export default router;
