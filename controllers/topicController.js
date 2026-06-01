import AIChat from '../models/AIChat.js';
import { explainTopic, getBetterExplanation } from '../services/aiService.js';
import asyncHandler from '../utils/asyncHandler.js';

export const explainTopicHandler = asyncHandler(async (req, res) => {
  const { topic } = req.body;
  const explanation = await explainTopic(topic, req.user.role);
  
  // Create a chat record for follow-ups
  const chat = await AIChat.create({
    user: req.user._id,
    chatType: 'topic_explanation',
    messages: [
      { role: 'user', content: `Explain topic: ${topic}` },
      { role: 'assistant', content: explanation }
    ]
  });

  req.user.usageStats.topicExplanationsToday += 1;
  await req.user.save();

  res.status(200).json({ success: true, data: { chatId: chat._id, explanation } });
});

export const betterExplanation = asyncHandler(async (req, res) => {
  const { chatId, question } = req.body;
  const chat = await AIChat.findOne({ _id: chatId, user: req.user._id });
  if (!chat) throw new Error('Chat not found');

  const lastAssistant = chat.messages.filter(m => m.role === 'assistant').pop();
  const previousExplanation = lastAssistant ? lastAssistant.content : '';

  const better = await getBetterExplanation('the topic', previousExplanation, question, req.user.role);

  chat.messages.push({ role: 'user', content: question });
  chat.messages.push({ role: 'assistant', content: better });
  await chat.save();

  res.status(200).json({ success: true, data: { chatId, betterExplanation: better } });
});