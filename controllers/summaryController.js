import Summary from '../models/Summary.js';
import StudyHistory from '../models/StudyHistory.js';
import { generateSummary } from '../services/aiService.js';
import asyncHandler from '../utils/asyncHandler.js';

export const createSummary = asyncHandler(async (req, res) => {
  const { text } = req.body;
  const summary = await generateSummary(text, req.user.role);
  
  // Save to DB
  const record = await Summary.create({ user: req.user._id, originalText: text, summary });
  
  // Update usage stats
  req.user.usageStats.summariesToday += 1;
  await req.user.save();
  
  // Study history
  await StudyHistory.create({ user: req.user._id, activityType: 'summary', data: { text, summary } });

  res.status(200).json({ success: true, data: { summary, id: record._id } });
});

export const getSummaryHistory = asyncHandler(async (req, res) => {
  const summaries = await Summary.find({ user: req.user._id }).sort('-createdAt').limit(20);
  res.status(200).json({ success: true, data: summaries });
});