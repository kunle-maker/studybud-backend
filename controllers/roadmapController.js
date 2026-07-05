import Roadmap from '../models/Roadmap.js';
import UserProgress from '../models/UserProgress.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../utils/responseHelper.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Annotate each lesson with locked/unlocked status for a given user.
 * A lesson is unlocked if ALL its prerequisites are in completedLessons.
 */
function annotateLessons(lessons, completedSet) {
  return lessons
    .sort((a, b) => a.order - b.order)
    .map(l => {
      const completed = completedSet.has(l._id.toString());
      const locked = l.prerequisites.some(pid => !completedSet.has(pid.toString()));
      return {
        _id:              l._id,
        title:            l.title,
        description:      l.description,
        estimatedMinutes: l.estimatedMinutes,
        difficulty:       l.difficulty,
        prerequisites:    l.prerequisites,
        order:            l.order,
        completed,
        locked: !completed && locked,
      };
    });
}

// ─── Public / User-facing ───────────────────────────────────────────────────

/**
 * GET /api/v1/roadmaps
 * List all published roadmaps (no lesson content, just metadata).
 */
export const listRoadmaps = asyncHandler(async (req, res) => {
  const { subject } = req.query;
  const filter = { isPublished: true };
  if (subject) filter.subject = subject.toLowerCase();

  const roadmaps = await Roadmap.find(filter)
    .select('title subject description difficulty lessons createdAt')
    .lean();

  const result = roadmaps.map(r => ({
    _id:         r._id,
    title:       r.title,
    subject:     r.subject,
    description: r.description,
    difficulty:  r.difficulty,
    lessonCount: r.lessons.length,
    totalMinutes: r.lessons.reduce((s, l) => s + (l.estimatedMinutes || 0), 0),
    createdAt:   r.createdAt,
  }));

  sendSuccess(res, result);
});

/**
 * GET /api/v1/roadmaps/:id
 * Get a single roadmap with lessons annotated (locked/unlocked/completed) for the current user.
 */
export const getRoadmap = asyncHandler(async (req, res) => {
  const roadmap = await Roadmap.findOne({ _id: req.params.id, isPublished: true }).lean();
  if (!roadmap) return res.status(404).json({ success: false, message: 'Roadmap not found.' });

  const progress = await UserProgress.findOne({ user: req.user._id, roadmap: roadmap._id }).lean();
  const completedSet = new Set((progress?.completedLessons || []).map(id => id.toString()));

  const lessons = annotateLessons(roadmap.lessons, completedSet);
  const completedCount = lessons.filter(l => l.completed).length;

  sendSuccess(res, {
    _id:            roadmap._id,
    title:          roadmap.title,
    subject:        roadmap.subject,
    description:    roadmap.description,
    difficulty:     roadmap.difficulty,
    lessons,
    progress: {
      completed:   completedCount,
      total:       lessons.length,
      percentage:  lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0,
      startedAt:   progress?.startedAt || null,
      lastActivityAt: progress?.lastActivityAt || null,
    },
  });
});

/**
 * POST /api/v1/roadmaps/:id/lessons/:lessonId/complete
 * Mark a lesson as complete for the current user.
 * Returns 400 if the lesson is still locked (prerequisites not met).
 * Uses atomic upsert + $addToSet to avoid duplicate-key race conditions.
 */
export const completeLesson = asyncHandler(async (req, res) => {
  const roadmap = await Roadmap.findOne({ _id: req.params.id, isPublished: true }).lean();
  if (!roadmap) return res.status(404).json({ success: false, message: 'Roadmap not found.' });

  const lesson = roadmap.lessons.find(l => l._id.toString() === req.params.lessonId);
  if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found.' });

  // Read current progress to check prerequisites (read-before-write is acceptable here;
  // the worst case of a race is the user completes a lesson slightly early, which is harmless).
  const existing = await UserProgress.findOne({ user: req.user._id, roadmap: roadmap._id }).lean();
  const completedSet = new Set((existing?.completedLessons || []).map(id => id.toString()));

  // Check prerequisites
  const locked = lesson.prerequisites.some(pid => !completedSet.has(pid.toString()));
  if (locked) {
    return res.status(400).json({
      success: false,
      message: 'Cannot complete this lesson — prerequisites not yet finished.',
    });
  }

  // Atomic upsert: create progress doc if absent, add lessonId idempotently
  const progress = await UserProgress.findOneAndUpdate(
    { user: req.user._id, roadmap: roadmap._id },
    {
      $addToSet: { completedLessons: lesson._id },
      $set:      { lastActivityAt: new Date() },
      $setOnInsert: { startedAt: new Date() },
    },
    { upsert: true, new: true }
  );

  const completedCount = progress.completedLessons.length;
  const total = roadmap.lessons.length;

  sendSuccess(res, {
    lessonId:   lesson._id,
    completed:  completedCount,
    total,
    percentage: total ? Math.round((completedCount / total) * 100) : 0,
  }, 200, 'Lesson marked as complete.');
});

/**
 * DELETE /api/v1/roadmaps/:id/lessons/:lessonId/complete
 * Unmark a lesson (allow re-doing).
 */
export const uncompleteLesson = asyncHandler(async (req, res) => {
  const progress = await UserProgress.findOne({ user: req.user._id, roadmap: req.params.id });
  if (!progress) return sendSuccess(res, {}, 200, 'No progress to unmark.');

  progress.completedLessons = progress.completedLessons.filter(
    id => id.toString() !== req.params.lessonId
  );
  progress.lastActivityAt = new Date();
  await progress.save();

  sendSuccess(res, {}, 200, 'Lesson unmarked.');
});

