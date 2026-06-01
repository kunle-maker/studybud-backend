import groqProvider from './groqProvider.js';

export const generateSummary = async (text, role) => {
  const messages = [
    {
      role: 'system',
      content: 'You are an expert academic summarizer for StudyFlow. Summarize the following text concisely, highlighting key points. Keep it under 300 words. Use clear, student-friendly language.'
    },
    { role: 'user', content: text }
  ];
  return await groqProvider.chatCompletion(role, messages, { max_tokens: 500 });
};

export const askTeacher = async (question, context = [], role) => {
  const messages = [
    {
      role: 'system',
      content: 'You are StudyFlow\'s friendly, patient AI teacher. Explain concepts clearly with simple examples. Encourage the student to ask follow-up questions. Always be supportive and positive.'
    },
    ...context,
    { role: 'user', content: question }
  ];
  return await groqProvider.chatCompletion(role, messages, { max_tokens: 800 });
};

export const explainTopic = async (topic, role) => {
  const messages = [
    {
      role: 'system',
      content: `You are StudyFlow, an educational AI assistant. Given a topic, provide a well-structured response with:
1. **Brief Overview** (2-3 sentences)
2. **Key Points** (bullet list of 4-6 items)
3. **Simple Real-World Example**
4. **Practice Questions** (2 questions with answers)
Use markdown formatting with clear headings. Keep the language clear and student-friendly.`
    },
    { role: 'user', content: `Explain the following topic: ${topic}` }
  ];
  return await groqProvider.chatCompletion(role, messages, { max_tokens: 1000, temperature: 0.5 });
};

export const getBetterExplanation = async (topic, previousExplanation, question, role) => {
  const messages = [
    {
      role: 'system',
      content: 'You are StudyFlow\'s AI teacher. Provide a clearer, more detailed explanation based on the student\'s follow-up question. Use simpler language or a different analogy if needed.'
    },
    { role: 'assistant', content: previousExplanation },
    { role: 'user', content: question }
  ];
  return await groqProvider.chatCompletion(role, messages, { max_tokens: 800 });
};

export const generateFlashcards = async (text, count = 5, role) => {
  const messages = [
    {
      role: 'system',
      content: `You are an expert study assistant for StudyFlow. From the provided text, generate exactly ${count} flashcards.
Return a valid JSON array with no markdown, no code fences — just the raw JSON.
Format: [{"question": "...", "answer": "..."}]
Make questions targeted, clear and educationally useful.`
    },
    { role: 'user', content: text }
  ];

  const raw = await groqProvider.chatCompletion(role, messages, { max_tokens: 1200, temperature: 0.4 });

  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found in response');
    return JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('Failed to parse flashcard response from AI. Please try again.');
  }
};

export const generateQuiz = async (text, questionCount = 5, role) => {
  const messages = [
    {
      role: 'system',
      content: `You are a quiz-maker for StudyFlow. From the provided text, generate a multiple-choice quiz with exactly ${questionCount} questions.
Return a valid JSON array with no markdown, no code fences — just the raw JSON.
Format: [{"question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correctAnswer": "A", "explanation": "..."}]`
    },
    { role: 'user', content: text }
  ];

  const raw = await groqProvider.chatCompletion(role, messages, { max_tokens: 2000, temperature: 0.4 });

  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found in response');
    return JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('Failed to parse quiz response from AI. Please try again.');
  }
};

export const summarizeOcrText = async (extractedText, role) => {
  const messages = [
    {
      role: 'system',
      content: 'You are StudyFlow\'s AI. The user has uploaded an image with text. Summarize this extracted text into clear, concise study notes. Fix any OCR errors where obvious.'
    },
    { role: 'user', content: extractedText }
  ];
  return await groqProvider.chatCompletion(role, messages, { max_tokens: 600 });
};
