import { searchEducationalVideos } from '../services/videoService.js';
import StudyHistory from '../models/StudyHistory.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/responseHelper.js';

export const searchVideos = asyncHandler(async (req, res) => {
  const { topic, maxResults } = req.query;
  if (!topic) {
    return res.status(400).json({ success: false, message: 'Topic query parameter is required' });
  }

  const result = await searchEducationalVideos(topic, Number(maxResults) || 6);

  await StudyHistory.create({
    user: req.user._id,
    activityType: 'video_search',
    data: { topic, resultsCount: result.total }
  });

  sendSuccess(res, result);
});

export const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  sendSuccess(res, {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube.com/embed/${videoId}`
  });
});
