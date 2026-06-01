import { Router } from 'express';
import { register, login, refreshToken, logout, getProfile } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';

const router = Router();

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
router.get('/me', protect, getProfile);

export default router;
