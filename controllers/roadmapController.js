import Roadmap from '../models/Roadmap.js';
import RoadmapExam from '../models/RoadmapExam.js';
import UserProgress from '../models/UserProgress.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../utils/responseHelper.js';
import {
  generateRoadmapAI,
  generateChapterContent,
  generateComprehensionQuestions,
  generateRoadmapExam,
  gradeTheoryAnswers,
  generateExamSummary,
} from '../services/aiService.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

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
        hasContent: !!(l.content && l.content.length > 100),
      };
    });
}

// ─── Public / User-facing ───────────────────────────────────────────────────

export const listRoadmaps = asyncHandler(async (req, res) => {
  const { subject } = req.query;
  const filter = { isPublished: true };
  if (subject) filter.subject = subject.toLowerCase();

  const roadmaps = await Roadmap.find(filter)
    .select('title subject description difficulty lessons createdAt createdBy')
    .lean();

  // Attach this user's progress in one query
  const roadmapIds = roadmaps.map(r => r._id);
  const progresses = await UserProgress.find({
    user: req.user._id,
    roadmap: { $in: roadmapIds },
  }).lean();

  const progressMap = {};
  for (const p of progresses) {
    progressMap[p.roadmap.toString()] = p;
  }

  const result = roadmaps.map(r => {
    const p     = progressMap[r._id.toString()];
    const total = r.lessons.length;
    const done  = p ? p.completedLessons.length : 0;
    return {
      _id:          r._id,
      title:        r.title,
      subject:      r.subject,
      description:  r.description,
      difficulty:   r.difficulty,
      lessonCount:  r.lessons.length,
      totalMinutes: r.lessons.reduce((s, l) => s + (l.estimatedMinutes || 0), 0),
      createdAt:    r.createdAt,
      createdBy:    r.createdBy,
      progress: {
        completed:  done,
        total,
        percentage: total ? Math.round((done / total) * 100) : 0,
      },
    };
  });

  sendSuccess(res, result);
});

export const getRoadmap = asyncHandler(async (req, res) => {
  const roadmap = await Roadmap.findOne({ _id: req.params.id, isPublished: true }).lean();
  if (!roadmap) return res.status(404).json({ success: false, message: 'Roadmap not found.' });

  const progress = await UserProgress.findOne({ user: req.user._id, roadmap: roadmap._id }).lean();
  const completedSet = new Set((progress?.completedLessons || []).map(id => id.toString()));

  const lessons = annotateLessons(roadmap.lessons, completedSet);
  const completedCount = lessons.filter(l => l.completed).length;
  const allComplete = lessons.length > 0 && completedCount === lessons.length;

  // Check if exam session exists
  const exam = await RoadmapExam.findOne({ user: req.user._id, roadmap: roadmap._id }).lean();

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
    examStatus: exam ? exam.status : null,
    canTakeExam: allComplete,
  });
});

