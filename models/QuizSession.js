import mongoose from 'mongoose';

const quizSessionSchema = new mongoose.Schema({
  user:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  questions:     { type: mongoose.Schema.Types.Mixed, default: [] }, // QuizQuestion[]
  answers:       { type: mongoose.Schema.Types.Mixed, default: {} }, // {[index]: selectedOption}
  currentQ:      { type: Number, default: 0 },
  view:          { type: String, enum: ['quiz', 'results'], default: 'quiz' },
  sourceText:    { type: String, default: '' },   // truncated source
  questionCount: { type: Number, default: 5 },
  completedAt:   { type: Date, default: null },
  // Optional context from chat (for AI-invoked quizzes)
  subject:  { type: String, default: '' },
  topic:    { type: String, default: '' },
}, { timestamps: true });

quizSessionSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('QuizSession', quizSessionSchema);
