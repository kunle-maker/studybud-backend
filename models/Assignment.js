import mongoose from 'mongoose';
import crypto from 'crypto';

const commentSchema = new mongoose.Schema({
  author:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content:    { type: String, required: true, trim: true },
  mentions:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  resolved:   { type: Boolean, default: false },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedAt: { type: Date, default: null },
}, { timestamps: true });

const activitySchema = new mongoose.Schema({
  actor:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action:    { type: String, required: true }, // 'created','updated','commented','completed','invited','joined','resolved_comment','unresolved_comment'
  detail:    { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const assignmentSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, default: '', maxlength: 5000 },
  creator:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  collaborators: [{
    user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role:     { type: String, enum: ['viewer', 'editor'], default: 'editor' },
    joinedAt: { type: Date, default: Date.now },
    _id: false,
  }],

  shareToken:   { type: String, unique: true, sparse: true },
  shareEnabled: { type: Boolean, default: false },

  status:  { type: String, enum: ['open', 'in_progress', 'completed'], default: 'open' },
  dueDate: { type: Date, default: null },

  comments: [commentSchema],
  activity: [activitySchema],
}, { timestamps: true });

assignmentSchema.index({ creator: 1, createdAt: -1 });
assignmentSchema.index({ 'collaborators.user': 1 });
assignmentSchema.index({ shareToken: 1 });

// Generate a URL-safe share token
assignmentSchema.methods.generateShareToken = function () {
  this.shareToken = crypto.randomBytes(20).toString('hex');
  this.shareEnabled = true;
  return this.shareToken;
};

export default mongoose.model('Assignment', assignmentSchema);
