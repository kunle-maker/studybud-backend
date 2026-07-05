import Assignment from '../models/Assignment.js';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../utils/responseHelper.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Extract @mentioned usernames from comment text and resolve to user IDs. */
async function resolveMentions(content) {
  const handles = [...new Set((content.match(/@(\w+)/g) || []).map(h => h.slice(1)))];
  if (!handles.length) return [];
  const users = await User.find({ name: { $in: handles } }).select('_id').lean();
  return users.map(u => u._id);
}

/** Push an activity entry (no save — caller must save). */
function addActivity(assignment, actorId, action, detail = '') {
  assignment.activity.push({ actor: actorId, action, detail });
}

/**
 * Normalize a value that may be an ObjectId, a populated Mongoose document,
 * or a plain lean object — always returns a plain string ID.
 */
function toId(value) {
  if (!value) return '';
  // Populated lean object has _id; ObjectId has toString directly
  return (value._id ?? value).toString();
}

/** Assert that the request user is the creator or any collaborator. */
function assertAccess(assignment, userId) {
  const uid = userId.toString();
  const isCreator = toId(assignment.creator) === uid;
  const isCollab  = assignment.collaborators.some(c => toId(c.user) === uid);
  return isCreator || isCollab;
}

/** Assert that the request user is the creator. */
function assertOwner(assignment, userId) {
  return toId(assignment.creator) === userId.toString();
}

// ─── Assignment CRUD ─────────────────────────────────────────────────────────

/**
 * POST /api/v1/assignments
 * Create a new assignment.
 */
export const createAssignment = asyncHandler(async (req, res) => {
  const { title, description, dueDate } = req.body;
  if (!title?.trim()) {
    return res.status(400).json({ success: false, message: 'title is required.' });
  }

  const assignment = new Assignment({
    title:       title.trim(),
    description: description?.trim() || '',
    creator:     req.user._id,
    dueDate:     dueDate || null,
  });

  addActivity(assignment, req.user._id, 'created', `Assignment "${assignment.title}" created.`);
  await assignment.save();

  sendCreated(res, assignment, 'Assignment created.');
});

/**
 * GET /api/v1/assignments
 * List assignments the user created or is a collaborator on.
 */
export const listAssignments = asyncHandler(async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const skip  = (page - 1) * limit;

  const filter = {
    $or: [
      { creator: req.user._id },
      { 'collaborators.user': req.user._id },
    ],
  };
  if (req.query.status) filter.status = req.query.status;

  const [assignments, total] = await Promise.all([
    Assignment.find(filter)
      .sort('-updatedAt')
      .skip(skip)
      .limit(limit)
      .populate('creator', 'name profilePicture')
      .populate('collaborators.user', 'name profilePicture')
      .select('-comments -activity')
      .lean(),
    Assignment.countDocuments(filter),
  ]);

  sendSuccess(res, {
    assignments,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  });
});

/**
 * GET /api/v1/assignments/:id
 * Get a single assignment (must be creator or collaborator).
 */
export const getAssignment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id)
    .populate('creator', 'name profilePicture email')
    .populate('collaborators.user', 'name profilePicture email')
    .populate('comments.author', 'name profilePicture')
    .populate('comments.resolvedBy', 'name')
    .populate('comments.mentions', 'name')
    .populate('activity.actor', 'name profilePicture')
    .lean();

  if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found.' });

  if (!assertAccess(assignment, req.user._id)) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }

  sendSuccess(res, assignment);
});

/**
 * PATCH /api/v1/assignments/:id
 * Update title, description, dueDate, or status (creator or editor-collaborator only).
 */
export const updateAssignment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found.' });

  const uid = req.user._id.toString();
  const isCreator = toId(assignment.creator) === uid;
  const isEditor  = assignment.collaborators.some(c => toId(c.user) === uid && c.role === 'editor');

  if (!isCreator && !isEditor) {
    return res.status(403).json({ success: false, message: 'Only the creator or editors can update.' });
  }

  const { title, description, dueDate, status } = req.body;
  const changes = [];

  if (title !== undefined && title.trim()) { assignment.title = title.trim(); changes.push('title'); }
  if (description !== undefined)           { assignment.description = description.trim(); changes.push('description'); }
  if (dueDate !== undefined)               { assignment.dueDate = dueDate; changes.push('due date'); }
  if (status !== undefined)                { assignment.status = status; changes.push(`status → ${status}`); }

  if (changes.length) {
    addActivity(assignment, req.user._id, 'updated', `Updated: ${changes.join(', ')}.`);
  }

  await assignment.save();
  sendSuccess(res, assignment, 200, 'Assignment updated.');
});

