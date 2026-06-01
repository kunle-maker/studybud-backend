import mongoose from 'mongoose';

const ocrUploadSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  imageUrl: String,
  extractedText: String,
  processedFor: { type: String, enum: ['summary', 'teacher', 'topic'] }
}, { timestamps: true });

export default mongoose.model('OCRUpload', ocrUploadSchema);