/**
 * GET /api/v1/roadmaps/my-progress
 * List all roadmaps the current user has started, with completion %.
 */
export const myProgress = asyncHandler(async (req, res) => {
  const progresses = await UserProgress.find({ user: req.user._id })
    .populate({ path: 'roadmap', select: 'title subject description difficulty lessons' })
    .lean();

  const result = progresses
    .filter(p => p.roadmap) // safety: roadmap not deleted
    .map(p => {
      const total = p.roadmap.lessons.length;
      const completed = p.completedLessons.length;
      return {
        roadmapId:      p.roadmap._id,
        title:          p.roadmap.title,
        subject:        p.roadmap.subject,
        difficulty:     p.roadmap.difficulty,
        completed,
        total,
        percentage:     total ? Math.round((completed / total) * 100) : 0,
        lastActivityAt: p.lastActivityAt,
        startedAt:      p.startedAt,
      };
    });

  sendSuccess(res, result);
});

// ─── Admin endpoints ─────────────────────────────────────────────────────────


/**
 * POST /api/v1/roadmaps  (admin only)
 * Create a roadmap with lessons.
 */
export const createRoadmap = asyncHandler(async (req, res) => {
  const { title, subject, description, difficulty, lessons } = req.body;

  if (!title?.trim() || !subject?.trim()) {
    return res.status(400).json({ success: false, message: 'title and subject are required.' });
  }

  // Client may pre-supply lesson _id values (as valid ObjectId strings) so that
  // prerequisites can reference sibling lessons in the same request.
  // If no _id is provided for a lesson, Mongoose generates one automatically.
  const normalised = (lessons || []).map((l, i) => ({
    ...(l._id ? { _id: l._id } : {}),
    title:            l.title,
    description:      l.description || '',
    content:          l.content || '',
    estimatedMinutes: l.estimatedMinutes || 15,
    difficulty:       l.difficulty || 'beginner',
    prerequisites:    l.prerequisites || [],
    order:            l.order ?? i,
  }));

  // Build the roadmap doc first so Mongoose resolves/generates all lesson _ids,
  // then validate prerequisites against those final IDs.
  const tempRoadmap = new Roadmap({ title, subject, lessons: normalised });
  const finalIds = new Set(tempRoadmap.lessons.map(l => l._id.toString()));
  for (const l of tempRoadmap.lessons) {
    for (const prereqId of l.prerequisites) {
      if (!finalIds.has(prereqId.toString())) {
        return res.status(400).json({
          success: false,
          message: `Prerequisite ID "${prereqId}" does not refer to any lesson in this roadmap.`,
        });
      }
    }
  }

  tempRoadmap.subject     = subject.trim().toLowerCase();
  tempRoadmap.description = description?.trim() || '';
  tempRoadmap.difficulty  = difficulty || 'beginner';
  tempRoadmap.createdBy   = req.user._id;
  await tempRoadmap.save();

  sendCreated(res, tempRoadmap, 'Roadmap created.');
});

/**
 * PUT /api/v1/roadmaps/:id  (admin only)
 * Replace a roadmap's metadata and lessons.
 */
export const updateRoadmap = asyncHandler(async (req, res) => {
  const roadmap = await Roadmap.findById(req.params.id);
  if (!roadmap) return res.status(404).json({ success: false, message: 'Roadmap not found.' });

  const { title, subject, description, difficulty, lessons, isPublished } = req.body;
  if (title !== undefined)       roadmap.title       = title.trim();
  if (subject !== undefined)     roadmap.subject     = subject.trim().toLowerCase();
  if (description !== undefined) roadmap.description = description.trim();
  if (difficulty !== undefined)  roadmap.difficulty  = difficulty;
  if (isPublished !== undefined) roadmap.isPublished = isPublished;
  if (lessons !== undefined) {
    const mapped = lessons.map((l, i) => ({
      _id:              l._id,          // preserve existing IDs so progress links stay valid
      title:            l.title,
      description:      l.description || '',
      content:          l.content || '',
      estimatedMinutes: l.estimatedMinutes || 15,
      difficulty:       l.difficulty || 'beginner',
      prerequisites:    l.prerequisites || [],
      order:            l.order ?? i,
    }));

    // Validate all prerequisites reference lesson IDs in this same update payload
    const ids = new Set(mapped.map(l => (l._id || '').toString()).filter(Boolean));
    for (const l of mapped) {
      for (const pid of l.prerequisites) {
        if (!ids.has(pid.toString())) {
          return res.status(400).json({
            success: false,
            message: `Prerequisite ID "${pid}" does not refer to any lesson in this roadmap.`,
          });
        }
      }
    }

    roadmap.lessons = mapped;
  }

  await roadmap.save();
  sendSuccess(res, roadmap, 200, 'Roadmap updated.');
});

/**
 * DELETE /api/v1/roadmaps/:id  (admin only)
 * Delete a roadmap and all associated user progress.
 */
export const deleteRoadmap = asyncHandler(async (req, res) => {
  const roadmap = await Roadmap.findByIdAndDelete(req.params.id);
  if (!roadmap) return res.status(404).json({ success: false, message: 'Roadmap not found.' });

  await UserProgress.deleteMany({ roadmap: req.params.id });
  sendSuccess(res, {}, 200, 'Roadmap deleted.');
});
