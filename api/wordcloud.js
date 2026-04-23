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
    
    // Combine questions and answers for a full thematic picture
    const fullText = documents.map(doc => `${doc.question} ${doc.answer}`).join(" ").toLowerCase();
    const words = fullText.match(/\b(\w+)\b/g);

    // THEMATIC FILTER: A massive list of "non-theme" filler words to ignore
    const fillerWords = new Set([
        "just", "really", "thing", "things", "something", "anything", "nothing", 
        "maybe", "actually", "even", "also", "back", "still", "through", "because", 
        "around", "much", "very", "well", "look", "said", "take", "come", "where", 
        "there", "their", "which", "when", "been", "were", "what", "could", "should", 
        "would", "does", "then", "them", "these", "here", "being", "your", "they",
        "have", "with", "from", "that", "this", "about", "some", "into", "other"
    ]);

    const counts = {};
    if (words) {
      words.forEach(word => {
        // Only keep words longer than 3 letters that aren't in our filler list
        if (word.length > 3 && !fillerWords.has(word)) {
          counts[word] = (counts[word] || 0) + 1;
        }
      });
    }

    // Convert to the [word, weight] format required by WordCloud2
    const cloudData = Object.keys(counts)
      .map(word => [word, 15 + (counts[word] * 8)]) 
      .sort((a, b) => b[1] - a[1])
      .slice(0, 80); // Top 80 themes

    res.status(200).json(cloudData);
  } catch (err) {
    res.status(500).json({ error: "The cloud remains out of reach." });
  }
}
