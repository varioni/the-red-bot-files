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
    
    // Combining question and answer to get a full thematic picture
    const fullText = documents.map(doc => `${doc.question} ${doc.answer}`).join(" ").toLowerCase();
    const words = fullText.match(/\b(\w+)\b/g);

    // EXPANDED FILTER: Specifically targeting the filler words you wanted gone
    const stopWords = new Set([
        "the", "and", "that", "this", "with", "from", "your", "they", "have", "will", 
        "would", "there", "their", "which", "when", "been", "were", "what", "through", 
        "also", "could", "should", "does", "then", "them", "these", "even", "here", 
        "where", "being", "just", "really", "thing", "things", "something", "maybe", 
        "actually", "back", "still", "around", "much", "very", "well", "look", "said", 
        "way", "some", "take", "come", "about", "into", "other", "more"
    ]);

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
        // Restoring your "Buffed" size logic
        size: 22 + (counts[word] * 12) 
      }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 120);

    res.status(200).json(cloudData);
  } catch (err) {
    res.status(500).json({ error: "The cloud remains out of reach." });
  }
}
