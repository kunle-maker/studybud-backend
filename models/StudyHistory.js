import mongoose from 'mongoose';

const studyHistorySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  activityType: { 
    type: String, 
    enum: ['summary', 'teacher_question', 'topic_explanation', 'ocr', 'video_search'] 
  },
  data: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

export default mongoose.model('StudyHistory', studyHistorySchema);