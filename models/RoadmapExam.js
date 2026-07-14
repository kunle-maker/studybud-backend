import mongoose from 'mongoose';

const ObjectId = mongoose.Schema.Types.ObjectId;

const objectiveQuestionSchema = new mongoose.Schema({
  question:      { type: String, required: true },
  options:       [{ type: String }],
  correctAnswer: { type: String, required: true },
  explanation:   { type: String, default: '' },
}, { _id: true });

const theoryQuestionSchema = new mongoose.Schema({
  question:   { type: String, required: true },
  markScheme: { type: String, default: '' },
  maxScore:   { type: Number, default: 15 },
}, { _id: true });

const theoryGradeSchema = new mongoose.Schema({
  questionIndex: { type: Number, required: true },
  score:         { type: Number, default: 0 },
  maxScore:      { type: Number, default: 15 },
  feedback:      { type: String, default: '' },
  correction:    { type: String, default: '' },
}, { _id: false });

const roadmapExamSchema = new mongoose.Schema({
  user:     { type: ObjectId, ref: 'User',    required: true },
  roadmap:  { type: ObjectId, ref: 'Roadmap', required: true },

  // Generated question banks
  objectiveQuestions: [objectiveQuestionSchema],  // 15 MCQ
  theoryQuestions:    [theoryQuestionSchema],      // 5 theory

  // Student answers
  objectiveAnswers: [{
    questionIndex: Number,
    answer: String,
  }],
  theoryAnswers: [{
    questionIndex: Number,   // index into theoryQuestions (0-4)
    answer: String,
  }],
  selectedTheoryIndices: [{ type: Number }],  // which 3 of 5 theory questions user answered

  status: {
    type: String,
    enum: ['pending', 'in_progress', 'submitted', 'graded'],
    default: 'pending',
  },

  // Scores (filled after grading)
  objectiveScore: { type: Number, default: 0 },   // /15
  theoryScore:    { type: Number, default: 0 },   // /45 (3 × 15)
  totalScore:     { type: Number, default: 0 },   // /60
  theoryGrades:   [theoryGradeSchema],

  performanceSummary:  { type: String, default: '' },
  recommendations:     { type: String, default: '' },

  timeLimitMinutes: { type: Number, default: 90 },
  startedAt:    { type: Date, default: Date.now },
  submittedAt:  { type: Date, default: null },
  gradedAt:     { type: Date, default: null },
}, { timestamps: true });

// Enforce one exam session per user per roadmap at the DB level
roadmapExamSchema.index({ user: 1, roadmap: 1 }, { unique: true });

export default mongoose.model('RoadmapExam', roadmapExamSchema);
