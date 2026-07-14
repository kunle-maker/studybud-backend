/**
 * AI-powered assignment features:
 *  - generateQuestions  – auto-generate exam questions via AI
 *  - saveAnswer         – save / update a user's answer to a question
 *  - submitAssignment   – submit all answers for AI grading
 *  - getGrades          – retrieve a user's graded submission
 */

import Assignment from '../models/Assignment.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/responseHelper.js';
import { generateAssignmentQuestions, gradeAssignment } from '../services/aiService.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripSensitiveFields(questions) {
  return questions.map(q => ({
    _id:      q._id,
    type:     q.type,
    question: q.question,
    options:  q.options,
    marks:    q.marks,
    hint:     q.hint,
    order:    q.order,
  }));
}

async function findAccessibleAssignment(id, userId) {
  return Assignment.findOne({
    _id: id,
    $or: [{ creator: userId }, { 'collaborators.user': userId }],
  });
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/v1/assignments/:id/generate-questions
 * AI generates exam questions for an assignment.
 * Idempotent: if questions already exist they are returned without regenerating.
 */
export const generateQuestions = asyncHandler(async (req, res) => {
  const assignment = await findAccessibleAssignment(req.params.id, req.user._id);
  if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

  // Already generated — return existing (sensitive fields stripped)
  if (assignment.questions?.length > 0) {
    return sendSuccess(res, { questions: stripSensitiveFields(assignment.questions) });
  }

  const rawQuestions = await generateAssignmentQuestions(
    assignment.title,
    assignment.description,
    assignment.difficulty,
    assignment.educationLevel,
    assignment.numQuestions,
    req.user.role
  );

  assignment.questions   = rawQuestions.map((q, i) => ({ ...q, order: i }));
  assignment.aiGenerated = true;
  await assignment.save();

  sendSuccess(res, { questions: stripSensitiveFields(assignment.questions) });
});

/**
 * POST /api/v1/assignments/:id/regenerate-questions
 * Creator-only. Discards existing AI-generated questions (and any answers/
 * grades tied to them, since the question set is changing) and generates a
 * fresh set. Optional body: { difficulty, numQuestions } to change params
 * before regenerating.
 */
export const regenerateQuestions = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

  if (assignment.creator.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Only the creator can regenerate questions.' });
  }

  const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'];
  if (req.body?.difficulty && VALID_DIFFICULTIES.includes(req.body.difficulty)) {
    assignment.difficulty = req.body.difficulty;
  }
  if (req.body?.numQuestions) {
    assignment.numQuestions = Math.min(20, Math.max(1, parseInt(req.body.numQuestions) || assignment.numQuestions));
  }

  const rawQuestions = await generateAssignmentQuestions(
    assignment.title,
    assignment.description,
    assignment.difficulty,
    assignment.educationLevel,
    assignment.numQuestions,
    req.user.role
  );

  assignment.questions   = rawQuestions.map((q, i) => ({ ...q, order: i }));
  assignment.aiGenerated = true;
  // Old answers/grades no longer correspond to the new question set.
  assignment.answers     = [];
  assignment.submissions = [];
  assignment.activity.push({ actor: req.user._id, action: 'updated', detail: 'Questions regenerated.' });

  await assignment.save();
  sendSuccess(res, { questions: stripSensitiveFields(assignment.questions) }, 200, 'Questions regenerated.');
});

/**
 * POST /api/v1/assignments/:id/answers
 * Save or update a single answer for the current user.
 * Body: { questionId, content }
 */
export const saveAnswer = asyncHandler(async (req, res) => {
  const { questionId, content } = req.body;
  if (!questionId) return res.status(400).json({ success: false, message: 'questionId is required' });

  const assignment = await findAccessibleAssignment(req.params.id, req.user._id);
  if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

  const uid = req.user._id.toString();
  const existingIdx = assignment.answers.findIndex(
    a => a.questionId.toString() === questionId && a.user.toString() === uid
  );

  if (existingIdx >= 0) {
    assignment.answers[existingIdx].content = content ?? '';
    assignment.answers[existingIdx].savedAt = new Date();
  } else {
    assignment.answers.push({ user: req.user._id, questionId, content: content ?? '', savedAt: new Date() });
  }

  await assignment.save();
  sendSuccess(res, {}, 200, 'Answer saved');
});

/**
 * POST /api/v1/assignments/:id/submit
 * Submit all answers for AI grading. Idempotent — returns existing grades if already graded.
 */
export const submitAssignment = asyncHandler(async (req, res) => {
  const assignment = await findAccessibleAssignment(req.params.id, req.user._id);
  if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
  if (!assignment.questions?.length) return res.status(400).json({ success: false, message: 'No questions to grade' });

  const uid = req.user._id.toString();

  // Already graded — return existing
  const existing = assignment.submissions.find(s => s.user.toString() === uid);
  if (existing?.graded) {
    return sendSuccess(res, { grades: existing.grades, totalScore: existing.totalScore, maxScore: existing.maxScore, graded: true });
  }

  // Collect answers in question order
  const userAnswers = assignment.questions.map(q => {
    const ans = assignment.answers.find(
      a => a.questionId.toString() === q._id.toString() && a.user.toString() === uid
    );
    return ans?.content || '';
  });

  // AI grading
  const gradeResults = await gradeAssignment(assignment.questions, userAnswers, req.user.role);

  const grades = gradeResults
    .map(g => ({
      questionId: assignment.questions[g.questionIndex]?._id,
      score:      g.score,
      maxScore:   g.maxScore,
      status:     g.status,
      feedback:   g.feedback,
      correction: g.correction,
    }))
    .filter(g => g.questionId);

  const totalScore = grades.reduce((s, g) => s + (g.score || 0), 0);
  const maxScore   = grades.reduce((s, g) => s + (g.maxScore || 0), 0);

  if (existing) {
    existing.grades      = grades;
    existing.totalScore  = totalScore;
    existing.maxScore    = maxScore;
    existing.graded      = true;
    existing.submittedAt = new Date();
  } else {
    assignment.submissions.push({ user: req.user._id, grades, totalScore, maxScore, graded: true });
  }

  await assignment.save();
  sendSuccess(res, { grades, totalScore, maxScore, graded: true });
});

/**
 * GET /api/v1/assignments/:id/grades
 * Retrieve the current user's graded submission (if it exists).
 */
export const getGrades = asyncHandler(async (req, res) => {
  const assignment = await findAccessibleAssignment(req.params.id, req.user._id);
  if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

  const submission = assignment.submissions.find(s => s.user.toString() === req.user._id.toString());
  if (!submission?.graded) return sendSuccess(res, { graded: false });

  sendSuccess(res, { grades: submission.grades, totalScore: submission.totalScore, maxScore: submission.maxScore, graded: true });
});
