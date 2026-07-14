import https from 'https';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';

// Channels/keywords known to produce entertainment rather than education
const ENTERTAINMENT_KEYWORDS = [
  'meme', 'prank', 'reaction', 'roast', 'gaming', 'minecraft', 'fortnite',
  'challenge', 'funny', 'compilation', 'vlog', 'music video', 'mv official',
  'shorts', '#shorts', 'tiktok', 'trailer', 'episode', 'season', 'movie',
  'unboxing', 'review iphone', 'mukbang', 'asmr food',
];

// Channels/keywords that indicate strong educational value
const EDUCATIONAL_KEYWORDS = [
  'lecture', 'tutorial', 'lesson', 'course', 'explain', 'how to', 'learn',
  'university', 'college', 'school', 'professor', 'teacher', 'institute',
  'academy', 'education', 'study', 'science', 'history', 'mathematics',
  'physics', 'chemistry', 'biology', 'programming', 'coding', 'engineering',
  'crash course', 'khan academy', 'mit opencourseware', 'ted-ed', 'ted ed',
  'coursera', 'edx', 'stanford', 'harvard', 'oxford', 'cambridge',
  '3blue1brown', 'vsauce', 'veritasium', 'minutephysics', 'numberphile',
];

function isEntertainmentVideo(title, channelTitle, description) {
  const text = `${title} ${channelTitle} ${description}`.toLowerCase();
  return ENTERTAINMENT_KEYWORDS.some(kw => text.includes(kw));
}

function educationalScore(title, channelTitle, description) {
  const text = `${title} ${channelTitle} ${description}`.toLowerCase();
  return EDUCATIONAL_KEYWORDS.reduce((score, kw) => score + (text.includes(kw) ? 1 : 0), 0);
}

const fetchJSON = (url) =>
  new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Failed to parse YouTube API response')); }
      });
    }).on('error', reject);
  });

export const searchEducationalVideos = async (topic, maxResults = 6) => {
  if (!topic || typeof topic !== 'string') throw new Error('A search topic is required');
  if (!YOUTUBE_API_KEY) throw new Error('YouTube API key is not configured.');

  // Fetch more than requested so we can filter and still return enough
  const fetchCount = Math.min(25, maxResults * 3);

  // Use two focused queries for educational content
  const queries = [
    `${topic} lecture tutorial educational`,
    `learn ${topic} course explanation`,
  ];

  const allVideos = [];

  for (const queryStr of queries) {
    const query = encodeURIComponent(queryStr);
    const url = `${YOUTUBE_SEARCH_URL}?part=snippet&q=${query}&type=video&videoCategoryId=27&relevanceLanguage=en&maxResults=${Math.ceil(fetchCount / 2)}&key=${YOUTUBE_API_KEY}`;

    try {
      const response = await fetchJSON(url);
      if (response.error) continue;

      const videos = (response.items || []).map(item => ({
        videoId:      item.id.videoId,
        title:        item.snippet.title,
        description:  item.snippet.description || '',
        thumbnail:    item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
        channelTitle: item.snippet.channelTitle,
        publishedAt:  item.snippet.publishedAt,
        url:          `https://www.youtube.com/watch?v=${item.id.videoId}`,
        _score:       educationalScore(item.snippet.title, item.snippet.channelTitle, item.snippet.description),
      }));

      allVideos.push(...videos);
    } catch { continue; }
  }

  // Deduplicate by videoId
  const seen = new Set();
  const unique = allVideos.filter(v => {
    if (seen.has(v.videoId)) return false;
    seen.add(v.videoId);
    return true;
  });

  // Filter out clear entertainment, sort by educational score descending
  const filtered = unique
    .filter(v => !isEntertainmentVideo(v.title, v.channelTitle, v.description))
    .sort((a, b) => b._score - a._score)
    .slice(0, maxResults)
    .map(({ _score: _s, ...v }) => v);  // strip internal score field

  // If we couldn't get enough after filtering, fall back to unfiltered
  if (filtered.length < 2 && unique.length > 0) {
    const fallback = unique.slice(0, maxResults).map(({ _score: _s, ...v }) => v);
    return { topic, videos: fallback, total: fallback.length };
  }

  return { topic, videos: filtered, total: filtered.length };
};
