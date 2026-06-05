import asyncHandler from '../utils/asyncHandler.js';

export const adminOnly = asyncHandler(async (req, res, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ success: false, message: 'Admin access only.' });
  }
  next();
});
