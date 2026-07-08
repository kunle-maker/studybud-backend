import { generateFlashcards, generateQuiz, summarizeOcrText } from '../services/aiService.js';
import StudyHistory from '../models/StudyHistory.js';
import QuizSession  from '../models/QuizSession.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/responseHelper.js';

/* ── Flashcards ──────────────────────────────────────────────────────── */
export const createFlashcards = asyncHandler(async (req, res) => {
  const { text, count } = req.body;
  const flashcards = await generateFlashcards(text, count || 5, req.user.role);

  await StudyHistory.create({
    user: req.user._id,
    activityType: 'summary',
    data: { type: 'flashcards', count: flashcards.length, textPreview: text.substring(0, 100) }
  });

  sendSuccess(res, { flashcards, count: flashcards.length });
});

/* ── Quiz (legacy — returns questions only, no session) ──────────────── */
export const createQuiz = asyncHandler(async (req, res) => {
  const { text, questionCount } = req.body;
  const quiz = await generateQuiz(text, questionCount || 5, req.user.role);

  await StudyHistory.create({
    user: req.user._id,
    activityType: 'summary',
    data: { type: 'quiz', questionCount: quiz.length, textPreview: text.substring(0, 100) }
  });

  sendSuccess(res, { quiz, questionCount: quiz.length });
});

/* ── Quiz Session (persistent, ID-based) ─────────────────────────────── */

/** POST /study-tools/quiz-session — generate quiz + persist, return sessionId */
export const createQuizSession = asyncHandler(async (req, res) => {
  const { text, questionCount, subject, topic } = req.body;
  const count = questionCount || 5;
  const questions = await generateQuiz(text, count, req.user.role);

  const session = await QuizSession.create({
    user:          req.user._id,
    questions,
    answers:       {},
    currentQ:      0,
    view:          'quiz',
    sourceText:    text.substring(0, 200),
    questionCount: count,
    subject:       subject || '',
    topic:         topic   || '',
  });

  await StudyHistory.create({
    user: req.user._id,
    activityType: 'summary',
    data: { type: 'quiz', questionCount: questions.length, textPreview: text.substring(0, 100) }
  });

  sendSuccess(res, { sessionId: session._id, questions, questionCount: questions.length });
});

/** GET /study-tools/quiz-session/:id — load session */
export const getQuizSession = asyncHandler(async (req, res) => {
  const session = await QuizSession.findOne({ _id: req.params.id, user: req.user._id });
  if (!session) return res.status(404).json({ success: false, message: 'Quiz session not found.' });
  sendSuccess(res, session);
});

/** PATCH /study-tools/quiz-session/:id/progress — save answer/currentQ */
export const saveQuizProgress = asyncHandler(async (req, res) => {
  const { answers, currentQ, view } = req.body;
  const session = await QuizSession.findOne({ _id: req.params.id, user: req.user._id });
  if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });

  if (answers  !== undefined) session.answers  = answers;
  if (currentQ !== undefined) session.currentQ = currentQ;
  if (view     !== undefined) {
    session.view = view;
    if (view === 'results' && !session.completedAt) session.completedAt = new Date();
  }
  await session.save();
  sendSuccess(res, { ok: true });
});

/* ── OCR summary ─────────────────────────────────────────────────────── */
export const summarizeFromOcr = asyncHandler(async (req, res) => {
  const { extractedText } = req.body;
  const summary = await summarizeOcrText(extractedText, req.user.role);
  sendSuccess(res, { summary });
});
