import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email:          { type: String, unique: true, sparse: true, lowercase: true },
  password:       { type: String, select: false },
  name:           { type: String },
  profilePicture: { type: String },
  refreshToken:   { type: String, select: false },

  authProvider:   { type: String, enum: ['local', 'google', 'github', 'telegram'], default: 'local' },
  googleId:       { type: String, unique: true, sparse: true },
  githubId:       { type: String, unique: true, sparse: true },
  telegramId:     { type: String, unique: true, sparse: true },

  role:           { type: String, enum: ['free', 'premium'], default: 'free' },
  isAdmin:        { type: Boolean, default: false },
  premiumUntil:   { type: Date, default: null },

  usageStats: {
    summariesToday:          { type: Number, default: 0 },
    teacherQuestionsToday:   { type: Number, default: 0 },
    topicExplanationsToday:  { type: Number, default: 0 },
    ocrToday:                { type: Number, default: 0 },
    lastReset:               { type: Date,   default: Date.now }
  }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.resetDailyIfNeeded = function () {
  const now = new Date();
  if (this.usageStats.lastReset.toDateString() !== now.toDateString()) {
    this.usageStats.summariesToday         = 0;
    this.usageStats.teacherQuestionsToday  = 0;
    this.usageStats.topicExplanationsToday = 0;
    this.usageStats.ocrToday               = 0;
    this.usageStats.lastReset              = now;
  }
};

export default mongoose.model('User', userSchema);
