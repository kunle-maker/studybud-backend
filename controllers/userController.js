import User from '../models/User.js';
import StudyHistory from '../models/StudyHistory.js';
import Summary from '../models/Summary.js';
import AIChat from '../models/AIChat.js';
import OCRUpload from '../models/OCRUpload.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/responseHelper.js';
import cloudinaryService from '../services/cloudinaryService.js';

export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  sendSuccess(res, {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    profilePicture: user.profilePicture,
    usageStats: user.usageStats,
    createdAt: user.createdAt
  });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const allowed = ['name'];
  const updates = {};
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true
  });

  sendSuccess(res, {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    profilePicture: user.profilePicture
  }, 200, 'Profile updated');
});

export const updateProfilePicture = asyncHandler(async (req, res) => {
  if (!req.file) throw new Error('Please upload an image');

  const result = await cloudinaryService.uploadBuffer(
    req.file.buffer,
    `studyflow/avatars/${req.user._id}`,
    { public_id: `avatar_${req.user._id}`, overwrite: true }
  );

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { profilePicture: result.secure_url },
    { new: true }
  );

  sendSuccess(res, { profilePicture: user.profilePicture }, 200, 'Profile picture updated');
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect' });
  }

  user.password = newPassword;
  await user.save();

  sendSuccess(res, {}, 200, 'Password changed successfully');
});

export const getUsageStats = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.resetDailyIfNeeded();
  await user.save({ validateBeforeSave: false });

  sendSuccess(res, {
    role: user.role,
    usageStats: user.usageStats,
    limits: user.role === 'premium'
      ? { summaries: 'Unlimited', teacher: 'Unlimited', topic: 'Unlimited', ocr: 'Unlimited' }
      : { summaries: 10, teacher: 20, topic: 5, ocr: 3 }
  });
});

export const getStudyHistory = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const [history, total] = await Promise.all([
    StudyHistory.find({ user: req.user._id })
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    StudyHistory.countDocuments({ user: req.user._id })
  ]);

  res.status(200).json({
    success: true,
    data: history,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) }
  });
});

export const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const [summaryCount, chatCount, ocrCount, recentHistory] = await Promise.all([
    Summary.countDocuments({ user: userId }),
    AIChat.countDocuments({ user: userId }),
    OCRUpload.countDocuments({ user: userId }),
    StudyHistory.find({ user: userId }).sort('-createdAt').limit(5)
  ]);

  const user = await User.findById(userId);
  user.resetDailyIfNeeded();

  sendSuccess(res, {
    stats: {
      totalSummaries: summaryCount,
      totalChats: chatCount,
      totalOcrUploads: ocrCount
    },
    todayUsage: user.usageStats,
    recentActivity: recentHistory,
    role: user.role
  });
});

export const deleteAccount = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  await Promise.all([
    User.findByIdAndDelete(userId),
    Summary.deleteMany({ user: userId }),
    AIChat.deleteMany({ user: userId }),
    OCRUpload.deleteMany({ user: userId }),
    StudyHistory.deleteMany({ user: userId })
  ]);
  sendSuccess(res, {}, 200, 'Account deleted successfully');
});
