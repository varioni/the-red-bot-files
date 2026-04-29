export default async function handler(req, res) {
  try {
    const astraUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/logs`;
    
    const astraRes = await fetch(astraUrl, {
      method: 'POST',
      headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        "find": { 
          "options": { "limit": 1000 } 
        } 
      })
    });

    const astraData = await astraRes.json();
    const documents = astraData?.data?.documents || [];
    const counts = {};

    documents.forEach(doc => {
      if (doc.noun) {
        const noun = doc.noun.toLowerCase().trim();
        if (noun.length > 2) {
          counts[noun] = (counts[noun] || 0) + 1;
        }
      }
    });

    const cloudData = Object.keys(counts)
      .map(word => ({
        text: word,
        size: 24 + (counts[word] * 15) 
      }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 80); 

    res.status(200).json(cloudData);
  } catch (err) {
    res.status(500).json({ error: "The cloud remains out of reach." });
  }
}
