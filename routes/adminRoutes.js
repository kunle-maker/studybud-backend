import { Router } from 'express';
import {
  getAdminDashboard,
  getStaggeringCases,
  approveStaggering,
  rejectStaggering,
  getAllPremiumUsers,
  revokeUserPremium,
  getAllUsers,
  getUserDetail,
  grantPremium,
  deleteUser,
} from '../controllers/adminController.js';
import { protect } from '../middleware/auth.js';
import { adminOnly } from '../middleware/adminAuth.js';

const router = Router();
router.use(protect, adminOnly);

// ── Dashboard ────────────────────────────────────────────────────────────────
router.get('/dashboard',               getAdminDashboard);

// ── Receipt staggering review ────────────────────────────────────────────────
router.get('/staggering',              getStaggeringCases);
router.post('/staggering/:id/approve', approveStaggering);
router.post('/staggering/:id/reject',  rejectStaggering);

// ── Premium user management ──────────────────────────────────────────────────
router.get('/premium-users',           getAllPremiumUsers);
router.post('/revoke/:userId',         revokeUserPremium);

// ── Full user management ─────────────────────────────────────────────────────
router.get('/users',                         getAllUsers);
router.get('/users/:userId',                 getUserDetail);
router.post('/users/:userId/grant-premium',  grantPremium);
router.delete('/users/:userId',              deleteUser);

export default router;
