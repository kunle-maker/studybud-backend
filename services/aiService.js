import groqProvider from './groqProvider.js';

/* ── Teaching style system prompts ──────────────────────────────────── */

const SITE_FEATURES = `
StudyBud features you can offer students:
- Summaries (/summaries): Condense notes into key points
- Flashcards (/flashcards): Create fast-memorisation cards
- Quiz (/quiz): Multiple-choice quiz to test knowledge
- Roadmaps (/roadmaps): Personalised learning path/plan
- Assignments (/assignments): Structured AI-graded assignments
- Subject Hub (/subjects): Subject-specific specialist tutors
- Topic Explainer (/topics): Deep explanations of any topic
- OCR Scanner (/ocr): Extract text from images/photos of notes
- Video Search (/videos): Find educational videos on any topic

When a student asks you to CREATE something (quiz, flashcards, summary, etc.), say you'll do it now
and include an ACTION block at the end of your reply in this exact format (no markdown around it):
ACTION:{"type":"<actionType>","params":{"subject":"...","topic":"...","material":"..."}}

Available action types: makeQuiz, makeFlashcards, makeSummary, makeRoadmap
Only include the ACTION block when the student explicitly requests you create something.
Never fabricate quizzes or flashcards inline — use the ACTION block so the app can do it properly.
`;

const TEACHING_STYLES = {
  default: `You are StudyBud's AI tutor — warm, patient, and genuinely encouraging.
You teach like a great human teacher: you notice when a student is confused and adjust your explanation, you celebrate when they get something right, and you never make them feel bad for not knowing.
You're not robotic or templated. You vary your tone, use analogies, tell short illustrative stories, and check in on understanding naturally.
When a student asks something vague, you gently probe to understand what they're struggling with before launching into an explanation.
Adapt to their level — if they use casual language, match it slightly; if they're technical, be precise.
${SITE_FEATURES}`,

  cool: `You are StudyBud's chill AI tutor. Keep it relaxed and friendly — like a smart older friend helping out. No stress, no pressure. Break things down simply, be conversational, and make learning feel easy.
${SITE_FEATURES}`,

  concise: `You are StudyBud's no-fluff AI tutor. Direct, precise, and efficient. Short answers, bullet points where they help. No lengthy intros or padding — just the key information the student needs.
${SITE_FEATURES}`,

  playful: `You are StudyBud's Gen Z AI tutor. Use relatable language — no cap, fr fr, lowkey, it's giving, slay, bussin. Keep it hype but actually educational. Make learning feel like chatting with a smart bestie. Sprinkle emojis occasionally 🎯✨.
${SITE_FEATURES}`,

  controlling: `You are StudyBud's strict AI tutor. Be direct and structured. After every explanation, ask a follow-up question to check understanding. Hold the student accountable — if they're wrong, correct them firmly but fairly.
${SITE_FEATURES}`,

  detailed: `You are StudyBud's thorough AI tutor. Cover every angle deeply: definitions, key concepts, historical context, common misconceptions, real-world applications, edge cases. Structure with clear headings. Leave nothing unexplained.
${SITE_FEATURES}`,
};

/* ── Teacher ask (non-streaming) ─────────────────────────────────────── */

export const askTeacher = async (question, context = [], role, style = 'default', knowledgeSnippet = '') => {
  const basePrompt = TEACHING_STYLES[style] || TEACHING_STYLES.default;
  const fullSystem = knowledgeSnippet
    ? `${basePrompt}\n\nHere is verified background knowledge relevant to this question — treat it as something you already know fluently, not as a citation:\n\n${knowledgeSnippet}`
    : basePrompt;

  const messages = [
    { role: 'system', content: fullSystem },
    ...context,
    { role: 'user', content: question },
  ];
  return await groqProvider.chatCompletion(role, messages, { max_tokens: 1000 });
};

/* ── Teacher ask (streaming) ─────────────────────────────────────────── */

export const streamAskTeacher = async (question, context = [], role, style = 'default', knowledgeSnippet = '') => {
  const basePrompt = TEACHING_STYLES[style] || TEACHING_STYLES.default;
  const fullSystem = knowledgeSnippet
    ? `${basePrompt}\n\nHere is verified background knowledge relevant to this question — treat it as something you already know fluently, not as a citation:\n\n${knowledgeSnippet}`
    : basePrompt;

  const messages = [
    { role: 'system', content: fullSystem },
    ...context,
    { role: 'user', content: question },
  ];
  return await groqProvider.streamChatCompletion(role, messages, { max_tokens: 1000 });
};

/* ── Subject teacher ─────────────────────────────────────────────────── */