/**
 * DELETE /api/v1/assignments/:id
 * Delete an assignment (creator only).
 */
export const deleteAssignment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found.' });

  if (!assertOwner(assignment, req.user._id)) {
    return res.status(403).json({ success: false, message: 'Only the creator can delete this assignment.' });
  }

  await assignment.deleteOne();
  sendSuccess(res, {}, 200, 'Assignment deleted.');
});

// ─── Sharing & Collaboration ─────────────────────────────────────────────────

/**
 * POST /api/v1/assignments/:id/share
 * Enable or refresh the share link (creator only).
 * Body: { enabled: boolean }
 */
export const manageShareLink = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found.' });

  if (!assertOwner(assignment, req.user._id)) {
    return res.status(403).json({ success: false, message: 'Only the creator can manage share settings.' });
  }

  const enable = req.body.enabled !== false; // default true

  if (enable) {
    if (!assignment.shareToken) assignment.generateShareToken();
    assignment.shareEnabled = true;
    addActivity(assignment, req.user._id, 'updated', 'Share link enabled.');
  } else {
    assignment.shareEnabled = false;
    addActivity(assignment, req.user._id, 'updated', 'Share link disabled.');
  }

  await assignment.save();
  sendSuccess(res, {
    shareEnabled: assignment.shareEnabled,
    shareToken:   assignment.shareEnabled ? assignment.shareToken : null,
  }, 200, enable ? 'Share link enabled.' : 'Share link disabled.');
});

/**
 * GET /api/v1/assignments/join/:token
 * Join an assignment via share link. Adds caller as 'editor' collaborator.
 */
export const joinViaShareLink = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findOne({
    shareToken:   req.params.token,
    shareEnabled: true,
  });

  if (!assignment) {
    return res.status(404).json({ success: false, message: 'Invalid or disabled share link.' });
  }

  const uid = req.user._id.toString();

  // Already the creator
  if (toId(assignment.creator) === uid) {
    return res.status(400).json({ success: false, message: 'You are the creator of this assignment.' });
  }

  // Already a collaborator
  const already = assignment.collaborators.some(c => toId(c.user) === uid);
  if (!already) {
    assignment.collaborators.push({ user: req.user._id, role: 'editor' });
    addActivity(assignment, req.user._id, 'joined', `${req.user.name} joined via share link.`);
    await assignment.save();
  }

  sendSuccess(res, { assignmentId: assignment._id, title: assignment.title }, 200, 'Joined assignment.');
});

/**
 * POST /api/v1/assignments/:id/invite
 * Invite a user by email (creator only).
 * Body: { email, role }  role defaults to 'editor'
 */
export const inviteCollaborator = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found.' });

  if (!assertOwner(assignment, req.user._id)) {
    return res.status(403).json({ success: false, message: 'Only the creator can invite collaborators.' });
  }

  const { email, role = 'editor' } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'email is required.' });

  const invitee = await User.findOne({ email: email.toLowerCase() }).select('_id name email');
  if (!invitee) return res.status(404).json({ success: false, message: 'No user found with that email.' });

  const uid = invitee._id.toString();

  if (toId(assignment.creator) === uid) {
    return res.status(400).json({ success: false, message: 'That user is already the creator.' });
  }

  const existing = assignment.collaborators.find(c => toId(c.user) === uid);
  if (existing) {
    // Update role if changed
    if (existing.role !== role) {
      existing.role = role;
      addActivity(assignment, req.user._id, 'invited', `${invitee.name}'s role updated to ${role}.`);
      await assignment.save();
    }
    return sendSuccess(res, { collaborator: invitee }, 200, 'Collaborator role updated.');
  }

  assignment.collaborators.push({ user: invitee._id, role });
  addActivity(assignment, req.user._id, 'invited', `${invitee.name} invited as ${role}.`);
  await assignment.save();

  sendSuccess(res, { collaborator: { id: invitee._id, name: invitee.name, email: invitee.email, role } }, 200, 'Collaborator invited.');
});

