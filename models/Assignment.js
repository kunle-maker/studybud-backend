import mongoose from 'mongoose';
import crypto from 'crypto';

// ── Sub-schemas ───────────────────────────────────────────────────────────────

const commentSchema = new mongoose.Schema({
  author:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content:    { type: String, required: true, trim: true },
  mentions:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  resolved:   { type: Boolean, default: false },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedAt: { type: Date, default: null },
}, { timestamps: true });

const activitySchema = new mongoose.Schema({
  actor:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action:    { type: String, required: true },
  detail:    { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

// ── AI Assignment schemas ─────────────────────────────────────────────────────

const questionSchema = new mongoose.Schema({
  type:          { type: String, enum: ['multiple_choice', 'short_answer', 'theory', 'problem_solving'], required: true },
  question:      { type: String, required: true },
  options:       [String],
  correctAnswer: { type: String, default: '' },   // hidden from client
  rubric:        { type: String, default: '' },   // hidden from client
  marks:         { type: Number, default: 5 },
  hint:          { type: String, default: '' },
  order:         { type: Number, default: 0 },
}, { _id: true });

const answerSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  content:    { type: String, default: '' },
  savedAt:    { type: Date, default: Date.now },
}, { _id: true });

const gradeDetailSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  score:      { type: Number, default: 0 },
  maxScore:   { type: Number, default: 0 },
  status:     { type: String, enum: ['correct', 'incorrect', 'partial'], default: 'incorrect' },
  feedback:   { type: String, default: '' },
  correction: { type: String, default: '' },
}, { _id: true });

const submissionSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  submittedAt: { type: Date, default: Date.now },
  grades:      [gradeDetailSchema],
  totalScore:  { type: Number, default: 0 },
  maxScore:    { type: Number, default: 0 },
  graded:      { type: Boolean, default: false },
}, { _id: true });

// ── Main schema ───────────────────────────────────────────────────────────────

const assignmentSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, default: '', maxlength: 5000 },
  creator:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  collaborators: [{
    user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role:     { type: String, enum: ['viewer', 'editor'], default: 'editor' },
    joinedAt: { type: Date, default: Date.now },
    _id: false,
  }],

  shareToken:   { type: String, unique: true, sparse: true },
  shareEnabled: { type: Boolean, default: false },
  status:       { type: String, enum: ['open', 'in_progress', 'completed'], default: 'open' },
  dueDate:      { type: Date, default: null },

  // AI-generated content
  questions:      [questionSchema],
  answers:        [answerSchema],
  submissions:    [submissionSchema],
  difficulty:     { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  educationLevel: { type: String, default: 'secondary' },
  numQuestions:   { type: Number, default: 5, min: 1, max: 20 },
  aiGenerated:    { type: Boolean, default: false },

  comments: [commentSchema],
  activity: [activitySchema],
}, { timestamps: true });

assignmentSchema.index({ creator: 1, createdAt: -1 });
assignmentSchema.index({ 'collaborators.user': 1 });
assignmentSchema.index({ shareToken: 1 });

assignmentSchema.methods.generateShareToken = function () {
  this.shareToken = crypto.randomBytes(20).toString('hex');
  this.shareEnabled = true;
  return this.shareToken;
};

export default mongoose.model('Assignment', assignmentSchema);
