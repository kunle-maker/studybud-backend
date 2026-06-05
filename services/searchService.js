const SEARCH_TIMEOUT_MS = 5000;

export const searchWeb = async (query) => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    const data = await resp.json();

    const parts = [];
    if (data.AbstractText) parts.push(data.AbstractText);
    if (Array.isArray(data.RelatedTopics)) {
      data.RelatedTopics.slice(0, 6).forEach((t) => {
        if (t.Text) parts.push(t.Text);
        else if (t.Topics) {
          t.Topics.slice(0, 3).forEach((sub) => {
            if (sub.Text) parts.push(sub.Text);
          });
        }
      });
    }

    return parts.join('\n\n').trim();
  } catch {
    return '';
  }
};
