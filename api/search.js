export default async function handler(req, res) {
  const { tag } = req.query;
  
  if (!tag) return res.status(400).json({ error: "No theme specified." });

  try {
    const astraUrl = `${process.env.ASTRA_ENDPOINT.replace(/\/$/, "")}/api/json/v1/default_keyspace/logs`;
    
    const astraRes = await fetch(astraUrl, {
      method: 'POST',
      headers: { 'Token': process.env.ASTRA_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        "find": { 
          "filter": {},
          "options": { "limit": 1000 } 
        } 
      })
    });

    const astraData = await astraRes.json();
    const documents = astraData?.data?.documents || [];
    
    // Exact match against the Curator's labeled noun
    const matches = documents.filter(doc => {
        const savedNoun = (doc.noun || "").toLowerCase().trim();
        return savedNoun === tag.toLowerCase().trim();
    }); 

    res.status(200).json(matches);
  } catch (err) {
    res.status(500).json({ error: "The archive is unresponsive." });
  }
}
