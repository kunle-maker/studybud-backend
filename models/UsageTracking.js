import mongoose from 'mongoose';

const usageTrackingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  summaries: { type: Number, default: 0 },
  teacherQuestions: { type: Number, default: 0 },
  topicExplanations: { type: Number, default: 0 },
  ocrCalls: { type: Number, default: 0 }
}, { timestamps: true });

usageTrackingSchema.index({ user: 1, date: -1 });

export default mongoose.model('UsageTracking', usageTrackingSchema);