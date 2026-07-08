import AIChat from '../models/AIChat.js';
import { askSubjectTeacher, parseActionFromResponse } from '../services/aiService.js';
import { fetchKnowledge } from '../services/knowledgeService.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/responseHelper.js';

function autoTitle(branch, question) {
  const clean = question.trim().replace(/[?!.]+$/, '');
  const short  = clean.length > 45 ? clean.substring(0, 42) + '…' : clean;
  return `${branch}: ${short}`;
}

export const askSubject = asyncHandler(async (req, res) => {
  const { question, chatId, subject, branch } = req.body;

  if (!question?.trim())            return res.status(400).json({ success: false, message: 'Question is required.' });
  if (!subject?.trim() || !branch?.trim()) return res.status(400).json({ success: false, message: 'Subject and branch are required.' });

  let chat;
  if (chatId) {
    chat = await AIChat.findOne({ _id: chatId, user: req.user._id, chatType: 'subject' });
    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found.' });
  } else {
    chat = new AIChat({
      user: req.user._id, messages: [], chatType: 'subject', subject, branch,
      title: autoTitle(branch, question),
    });
  }

  chat.messages.push({ role: 'user', content: question });
  const context = chat.messages.slice(-12).map(m => ({ role: m.role, content: m.content }));

  const { snippet: knowledgeSnippet } = await fetchKnowledge(question).catch(() => ({ snippet: '' }));
  const rawAnswer = await askSubjectTeacher(question, context, subject, branch, req.user.role, knowledgeSnippet);
  const { text: answer, action } = parseActionFromResponse(rawAnswer);

  chat.messages.push({ role: 'assistant', content: answer });
  await chat.save();

  req.user.usageStats.teacherQuestionsToday += 1;
  await req.user.save();

  res.status(200).json({
    success: true,
    data: { chatId: chat._id, answer, title: chat.title, subject: chat.subject, branch: chat.branch, action: action || null },
  });
});

export const getSubjectHistory = asyncHandler(async (req, res) => {
  const chats = await AIChat.find({ user: req.user._id, chatType: 'subject' })
    .sort('-updatedAt')
    .select('_id title subject branch updatedAt messages')
    .lean();

  const summaries = chats.map(c => ({
    _id:          c._id,
    title:        c.title || 'New Chat',
    subject:      c.subject || '',
    branch:       c.branch  || '',
    updatedAt:    c.updatedAt,
    messageCount: c.messages?.length || 0,
    preview:      c.messages?.length > 0 ? c.messages[c.messages.length - 1].content.substring(0, 80) : '',
  }));

  sendSuccess(res, summaries);
});

export const getSubjectChatById = asyncHandler(async (req, res) => {
  const chat = await AIChat.findOne({ _id: req.params.id, user: req.user._id, chatType: 'subject' });
  if (!chat) return res.status(404).json({ success: false, message: 'Chat not found.' });
  sendSuccess(res, chat);
});

export const deleteSubjectChat = asyncHandler(async (req, res) => {
  const chat = await AIChat.findOneAndDelete({ _id: req.params.id, user: req.user._id, chatType: 'subject' });
  if (!chat) return res.status(404).json({ success: false, message: 'Chat not found.' });
  sendSuccess(res, {}, 200, 'Chat deleted.');
});
