import mongoose from 'mongoose';

const aiChatSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, default: 'New Chat' },
  teachingStyle: {
    type: String,
    enum: ['default', 'cool', 'concise', 'playful', 'controlling', 'detailed'],
    default: 'default'
  },
  messages: [{
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: String,
    timestamp: { type: Date, default: Date.now }
  }],
  chatType: { type: String, enum: ['teacher', 'topic_explanation'], default: 'teacher' }
}, { timestamps: true });

aiChatSchema.index({ user: 1, chatType: 1, updatedAt: -1 });

export default mongoose.model('AIChat', aiChatSchema);
