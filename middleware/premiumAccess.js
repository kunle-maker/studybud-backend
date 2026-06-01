import asyncHandler from '../utils/asyncHandler.js';
import { ForbiddenError } from '../utils/errors.js';

export const requirePremium = asyncHandler(async (req, res, next) => {
  if (req.user.role !== 'premium') {
    throw new ForbiddenError('Premium subscription required');
  }
  next();
});