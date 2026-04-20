export default async function handler(req, res) {
  try {
    const astraUrl = `${process.env.ASTRA_ENDPOINT}/api/json/v1/default_keyspace/logs`;
    const astraRes = await fetch(astraUrl, {
      method: 'POST',
      headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ "find": { "options": { "limit": 200 } } }) 
    });
    const data = await astraRes.json();
    
    if (!data?.data?.documents) return res.status(200).json([]);

    const allText = data.data.documents.map(d => d.question || "").join(" ").toLowerCase();

    // 1. FILTER LISTS
    const stopWords = new Set(["the", "and", "your", "what", "how", "with", "this", "that", "there", "from", "for", "are", "was", "not", "have", "you", "but", "about", "would"]);
    const profanityFilter = /\b(fuck|shit|porn|cunt|nigger|faggot|rape|cp)\b/i;

    const words = allText.match(/\b\w+\b/g) || [];
    const counts = {};

    words.forEach(word => {
      // Logic: Allow words like "child" but block bad words and noise
      if (word.length > 3 && !stopWords.has(word) && !profanityFilter.test(word)) {
        counts[word] = (counts[word] || 0) + 1;
      }
    });

    const cloudData = Object.keys(counts).map(word => ({
      text: word,
      size: 12 + (counts[word] * 5) 
    })).sort((a, b) => b.size - a.size).slice(0, 50);

    res.status(200).json(cloudData);
  } catch (err) {
    res.status(500).json([]);
  }
}
