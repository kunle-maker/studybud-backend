import groqProvider from './groqProvider.js';

const TEACHING_STYLES = {
  default: `You are TeachBuddy, StudyBud's friendly and patient AI teacher. Explain concepts clearly with simple, relatable examples. Be supportive, encouraging, and always invite follow-up questions.`,

  cool: `You are TeachBuddy, StudyBud's chill AI teacher. Keep it relaxed and conversational. No stress, no pressure. Break complex stuff down casually like you're explaining to a friend over coffee. Simple words, smooth flow.`,

  concise: `You are TeachBuddy, StudyBud's no-fluff AI teacher. Be direct and to the point. Short answers, bullet points where helpful. No lengthy intros or conclusions — just the key info the student needs.`,

  playful: `You are TeachBuddy, StudyBud's fun AI teacher who gets Gen Z. Use relatable language and sprinkle in terms like "no cap", "fr fr", "lowkey", "it's giving", "slay", "bussin", "understood the assignment", "that's wild", "periodt" etc. Keep it hype but still educational. Make learning feel like chatting with a smart bestie. Use emojis occasionally 🎯✨.`,

  controlling: `You are TeachBuddy, StudyBud's strict and structured AI teacher. Be direct and no-nonsense. After every explanation, ask the student a follow-up question to check their understanding. Hold them accountable. If they give a wrong answer, correct it firmly but fairly.`,

  detailed: `You are TeachBuddy, StudyBud's thorough AI teacher. Cover every angle deeply. Give in-depth explanations, multiple examples, historical context, common misconceptions, and edge cases. Leave nothing unexplained. Structure your responses with clear headings.`
};

export const askSubjectTeacher = async (question, context = [], subject, branch, role) => {
  const systemPrompt = `You are an expert ${branch} tutor on StudyBud, specialising exclusively in ${branch}${subject !== branch ? ` (part of ${subject})` : ''}.

Your job is to teach this subject clearly and thoroughly. Follow these principles:
- Stay focused on ${branch} — don't drift to unrelated areas
- Give structured, educational responses with examples where helpful
- Use real-world applications to make concepts tangible
- After explaining, briefly invite a follow-up question to deepen understanding
- Adapt complexity to the student's apparent level based on how they ask
- Format with markdown where it aids clarity (headings, bullet points, code blocks for STEM topics)`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...context,
    { role: 'user', content: question },
  ];
  return await groqProvider.chatCompletion(role, messages, { max_tokens: 1000 });
};

export const generateSummary = async (text, role) => {
  const messages = [
    {
      role: 'system',
      content: 'You are an expert academic summarizer for StudyBud. Summarize the following text concisely, highlighting key points. Keep it under 300 words. Use clear, student-friendly language.'
    },
    { role: 'user', content: text }
  ];
  return await groqProvider.chatCompletion(role, messages, { max_tokens: 500 });
};

export const askTeacher = async (question, context = [], role, style = 'default', searchContext = '') => {
  const systemPrompt = TEACHING_STYLES[style] || TEACHING_STYLES.default;

  const fullSystem = searchContext
    ? `${systemPrompt}\n\nHere is some relevant background information from a web search that may help you answer:\n\n${searchContext}\n\nUse this context to enrich your answer where relevant, but always prioritise accuracy.`
    : systemPrompt;

  const messages = [
    { role: 'system', content: fullSystem },
    ...context,
    { role: 'user', content: question }
  ];
  return await groqProvider.chatCompletion(role, messages, { max_tokens: 900 });
};

export const generateAssignment = async (chatContext, topic, role) => {
  const contextSummary = chatContext.length > 0
    ? chatContext.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n')
    : `Topic: ${topic}`;

  const messages = [
    {
      role: 'system',
      content: `You are TeachBuddy, StudyBud's AI teacher. Based on the recent conversation, generate a focused assignment for the student.

The assignment should include:
1. **Title** — a clear assignment name
2. **Objective** — what the student will practise or demonstrate
3. **Tasks** — 3 to 5 specific tasks or questions (mix of short answer, explanation, and one applied/practical task)
4. **Submission Tip** — one short tip on how to tackle it

Format clearly with markdown. Be specific to the topic discussed. Make it challenging but achievable.`
    },
    {
      role: 'user',
      content: `Based on this conversation, generate a relevant assignment:\n\n${contextSummary}`
    }
  ];
  return await groqProvider.chatCompletion(role, messages, { max_tokens: 700, temperature: 0.5 });
};

export const generatePastQuestions = async (topic, searchContext, role) => {
  const messages = [
    {
      role: 'system',
      content: `You are TeachBuddy, StudyBud's exam prep specialist. Generate realistic past exam-style questions on the given topic.

${searchContext ? `Here is relevant context from a web search:\n\n${searchContext}\n\n` : ''}

Provide:
1. **5 Short Answer Questions** with model answers
2. **3 Essay / Long Answer Questions** with outline answers
3. **Quick Tips** — 3 bullet points on what examiners look for

Format with clear markdown headings. Make the questions exam-realistic and varied in difficulty.`
    },
    {
      role: 'user',
      content: `Generate past exam questions for: ${topic}`
    }
  ];
  return await groqProvider.chatCompletion(role, messages, { max_tokens: 1200, temperature: 0.5 });
};

export const explainTopic = async (topic, role) => {
  const messages = [
    {
      role: 'system',
      content: `You are StudyBud, an educational AI assistant. Given a topic, provide a well-structured response with:
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
      content: 'You are StudyBud\'s AI teacher. Provide a clearer, more detailed explanation based on the student\'s follow-up question. Use simpler language or a different analogy if needed.'
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
      content: `You are an expert study assistant for StudyBud. From the provided text, generate exactly ${count} flashcards.
Return a valid JSON array with no markdown, no code fences — just the raw JSON.
Format: [{"front": "question text here", "back": "answer text here"}]
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
      content: `You are a quiz-maker for StudyBud. From the provided text, generate a multiple-choice quiz with exactly ${questionCount} questions.
Return a valid JSON array with no markdown, no code fences — just the raw JSON.
Format: [{"question": "...", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correctAnswer": "A. <full option text here>", "explanation": "..."}]
IMPORTANT: correctAnswer must be the FULL option string exactly as it appears in the options array (e.g. "A. Meiosis"), NOT just the letter.`
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
      content: 'You are StudyBud\'s AI. The user has uploaded an image with text. Summarize this extracted text into clear, concise study notes. Fix any OCR errors where obvious.'
    },
    { role: 'user', content: extractedText }
  ];
  return await groqProvider.chatCompletion(role, messages, { max_tokens: 600 });
};
