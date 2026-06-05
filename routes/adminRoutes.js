import { Router } from 'express';
import {
  getAdminDashboard,
  getStaggeringCases,
  approveStaggering,
  rejectStaggering,
  getAllPremiumUsers,
  revokeUserPremium
} from '../controllers/adminController.js';
import { protect } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminAuth.js';

const router = Router();
router.use(protect, adminOnly);

router.get('/dashboard',              getAdminDashboard);
router.get('/staggering',             getStaggeringCases);
router.post('/staggering/:id/approve',approveStaggering);
router.post('/staggering/:id/reject', rejectStaggering);
router.get('/premium-users',          getAllPremiumUsers);
router.post('/revoke/:userId',        revokeUserPremium);

export default router;
