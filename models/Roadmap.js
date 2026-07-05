import mongoose from 'mongoose';

const lessonSchema = new mongoose.Schema({
  title:            { type: String, required: true, trim: true },
  description:      { type: String, default: '' },
  content:          { type: String, default: '' },
  estimatedMinutes: { type: Number, default: 15, min: 1 },
  difficulty:       { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
  prerequisites:    [{ type: mongoose.Schema.Types.ObjectId }],  // sibling lesson _ids
  order:            { type: Number, required: true },
}, { _id: true });

const roadmapSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  subject:     { type: String, required: true, trim: true, lowercase: true }, // slug, e.g. "mathematics"
  description: { type: String, default: '' },
  difficulty:  { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
  lessons:     [lessonSchema],
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // null = system-created
  isPublished: { type: Boolean, default: true },
}, { timestamps: true });

roadmapSchema.index({ subject: 1 });

export default mongoose.model('Roadmap', roadmapSchema);
