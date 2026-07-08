/**
 * knowledgeService.js
 * ------------------------------------------------------------------
 * Enriches AI responses with real-world knowledge.
 *
 * Strategy:
 *  1. Classify the query: is it "general knowledge" (likely Wikipedia)?
 *     Or narrow/specific/time-sensitive (use Serper)?
 *  2. If Wikipedia: fetch /api/rest_v1/page/summary/{topic}, cache 7 days.
 *  3. If Serper: hit the Serper search API, cache 1 day.
 *  4. Return a compact knowledge snippet for the AI system prompt.
 */

import KnowledgeCache from '../models/KnowledgeCache.js';

const SERPER_API_KEY = process.env.SERPER_API_KEY || '';
const FETCH_TIMEOUT  = 6000; // ms

/* ── Helpers ──────────────────────────────────────────────────────────── */

function slugify(text) {
  return text.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/* ── Classifier ───────────────────────────────────────────────────────── */

/**
 * Returns 'wikipedia' if the query looks like a broad, well-known topic,
 * or 'serper' if it's narrow / time-sensitive / specific.
 */
function classifyQuery(query) {
  const q = query.toLowerCase();

  // Signals of narrow / specific / time-sensitive queries → Serper
  const serperSignals = [
    /\d{4}/, // year mentions
    /latest|recent|current|today|this year|2024|2025|2026/,
    /price|cost|stock|crypto|bitcoin|exchange rate/,
    /news|breaking|update|announce/,
    /how to (install|configure|deploy|set up|fix)/,
    /error|bug|crash|exception|stacktrace/,
    /specific|exact|precise/,
    /who won|score|result|match|game/,
  ];
  if (serperSignals.some(p => p.test(q))) return 'serper';

  // Signals of general knowledge → Wikipedia
  const wikiSignals = [
    /what is|what are|explain|define|describe|tell me about/,
    /how does|how do|why does|why is|when was|who is|who was/,
    /history of|origin of|meaning of|concept of|theory of/,
    /photosynthesis|mitosis|gravity|evolution|democracy|calculus/,
    /newton|einstein|darwin|shakespeare|plato|aristotle/,
    /world war|french revolution|renaissance|industrial revolution/,
  ];
  if (wikiSignals.some(p => p.test(q))) return 'wikipedia';

  // Short queries (1-3 words) are often topics → Wikipedia
  if (query.trim().split(/\s+/).length <= 3) return 'wikipedia';

  // Default
  return 'wikipedia';
}

/* ── Wikipedia fetch ──────────────────────────────────────────────────── */

async function fetchWikipedia(query) {
  // Extract the core topic for Wikipedia (strip filler words)
  const topic = query
    .replace(/^(what is|explain|define|tell me about|how does|who is|who was|describe)\s+/i, '')
    .replace(/[?!.]$/, '')
    .trim();

  // First try direct article lookup
  const encoded = encodeURIComponent(topic.replace(/\s+/g, '_'));
  try {
    const res = await fetchWithTimeout(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
      { headers: { 'User-Agent': 'StudyBud/1.0 (educational-app)' } }
    );
    if (res.ok) {
      const json = await res.json();
      if (json.extract && json.extract.length > 50) {
        return json.extract.slice(0, 1500); // cap at 1500 chars
      }
    }
  } catch { /* fall through to search */ }

  // Fallback: Wikipedia search API
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json&srlimit=1&origin=*`;
    const sr = await fetchWithTimeout(searchUrl);
    if (sr.ok) {
      const sd = await sr.json();
      const title = sd?.query?.search?.[0]?.title;
      if (title) {
        const encoded2 = encodeURIComponent(title.replace(/\s+/g, '_'));
        const res2 = await fetchWithTimeout(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded2}`,
          { headers: { 'User-Agent': 'StudyBud/1.0 (educational-app)' } }
        );
        if (res2.ok) {
          const json2 = await res2.json();
          if (json2.extract && json2.extract.length > 50) {
            return json2.extract.slice(0, 1500);
          }
        }
      }
    }
  } catch { /* ignore */ }

  return '';
}

/* ── Serper fetch ─────────────────────────────────────────────────────── */

async function fetchSerper(query) {
  if (!SERPER_API_KEY) return '';
  try {
    const res = await fetchWithTimeout('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 5 }),
    });
    if (!res.ok) return '';
    const data = await res.json();
    const parts = [];

    // Answer box / knowledge panel
    if (data.answerBox?.answer)  parts.push(data.answerBox.answer);
    if (data.answerBox?.snippet) parts.push(data.answerBox.snippet);
    if (data.knowledgeGraph?.description) parts.push(data.knowledgeGraph.description);

    // Organic snippets
    (data.organic || []).slice(0, 4).forEach(r => {
      if (r.snippet) parts.push(`${r.title}: ${r.snippet}`);
    });

    return parts.join('\n\n').slice(0, 1500);
  } catch { return ''; }
}

/* ── Main export ──────────────────────────────────────────────────────── */

/**
 * Fetch knowledge enrichment for a query.
 * Returns { snippet: string, source: 'wikipedia'|'serper'|'none' }
 * Uses DB cache; falls back to '' on any error.
 */
export async function fetchKnowledge(query) {
  if (!query?.trim()) return { snippet: '', source: 'none' };

  const source = classifyQuery(query);
  const cacheKey = `${source}:${slugify(query)}`;

  // Check cache
  try {
    const cached = await KnowledgeCache.findOne({ key: cacheKey });
    if (cached && cached.ttlExpiry > new Date()) {
      return { snippet: cached.summary, source: cached.source };
    }
    if (cached) await KnowledgeCache.deleteOne({ key: cacheKey }); // expired
  } catch { /* cache unavailable, continue */ }

  // Fetch from source
  let snippet = '';
  try {
    snippet = source === 'wikipedia'
      ? await fetchWikipedia(query)
      : await fetchSerper(query);
  } catch { snippet = ''; }

  if (!snippet) return { snippet: '', source: 'none' };

  // Cache result
  try {
    const ttlMs = source === 'wikipedia'
      ? 7 * 24 * 60 * 60 * 1000   // 7 days
      : 1 * 24 * 60 * 60 * 1000;  // 1 day
    await KnowledgeCache.findOneAndUpdate(
      { key: cacheKey },
      { key: cacheKey, summary: snippet, source, ttlExpiry: new Date(Date.now() + ttlMs) },
      { upsert: true, new: true }
    );
  } catch { /* ignore cache write failure */ }

  return { snippet, source };
}
