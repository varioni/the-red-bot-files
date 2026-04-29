export default async function handler(req, res) {
  try {
    const astraUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/logs`;
    
    const astraRes = await fetch(astraUrl, {
      method: 'POST',
      headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ "find": { "options": { "limit": 1000 } } }) // Increased limit to find more unique nouns
    });

    const astraData = await astraRes.json();
    const documents = astraData?.data?.documents || [];
    
    const counts = {};

    documents.forEach(doc => {
      if (doc.noun) {
        const noun = doc.noun.toLowerCase().trim();
        // Only count valid, single-word thematic nouns
        if (noun.length > 2) {
          counts[noun] = (counts[noun] || 0) + 1;
        }
      }
    });

    const cloudData = Object.keys(counts)
      .map(word => ({
        text: word,
        // Since we are only using nouns, we increase the growth 
        // multiplier so popular themes really stand out.
        size: 24 + (counts[word] * 15) 
      }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 60); // A tighter list makes for a more "designed" look

    res.status(200).json(cloudData);
  } catch (err) {
    res.status(500).json({ error: "The cloud remains out of reach." });
  }
}