export const completeLesson = asyncHandler(async (req, res) => {
  const roadmap = await Roadmap.findOne({ _id: req.params.id, isPublished: true }).lean();
  if (!roadmap) return res.status(404).json({ success: false, message: 'Roadmap not found.' });

  const lesson = roadmap.lessons.find(l => l._id.toString() === req.params.lessonId);
  if (!lesson) return res.status(404).json({ success: false, message: 'Lesson not found.' });

  const existing = await UserProgress.findOne({ user: req.user._id, roadmap: roadmap._id }).lean();
  const completedSet = new Set((existing?.completedLessons || []).map(id => id.toString()));

  const locked = lesson.prerequisites.some(pid => !completedSet.has(pid.toString()));
  if (locked) {
    return res.status(400).json({
      success: false,
      message: 'Cannot complete this lesson — prerequisites not yet finished.',
    });
  }

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

export const myProgress = asyncHandler(async (req, res) => {
  const progresses = await UserProgress.find({ user: req.user._id })
    .populate({ path: 'roadmap', select: 'title subject description difficulty lessons' })
    .lean();

  const result = progresses
    .filter(p => p.roadmap)
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

// ─── Chapter Content ─────────────────────────────────────────────────────────

/**
 * GET /api/v1/roadmaps/:id/lessons/:lessonId/content
 * Returns lesson content, generating it via AI if not already cached.
 */
export const getLessonContent = asyncHandler(async (req, res) => {
  const roadmap = await Roadmap.findOne({ _id: req.params.id, isPublished: true });
  if (!roadmap) return res.status(404).json({ success: false, message: 'Roadmap not found.' });

  const lessonIdx = roadmap.lessons.findIndex(l => l._id.toString() === req.params.lessonId);
  if (lessonIdx === -1) return res.status(404).json({ success: false, message: 'Lesson not found.' });

  const lesson = roadmap.lessons[lessonIdx];

  // Return cached content if available (and reasonably fresh — > 100 chars)
  if (lesson.content && lesson.content.length > 100) {
    return sendSuccess(res, {
      lessonId: lesson._id,
      title:    lesson.title,
      content:  lesson.content,
      comprehensionQuestions: lesson.comprehensionQuestions || [],
      generatedAt: lesson.contentGeneratedAt,
    });
  }

  // Generate content via AI
  const content = await generateChapterContent(
    lesson.title,
    lesson.description,
    roadmap.title,
    roadmap.subject,
    lesson.difficulty || roadmap.difficulty,
    req.user.role
  );

  // Generate comprehension questions
  let comprehensionQuestions = [];
  try {
    comprehensionQuestions = await generateComprehensionQuestions(lesson.title, content, req.user.role);
  } catch { /* non-critical — proceed without */ }

  // Cache in DB
  roadmap.lessons[lessonIdx].content = content;
  roadmap.lessons[lessonIdx].contentGeneratedAt = new Date();
  if (comprehensionQuestions.length) {
    roadmap.lessons[lessonIdx].comprehensionQuestions = comprehensionQuestions;
  }
  await roadmap.save();

  sendSuccess(res, {
    lessonId: lesson._id,
    title:    lesson.title,
    content,
    comprehensionQuestions,
    generatedAt: roadmap.lessons[lessonIdx].contentGeneratedAt,
  });
});

/**
 * POST /api/v1/roadmaps/:id/lessons/:lessonId/regenerate-content
 * Force-regenerate chapter content (ignores cache).
 */
export const regenerateLessonContent = asyncHandler(async (req, res) => {
  const roadmap = await Roadmap.findOne({ _id: req.params.id, isPublished: true });
  if (!roadmap) return res.status(404).json({ success: false, message: 'Roadmap not found.' });

  const lessonIdx = roadmap.lessons.findIndex(l => l._id.toString() === req.params.lessonId);
  if (lessonIdx === -1) return res.status(404).json({ success: false, message: 'Lesson not found.' });

  const lesson = roadmap.lessons[lessonIdx];

  const content = await generateChapterContent(
    lesson.title,
    lesson.description,
    roadmap.title,
    roadmap.subject,
    lesson.difficulty || roadmap.difficulty,
    req.user.role
  );

  let comprehensionQuestions = [];
  try {
    comprehensionQuestions = await generateComprehensionQuestions(lesson.title, content, req.user.role);
  } catch { /* non-critical */ }

  roadmap.lessons[lessonIdx].content = content;
  roadmap.lessons[lessonIdx].contentGeneratedAt = new Date();
  if (comprehensionQuestions.length) {
    roadmap.lessons[lessonIdx].comprehensionQuestions = comprehensionQuestions;
  }
  await roadmap.save();

  sendSuccess(res, {
    lessonId: lesson._id,
    title:    lesson.title,
    content,
    comprehensionQuestions,
    generatedAt: roadmap.lessons[lessonIdx].contentGeneratedAt,
  });
});

// ─── Final Examination ───────────────────────────────────────────────────────

/**
 * GET /api/v1/roadmaps/:id/exam
 * Get an existing exam session, or return 404 if none exists yet.
 */
export const getExam = asyncHandler(async (req, res) => {
  const exam = await RoadmapExam.findOne({ user: req.user._id, roadmap: req.params.id }).lean();
  if (!exam) return res.status(404).json({ success: false, message: 'No exam session found.' });
  sendSuccess(res, exam);
});

/**
 * POST /api/v1/roadmaps/:id/exam/start
 * Create a new exam session (or return existing in-progress one).
 * Requires all lessons completed.
 */
export const startExam = asyncHandler(async (req, res) => {
  const roadmap = await Roadmap.findOne({ _id: req.params.id, isPublished: true }).lean();
  if (!roadmap) return res.status(404).json({ success: false, message: 'Roadmap not found.' });

  // Check all lessons complete
  const progress = await UserProgress.findOne({ user: req.user._id, roadmap: roadmap._id }).lean();
  const completedSet = new Set((progress?.completedLessons || []).map(id => id.toString()));
  const allComplete = roadmap.lessons.every(l => completedSet.has(l._id.toString()));

  if (!allComplete) {
    return res.status(400).json({
      success: false,
      message: 'Complete all chapters before taking the final exam.',
    });
  }

  // Return existing in-progress exam (don't regenerate questions)
  const existing = await RoadmapExam.findOne({ user: req.user._id, roadmap: roadmap._id });
  if (existing && ['in_progress', 'submitted', 'graded'].includes(existing.status)) {
    return sendSuccess(res, existing);
  }

  // Generate exam questions
  const examData = await generateRoadmapExam(
    roadmap.title,
    roadmap.subject,
    roadmap.difficulty,
    roadmap.lessons.map(l => ({ title: l.title, description: l.description })),
    req.user.role
  );

  // Validate and cap questions
  const objectiveQs = (examData.objectiveQuestions || []).slice(0, 15);
  const theoryQs    = (examData.theoryQuestions    || []).slice(0, 5);

  // Create or replace exam session
  let exam;
  try {
    exam = await RoadmapExam.findOneAndUpdate(
      { user: req.user._id, roadmap: roadmap._id },
      {
        user:               req.user._id,
        roadmap:            roadmap._id,
        objectiveQuestions: objectiveQs,
        theoryQuestions:    theoryQs,
        objectiveAnswers:   [],
        theoryAnswers:      [],
        selectedTheoryIndices: [],
        status:             'in_progress',
        objectiveScore:     0,
        theoryScore:        0,
        totalScore:         0,
        theoryGrades:       [],
        startedAt:          new Date(),
        submittedAt:        null,
        gradedAt:           null,
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    // Handle duplicate-key race condition: another request already inserted the doc.
    // E11000 unique-index violation — just fetch the existing session.
    if (err.code === 11000) {
      exam = await RoadmapExam.findOne({ user: req.user._id, roadmap: roadmap._id });
      if (!exam) throw err; // unexpected — rethrow
    } else {
      throw err;
    }
  }

  sendSuccess(res, exam);
});

/**
 * PATCH /api/v1/roadmaps/:id/exam/answers
 * Auto-save answers during the exam.
 * Body: { type: 'objective'|'theory', questionIndex: number, answer: string }
 */
export const saveExamAnswer = asyncHandler(async (req, res) => {
  const { type, questionIndex, answer } = req.body;
  if (type === undefined || questionIndex === undefined) {
    return res.status(400).json({ success: false, message: 'type and questionIndex are required.' });
  }

  const exam = await RoadmapExam.findOne({ user: req.user._id, roadmap: req.params.id });
  if (!exam) return res.status(404).json({ success: false, message: 'Exam session not found.' });
  if (exam.status !== 'in_progress') return res.status(400).json({ success: false, message: 'Exam already submitted.' });

  if (type === 'objective') {
    const idx = exam.objectiveAnswers.findIndex(a => a.questionIndex === questionIndex);
    if (idx >= 0) exam.objectiveAnswers[idx].answer = answer;
    else exam.objectiveAnswers.push({ questionIndex, answer });
  } else if (type === 'theory') {
    const idx = exam.theoryAnswers.findIndex(a => a.questionIndex === questionIndex);
    if (idx >= 0) exam.theoryAnswers[idx].answer = answer;
    else exam.theoryAnswers.push({ questionIndex, answer });

    // Track selected theory question indices (the ones answered)
    if (!exam.selectedTheoryIndices.includes(questionIndex)) {
      exam.selectedTheoryIndices.push(questionIndex);
    }
  }

  exam.markModified('objectiveAnswers');
  exam.markModified('theoryAnswers');
  exam.markModified('selectedTheoryIndices');
  await exam.save();

  sendSuccess(res, {}, 200, 'Answer saved.');
});

/**
 * POST /api/v1/roadmaps/:id/exam/submit
 * Submit exam for grading.
 */
export const submitExam = asyncHandler(async (req, res) => {
  const exam = await RoadmapExam.findOne({ user: req.user._id, roadmap: req.params.id });
  if (!exam) return res.status(404).json({ success: false, message: 'Exam session not found.' });
  if (exam.status === 'graded') return sendSuccess(res, exam); // already graded

  const roadmap = await Roadmap.findById(req.params.id).lean();

  // Grade objective section
  let objectiveScore = 0;
  exam.objectiveQuestions.forEach((q, i) => {
    const studentAns = exam.objectiveAnswers.find(a => a.questionIndex === i);
    if (studentAns?.answer === q.correctAnswer) objectiveScore++;
  });

  // Determine which 3 theory questions were answered (or chosen by user)
  // If selectedTheoryIndices has answers, use those; otherwise use first 3 answered
  const answeredTheoryIndices = [...new Set([
    ...exam.selectedTheoryIndices,
    ...exam.theoryAnswers.map(a => a.questionIndex),
  ])].slice(0, 3);

  // Grade theory section via AI
  let theoryGrades = [];
  let theoryScore = 0;

  if (answeredTheoryIndices.length > 0) {
    const theoryForGrading = answeredTheoryIndices.map(idx => ({
      questionIndex: idx,
      question:   exam.theoryQuestions[idx]?.question || '',
      markScheme: exam.theoryQuestions[idx]?.markScheme || '',
      maxScore:   15,
      answer:     exam.theoryAnswers.find(a => a.questionIndex === idx)?.answer || '(no answer provided)',
    }));

    try {
      const grades = await gradeTheoryAnswers(theoryForGrading, req.user.role);
      theoryGrades = grades.map(g => ({
        questionIndex: g.questionIndex,
        score:    Math.min(15, Math.max(0, g.score || 0)),
        maxScore: 15,
        feedback: g.feedback || '',
        correction: g.correction || '',
      }));
      theoryScore = theoryGrades.reduce((s, g) => s + g.score, 0);
    } catch {
      // Fallback: rough scoring based on answer length
      theoryGrades = answeredTheoryIndices.map(idx => {
        const ans = exam.theoryAnswers.find(a => a.questionIndex === idx);
        const words = (ans?.answer || '').split(/\s+/).filter(Boolean).length;
        const score = Math.min(15, Math.round(words / 20));
        return { questionIndex: idx, score, maxScore: 15, feedback: 'Auto-scored based on response length.', correction: '' };
      });
      theoryScore = theoryGrades.reduce((s, g) => s + g.score, 0);
    }
  }

  const totalScore = objectiveScore + theoryScore;

  // Generate performance summary
  let performanceSummary = '';
  let recommendations = '';
  try {
    const summary = await generateExamSummary(
      roadmap?.title || 'this roadmap',
      totalScore,
      objectiveScore,
      theoryScore,
      theoryGrades,
      req.user.role
    );
    // Split summary into performance and recommendations
    const lines = summary.split('\n').filter(Boolean);
    const recIdx = lines.findIndex(l => l.toLowerCase().includes('recommend') || l.includes('•') || l.includes('-'));
    if (recIdx > 0) {
      performanceSummary = lines.slice(0, recIdx).join('\n');
      recommendations    = lines.slice(recIdx).join('\n');
    } else {
      performanceSummary = summary;
    }
  } catch { /* non-critical */ }

  // Save results
  exam.status             = 'graded';
  exam.objectiveScore     = objectiveScore;
  exam.theoryScore        = theoryScore;
  exam.totalScore         = totalScore;
  exam.theoryGrades       = theoryGrades;
  exam.selectedTheoryIndices = answeredTheoryIndices;
  exam.performanceSummary = performanceSummary;
  exam.recommendations    = recommendations;
  exam.submittedAt        = new Date();
  exam.gradedAt           = new Date();
  await exam.save();

  sendSuccess(res, exam);
});

// ─── User-facing AI generation ───────────────────────────────────────────────

export const generateRoadmapForUser = asyncHandler(async (req, res) => {
  const { topic, subject, difficulty } = req.body;
  if (!topic?.trim() || !subject?.trim()) {
    return res.status(400).json({ success: false, message: 'topic and subject are required.' });
  }

  if (req.user.role !== 'premium') {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const todayCount = await Roadmap.countDocuments({
      createdBy: req.user._id,
      createdAt: { $gte: dayStart },
    });
    if (todayCount >= 2) {
      return res.status(429).json({
        success: false,
        message: 'Daily limit reached (2 roadmaps/day on free plan). Upgrade to Premium for unlimited.',
      });
    }
  }

  const validDifficulties = ['beginner', 'intermediate', 'advanced'];
  const safeDifficulty = validDifficulties.includes(difficulty) ? difficulty : 'beginner';

  const raw = await generateRoadmapAI(topic.trim(), subject.trim().toLowerCase(), safeDifficulty, req.user.role);

  let parsed;
  try {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const start = cleaned.indexOf('{');
    const end   = cleaned.lastIndexOf('}');
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return res.status(502).json({ success: false, message: 'AI returned an unreadable response. Please try again.' });
  }

  const rawLessons = Array.isArray(parsed.lessons) ? parsed.lessons : [];
  const lessons = rawLessons.slice(0, 12).map((l, i) => ({
    title:            String(l.title || `Lesson ${i + 1}`).slice(0, 120),
    description:      String(l.description || '').slice(0, 800),
    estimatedMinutes: Math.max(5, Math.min(120, Number(l.estimatedMinutes) || 60)),
    difficulty:       validDifficulties.includes(l.difficulty) ? l.difficulty : safeDifficulty,
    order:            i,
    prerequisites:    [],
  }));

  const roadmap = new Roadmap({
    title:       String(parsed.title || topic).slice(0, 120),
    subject:     subject.trim().toLowerCase(),
    description: String(parsed.description || '').slice(0, 500),
    difficulty:  safeDifficulty,
    lessons,
    createdBy:   req.user._id,
    isPublished: true,
  });

  for (let i = 1; i < roadmap.lessons.length; i++) {
    roadmap.lessons[i].prerequisites = [roadmap.lessons[i - 1]._id];
  }

  await roadmap.save();

  if (req.user.role !== 'premium') {
    const dayStart2 = new Date();
    dayStart2.setHours(0, 0, 0, 0);
    const confirmedCount = await Roadmap.countDocuments({
      createdBy: req.user._id,
      createdAt: { $gte: dayStart2 },
    });
    if (confirmedCount > 2) {
      await Roadmap.deleteOne({ _id: roadmap._id });
      return res.status(429).json({
        success: false,
        message: 'Daily limit reached (2 roadmaps/day on free plan). Upgrade to Premium for unlimited.',
      });
    }
  }

  sendCreated(res, {
    _id:          roadmap._id,
    title:        roadmap.title,
    subject:      roadmap.subject,
    description:  roadmap.description,
    difficulty:   roadmap.difficulty,
    lessonCount:  roadmap.lessons.length,
    totalMinutes: roadmap.lessons.reduce((s, l) => s + l.estimatedMinutes, 0),
  }, 'Roadmap generated successfully.');
});

// ─── Admin endpoints ─────────────────────────────────────────────────────────

export const createRoadmap = asyncHandler(async (req, res) => {
  const { title, subject, description, difficulty, lessons } = req.body;
  if (!title?.trim() || !subject?.trim()) {
    return res.status(400).json({ success: false, message: 'title and subject are required.' });
  }

  const normalised = (lessons || []).map((l, i) => ({
    ...(l._id ? { _id: l._id } : {}),
    title:            l.title,
    description:      l.description || '',
    content:          l.content || '',
    estimatedMinutes: l.estimatedMinutes || 60,
    difficulty:       l.difficulty || 'beginner',
    prerequisites:    l.prerequisites || [],
    order:            l.order ?? i,
  }));

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
      _id:              l._id,
      title:            l.title,
      description:      l.description || '',
      content:          l.content || '',
      estimatedMinutes: l.estimatedMinutes || 60,
      difficulty:       l.difficulty || 'beginner',
      prerequisites:    l.prerequisites || [],
      order:            l.order ?? i,
    }));
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

export const deleteRoadmap = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  // Admins can delete any roadmap; regular users can only delete ones they created
  const query = isAdmin
    ? { _id: req.params.id }
    : { _id: req.params.id, createdBy: req.user._id };

  const roadmap = await Roadmap.findOneAndDelete(query);
  if (!roadmap) {
    return res.status(404).json({
      success: false,
      message: isAdmin
        ? 'Roadmap not found.'
        : 'Roadmap not found or you do not have permission to delete it.',
    });
  }

  await Promise.all([
    UserProgress.deleteMany({ roadmap: req.params.id }),
    RoadmapExam.deleteMany({ roadmap: req.params.id }),
  ]);
  sendSuccess(res, {}, 200, 'Roadmap deleted.');
});
