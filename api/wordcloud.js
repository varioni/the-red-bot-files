export default async function handler(req, res) {
  try {
    const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/json/v1/default_keyspace/archives`;
    
    // We pull up to 100 entries to ensure the cloud feels dense
    const astraRes = await fetch(astraUrl, {
      method: 'POST',
      headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        "find": { 
          "options": { "limit": 100 } 
        } 
      })
    });

    const astraData = await astraRes.json();
    const documents = astraData?.data?.documents || [];

    // Combine all text into one block
    const fullText = documents.map(doc => doc.answer || "").join(" ").toLowerCase();

    // Split into words and clean punctuation
    const words = fullText.match(/\b(\w+)\b/g);

    // Words to ignore (the usual suspects)
    const stopWords = new Set(["the", "and", "that", "this", "with", "from", "your", "they", "have", "will", "would", "there", "their", "about", "which", "when", "into", "been", "were", "what", "through", "more", "some", "only", "just", "than", "very", "also", "could", "should", "shall", "does", "then", "them", "these", "even", "more", "most"]);

    const counts = {};
    if (words) {
      words.forEach(word => {
        // Only keep words longer than 3 chars that aren't stop words
        if (word.length > 3 && !stopWords.has(word)) {
          counts[word] = (counts[word] || 0) + 1;
        }
      });
    }

    // Convert to a format the frontend likes
    // We take the top 80 words to keep performance smooth
    const cloudData = Object.keys(counts)
      .map(word => ({
        text: word,
        size: 14 + (counts[word] * 6) // Base size + frequency boost
      }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 80); 

    res.status(200).json(cloudData);

  } catch (err) {
    res.status(500).json({ error: "The cloud remains out of reach." });
  }
}
