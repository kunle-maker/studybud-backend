import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  user:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan:             { type: String, enum: ['free', 'premium'], default: 'free' },
  startDate:        Date,
  endDate:          Date,
  status:           { type: String, enum: ['pending', 'active', 'expired', 'cancelled', 'rejected'], default: 'pending' },
  receiptImageUrl:  String,
  receiptVerified:  { type: Boolean, default: false },
  verificationNote: String,
  transferReference:String,

  transactionId:    { type: String, default: null, sparse: true },

  isStaggering:     { type: Boolean, default: false },
  adminReviewed:    { type: Boolean, default: false },
  adminVerified:    { type: Boolean, default: null },
  adminNote:        { type: String, default: null }
}, { timestamps: true });

subscriptionSchema.index({ transactionId: 1 }, { sparse: true });

export default mongoose.model('Subscription', subscriptionSchema);
