import Subscription from '../models/Subscription.js';
import User from '../models/User.js';
import { verifyPaymentReceipt } from '../services/receiptVerificationService.js';
import cloudinaryService from '../services/cloudinaryService.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/responseHelper.js';

const PREMIUM_DURATION_DAYS = Number(process.env.PREMIUM_DURATION_DAYS) || 30;

export const getPaymentDetails = asyncHandler(async (req, res) => {
  const user = req.user;
  if (user.role === 'premium') {
    return res.status(400).json({ success: false, message: 'You are already on the premium plan.' });
  }
  sendSuccess(res, {
    amount: 1000,
    currency: 'NGN',
    bank: {
      name: 'SmartCash',
      accountName: 'Ayodele Ganiyu',
      accountNumber: '9012834275'
    },
    instructions: [
      'Transfer exactly ₦1,000 to the account above',
      'Take a clear screenshot of your transfer receipt',
      'Upload the screenshot — AI verifies it instantly',
      'Receipt must be from today — old or reused receipts are rejected'
    ]
  });
});

export const submitReceipt = asyncHandler(async (req, res) => {
  const user = req.user;

  if (user.role === 'premium') {
    return res.status(400).json({ success: false, message: 'You are already on the premium plan.' });
  }
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please upload your payment receipt screenshot.' });
  }

  const buffer   = req.file.buffer;
  const mimeType = req.file.mimetype || 'image/jpeg';
  const imageBase64 = buffer.toString('base64');

  const v = await verifyPaymentReceipt(imageBase64, mimeType);

  let receiptImageUrl = null;
  try {
    const uploaded = await cloudinaryService.uploadBuffer(buffer, `studyflow/receipts/${user._id}`);
    receiptImageUrl = uploaded.secure_url;
  } catch (err) {
    console.warn('Cloudinary receipt upload failed:', err.message);
  }

  const detectedInfo = {
    name:           v.detected_name,
    amount:         v.detected_amount,
    bank:           v.detected_bank,
    date:           v.detected_date,
    transactionId:  v.detected_transaction_id
  };

  // ── Step 1: Core validity (name + bank + amount + genuine) ──────────────────
  if (!v.core_valid) {
    await Subscription.create({
      user: user._id,
      plan: 'premium',
      status: 'rejected',
      receiptImageUrl,
      receiptVerified: false,
      verificationNote: v.reason,
      transactionId: v.detected_transaction_id || null
    });

    return res.status(400).json({
      success: false,
      message: 'Receipt could not be verified.',
      reason: v.reason,
      detected: detectedInfo,
      hint: 'Ensure your screenshot clearly shows: Ayodele Ganiyu · SmartCash · ₦1,000.'
    });
  }

  // ── Step 2: Date is valid — normal premium grant ────────────────────────────
  if (v.date_valid) {
    return await grantPremium(res, user, {
      receiptImageUrl,
      verificationNote: v.reason,
      transactionId: v.detected_transaction_id || null,
      isStaggering: false,
      detected: detectedInfo
    });
  }

  // ── Step 3: Date missing/invalid — check transaction ID ────────────────────
  const txId = v.detected_transaction_id;

  if (txId) {
    const existingSub = await Subscription.findOne({
      transactionId: txId,
      status: { $in: ['active', 'pending'] }
    });

    if (existingSub) {
      await Subscription.create({
        user: user._id,
        plan: 'premium',
        status: 'rejected',
        receiptImageUrl,
        receiptVerified: false,
        verificationNote: 'Duplicate transaction ID — receipt already used.',
        transactionId: txId
      });

      return res.status(400).json({
        success: false,
        message: 'This receipt has already been used for a previous upgrade.',
        reason: 'Duplicate transaction ID detected.',
        detected: detectedInfo,
        hint: 'Each receipt can only be used once. Please make a new transfer.'
      });
    }

    // New transaction ID, core valid — grant premium
    return await grantPremium(res, user, {
      receiptImageUrl,
      verificationNote: `Date not visible, but unique transaction ID verified: ${txId}`,
      transactionId: txId,
      isStaggering: false,
      detected: detectedInfo
    });
  }

  // ── Step 4: No date, no transaction ID — staggering premium ────────────────
  return await grantStaggeringPremium(res, user, {
    receiptImageUrl,
    verificationNote: 'Neither receipt date nor transaction ID was detectable. Granted as staggering premium pending admin review.',
    transactionId: null,
    detected: detectedInfo
  });
});

async function grantPremium(res, user, { receiptImageUrl, verificationNote, transactionId, isStaggering, detected }) {
  const now = new Date();
  const endDate = new Date(now.getTime() + PREMIUM_DURATION_DAYS * 24 * 60 * 60 * 1000);

  await Subscription.create({
    user: user._id,
    plan: 'premium',
    status: 'active',
    startDate: now,
    endDate,
    receiptImageUrl,
    receiptVerified: true,
    verificationNote,
    transactionId,
    isStaggering: false
  });

  await User.findByIdAndUpdate(user._id, { role: 'premium', premiumUntil: endDate });

  sendSuccess(res, {
    upgraded: true,
    plan: 'premium',
    startDate: now,
    endDate,
    detected
  }, 200, '🎉 Payment verified! Your account has been upgraded to Premium.');
}

async function grantStaggeringPremium(res, user, { receiptImageUrl, verificationNote, transactionId, detected }) {
  const now = new Date();
  const endDate = new Date(now.getTime() + PREMIUM_DURATION_DAYS * 24 * 60 * 60 * 1000);

  await Subscription.create({
    user: user._id,
    plan: 'premium',
    status: 'active',
    startDate: now,
    endDate,
    receiptImageUrl,
    receiptVerified: false,
    verificationNote,
    transactionId,
    isStaggering: true,
    adminReviewed: false,
    adminVerified: null
  });

  await User.findByIdAndUpdate(user._id, { role: 'premium', premiumUntil: endDate });

  sendSuccess(res, {
    upgraded: true,
    plan: 'premium',
    staggering: true,
    startDate: now,
    endDate,
    detected
  }, 200, '✅ You have been granted Premium access. Your receipt is pending admin review.');
}

export const getSubscription = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findOne({ user: req.user._id, status: 'active' }).sort('-createdAt');
  sendSuccess(res, {
    role: req.user.role,
    subscription: subscription || null
  });
});