export const askSubjectTeacher = async (question, context = [], subject, branch, role, knowledgeSnippet = '') => {
  const systemPrompt = `You are StudyBud's expert ${branch} tutor, specialising exclusively in ${branch}${subject !== branch ? ` (part of ${subject})` : ''}.

Teach like a great human teacher: patient, encouraging, and adaptive.
- Stay focused on ${branch} — don't drift to unrelated areas
- Give structured, educational responses with real-world examples
- Sense the student's level from how they write — adjust accordingly
- After explaining, briefly invite a follow-up to deepen understanding
- Use markdown for clarity (headings, bullets, code for STEM topics)
${knowledgeSnippet ? `\nHere is verified background knowledge — treat it as something you already know:\n\n${knowledgeSnippet}` : ''}
${SITE_FEATURES}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...context,
    { role: 'user', content: question },
  ];
  return await groqProvider.chatCompletion(role, messages, { max_tokens: 1000 });
};

/* ── Action detection from completed AI response ─────────────────────── */

/**
 * Parse ACTION block from AI response text.
 * Returns { text: cleanedText, action: {type, params} | null }
 */
export function parseActionFromResponse(text) {
  const actionMatch = text.match(/ACTION:\{[\s\S]*?\}(?:\n|$)/);
  if (!actionMatch) return { text, action: null };

  let action = null;
  try {
    const jsonStr = actionMatch[0].replace(/^ACTION:/, '').trim();
    action = JSON.parse(jsonStr);
  } catch { /* ignore */ }

  const cleanText = text.replace(actionMatch[0], '').trim();
  return { text: cleanText, action };
}

/* ── Smart action detection (keyword-only, no extra AI call) ─────────── */

export function detectActionsFromText(userMessage) {
  const msg = userMessage.toLowerCase();
  const actions = [];

  if (/exam|test tomorrow|revision|revise|upcoming test/.test(msg))
    actions.push('makeRevisionPlan', 'makeFlashcards', 'makePracticeTest');
  if (/explain|what is|how does|how do|teach me|help me (with|understand)|i don.t understand/.test(msg))
    actions.push('makeSummary', 'makeNotes', 'makeCheatSheet');
  if (/quiz|test me|practice question|mcq/.test(msg))
    actions.push('makeQuiz', 'makePracticeTest');
  if (/assignment|homework|task|coursework/.test(msg))
    actions.push('makeAssignment');
  if (/roadmap|learn|study plan|schedule|curriculum/.test(msg))
    actions.push('makeRoadMap', 'makeStudySchedule');
  if (/flashcard|memorize|remember|recall/.test(msg))
    actions.push('makeFlashcards');
  if (/summary|summarize|key point|overview|brief/.test(msg))
    actions.push('makeSummary', 'makeCheatSheet');

  return [...new Set(actions)].slice(0, 3);
}

/* ── Assignment generation ───────────────────────────────────────────── */

export const generateAssignmentQuestions = async (title, description, difficulty = 'medium', educationLevel = 'secondary', numQuestions = 5, role) => {
  const messages = [
    {
      role: 'system',
      content: `You are StudyBud's AI assignment generator. Create exactly ${numQuestions} high-quality exam questions.

Rules:
- Mix question types: multiple_choice, short_answer, theory, problem_solving
- Questions become progressively harder (easier first, harder last)
- Generate correct answers and grading rubrics (hidden from students until graded)
- Provide a helpful hint per question that does not give away the answer
- marks: 1–10 based on complexity

Return ONLY a JSON array — no markdown, no code fences.
Schema: [{"type":"multiple_choice","question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"correctAnswer":"A. full option","rubric":"grading criteria","marks":5,"hint":"helpful hint","order":0}]
For non-multiple_choice omit "options".`
    },
    { role: 'user', content: `Title: "${title}"\nTopic: "${description}"\nDifficulty: ${difficulty}\nLevel: ${educationLevel}\nCount: ${numQuestions}` }
  ];
  const raw = await groqProvider.chatCompletion(role, messages, { max_tokens: 3000, temperature: 0.4 });
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found');
    return JSON.parse(jsonMatch[0]);
  } catch { throw new Error('Failed to generate questions. Please try again.'); }
};

export const gradeAssignment = async (questions, answers, role) => {
  const qa = questions.map((q, i) => ({
    questionIndex: i,
    question:      q.question,
    type:          q.type,
    correctAnswer: q.correctAnswer,
    rubric:        q.rubric,
    marks:         q.marks,
    studentAnswer: answers[i] || ''
  }));
  const messages = [
    {
      role: 'system',
      content: `You are StudyBud's AI grader. Grade each student answer fairly — understand intent, not exact matching.

Return ONLY a JSON array — no markdown.
Schema: [{"questionIndex":0,"score":4,"maxScore":5,"status":"partial","feedback":"Explanation of grade","correction":"Correct answer if wrong/partial"}]
status: "correct" | "partial" | "incorrect"
score must be 0 to maxScore`
    },
    { role: 'user', content: JSON.stringify(qa) }
  ];
  const raw = await groqProvider.chatCompletion(role, messages, { max_tokens: 2500, temperature: 0.2 });
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON found');
    return JSON.parse(jsonMatch[0]);
  } catch { throw new Error('Failed to grade assignment. Please try again.'); }
};

export const generateSummary = async (text, role) => {
  const messages = [
    { role: 'system', content: 'You are an expert academic summarizer for StudyBud. Summarize the following text concisely, highlighting key points. Keep it under 300 words. Use clear, student-friendly language.' },
    { role: 'user', content: text }
  ];
  return await groqProvider.chatCompletion(role, messages, { max_tokens: 500 });
};

export const generateAssignment = async (chatContext, topic, role) => {
  const contextSummary = chatContext.length > 0
    ? `Based on a recent study session about: ${chatContext.slice(-3).map(m => m.content.substring(0, 100)).join(' | ')}`
    : '';
  const messages = [
    {
      role: 'system',
      content: `You are a study assistant creating an educational assignment. ${contextSummary}\nCreate a well-structured assignment with 3-5 varied questions covering key concepts. Include: clear instructions, mixed question types (MCQ, short answer, essay), and mark allocations.`
    },
    { role: 'user', content: `Create an assignment about: ${topic}` }
  ];
  return await groqProvider.chatCompletion(role, messages, { max_tokens: 1200 });
};

export const generatePastQuestions = async (topic, searchContext, role) => {
  const messages = [
    {
      role: 'system',
      content: `You are a study assistant specializing in past examination questions. Use any provided context to generate realistic past exam questions with varied difficulty and model answers.${searchContext ? `\n\nSearch context:\n${searchContext}` : ''}`
    },
    { role: 'user', content: `Generate past exam questions for: ${topic}` }
  ];
  return await groqProvider.chatCompletion(role, messages, { max_tokens: 1500 });
};

export const generateFlashcards = async (text, count = 10, role) => {
  const messages = [
    {
      role: 'system',
      content: `You are a flashcard creator for StudyBud. Generate exactly ${count} high-quality study flashcards.
Return a valid JSON array with no markdown — just raw JSON.
Format: [{"front":"question","back":"answer"}]`
    },
    { role: 'user', content: text }
  ];
  const raw = await groqProvider.chatCompletion(role, messages, { max_tokens: 1200, temperature: 0.4 });
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found');
    return JSON.parse(jsonMatch[0]);
  } catch { throw new Error('Failed to parse flashcard response from AI. Please try again.'); }
};

export const generateQuiz = async (text, questionCount = 5, role) => {
  const messages = [
    {
      role: 'system',
      content: `You are a quiz-maker for StudyBud. Generate a multiple-choice quiz with exactly ${questionCount} questions.
Return a valid JSON array — no markdown, no code fences.
Format: [{"question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"correctAnswer":"A. full option text","explanation":"..."}]
IMPORTANT: correctAnswer must be the FULL option string as it appears in options.`
    },
    { role: 'user', content: text }
  ];
  const raw = await groqProvider.chatCompletion(role, messages, { max_tokens: 2000, temperature: 0.4 });
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found');
    return JSON.parse(jsonMatch[0]);
  } catch { throw new Error('Failed to parse quiz response from AI. Please try again.'); }
};

export const explainTopic = async (topic, role) => {
  const messages = [
    {
      role: 'system',
      content: `You are StudyBud's expert topic explainer. Explain any topic clearly and concisely.

Structure:
1. Plain-language definition (1–2 sentences)
2. Key concepts or components (bullet points)
3. A simple real-world example or analogy
4. Why it matters / applications

Use markdown. Keep it student-friendly. Aim for 200–400 words.`
    },
    { role: 'user', content: `Explain this topic: ${topic}` }
  ];
  return await groqProvider.chatCompletion(role, messages, { max_tokens: 700 });
};

export const getBetterExplanation = async (topic, previousExplanation, question, role) => {
  const messages = [
    {
      role: 'system',
      content: `You are StudyBud's expert topic explainer. A student didn't fully understand a previous explanation and has a follow-up question. Provide a clearer, more targeted explanation using a different angle, analogy, or example. Be concise and helpful.`
    },
    {
      role: 'user',
      content: `Topic: ${topic}\n\nPrevious explanation:\n${previousExplanation}\n\nStudent's question:\n${question}`
    }
  ];
  return await groqProvider.chatCompletion(role, messages, { max_tokens: 700 });
};

export const summarizeOcrText = async (extractedText, role) => {
  const messages = [
    { role: 'system', content: "You are StudyBud's AI. The user has uploaded an image with text. Summarize this extracted text into clear, concise study notes. Fix any obvious OCR errors." },
    { role: 'user', content: extractedText }
  ];
  return await groqProvider.chatCompletion(role, messages, { max_tokens: 600 });
};

/* Legacy alias kept for compatibility */
export const detectActions = async () => [];
