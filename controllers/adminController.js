import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess, sendPaginated } from '../utils/responseHelper.js';

// ─── Dashboard ───────────────────────────────────────────────────────────────

export const getAdminDashboard = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    premiumUsers,
    freeUsers,
    staggeringCount,
    recentStaggering
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'premium' }),
    User.countDocuments({ role: 'free' }),
    Subscription.countDocuments({ isStaggering: true, adminReviewed: false }),
    Subscription.find({ isStaggering: true, adminReviewed: false })
      .sort('-createdAt')
      .limit(5)
      .populate('user', 'name email profilePicture role createdAt')
  ]);

  sendSuccess(res, {
    stats: { totalUsers, premiumUsers, freeUsers, pendingStaggering: staggeringCount },
    recentStaggering
  });
});

// ─── Staggering (receipt review) ─────────────────────────────────────────────

export const getStaggeringCases = asyncHandler(async (req, res) => {
  const page  = parseInt(req.query.page)  || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip  = (page - 1) * limit;

  const filter = req.query.reviewed === 'true'
    ? { isStaggering: true, adminReviewed: true }
    : { isStaggering: true, adminReviewed: false };

  const [cases, total] = await Promise.all([
    Subscription.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email profilePicture role createdAt'),
    Subscription.countDocuments(filter)
  ]);

  sendSuccess(res, { cases, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
});

export const approveStaggering = asyncHandler(async (req, res) => {
  const sub = await Subscription.findById(req.params.id).populate('user');
  if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found.' });
  if (!sub.isStaggering) return res.status(400).json({ success: false, message: 'Not a staggering subscription.' });

  sub.adminReviewed = true;
  sub.adminVerified = true;
  sub.adminNote = req.body.note || 'Approved by admin.';
  await sub.save();

  await User.findByIdAndUpdate(sub.user._id, { role: 'premium' });

  sendSuccess(res, { subscriptionId: sub._id }, 200, 'Staggering premium approved.');
});

export const rejectStaggering = asyncHandler(async (req, res) => {
  const sub = await Subscription.findById(req.params.id).populate('user');
  if (!sub) return res.status(404).json({ success: false, message: 'Subscription not found.' });
  if (!sub.isStaggering) return res.status(400).json({ success: false, message: 'Not a staggering subscription.' });

  sub.adminReviewed = true;
  sub.adminVerified = false;
  sub.status = 'rejected';
  sub.adminNote = req.body.note || 'Rejected by admin — payment not verified.';
  await sub.save();

  const otherActive = await Subscription.findOne({
    user: sub.user._id,
    status: 'active',
    _id: { $ne: sub._id }
  });
  if (!otherActive) {
    await User.findByIdAndUpdate(sub.user._id, { role: 'free' });
  }

  sendSuccess(res, { subscriptionId: sub._id }, 200, 'Staggering premium rejected. User downgraded to free.');
});

// ─── Premium user management ──────────────────────────────────────────────────

export const getAllPremiumUsers = asyncHandler(async (req, res) => {
  const page  = parseInt(req.query.page)  || 1;
  const limit = parseInt(req.query.limit) || 30;
  const skip  = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find({ role: 'premium' })
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .select('name email profilePicture role authProvider premiumUntil createdAt isAdmin'),
    User.countDocuments({ role: 'premium' })
  ]);

  const withSubs = await Promise.all(users.map(async u => {
    const sub = await Subscription.findOne({ user: u._id, status: 'active' }).sort('-createdAt');
    return { ...u.toObject(), subscription: sub || null };
  }));

  sendSuccess(res, { users: withSubs, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
});

export const revokeUserPremium = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

  await Subscription.updateMany({ user: user._id, status: 'active' }, { status: 'cancelled' });
  await User.findByIdAndUpdate(user._id, { role: 'free' });

  sendSuccess(res, {}, 200, `Premium revoked for ${user.name}.`);
});

// ─── User management (new) ────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/users
 * List all users with search + role filter + pagination.
 * Query: ?page=1&limit=30&role=free|premium&search=<name or email>
 */
export const getAllUsers = asyncHandler(async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(100, parseInt(req.query.limit) || 30);
  const skip   = (page - 1) * limit;

  const filter = {};
  if (req.query.role)   filter.role  = req.query.role;
  if (req.query.search) {
    const re = new RegExp(req.query.search.trim(), 'i');
    filter.$or = [{ name: re }, { email: re }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .select('name email profilePicture role authProvider isAdmin premiumUntil createdAt usageStats'),
    User.countDocuments(filter),
  ]);

  sendPaginated(res, users, total, page, limit);
});

/**
 * GET /api/v1/admin/users/:userId
 * Get a single user's full profile + subscription history.
 */
export const getUserDetail = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId)
    .select('name email profilePicture role authProvider isAdmin premiumUntil createdAt usageStats');
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

  const subscriptions = await Subscription.find({ user: user._id })
    .sort('-createdAt')
    .limit(10)
    .lean();

  sendSuccess(res, { user, subscriptions });
});

/**
 * POST /api/v1/admin/users/:userId/grant-premium
 * Manually grant premium to any user for a given number of days.
 * Body: { days }  (default 30)
 */
export const grantPremium = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

  const days = Math.max(1, parseInt(req.body.days) || 30);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  user.role         = 'premium';
  user.premiumUntil = expiresAt;
  await user.save({ validateBeforeSave: false });

  sendSuccess(res, { userId: user._id, role: user.role, premiumUntil: user.premiumUntil },
    200, `Premium granted to ${user.name} for ${days} day(s).`);
});

/**
 * DELETE /api/v1/admin/users/:userId
 * Permanently delete a user and their active subscriptions.
 * Cannot delete another admin account.
 */
export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

  if (user.isAdmin) {
    return res.status(403).json({ success: false, message: 'Cannot delete an admin account.' });
  }

  await Subscription.deleteMany({ user: user._id });
  await user.deleteOne();

  sendSuccess(res, {}, 200, `User ${user.email} deleted.`);
});
