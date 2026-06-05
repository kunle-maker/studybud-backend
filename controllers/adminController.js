import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/responseHelper.js';

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
