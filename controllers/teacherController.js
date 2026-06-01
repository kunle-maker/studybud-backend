import AIChat from '../models/AIChat.js';
import { askTeacher } from '../services/aiService.js';
import asyncHandler from '../utils/asyncHandler.js';

export const askQuestion = asyncHandler(async (req, res) => {
  const { question, chatId } = req.body;
  let chat;
  if (chatId) {
    chat = await AIChat.findOne({ _id: chatId, user: req.user._id });
    if (!chat) throw new Error('Chat not found');
  } else {
    chat = new AIChat({ user: req.user._id, messages: [], chatType: 'teacher' });
  }

  // Add user message
  chat.messages.push({ role: 'user', content: question });
  
  // Build context from last few messages
  const context = chat.messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
  const answer = await askTeacher(question, context, req.user.role);

  chat.messages.push({ role: 'assistant', content: answer });
  await chat.save();

  // Update usage
  req.user.usageStats.teacherQuestionsToday += 1;
  await req.user.save();

  res.status(200).json({ success: true, data: { chatId: chat._id, answer } });
});

export const getChatHistory = asyncHandler(async (req, res) => {
  const chats = await AIChat.find({ user: req.user._id, chatType: 'teacher' }).sort('-updatedAt');
  res.status(200).json({ success: true, data: chats });
});