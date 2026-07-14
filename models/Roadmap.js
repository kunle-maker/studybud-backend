import mongoose from 'mongoose';

const comprehensionQuestionSchema = new mongoose.Schema({
  question:      { type: String, required: true },
  options:       [{ type: String }],
  correctAnswer: { type: String, required: true },
  explanation:   { type: String, default: '' },
}, { _id: true });

const lessonSchema = new mongoose.Schema({
  title:                  { type: String, required: true, trim: true },
  description:            { type: String, default: '' },
  content:                { type: String, default: '' },          // rich markdown chapter content
  contentGeneratedAt:     { type: Date, default: null },
  comprehensionQuestions: [comprehensionQuestionSchema],
  estimatedMinutes:       { type: Number, default: 15, min: 1 },
  difficulty:             { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
  prerequisites:          [{ type: mongoose.Schema.Types.ObjectId }],
  order:                  { type: Number, required: true },
}, { _id: true });

const roadmapSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  subject:     { type: String, required: true, trim: true, lowercase: true },
  description: { type: String, default: '' },
  difficulty:  { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
  lessons:     [lessonSchema],
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isPublished: { type: Boolean, default: true },
}, { timestamps: true });

roadmapSchema.index({ subject: 1 });

export default mongoose.model('Roadmap', roadmapSchema);
