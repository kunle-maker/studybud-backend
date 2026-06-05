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
      'Receipt must be from today — old receipts will be rejected'
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

  const buffer = req.file.buffer;
  const mimeType = req.file.mimetype || 'image/jpeg';
  const imageBase64 = buffer.toString('base64');

  const verification = await verifyPaymentReceipt(imageBase64, mimeType);

  let receiptImageUrl = null;
  try {
    const uploadResult = await cloudinaryService.uploadBuffer(
      buffer,
      `studyflow/receipts/${user._id}`
    );
    receiptImageUrl = uploadResult.secure_url;
  } catch (err) {
    console.warn('Cloudinary upload failed for receipt:', err.message);
  }

  if (!verification.valid) {
    await Subscription.create({
      user: user._id,
      plan: 'premium',
      status: 'rejected',
      receiptImageUrl,
      receiptVerified: false,
      verificationNote: verification.reason
    });

    let message = 'Receipt could not be verified.';
    if (verification.date_valid === false) {
      message = 'Old receipt detected. Please upload a receipt from today\'s transaction only.';
    }

    return res.status(400).json({
      success: false,
      message,
      reason: verification.reason,
      detected: {
        name:   verification.detected_name,
        amount: verification.detected_amount,
        bank:   verification.detected_bank,
        date:   verification.detected_date
      },
      hint: verification.date_valid === false
        ? 'We only accept receipts from today. Old or recycled receipts are rejected automatically.'
        : 'Make sure your screenshot clearly shows: Ayodele Ganiyu, SmartCash bank, ₦1,000, and today\'s date.'
    });
  }

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
    verificationNote: verification.reason
  });

  await User.findByIdAndUpdate(user._id, { role: 'premium' });

  sendSuccess(res, {
    upgraded: true,
    plan: 'premium',
    startDate: now,
    endDate,
    detected: {
      name:   verification.detected_name,
      amount: verification.detected_amount,
      bank:   verification.detected_bank,
      date:   verification.detected_date
    }
  }, 200, '🎉 Payment verified! Your account has been upgraded to Premium.');
});

export const getSubscription = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findOne({ user: req.user._id, status: 'active' })
    .sort('-createdAt');

  sendSuccess(res, {
    role: req.user.role,
    subscription: subscription || null
  });
});
