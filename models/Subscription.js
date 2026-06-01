import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: String, enum: ['free', 'premium'], default: 'free' },
  startDate: Date,
  endDate: Date,
  status: { type: String, enum: ['pending', 'active', 'expired', 'cancelled', 'rejected'], default: 'pending' },
  receiptImageUrl: String,
  receiptVerified: { type: Boolean, default: false },
  verificationNote: String,
  transferReference: String
}, { timestamps: true });

export default mongoose.model('Subscription', subscriptionSchema);
