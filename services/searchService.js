const SEARCH_TIMEOUT_MS = 8000;
const SERPER_API_KEY = process.env.SERPER_API_KEY;

/**
 * Search the web using Serper (Google Search API).
 * Falls back to DuckDuckGo if Serper key is unavailable.
 */
export const searchWeb = async (query) => {
  if (SERPER_API_KEY) {
    return searchWithSerper(query);
  }
  return searchWithDuckDuckGo(query);
};

async function searchWithSerper(query) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

    const resp = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 8 }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) throw new Error(`Serper API returned ${resp.status}`);

    const data = await resp.json();
    const parts = [];

    // Answer box
    if (data.answerBox?.answer)  parts.push(data.answerBox.answer);
    if (data.answerBox?.snippet) parts.push(data.answerBox.snippet);

    // Knowledge graph
    if (data.knowledgeGraph?.description) parts.push(data.knowledgeGraph.description);

    // Organic results
    (data.organic || []).slice(0, 6).forEach(r => {
      if (r.snippet) parts.push(`${r.title}: ${r.snippet}`);
    });

    return parts.join('\n\n').trim();
  } catch (err) {
    console.warn('Serper search failed, falling back to DuckDuckGo:', err.message);
    return searchWithDuckDuckGo(query);
  }
}

async function searchWithDuckDuckGo(query) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!resp.ok) throw new Error(`DuckDuckGo returned ${resp.status}`);

    const data = await resp.json();
    const parts = [];

    if (data.AbstractText) parts.push(data.AbstractText);
    if (Array.isArray(data.RelatedTopics)) {
      data.RelatedTopics.slice(0, 6).forEach(t => {
        if (t.Text) parts.push(t.Text);
        else if (t.Topics) t.Topics.slice(0, 3).forEach(sub => { if (sub.Text) parts.push(sub.Text); });
      });
    }

    return parts.join('\n\n').trim();
  } catch {
    return '';
  }
}
