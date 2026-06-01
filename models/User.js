import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['free', 'premium'], default: 'free' },
  name: String,
  profilePicture: String,
  refreshToken: { type: String, select: false },
  usageStats: {
    summariesToday: { type: Number, default: 0 },
    teacherQuestionsToday: { type: Number, default: 0 },
    topicExplanationsToday: { type: Number, default: 0 },
    ocrToday: { type: Number, default: 0 },
    lastReset: { type: Date, default: Date.now }
  }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.resetDailyIfNeeded = function () {
  const now = new Date();
  if (this.usageStats.lastReset.toDateString() !== now.toDateString()) {
    this.usageStats.summariesToday = 0;
    this.usageStats.teacherQuestionsToday = 0;
    this.usageStats.topicExplanationsToday = 0;
    this.usageStats.ocrToday = 0;
    this.usageStats.lastReset = now;
  }
};

export default mongoose.model('User', userSchema);