/**
 * DELETE /api/v1/assignments/:id/collaborators/:userId
 * Remove a collaborator (creator only, or self-remove).
 */
export const removeCollaborator = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found.' });

  const requesterId = req.user._id.toString();
  const targetId    = req.params.userId;
  const isSelfRemove = requesterId === targetId;

  if (!assertOwner(assignment, req.user._id) && !isSelfRemove) {
    return res.status(403).json({ success: false, message: 'Only the creator can remove collaborators.' });
  }

  const before = assignment.collaborators.length;
  assignment.collaborators = assignment.collaborators.filter(c => c.user.toString() !== targetId);

  if (assignment.collaborators.length === before) {
    return res.status(404).json({ success: false, message: 'Collaborator not found.' });
  }

  addActivity(assignment, req.user._id, 'updated', isSelfRemove ? 'Left the assignment.' : `Collaborator removed.`);
  await assignment.save();

  sendSuccess(res, {}, 200, 'Collaborator removed.');
});

// ─── Comments ────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/assignments/:id/comments
 * Add a comment. Supports @mentions by name in text.
 */
export const addComment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found.' });

  if (!assertAccess(assignment, req.user._id)) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }

  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ success: false, message: 'content is required.' });

  const mentions = await resolveMentions(content);

  assignment.comments.push({
    author:   req.user._id,
    content:  content.trim(),
    mentions,
  });

  addActivity(assignment, req.user._id, 'commented', content.trim().substring(0, 100));
  await assignment.save();

  const comment = assignment.comments[assignment.comments.length - 1];
  sendCreated(res, { comment }, 'Comment added.');
});

/**
 * PATCH /api/v1/assignments/:id/comments/:commentId/resolve
 * Toggle resolved state of a comment (creator or editor only — not viewers).
 */
export const resolveComment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found.' });

  const uid = req.user._id.toString();
  const isCreator = assignment.creator.toString() === uid;
  const isEditor  = assignment.collaborators.some(c => c.user.toString() === uid && c.role === 'editor');
  if (!isCreator && !isEditor) {
    return res.status(403).json({ success: false, message: 'Only creators and editors can resolve comments.' });
  }

  const comment = assignment.comments.id(req.params.commentId);
  if (!comment) return res.status(404).json({ success: false, message: 'Comment not found.' });

  comment.resolved   = !comment.resolved;
  comment.resolvedBy = comment.resolved ? req.user._id : null;
  comment.resolvedAt = comment.resolved ? new Date() : null;

  const action = comment.resolved ? 'resolved_comment' : 'unresolved_comment';
  addActivity(assignment, req.user._id, action, `Comment ${comment.resolved ? 'resolved' : 'unresolved'}.`);
  await assignment.save();

  sendSuccess(res, { commentId: comment._id, resolved: comment.resolved }, 200,
    comment.resolved ? 'Comment resolved.' : 'Comment unresolved.');
});

/**
 * DELETE /api/v1/assignments/:id/comments/:commentId
 * Delete own comment (or creator of assignment can delete any).
 */
export const deleteComment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found.' });

  const comment = assignment.comments.id(req.params.commentId);
  if (!comment) return res.status(404).json({ success: false, message: 'Comment not found.' });

  const uid = req.user._id.toString();
  const isCommentAuthor = comment.author.toString() === uid;
  const isAssignmentCreator = assignment.creator.toString() === uid;

  if (!isCommentAuthor && !isAssignmentCreator) {
    return res.status(403).json({ success: false, message: 'Cannot delete another user\'s comment.' });
  }

  comment.deleteOne();
  addActivity(assignment, req.user._id, 'updated', 'A comment was deleted.');
  await assignment.save();

  sendSuccess(res, {}, 200, 'Comment deleted.');
});

// ─── Activity ────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/assignments/:id/activity
 * Get paginated activity log for an assignment.
 */
export const getActivity = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id)
    .populate('activity.actor', 'name profilePicture')
    .lean();

  if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found.' });

  if (!assertAccess(assignment, req.user._id)) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }

  const page  = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const sorted = [...assignment.activity].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const total  = sorted.length;
  const items  = sorted.slice((page - 1) * limit, page * limit);

  sendSuccess(res, {
    activity: items,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  });
});
