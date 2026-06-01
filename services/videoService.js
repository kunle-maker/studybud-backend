import https from 'https';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';

const fetchJSON = (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse YouTube API response'));
        }
      });
    }).on('error', reject);
  });
};

export const searchEducationalVideos = async (topic, maxResults = 6) => {
  if (!topic || typeof topic !== 'string') {
    throw new Error('A search topic is required');
  }

  if (!YOUTUBE_API_KEY) {
    throw new Error('YouTube API key is not configured. Set YOUTUBE_API_KEY in your environment.');
  }

  const query = encodeURIComponent(`${topic} educational tutorial`);
  const url = `${YOUTUBE_SEARCH_URL}?part=snippet&q=${query}&type=video&videoCategoryId=27&relevanceLanguage=en&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`;

  const response = await fetchJSON(url);

  if (response.error) {
    throw new Error(`YouTube API error: ${response.error.message}`);
  }

  const videos = (response.items || []).map((item) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`
  }));

  return { topic, videos, total: videos.length };
};
