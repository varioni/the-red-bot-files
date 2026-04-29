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
          // Direct database filter for the specific noun
          "filter": { "noun": tag.toLowerCase().trim() }
        } 
      })
    });

    const astraData = await astraRes.json();
    const matches = astraData?.data?.documents || [];

    res.status(200).json(matches);
  } catch (err) {
    res.status(500).json({ error: "The archive is unresponsive." });
  }
}
