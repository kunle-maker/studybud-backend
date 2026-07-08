import AIChat from '../models/AIChat.js';
import {
  askTeacher,
  streamAskTeacher,
  generateAssignment,
  generatePastQuestions,
  parseActionFromResponse,
} from '../services/aiService.js';
import { fetchKnowledge } from '../services/knowledgeService.js';
import { searchWeb }      from '../services/searchService.js';
import asyncHandler       from '../utils/asyncHandler.js';
import { sendSuccess }    from '../utils/responseHelper.js';

const VALID_STYLES = ['default', 'cool', 'concise', 'playful', 'controlling', 'detailed'];

function autoTitle(question) {
  const clean = question.trim().replace(/[?!.]+$/, '');
  return clean.length > 60 ? clean.substring(0, 57) + '…' : clean;
}

/* ── Non-streaming ask ──────────────────────────────────────────────── */
export const askQuestion = asyncHandler(async (req, res) => {
  const { question, chatId, style, examPrepMode } = req.body;
  const isPremium = req.user.role === 'premium';
  const teachingStyle = (isPremium && VALID_STYLES.includes(style)) ? style : 'default';

  let chat;
  if (chatId) {
    chat = await AIChat.findOne({ _id: chatId, user: req.user._id });
    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });
  } else {
    chat = new AIChat({ user: req.user._id, messages: [], chatType: 'teacher', teachingStyle, title: autoTitle(question) });
  }

  chat.messages.push({ role: 'user', content: question });
  const context = chat.messages.slice(-12).map(m => ({ role: m.role, content: m.content }));

  // Knowledge enrichment + exam mode search (run in parallel)
  const [{ snippet: knowledgeSnippet }, examSearchContext] = await Promise.all([
    fetchKnowledge(question).catch(() => ({ snippet: '' })),
    (isPremium && examPrepMode)
      ? searchWeb(`${question} past exam questions`).catch(() => '')
      : Promise.resolve(''),
  ]);

  const enrichedSnippet = [knowledgeSnippet, examSearchContext].filter(Boolean).join('\n\n');
  const rawAnswer = await askTeacher(question, context, req.user.role, teachingStyle, enrichedSnippet);
  const { text: answer, action } = parseActionFromResponse(rawAnswer);

  chat.messages.push({ role: 'assistant', content: answer });
  await chat.save();

  req.user.usageStats.teacherQuestionsToday += 1;
  await req.user.save();

  res.status(200).json({
    success: true,
    data: { chatId: chat._id, answer, title: chat.title, teachingStyle: chat.teachingStyle, action: action || null },
  });
});

/* ── Streaming SSE ──────────────────────────────────────────────────── */
export const streamQuestion = asyncHandler(async (req, res) => {
  const { question, chatId, style, examPrepMode } = req.body;
  if (!question?.trim()) return res.status(400).json({ success: false, message: 'question is required' });

  const isPremium    = req.user.role === 'premium';
  const teachingStyle = (isPremium && VALID_STYLES.includes(style)) ? style : 'default';

  let chat;
  if (chatId) {
    chat = await AIChat.findOne({ _id: chatId, user: req.user._id });
    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });
  } else {
    chat = new AIChat({ user: req.user._id, messages: [], chatType: 'teacher', teachingStyle, title: autoTitle(question) });
  }

  chat.messages.push({ role: 'user', content: question });
  const context = chat.messages.slice(-12).map(m => ({ role: m.role, content: m.content }));

  // Knowledge enrichment
  const [{ snippet: knowledgeSnippet }, examSearchContext] = await Promise.all([
    fetchKnowledge(question).catch(() => ({ snippet: '' })),
    (isPremium && examPrepMode)
      ? searchWeb(`${question} past exam questions`).catch(() => '')
      : Promise.resolve(''),
  ]);
  const enrichedSnippet = [knowledgeSnippet, examSearchContext].filter(Boolean).join('\n\n');

  // SSE headers
  res.setHeader('Content-Type',    'text/event-stream');
  res.setHeader('Cache-Control',   'no-cache');
  res.setHeader('Connection',      'keep-alive');
  res.setHeader('X-Accel-Buffering','no');
  res.flushHeaders();

  // Send chat metadata first
  res.write(`data: ${JSON.stringify({ type: 'meta', chatId: chat._id.toString(), title: chat.title })}\n\n`);

  let fullContent = '';
  try {
    const stream = await streamAskTeacher(question, context, req.user.role, teachingStyle, enrichedSnippet);
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || '';
      if (token) {
        fullContent += token;
        res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
      }
    }
  } catch (err) {
    console.error('Streaming error:', err);
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'AI generation failed. Please try again.' })}\n\n`);
    res.end();
    return;
  }

  // Parse action from completed response
  const { text: cleanContent, action } = parseActionFromResponse(fullContent);

  try {
    chat.messages.push({ role: 'assistant', content: cleanContent });
    await chat.save();
    req.user.usageStats.teacherQuestionsToday += 1;
    await req.user.save();
  } catch (err) { console.error('Failed to save streaming chat:', err); }

  res.write(`data: ${JSON.stringify({ type: 'done', chatId: chat._id.toString(), action: action || null })}\n\n`);
  res.end();
});

/* ── History / CRUD ─────────────────────────────────────────────────── */
export const getChatHistory = asyncHandler(async (req, res) => {
  const chats = await AIChat.find({ user: req.user._id, chatType: 'teacher' })
    .sort('-updatedAt')
    .select('_id title teachingStyle updatedAt messages')
    .lean();

  const summaries = chats.map(c => ({
    _id:           c._id,
    title:         c.title || 'New Chat',
    teachingStyle: c.teachingStyle || 'default',
    updatedAt:     c.updatedAt,
    messageCount:  c.messages?.length || 0,
    preview:       c.messages?.length > 0 ? c.messages[c.messages.length - 1].content.substring(0, 80) : '',
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
    return res.status(403).json({ success: false, message: 'Assignments are a Premium feature.' });
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
    return res.status(403).json({ success: false, message: 'Past Questions search is a Premium feature.' });
  }
  const { topic } = req.body;
  if (!topic?.trim()) return res.status(400).json({ success: false, message: 'Please provide a topic.' });
  const searchContext = await searchWeb(`${topic} past exam questions revision`);
  const result = await generatePastQuestions(topic, searchContext, req.user.role);
  sendSuccess(res, { topic, questions: result });
});
