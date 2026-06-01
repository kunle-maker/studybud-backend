import mongoose from 'mongoose';

const aiChatSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  messages: [{
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: String,
    timestamp: { type: Date, default: Date.now }
  }],
  chatType: { type: String, enum: ['teacher', 'topic_explanation'], default: 'teacher' }
}, { timestamps: true });

export default mongoose.model('AIChat', aiChatSchema);