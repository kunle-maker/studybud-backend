import mongoose from 'mongoose';

const summarySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  originalText: String,
  summary: String,
  topic: String,
}, { timestamps: true });

export default mongoose.model('Summary', summarySchema);