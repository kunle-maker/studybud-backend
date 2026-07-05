import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AuthenticationError } from '../utils/errors.js';
import { generateTokens } from '../utils/tokenUtils.js';

export const register = asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;
  const existing = await User.findOne({ email });
  if (existing) throw new AuthenticationError('Email already registered');

  const user = await User.create({ email, password, name });
  const tokens = generateTokens(user._id);
  user.refreshToken = tokens.refreshToken;
  await user.save({ validateBeforeSave: false });

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    data: { user: { id: user._id, email, name, role: user.role }, ...tokens }
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new AuthenticationError('Invalid credentials');
  }
  const tokens = generateTokens(user._id);
  user.refreshToken = tokens.refreshToken;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: { user: { id: user._id, email, name: user.name, role: user.role }, ...tokens }
  });
});

export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new AuthenticationError('Refresh token required');

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new AuthenticationError('Invalid or expired refresh token');
  }

  const user = await User.findById(decoded.id).select('+refreshToken');
  if (!user || user.refreshToken !== refreshToken) {
    throw new AuthenticationError('Refresh token has been revoked');
  }

  const tokens = generateTokens(user._id);
  user.refreshToken = tokens.refreshToken;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: 'Token refreshed',
    data: tokens
  });
});

export const logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

export const getProfile = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      user: {
        id: req.user._id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role,
        profilePicture: req.user.profilePicture,
        usageStats: req.user.usageStats
      }
    }
  });
});

export const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Credentials are validated against the env-var-seeded admin account.
  // Never hardcode credentials here — set ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD
  // in your deployment secrets and run ensureAdminExists() on startup.
  const seedEmail    = process.env.ADMIN_SEED_EMAIL;
  const seedPassword = process.env.ADMIN_SEED_PASSWORD;

  if (!seedEmail || !seedPassword) {
    return res.status(503).json({ success: false, message: 'Admin account not configured on this server.' });
  }

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'email and password are required.' });
  }

  const admin = await User.findOne({ email: email.toLowerCase(), isAdmin: true }).select('+password');
  if (!admin) {
    return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
  }

  const valid = await admin.comparePassword(password);
  if (!valid) {
    return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
  }

  const tokens = generateTokens(admin._id);
  admin.refreshToken = tokens.refreshToken;
  await admin.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: 'Admin login successful',
    data: {
      user: {
        id:             admin._id,
        _id:            admin._id,
        email:          admin.email,
        name:           admin.name,
        role:           admin.role,
        isAdmin:        admin.isAdmin,
        profilePicture: admin.profilePicture || null,
      },
      ...tokens
    }
  });
});
