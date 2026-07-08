import { Router } from 'express';
import passport from 'passport';
import { register, login, refreshToken, logout, getProfile, adminLogin } from '../controllers/authController.js';
import { googleCallback, githubCallback, telegramAuth } from '../controllers/oauthController.js';
import { protect } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';

const router = Router();

// ── Local auth (kept for backward compat / admin use) ──────────────────────
router.post('/register', authLimiter, [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').notEmpty().withMessage('Name is required'),
  validate
], register);

router.post('/login', authLimiter, [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate
], login);

router.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  validate
], refreshToken);

router.post('/logout', protect, logout);
router.get('/me',     protect, getProfile);

// ── Google OAuth (only when credentials are configured) ─────────────────────
const oauthUnavailable = (provider) => (_req, res) =>
  res.status(501).json({ message: `${provider} OAuth is not configured on this server.` });

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );
  router.get('/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/auth/error' }),
    googleCallback
  );
} else {
  router.get('/google',          oauthUnavailable('Google'));
  router.get('/google/callback', oauthUnavailable('Google'));
}

// ── GitHub OAuth (only when credentials are configured) ──────────────────────
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  router.get('/github',
    passport.authenticate('github', { scope: ['user:email'] })
  );
  router.get('/github/callback',
    passport.authenticate('github', { session: false, failureRedirect: '/auth/error' }),
    githubCallback
  );
} else {
  router.get('/github',          oauthUnavailable('GitHub'));
  router.get('/github/callback', oauthUnavailable('GitHub'));
}

// ── Telegram Login Widget ───────────────────────────────────────────────────
router.post('/telegram', authLimiter, telegramAuth);

// ── Admin credential login ───────────────────────────────────────────────────
router.post('/admin-login', authLimiter, [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate
], adminLogin);

export default router;
