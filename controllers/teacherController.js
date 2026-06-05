import AIChat from '../models/AIChat.js';
import { askTeacher, generateAssignment, generatePastQuestions } from '../services/aiService.js';
import { searchWeb } from '../services/searchService.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/responseHelper.js';

const VALID_STYLES = ['default', 'cool', 'concise', 'playful', 'controlling', 'detailed'];

function autoTitle(question) {
  const clean = question.trim().replace(/[?!.]+$/, '');
  return clean.length > 60 ? clean.substring(0, 57) + '…' : clean;
}

export const askQuestion = asyncHandler(async (req, res) => {
  const { question, chatId, style, examPrepMode } = req.body;
  const isPremium = req.user.role === 'premium';

  const teachingStyle = (isPremium && VALID_STYLES.includes(style)) ? style : 'default';

  let chat;
  if (chatId) {
    chat = await AIChat.findOne({ _id: chatId, user: req.user._id });
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found' });
    }
  } else {
    chat = new AIChat({
      user: req.user._id,
      messages: [],
      chatType: 'teacher',
      teachingStyle,
      title: autoTitle(question)
    });
  }

  chat.messages.push({ role: 'user', content: question });

  const context = chat.messages.slice(-12).map(m => ({ role: m.role, content: m.content }));

  let searchContext = '';
  if (isPremium && examPrepMode) {
    searchContext = await searchWeb(`${question} past exam questions`);
  }

  const answer = await askTeacher(question, context, req.user.role, teachingStyle, searchContext);

  chat.messages.push({ role: 'assistant', content: answer });
  await chat.save();

  req.user.usageStats.teacherQuestionsToday += 1;
  await req.user.save();

  res.status(200).json({
    success: true,
    data: {
      chatId: chat._id,
      answer,
      title: chat.title,
      teachingStyle: chat.teachingStyle
    }
  });
});

export const getChatHistory = asyncHandler(async (req, res) => {
  const chats = await AIChat.find({ user: req.user._id, chatType: 'teacher' })
    .sort('-updatedAt')
    .select('_id title teachingStyle updatedAt messages')
    .lean();

  const summaries = chats.map(c => ({
    _id: c._id,
    title: c.title || 'New Chat',
    teachingStyle: c.teachingStyle || 'default',
    updatedAt: c.updatedAt,
    messageCount: c.messages?.length || 0,
    preview: c.messages?.length > 0
      ? c.messages[c.messages.length - 1].content.substring(0, 80)
      : ''
  }));

  sendSuccess(res, summaries);
});

export const getChatById = asyncHandler(async (req, res) => {
  const chat = await AIChat.findOne({ _id: req.params.id, user: req.user._id });
  if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });
  sendSuccess(res, chat);
});

export const deleteChat = asyncHandler(async (req, res) => {
  const chat = await AIChat.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });
  sendSuccess(res, {}, 200, 'Chat deleted');
});

export const createAssignment = asyncHandler(async (req, res) => {
  if (req.user.role !== 'premium') {
    return res.status(403).json({ success: false, message: 'Assignments are a Premium feature. Upgrade to unlock.' });
  }

  const { chatId, topic } = req.body;
  let context = [];

  if (chatId) {
    const chat = await AIChat.findOne({ _id: chatId, user: req.user._id });
    if (chat) context = chat.messages;
  }

  const assignment = await generateAssignment(context, topic || 'the recent topic', req.user.role);
  sendSuccess(res, { assignment });
});

export const searchPastQuestions = asyncHandler(async (req, res) => {
  if (req.user.role !== 'premium') {
    return res.status(403).json({ success: false, message: 'Past Questions search is a Premium feature. Upgrade to unlock.' });
  }

  const { topic } = req.body;
  if (!topic?.trim()) {
    return res.status(400).json({ success: false, message: 'Please provide a topic.' });
  }

  const searchContext = await searchWeb(`${topic} past exam questions revision`);
  const result = await generatePastQuestions(topic, searchContext, req.user.role);

  sendSuccess(res, { topic, questions: result });
});
