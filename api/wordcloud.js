export default async function handler(req, res) {
  try {
    const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/json/v1/default_keyspace/logs`;
    
    const astraRes = await fetch(astraUrl, {
      method: 'POST',
      headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ "find": { "options": { "limit": 500 } } })
    });

    const astraData = await astraRes.json();
    const documents = astraData?.data?.documents || [];
    const fullText = documents.map(doc => doc.question || "").join(" ").toLowerCase();
    const words = fullText.match(/\b(\w+)\b/g);

    // Reduced stopword list to allow more "connective" but atmospheric words
    const stopWords = new Set(["the", "and", "that", "this", "with", "from", "your", "they", "have", "will", "would", "there", "their", "which", "when", "been", "were", "what", "through", "also", "could", "should", "does", "then", "them", "these", "even", "here", "there", "where", "being"]);

    const counts = {};
    if (words) {
      words.forEach(word => {
        if (word.length > 3 && !stopWords.has(word)) {
          counts[word] = (counts[word] || 0) + 1;
        }
      });
    }

    const cloudData = Object.keys(counts)
      .map(word => ({
        text: word,
        // BUFFED SIZE: Base size starts at 22px, and grows faster
        size: 22 + (counts[word] * 12) 
      }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 120); // Pulling more words for density

    res.status(200).json(cloudData);
  } catch (err) {
    res.status(500).json({ error: "The cloud remains out of reach." });
  }
}
