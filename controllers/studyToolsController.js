import { generateFlashcards, generateQuiz, summarizeOcrText } from '../services/aiService.js';
import StudyHistory from '../models/StudyHistory.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/responseHelper.js';

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

export const summarizeFromOcr = asyncHandler(async (req, res) => {
  const { extractedText } = req.body;
  const summary = await summarizeOcrText(extractedText, req.user.role);

  sendSuccess(res, { summary });
});
