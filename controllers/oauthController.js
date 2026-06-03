import crypto from 'crypto';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateTokens } from '../utils/tokenUtils.js';

function frontendRedirect(res, tokens, user, error = null) {
  const base = process.env.FRONTEND_URL || 'http://localhost:3000';
  if (error) {
    return res.redirect(`${base}/auth/callback?error=${encodeURIComponent(error)}`);
  }
  const params = new URLSearchParams({
    accessToken:  tokens.accessToken,
    refreshToken: tokens.refreshToken,
    userId:       user._id.toString(),
    name:         user.name || '',
    role:         user.role
  });
  res.redirect(`${base}/auth/callback?${params.toString()}`);
}

async function issueTokensAndRedirect(req, res, provider) {
  try {
    const user = req.user;
    if (!user) return frontendRedirect(res, null, null, 'Authentication failed');
    const tokens = generateTokens(user._id);
    user.refreshToken = tokens.refreshToken;
    await user.save({ validateBeforeSave: false });
    frontendRedirect(res, tokens, user);
  } catch {
    frontendRedirect(res, null, null, 'Server error during authentication');
  }
}

export const googleCallback = (req, res) => issueTokensAndRedirect(req, res, 'google');
export const githubCallback = (req, res) => issueTokensAndRedirect(req, res, 'github');

export const telegramAuth = asyncHandler(async (req, res) => {
  const data = req.body;
  const { hash, ...fields } = data;

  if (!hash) return res.status(400).json({ success: false, message: 'Missing hash field' });

  const dataCheckString = Object.keys(fields)
    .sort()
    .map(k => `${k}=${fields[k]}`)
    .join('\n');

  const secretKey = crypto
    .createHash('sha256')
    .update(process.env.TELEGRAM_BOT_TOKEN)
    .digest();

  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (computedHash !== hash) {
    return res.status(401).json({ success: false, message: 'Invalid Telegram auth data' });
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - parseInt(fields.auth_date, 10);
  if (ageSeconds > 300) {
    return res.status(401).json({ success: false, message: 'Auth data expired — please try again' });
  }

  let user = await User.findOne({ telegramId: String(fields.id) });
  if (!user) {
    user = await User.create({
      telegramId:     String(fields.id),
      name:           [fields.first_name, fields.last_name].filter(Boolean).join(' '),
      profilePicture: fields.photo_url || undefined,
      authProvider:   'telegram'
    });
  } else {
    const updatedName = [fields.first_name, fields.last_name].filter(Boolean).join(' ');
    if (updatedName) user.name = updatedName;
    if (fields.photo_url) user.profilePicture = fields.photo_url;
  }

  const tokens = generateTokens(user._id);
  user.refreshToken = tokens.refreshToken;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: 'Logged in with Telegram',
    data: {
      user: { id: user._id, name: user.name, role: user.role, profilePicture: user.profilePicture },
      accessToken:  tokens.accessToken,
      refreshToken: tokens.refreshToken
    }
  });
});
