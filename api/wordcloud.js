export default async function handler(req, res) {
  try {
    // FIXED: Pointing to /logs instead of /archives
    const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/json/v1/default_keyspace/logs`;
    
    const astraRes = await fetch(astraUrl, {
      method: 'POST',
      headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        "find": { 
          "options": { "limit": 500 } // Increased limit to allow the cloud to grow over time
        } 
      })
    });

    const astraData = await astraRes.json();
    const documents = astraData?.data?.documents || [];

    // FIXED: Pulling from doc.question (the user's letter)
    const fullText = documents.map(doc => doc.question || "").join(" ").toLowerCase();

    // Cleaning logic
    const words = fullText.match(/\b(\w+)\b/g);

    const stopWords = new Set(["the", "and", "that", "this", "with", "from", "your", "they", "have", "will", "would", "there", "their", "about", "which", "when", "into", "been", "were", "what", "through", "more", "some", "only", "just", "than", "very", "also", "could", "should", "shall", "does", "then", "them", "these", "even", "more", "most", "here", "there", "where", "being"]);

    const counts = {};
    if (words) {
      words.forEach(word => {
        // Cleaning out the profanity the user mentioned and common noise
        if (word.length > 3 && !stopWords.has(word) && word !== "fucking") {
          counts[word] = (counts[word] || 0) + 1;
        }
      });
    }

    const cloudData = Object.keys(counts)
      .map(word => ({
        text: word,
        size: 16 + (counts[word] * 8) // Buffed the size multiplier for better "growth"
      }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 100); // Top 100 words

    res.status(200).json(cloudData);

  } catch (err) {
    res.status(500).json({ error: "The cloud remains out of reach." });
  }
}
