import mongoose from 'mongoose';

const userProgressSchema = new mongoose.Schema({
  user:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  roadmap:          { type: mongoose.Schema.Types.ObjectId, ref: 'Roadmap', required: true },
  completedLessons: [{ type: mongoose.Schema.Types.ObjectId }], // lesson _ids
  startedAt:        { type: Date, default: Date.now },
  lastActivityAt:   { type: Date, default: Date.now },
}, { timestamps: true });

userProgressSchema.index({ user: 1, roadmap: 1 }, { unique: true });

export default mongoose.model('UserProgress', userProgressSchema);
