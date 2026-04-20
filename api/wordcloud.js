export default async function handler(req, res) {
  try {
    const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/json/v1/default_keyspace/logs`;
    const astraRes = await fetch(astraUrl, {
      method: 'POST',
      headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ "find": { "options": { "limit": 100 } } }) // Last 100 questions
    });
    const data = await astraRes.json();
    
    if (!data?.data?.documents) return res.status(200).json([]);

    // 1. Combine all questions into one big string
    const allText = data.data.documents.map(d => d.question || "").join(" ").toLowerCase();

    // 2. Filter out "Stop Words" (boring words)
    const stopWords = new Set(["the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "to", "of", "in", "for", "with", "on", "at", "by", "from", "up", "about", "into", "over", "after", "you", "your", "my", "i", "me", "how", "what", "why", "can", "do", "it"]);
    
    const words = allText.match(/\b\w+\b/g) || [];
    const counts = {};

    words.forEach(word => {
      if (word.length > 2 && !stopWords.has(word)) {
        counts[word] = (counts[word] || 0) + 1;
      }
    });

    // 3. Format for a word cloud library (array of {text, size})
    const cloudData = Object.keys(counts).map(word => ({
      text: word,
      size: 10 + (counts[word] * 5) // Base size + frequency boost
    })).sort((a, b) => b.size - a.size).slice(0, 50); // Top 50 words

    res.status(200).json(cloudData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
