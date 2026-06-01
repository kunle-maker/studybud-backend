import asyncHandler from '../utils/asyncHandler.js';
import { TooManyRequestsError } from '../utils/errors.js';
import { USAGE_LIMITS } from '../utils/constants.js';

export const checkDailyLimit = (feature) => {
  return asyncHandler(async (req, res, next) => {
    const user = req.user;
    if (user.role === 'premium') return next();

    user.resetDailyIfNeeded();
    
    const limit = USAGE_LIMITS.FREE[feature];
    let current;
    switch (feature) {
      case 'summaries':
        current = user.usageStats.summariesToday;
        break;
      case 'teacher':
        current = user.usageStats.teacherQuestionsToday;
        break;
      case 'topic':
        current = user.usageStats.topicExplanationsToday;
        break;
      case 'ocr':
        current = user.usageStats.ocrToday;
        break;
      default:
        return next();
    }

    if (current >= limit) {
      throw new TooManyRequestsError(`Daily limit of ${limit} ${feature} reached. Upgrade to premium.`);
    }
    next();
  });
};