import mongoose from 'mongoose';

const knowledgeCacheSchema = new mongoose.Schema({
  key:       { type: String, required: true, unique: true, index: true }, // normalised topic slug
  summary:   { type: String, required: true },
  source:    { type: String, enum: ['wikipedia', 'serper'], default: 'wikipedia' },
  fetchedAt: { type: Date, default: Date.now },
  ttlExpiry: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }, // 7 days
}, { timestamps: true });

// Auto-expire index handled in application code (check ttlExpiry)
knowledgeCacheSchema.index({ key: 1 });

export default mongoose.model('KnowledgeCache', knowledgeCacheSchema);
